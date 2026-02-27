-- ============================================
-- Combined Migrations 010-013
-- Run this in the Supabase SQL Editor
-- ============================================

-- Migration 010: Add demographic columns to anonymous_tokens
ALTER TABLE anonymous_tokens
  ADD COLUMN IF NOT EXISTS sexe TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS date_entree DATE,
  ADD COLUMN IF NOT EXISTS fonction TEXT,
  ADD COLUMN IF NOT EXISTS lieu_travail TEXT,
  ADD COLUMN IF NOT EXISTS type_contrat TEXT,
  ADD COLUMN IF NOT EXISTS temps_travail TEXT,
  ADD COLUMN IF NOT EXISTS cost_center TEXT;

CREATE INDEX IF NOT EXISTS idx_tokens_sexe ON anonymous_tokens (sexe) WHERE sexe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_date_naissance ON anonymous_tokens (date_naissance) WHERE date_naissance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_date_entree ON anonymous_tokens (date_entree) WHERE date_entree IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_fonction ON anonymous_tokens (fonction) WHERE fonction IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_lieu_travail ON anonymous_tokens (lieu_travail) WHERE lieu_travail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_type_contrat ON anonymous_tokens (type_contrat) WHERE type_contrat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_temps_travail ON anonymous_tokens (temps_travail) WHERE temps_travail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_cost_center ON anonymous_tokens (cost_center) WHERE cost_center IS NOT NULL;

-- Migration 011: Add survey type fields to surveys
ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS survey_type TEXT NOT NULL DEFAULT 'classique'
    CHECK (survey_type IN ('classique', 'pulse')),
  ADD COLUMN IF NOT EXISTS sample_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';

-- Migration 012: Create survey_tokens junction table
CREATE TABLE IF NOT EXISTS survey_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES anonymous_tokens(id) ON DELETE CASCADE,
  selected_by TEXT NOT NULL DEFAULT 'filter' CHECK (selected_by IN ('filter', 'sample')),
  invitation_sent_at TIMESTAMPTZ,
  teams_invitation_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  teams_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(survey_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_tokens_survey_id ON survey_tokens (survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_tokens_token_id ON survey_tokens (token_id);

ALTER TABLE survey_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'survey_tokens' AND policyname = 'Admin and HR can manage survey_tokens'
  ) THEN
    CREATE POLICY "Admin and HR can manage survey_tokens"
      ON survey_tokens
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'hr_management')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'survey_tokens' AND policyname = 'Anon can validate survey_tokens'
  ) THEN
    CREATE POLICY "Anon can validate survey_tokens"
      ON survey_tokens
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Migration 013: Backfill survey_tokens for existing surveys
INSERT INTO survey_tokens (survey_id, token_id, selected_by, invitation_sent_at, teams_invitation_sent_at, reminder_sent_at, teams_reminder_sent_at)
SELECT
  s.id AS survey_id,
  at.id AS token_id,
  'filter' AS selected_by,
  at.invitation_sent_at,
  at.teams_invitation_sent_at,
  at.reminder_sent_at,
  at.teams_reminder_sent_at
FROM surveys s
JOIN anonymous_tokens at ON at.societe_id = s.societe_id AND at.active = true
WHERE s.societe_id IS NOT NULL
ON CONFLICT (survey_id, token_id) DO NOTHING;
