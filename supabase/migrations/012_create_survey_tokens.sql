-- Migration 012: Create survey_tokens junction table
CREATE TABLE survey_tokens (
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

-- Indexes for efficient lookups
CREATE INDEX idx_survey_tokens_survey_id ON survey_tokens (survey_id);
CREATE INDEX idx_survey_tokens_token_id ON survey_tokens (token_id);

-- RLS
ALTER TABLE survey_tokens ENABLE ROW LEVEL SECURITY;

-- Admin and HR can manage survey_tokens
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

-- Anon users can check if their token is in a survey (for validation)
CREATE POLICY "Anon can validate survey_tokens"
  ON survey_tokens
  FOR SELECT
  TO anon
  USING (true);
