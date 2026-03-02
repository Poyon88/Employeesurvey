export interface Tenant {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export type PlanTier = 'starter' | 'pro' | 'business' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export interface Subscription {
  id: string;
  tenant_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_tier: PlanTier;
  status: SubscriptionStatus;
  declared_employees: number;
  actual_employees: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}
