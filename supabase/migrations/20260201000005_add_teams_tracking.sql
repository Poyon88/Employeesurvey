-- Add Teams notification tracking columns to anonymous_tokens
ALTER TABLE anonymous_tokens ADD COLUMN IF NOT EXISTS teams_invitation_sent_at TIMESTAMPTZ;
ALTER TABLE anonymous_tokens ADD COLUMN IF NOT EXISTS teams_reminder_sent_at TIMESTAMPTZ;
