import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, STRIPE_PRICE_MAP } from '@/lib/stripe/config';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Reverse lookup: price_id -> plan_tier
function getPlanTierFromPriceId(priceId: string): string {
  for (const [tier, id] of Object.entries(STRIPE_PRICE_MAP)) {
    if (id === priceId) {
      return tier;
    }
  }
  return 'unknown';
}

// Helper to extract subscription period dates, handling both SDK v17+ layouts
function getSubscriptionPeriodDates(subscription: Stripe.Subscription) {
  // Try direct fields first (older SDK / some API versions)
  let currentPeriodStart = (subscription as any).current_period_start;
  let currentPeriodEnd = (subscription as any).current_period_end;

  // Fall back to items.data[0] (SDK v17+ / newer API versions)
  if (!currentPeriodStart && subscription.items?.data?.[0]) {
    const item = subscription.items.data[0];
    currentPeriodStart = (item as any).current_period_start;
    currentPeriodEnd = (item as any).current_period_end;
  }

  return {
    current_period_start: currentPeriodStart
      ? new Date(currentPeriodStart * 1000).toISOString()
      : null,
    current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
  };
}

// Helper to extract subscription ID from an invoice.
// In Stripe SDK v17+ the `subscription` field was removed from Invoice type
// in favor of `parent.subscription_details.subscription`. We handle both.
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // Try legacy direct field (cast through any for SDK v17+ compat)
  const legacySub = (invoice as any).subscription;
  if (typeof legacySub === 'string') {
    return legacySub;
  }
  if (legacySub && typeof legacySub === 'object' && legacySub.id) {
    return legacySub.id;
  }

  // Fall back to parent.subscription_details.subscription (newer API)
  const parent = (invoice as any).parent;
  if (parent?.subscription_details?.subscription) {
    return parent.subscription_details.subscription;
  }

  return null;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const stripe = getStripe();
  const supabase = createAdminClient();

  const tenantId = session.metadata?.tenant_id;
  const planTier = session.metadata?.plan_tier;

  if (!tenantId) {
    console.error('No tenant_id in session metadata');
    return;
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription)?.id;

  // Update tenant's stripe_customer_id
  if (customerId) {
    await supabase
      .from('tenants')
      .update({ stripe_customer_id: customerId })
      .eq('id', tenantId);
  }

  // Fetch full subscription to get period dates
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const periodDates = getSubscriptionPeriodDates(subscription);

    // Upsert subscription record
    await supabase.from('subscriptions').upsert(
      {
        tenant_id: tenantId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        plan_tier: planTier || 'unknown',
        status: 'active',
        current_period_start: periodDates.current_period_start,
        current_period_end: periodDates.current_period_end,
        cancel_at_period_end: false,
      },
      {
        onConflict: 'tenant_id',
      }
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createAdminClient();

  const periodDates = getSubscriptionPeriodDates(subscription);

  // Determine plan tier from the first line item's price
  let planTier = 'unknown';
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId) {
    planTier = getPlanTierFromPriceId(priceId);
  }

  await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      plan_tier: planTier,
      current_period_start: periodDates.current_period_start,
      current_period_end: periodDates.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createAdminClient();

  await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createAdminClient();

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.error('No subscription ID found on failed invoice');
    return;
  }

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = createAdminClient();

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.error('No subscription ID found on paid invoice');
    return;
  }

  await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('stripe_subscription_id', subscriptionId);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`Error handling event ${event.type}: ${err.message}`);
    // Still return 200 to prevent Stripe from retrying
    return NextResponse.json(
      { received: true, error: err.message },
      { status: 200 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
