-- =============================================
-- PulseSurvey - Initial Database Schema
-- =============================================

-- Structure organisationnelle (hiérarchie Direction > Département > Service)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direction', 'department', 'service')),
  parent_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_organizations_parent ON organizations(parent_id);
CREATE INDEX idx_organizations_type ON organizations(type);

-- Profils utilisateurs (étend auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr_management', 'manager')) DEFAULT 'manager',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'manager')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Association managers ↔ unités organisationnelles
CREATE TABLE manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(manager_id, organization_id)
);

ALTER TABLE manager_assignments ENABLE ROW LEVEL SECURITY;

-- Tokens anonymes (clé de voûte de l'anonymat)
CREATE TABLE anonymous_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  direction_id UUID REFERENCES organizations(id),
  department_id UUID REFERENCES organizations(id),
  service_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE anonymous_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_anonymous_tokens_token ON anonymous_tokens(token);

-- Groupes de vagues (suivi longitudinal)
CREATE TABLE wave_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wave_groups ENABLE ROW LEVEL SECURITY;

-- Sondages
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fr TEXT NOT NULL,
  title_en TEXT,
  description_fr TEXT,
  description_en TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'closed')) DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES profiles(id),
  wave_group_id UUID REFERENCES wave_groups(id),
  wave_number INT DEFAULT 1,
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_wave_group ON surveys(wave_group_id);

-- Questions
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'likert', 'free_text')),
  text_fr TEXT NOT NULL,
  text_en TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_questions_survey ON questions(survey_id);

-- Options de réponse (pour choix unique/multiple)
CREATE TABLE question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text_fr TEXT NOT NULL,
  text_en TEXT,
  value TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_question_options_question ON question_options(question_id);

-- Réponses (une entrée par soumission complète)
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  token_id UUID NOT NULL REFERENCES anonymous_tokens(id),
  direction_id UUID REFERENCES organizations(id),
  department_id UUID REFERENCES organizations(id),
  service_id UUID REFERENCES organizations(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(survey_id, token_id)
);

ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_responses_survey ON responses(survey_id);
CREATE INDEX idx_responses_token ON responses(token_id);
CREATE INDEX idx_responses_direction ON responses(direction_id);
CREATE INDEX idx_responses_department ON responses(department_id);
CREATE INDEX idx_responses_service ON responses(service_id);

-- Réponses individuelles (une entrée par question)
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  numeric_value INT,
  text_value TEXT,
  selected_option_ids UUID[]
);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_answers_response ON answers(response_id);
CREATE INDEX idx_answers_question ON answers(question_id);

-- =============================================
-- Helper Functions
-- =============================================

-- Fonction pour récupérer le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()));
END;
$$;

-- =============================================
-- RLS Policies
-- =============================================

-- Profiles
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

-- Organizations
CREATE POLICY "organizations_select" ON organizations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "organizations_insert_admin" ON organizations FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "organizations_update_admin" ON organizations FOR UPDATE TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "organizations_delete_admin" ON organizations FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

-- Manager Assignments
CREATE POLICY "manager_assignments_select" ON manager_assignments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "manager_assignments_insert_admin" ON manager_assignments FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "manager_assignments_update_admin" ON manager_assignments FOR UPDATE TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "manager_assignments_delete_admin" ON manager_assignments FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

-- Anonymous Tokens
CREATE POLICY "anonymous_tokens_select_admin" ON anonymous_tokens FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "anonymous_tokens_insert_admin" ON anonymous_tokens FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) = 'admin');

-- Wave Groups
CREATE POLICY "wave_groups_select" ON wave_groups FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "wave_groups_insert" ON wave_groups FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

-- Surveys
CREATE POLICY "surveys_select_admin_hr" ON surveys FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "surveys_select_published" ON surveys FOR SELECT TO authenticated
  USING (status = 'published' AND (SELECT public.get_user_role()) = 'manager');

CREATE POLICY "surveys_insert_admin_hr" ON surveys FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "surveys_update_admin_hr" ON surveys FOR UPDATE TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "surveys_delete_admin_hr" ON surveys FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

-- Questions
CREATE POLICY "questions_select" ON questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM surveys s WHERE s.id = survey_id));

CREATE POLICY "questions_insert" ON questions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "questions_update" ON questions FOR UPDATE TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "questions_delete" ON questions FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

-- Question Options
CREATE POLICY "question_options_select" ON question_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id));

CREATE POLICY "question_options_insert" ON question_options FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "question_options_update" ON question_options FOR UPDATE TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "question_options_delete" ON question_options FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management'));

-- Responses
CREATE POLICY "responses_select" ON responses FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) IN ('admin', 'hr_management', 'manager'));

-- Answers
CREATE POLICY "answers_select" ON answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM responses r WHERE r.id = response_id));

-- =============================================
-- Storage bucket pour les documents
-- =============================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', false);

CREATE POLICY "documents_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "documents_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (SELECT public.get_user_role()) IN ('admin', 'hr_management'));

CREATE POLICY "documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (SELECT public.get_user_role()) IN ('admin', 'hr_management'));
