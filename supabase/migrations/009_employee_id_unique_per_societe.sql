-- Replace global unique index on employee_id with a composite unique index per société
DROP INDEX IF EXISTS idx_anonymous_tokens_employee_id;

CREATE UNIQUE INDEX idx_anonymous_tokens_employee_per_societe
  ON anonymous_tokens(societe_id, employee_id) WHERE employee_id IS NOT NULL;
