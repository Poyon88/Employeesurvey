"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminDashboardData,
  TenantWithDetails,
  TenantDetail,
  UserAcrossTenants,
  PlatformAdminLog,
} from "@/lib/types/admin";

// --- Guard ---

async function verifyPlatformAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Non authentifie");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    throw new Error("Acces refuse");
  }

  return user.id;
}

async function logAdminAction(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {}
) {
  const admin = createAdminClient();
  await admin.from("platform_admin_logs").insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

// --- Dashboard ---

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await verifyPlatformAdmin();
  const admin = createAdminClient();

  const [
    { count: totalTenants },
    { count: suspendedTenants },
    { count: totalUsers },
    { count: totalSurveys },
    { data: subscriptions },
    { data: recentLogs },
  ] = await Promise.all([
    admin.from("tenants").select("*", { count: "exact", head: true }),
    admin
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .not("suspended_at", "is", null),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("surveys").select("*", { count: "exact", head: true }),
    admin.from("subscriptions").select("plan_tier, status"),
    admin
      .from("platform_admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const tenantsByPlan: Record<string, number> = {};
  let activeTenants = 0;
  let trialingTenants = 0;

  (subscriptions || []).forEach((sub) => {
    tenantsByPlan[sub.plan_tier] = (tenantsByPlan[sub.plan_tier] || 0) + 1;
    if (sub.status === "active") activeTenants++;
    if (sub.status === "trialing") trialingTenants++;
  });

  return {
    totalTenants: totalTenants || 0,
    activeTenants,
    suspendedTenants: suspendedTenants || 0,
    trialingTenants,
    totalUsers: totalUsers || 0,
    totalSurveys: totalSurveys || 0,
    recentLogs: (recentLogs as PlatformAdminLog[]) || [],
    tenantsByPlan,
  };
}

// --- Tenants ---

export async function getTenantsWithDetails(
  search?: string,
  statusFilter?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ tenants: TenantWithDetails[]; total: number }> {
  await verifyPlatformAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("tenants")
    .select("id, name, slug, created_at, suspended_at", { count: "exact" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  if (statusFilter === "suspended") {
    query = query.not("suspended_at", "is", null);
  } else if (statusFilter === "active") {
    query = query.is("suspended_at", null);
  }

  const from = (page - 1) * pageSize;
  query = query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data: tenants, count } = await query;

  if (!tenants) return { tenants: [], total: 0 };

  const tenantIds = tenants.map((t) => t.id);

  const [{ data: subs }, { data: members }, { data: surveys }] = await Promise.all([
    admin.from("subscriptions").select("tenant_id, plan_tier, status, trial_ends_at, declared_employees").in("tenant_id", tenantIds),
    admin.from("tenant_members").select("tenant_id"),
    admin.from("surveys").select("tenant_id"),
  ]);

  const memberCounts: Record<string, number> = {};
  (members || []).forEach((m) => {
    if (tenantIds.includes(m.tenant_id)) {
      memberCounts[m.tenant_id] = (memberCounts[m.tenant_id] || 0) + 1;
    }
  });

  const surveyCounts: Record<string, number> = {};
  (surveys || []).forEach((s) => {
    if (tenantIds.includes(s.tenant_id)) {
      surveyCounts[s.tenant_id] = (surveyCounts[s.tenant_id] || 0) + 1;
    }
  });

  const subsMap: Record<string, TenantWithDetails["subscription"]> = {};
  (subs || []).forEach((s) => {
    subsMap[s.tenant_id] = {
      plan_tier: s.plan_tier,
      status: s.status,
      trial_ends_at: s.trial_ends_at,
      declared_employees: s.declared_employees,
    };
  });

  const result: TenantWithDetails[] = tenants.map((t) => ({
    ...t,
    subscription: subsMap[t.id] || null,
    memberCount: memberCounts[t.id] || 0,
    surveyCount: surveyCounts[t.id] || 0,
  }));

  return { tenants: result, total: count || 0 };
}

export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  const adminUserId = await verifyPlatformAdmin();
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (!tenant) return null;

  const [{ data: sub }, { data: members }, { data: surveys }, { data: orgs }] =
    await Promise.all([
      admin
        .from("subscriptions")
        .select("id, plan_tier, status, trial_ends_at, declared_employees, actual_employees, current_period_start, current_period_end")
        .eq("tenant_id", tenantId)
        .single(),
      admin
        .from("tenant_members")
        .select("id, user_id, role, joined_at")
        .eq("tenant_id", tenantId),
      admin
        .from("surveys")
        .select("id, title_fr, status, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      admin
        .from("organizations")
        .select("id, name, type, parent_id")
        .eq("tenant_id", tenantId),
    ]);

  // Fetch profiles for members
  const userIds = (members || []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };

  const profileMap: Record<string, { email: string; full_name: string | null }> = {};
  (profiles || []).forEach((p) => {
    profileMap[p.id] = { email: p.email, full_name: p.full_name };
  });

  await logAdminAction(adminUserId, "view_tenant", "tenant", tenantId, {
    tenant_name: tenant.name,
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    stripe_customer_id: tenant.stripe_customer_id,
    created_at: tenant.created_at,
    suspended_at: tenant.suspended_at,
    subscription: sub || null,
    members: (members || []).map((m) => ({
      ...m,
      profile: profileMap[m.user_id] || { email: "inconnu", full_name: null },
    })),
    surveys: surveys || [],
    organizations: orgs || [],
  };
}

// --- Tenant Actions ---

export async function suspendTenant(tenantId: string): Promise<{ error?: string }> {
  const adminUserId = await verifyPlatformAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("tenants")
    .update({ suspended_at: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  await logAdminAction(adminUserId, "suspend_tenant", "tenant", tenantId);
  return {};
}

export async function reactivateTenant(tenantId: string): Promise<{ error?: string }> {
  const adminUserId = await verifyPlatformAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("tenants")
    .update({ suspended_at: null })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  await logAdminAction(adminUserId, "reactivate_tenant", "tenant", tenantId);
  return {};
}

export async function deleteTenant(tenantId: string): Promise<{ error?: string }> {
  const adminUserId = await verifyPlatformAdmin();
  const admin = createAdminClient();

  // Get tenant name for log
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  // Delete in dependency order
  // 1. Answers (via responses)
  const { data: surveyIds } = await admin
    .from("surveys")
    .select("id")
    .eq("tenant_id", tenantId);

  if (surveyIds?.length) {
    const sIds = surveyIds.map((s) => s.id);

    const { data: responseIds } = await admin
      .from("responses")
      .select("id")
      .in("survey_id", sIds);

    if (responseIds?.length) {
      await admin
        .from("answers")
        .delete()
        .in("response_id", responseIds.map((r) => r.id));
    }

    await admin.from("responses").delete().in("survey_id", sIds);

    // Delete question_options and questions
    const { data: questionIds } = await admin
      .from("questions")
      .select("id")
      .in("survey_id", sIds);

    if (questionIds?.length) {
      await admin
        .from("question_options")
        .delete()
        .in("question_id", questionIds.map((q) => q.id));
    }

    await admin.from("questions").delete().in("survey_id", sIds);
    await admin.from("surveys").delete().eq("tenant_id", tenantId);
  }

  // 2. Anonymous tokens
  await admin.from("anonymous_tokens").delete().eq("tenant_id", tenantId);

  // 3. Organizations
  await admin.from("organizations").delete().eq("tenant_id", tenantId);

  // 4. Invitations
  await admin.from("tenant_invitations").delete().eq("tenant_id", tenantId);

  // 5. Subscriptions
  await admin.from("subscriptions").delete().eq("tenant_id", tenantId);

  // 6. Members
  await admin.from("tenant_members").delete().eq("tenant_id", tenantId);

  // 7. Tenant itself
  const { error } = await admin.from("tenants").delete().eq("id", tenantId);

  if (error) return { error: error.message };

  await logAdminAction(adminUserId, "delete_tenant", "tenant", tenantId, {
    tenant_name: tenant?.name,
  });

  return {};
}

export async function deleteSurveyAsAdmin(surveyId: string): Promise<{ error?: string }> {
  const adminUserId = await verifyPlatformAdmin();
  const admin = createAdminClient();

  // Get survey info for log
  const { data: survey } = await admin
    .from("surveys")
    .select("title_fr, tenant_id")
    .eq("id", surveyId)
    .single();

  // Delete answers
  const { data: responseIds } = await admin
    .from("responses")
    .select("id")
    .eq("survey_id", surveyId);

  if (responseIds?.length) {
    await admin
      .from("answers")
      .delete()
      .in("response_id", responseIds.map((r) => r.id));
  }

  await admin.from("responses").delete().eq("survey_id", surveyId);

  // Delete question_options and questions
  const { data: questionIds } = await admin
    .from("questions")
    .select("id")
    .eq("survey_id", surveyId);

  if (questionIds?.length) {
    await admin
      .from("question_options")
      .delete()
      .in("question_id", questionIds.map((q) => q.id));
  }

  await admin.from("questions").delete().eq("survey_id", surveyId);

  const { error } = await admin.from("surveys").delete().eq("id", surveyId);

  if (error) return { error: error.message };

  await logAdminAction(adminUserId, "delete_survey", "survey", surveyId, {
    title: survey?.title_fr,
    tenant_id: survey?.tenant_id,
  });

  return {};
}

export async function deleteOrganizationAsAdmin(orgId: string): Promise<{ error?: string }> {
  const adminUserId = await verifyPlatformAdmin();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("name, tenant_id")
    .eq("id", orgId)
    .single();

  // Detach children first
  await admin
    .from("organizations")
    .update({ parent_id: null })
    .eq("parent_id", orgId);

  const { error } = await admin.from("organizations").delete().eq("id", orgId);

  if (error) return { error: error.message };

  await logAdminAction(adminUserId, "delete_organization", "organization", orgId, {
    name: org?.name,
    tenant_id: org?.tenant_id,
  });

  return {};
}

// --- Users ---

export async function searchUsersAcrossTenants(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ users: UserAcrossTenants[]; total: number }> {
  await verifyPlatformAdmin();
  const admin = createAdminClient();

  if (!query || query.length < 2) return { users: [], total: 0 };

  const from = (page - 1) * pageSize;

  const { data: profiles, count } = await admin
    .from("profiles")
    .select("id, email, full_name, is_platform_admin, tenant_id", { count: "exact" })
    .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
    .range(from, from + pageSize - 1)
    .order("email");

  if (!profiles) return { users: [], total: 0 };

  // Get tenant info + membership role
  const tenantIds = [...new Set(profiles.map((p) => p.tenant_id).filter(Boolean))] as string[];
  const userIds = profiles.map((p) => p.id);

  const [{ data: tenants }, { data: memberships }] = await Promise.all([
    tenantIds.length
      ? admin.from("tenants").select("id, name").in("id", tenantIds)
      : { data: [] },
    admin.from("tenant_members").select("user_id, role, joined_at").in("user_id", userIds),
  ]);

  const tenantMap: Record<string, string> = {};
  (tenants || []).forEach((t) => (tenantMap[t.id] = t.name));

  const memberMap: Record<string, { role: string; joined_at: string }> = {};
  (memberships || []).forEach((m) => {
    memberMap[m.user_id] = { role: m.role, joined_at: m.joined_at };
  });

  const users: UserAcrossTenants[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    is_platform_admin: p.is_platform_admin,
    tenant_id: p.tenant_id,
    tenant_name: p.tenant_id ? tenantMap[p.tenant_id] || null : null,
    role: memberMap[p.id]?.role || null,
    joined_at: memberMap[p.id]?.joined_at || null,
  }));

  return { users, total: count || 0 };
}

// --- Logs ---

export async function getAdminActivityLogs(
  page: number = 1,
  pageSize: number = 50
): Promise<{ logs: PlatformAdminLog[]; total: number }> {
  await verifyPlatformAdmin();
  const admin = createAdminClient();

  const from = (page - 1) * pageSize;

  const { data, count } = await admin
    .from("platform_admin_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  return { logs: (data as PlatformAdminLog[]) || [], total: count || 0 };
}
