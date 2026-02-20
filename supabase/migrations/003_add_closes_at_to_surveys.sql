-- Add planned closing date to surveys
ALTER TABLE surveys ADD COLUMN closes_at TIMESTAMPTZ;
