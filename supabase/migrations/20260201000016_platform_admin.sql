-- Platform Admin: super-admin console support
-- Adds is_platform_admin flag, tenant suspension, and audit logging

-- 1. Platform admin flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Tenant suspension timestamp
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 3. Platform admin audit log table
CREATE TABLE IF NOT EXISTS platform_admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying logs
CREATE INDEX IF NOT EXISTS idx_platform_admin_logs_created_at ON platform_admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_logs_admin_user ON platform_admin_logs(admin_user_id);

-- RLS: only service role can access platform_admin_logs (no user access)
ALTER TABLE platform_admin_logs ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service role (admin client) can read/write

-- SEED: Mark your profile as platform admin (update the email below)
-- UPDATE profiles SET is_platform_admin = true WHERE email = 'YOUR_EMAIL_HERE';
