-- ============================================
-- Multi-tenancy migration for PulseSurvey
-- ============================================

-- 1. Tenants table (billing entity, distinct from existing organizations table)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tenant members
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- 3. Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'pro', 'business', 'enterprise')) DEFAULT 'starter',
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')) DEFAULT 'trialing',
  declared_employees INT NOT NULL DEFAULT 0,
  actual_employees INT NOT NULL DEFAULT 0,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tenant invitations
CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- 5. Add tenant_id to existing tables
ALTER TABLE organizations ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE surveys ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE anonymous_tokens ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 6. Indexes for performance
CREATE INDEX idx_tenant_members_user_id ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX idx_organizations_tenant_id ON organizations(tenant_id);
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_surveys_tenant_id ON surveys(tenant_id);
CREATE INDEX idx_anonymous_tokens_tenant_id ON anonymous_tokens(tenant_id);
CREATE INDEX idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(token);

-- 7. Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 8. Enable RLS on new tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for tenants
CREATE POLICY "Members can view their tenant"
  ON tenants FOR SELECT
  USING (id = get_user_tenant_id());

CREATE POLICY "Owners can update their tenant"
  ON tenants FOR UPDATE
  USING (id = get_user_tenant_id())
  WITH CHECK (id = get_user_tenant_id());

-- 10. RLS policies for tenant_members
CREATE POLICY "Members can view tenant members"
  ON tenant_members FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Owners can insert tenant members"
  ON tenant_members FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

CREATE POLICY "Owners can delete tenant members"
  ON tenant_members FOR DELETE
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- 11. RLS policies for subscriptions (writes via service role only)
CREATE POLICY "Members can view subscription"
  ON subscriptions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- 12. RLS policies for tenant_invitations
CREATE POLICY "Members can view invitations"
  ON tenant_invitations FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Owners can create invitations"
  ON tenant_invitations FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_invitations.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

CREATE POLICY "Owners can delete invitations"
  ON tenant_invitations FOR DELETE
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_invitations.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- 13. RLS policies for existing data tables (tenant isolation)
-- Organizations
CREATE POLICY "Tenant isolation" ON organizations
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Profiles
CREATE POLICY "Tenant isolation" ON profiles
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Surveys
CREATE POLICY "Tenant isolation" ON surveys
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Anonymous tokens
CREATE POLICY "Tenant isolation" ON anonymous_tokens
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- 14. Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
