-- Migration 013: Backfill survey_tokens for existing surveys
-- For each existing survey, insert all active tokens that match the survey's societe_id
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
