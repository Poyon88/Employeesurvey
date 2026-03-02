"use server";

import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/stripe/actions";
import { PRICING_TIERS } from "@/lib/constants";
import type { Tenant, Subscription, TenantMember } from "@/lib/types/database";

export interface SubscriptionData {
  tenant: Tenant;
  subscription: Subscription;
  membership: TenantMember;
  planName: string;
  maxEmployees: number;
}

export async function getSubscriptionData(): Promise<{
  data?: SubscriptionData;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    // Get tenant membership
    const { data: membership, error: memberError } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return { error: "Aucune organisation trouvee." };
    }

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", membership.tenant_id)
      .single();

    if (tenantError || !tenant) {
      return { error: "Organisation introuvable." };
    }

    // Fetch subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .single();

    if (subError || !subscription) {
      return { error: "Aucun abonnement trouve." };
    }

    const tier = PRICING_TIERS[subscription.plan_tier as keyof typeof PRICING_TIERS];
    const planName = tier?.name ?? subscription.plan_tier;
    const maxEmployees = tier?.max ?? 0;

    return {
      data: {
        tenant,
        subscription,
        membership,
        planName,
        maxEmployees,
      },
    };
  } catch (error) {
    console.error("getSubscriptionData error:", error);
    return { error: "Une erreur est survenue." };
  }
}

export async function handleCheckout(planTier: string): Promise<{
  url?: string | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { error: "Aucune organisation trouvee." };
    }

    const result = await createCheckoutSession(membership.tenant_id, planTier);
    return { url: result.url };
  } catch (error) {
    console.error("handleCheckout error:", error);
    return { error: "Erreur lors de la creation de la session de paiement." };
  }
}

export async function handleBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Utilisateur non authentifie." };
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { error: "Aucune organisation trouvee." };
    }

    const result = await createBillingPortalSession(membership.tenant_id);
    return { url: result.url };
  } catch (error) {
    console.error("handleBillingPortal error:", error);
    return { error: "Erreur lors de l'ouverture du portail de facturation." };
  }
}
