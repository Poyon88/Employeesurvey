import type { PlanTier, SubscriptionStatus } from "./database";

export interface PlatformAdminLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminDashboardData {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialingTenants: number;
  totalUsers: number;
  totalSurveys: number;
  recentLogs: PlatformAdminLog[];
  tenantsByPlan: Record<string, number>;
}

export interface TenantWithDetails {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  suspended_at: string | null;
  subscription: {
    plan_tier: PlanTier;
    status: SubscriptionStatus;
    trial_ends_at: string | null;
    declared_employees: number;
  } | null;
  memberCount: number;
  surveyCount: number;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  created_at: string;
  suspended_at: string | null;
  subscription: {
    id: string;
    plan_tier: PlanTier;
    status: SubscriptionStatus;
    trial_ends_at: string | null;
    declared_employees: number;
    actual_employees: number;
    current_period_start: string | null;
    current_period_end: string | null;
  } | null;
  members: {
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    profile: {
      email: string;
      full_name: string | null;
    };
  }[];
  surveys: {
    id: string;
    title_fr: string;
    status: string;
    created_at: string;
  }[];
  organizations: {
    id: string;
    name: string;
    type: string;
    parent_id: string | null;
  }[];
}

export interface UserAcrossTenants {
  id: string;
  email: string;
  full_name: string | null;
  is_platform_admin: boolean;
  tenant_id: string | null;
  tenant_name: string | null;
  role: string | null;
  joined_at: string | null;
}
