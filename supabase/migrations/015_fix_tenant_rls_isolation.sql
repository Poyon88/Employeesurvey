-- ============================================
-- Fix tenant isolation: drop old non-tenant-aware
-- policies and replace with tenant-scoped ones
-- ============================================

-- =============================================
-- 1. Drop old policies that don't check tenant_id
-- =============================================

-- Surveys (old role-based policies)
DROP POLICY IF EXISTS "surveys_select_admin_hr" ON surveys;
DROP POLICY IF EXISTS "surveys_select_published" ON surveys;
DROP POLICY IF EXISTS "surveys_insert_admin_hr" ON surveys;
DROP POLICY IF EXISTS "surveys_update_admin_hr" ON surveys;
DROP POLICY IF EXISTS "surveys_delete_admin_hr" ON surveys;
-- Drop the tenant isolation policy from 014 too, we'll recreate it properly
DROP POLICY IF EXISTS "Tenant isolation" ON surveys;

-- Organizations (old role-based policies)
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_admin" ON organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_admin" ON organizations;
DROP POLICY IF EXISTS "Tenant isolation" ON organizations;

-- Anonymous tokens
DROP POLICY IF EXISTS "anonymous_tokens_select_admin" ON anonymous_tokens;
DROP POLICY IF EXISTS "anonymous_tokens_insert_admin" ON anonymous_tokens;
DROP POLICY IF EXISTS "Tenant isolation" ON anonymous_tokens;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
DROP POLICY IF EXISTS "Tenant isolation" ON profiles;

-- Questions (cascade from surveys)
DROP POLICY IF EXISTS "questions_select" ON questions;
DROP POLICY IF EXISTS "questions_insert" ON questions;
DROP POLICY IF EXISTS "questions_update" ON questions;
DROP POLICY IF EXISTS "questions_delete" ON questions;

-- Question options (cascade from questions)
DROP POLICY IF EXISTS "question_options_select" ON question_options;
DROP POLICY IF EXISTS "question_options_insert" ON question_options;
DROP POLICY IF EXISTS "question_options_update" ON question_options;
DROP POLICY IF EXISTS "question_options_delete" ON question_options;

-- Responses
DROP POLICY IF EXISTS "responses_select" ON responses;

-- Answers
DROP POLICY IF EXISTS "answers_select" ON answers;

-- Survey tokens
DROP POLICY IF EXISTS "Admin and HR can manage survey_tokens" ON survey_tokens;

-- =============================================
-- 2. Recreate policies with tenant isolation
-- =============================================

-- Surveys: tenant members can do everything
CREATE POLICY "tenant_surveys_select" ON surveys FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_surveys_insert" ON surveys FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_surveys_update" ON surveys FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_surveys_delete" ON surveys FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Organizations: tenant members can do everything
CREATE POLICY "tenant_organizations_select" ON organizations FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_organizations_insert" ON organizations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_organizations_update" ON organizations FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_organizations_delete" ON organizations FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Anonymous tokens: tenant members can do everything
CREATE POLICY "tenant_anonymous_tokens_select" ON anonymous_tokens FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_anonymous_tokens_insert" ON anonymous_tokens FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_anonymous_tokens_update" ON anonymous_tokens FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_anonymous_tokens_delete" ON anonymous_tokens FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Profiles: own profile OR same tenant
CREATE POLICY "tenant_profiles_select" ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "tenant_profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "tenant_profiles_delete" ON profiles FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Questions: via survey tenant
CREATE POLICY "tenant_questions_select" ON questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_id AND s.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "tenant_questions_insert" ON questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_id AND s.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "tenant_questions_update" ON questions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_id AND s.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "tenant_questions_delete" ON questions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_id AND s.tenant_id = get_user_tenant_id()
  ));

-- Question options: via question → survey tenant
CREATE POLICY "tenant_question_options_select" ON question_options FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM questions q
    JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = question_id AND s.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "tenant_question_options_insert" ON question_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM questions q
    JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = question_id AND s.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "tenant_question_options_update" ON question_options FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM questions q
    JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = question_id AND s.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "tenant_question_options_delete" ON question_options FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM questions q
    JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = question_id AND s.tenant_id = get_user_tenant_id()
  ));

-- Responses: via survey tenant
CREATE POLICY "tenant_responses_select" ON responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_id AND s.tenant_id = get_user_tenant_id()
  ));

-- Answers: via response → survey tenant
CREATE POLICY "tenant_answers_select" ON answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM responses r
    JOIN surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.tenant_id = get_user_tenant_id()
  ));

-- Survey tokens: via survey tenant
DROP POLICY IF EXISTS "Anon can validate survey_tokens" ON survey_tokens;

CREATE POLICY "tenant_survey_tokens_all" ON survey_tokens FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_id AND s.tenant_id = get_user_tenant_id()
  ));

-- Re-create anon policy for survey token validation (public respondents)
CREATE POLICY "anon_validate_survey_tokens" ON survey_tokens FOR SELECT TO anon
  USING (true);

-- =============================================
-- 3. Backfill: assign all orphan data to the
--    first tenant (earliest created)
-- =============================================
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    UPDATE organizations SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE profiles SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE surveys SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE anonymous_tokens SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  END IF;
END;
$$;

-- =============================================
-- 4. Add default tenant_id on tables so app code
--    doesn't need to pass it explicitly on insert
-- =============================================
ALTER TABLE surveys ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE organizations ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE anonymous_tokens ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
