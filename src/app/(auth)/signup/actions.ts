"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { getStripe } from "@/lib/stripe/config";
import { TRIAL_DURATION_DAYS, type PlanTierKey } from "@/lib/constants";

interface CompleteSignupInput {
  companyName: string;
  planTier: PlanTierKey;
  declaredEmployees: number;
}

export async function completeSignup({
  companyName,
  planTier,
  declaredEmployees,
}: CompleteSignupInput): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifié. Veuillez vous reconnecter." };
    }

    // Use admin client to bypass RLS (user has no tenant yet)
    const admin = createAdminClient();

    // 2. Check if user already has a tenant (idempotency)
    const { data: existingMember } = await admin
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existingMember) {
      // Already set up — just redirect
      return { success: true };
    }

    // 3. Generate unique slug
    let slug = slugify(companyName);
    const { data: slugExists } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .single();
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // 4. Create tenant
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: companyName,
        slug,
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      return {
        error: `Erreur lors de la création de l'entreprise : ${tenantError?.message || "Erreur inconnue"}`,
      };
    }

    // 4. Create tenant_member
    const { error: memberError } = await admin
      .from("tenant_members")
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      return {
        error: `Erreur lors de la création du membre : ${memberError.message}`,
      };
    }

    // 5. Create subscription
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    const { error: subError } = await admin.from("subscriptions").insert({
      tenant_id: tenant.id,
      plan_tier: planTier,
      status: "trialing",
      declared_employees: declaredEmployees,
      trial_ends_at: trialEndsAt.toISOString(),
    });

    if (subError) {
      return {
        error: `Erreur lors de la création de l'abonnement : ${subError.message}`,
      };
    }

    // 6. Create Stripe customer (non-blocking)
    try {
      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: user.email,
        name: companyName,
        metadata: {
          tenant_id: tenant.id,
        },
      });

      // 7. Update tenant with stripe_customer_id
      await admin
        .from("tenants")
        .update({ stripe_customer_id: customer.id })
        .eq("id", tenant.id);
    } catch {
      // Stripe failure should not block signup
      console.error("Stripe customer creation failed, will retry later");
    }

    return { success: true };
  } catch (err) {
    console.error("completeSignup error:", err);
    return { error: "Une erreur inattendue est survenue. Veuillez réessayer." };
  }
}
