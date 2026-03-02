'use server';

import { getStripe, STRIPE_PRICE_MAP } from '@/lib/stripe/config';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createCheckoutSession(tenantId: string, planTier: string) {
  const stripe = getStripe();
  const supabase = createAdminClient();

  // Fetch tenant's stripe_customer_id
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`Failed to fetch tenant: ${error?.message || 'Not found'}`);
  }

  const priceId = STRIPE_PRICE_MAP[planTier];
  if (!priceId) {
    throw new Error(`Invalid plan tier: ${planTier}`);
  }

  const sessionParams: Record<string, any> = {
    mode: 'subscription' as const,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    metadata: {
      tenant_id: tenantId,
      plan_tier: planTier,
    },
  };

  // Attach existing Stripe customer if available
  if (tenant.stripe_customer_id) {
    sessionParams.customer = tenant.stripe_customer_id;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return { url: session.url };
}

export async function createBillingPortalSession(tenantId: string) {
  const stripe = getStripe();
  const supabase = createAdminClient();

  // Fetch tenant's stripe_customer_id
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`Failed to fetch tenant: ${error?.message || 'Not found'}`);
  }

  if (!tenant.stripe_customer_id) {
    throw new Error('Tenant does not have a Stripe customer ID');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  return { url: session.url };
}
