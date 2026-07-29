-- Catch up slim remote stripe_transaction (pre-0001 columns) + analytics fields.
-- CREATE TABLE IF NOT EXISTS in 0001 is a no-op when the table already exists,
-- so tag_*/event_day were never added on production user-auth-db.
ALTER TABLE stripe_transaction ADD COLUMN tag_category TEXT;
ALTER TABLE stripe_transaction ADD COLUMN tag_stage TEXT;
ALTER TABLE stripe_transaction ADD COLUMN stage_category TEXT;
ALTER TABLE stripe_transaction ADD COLUMN event_day TEXT;
ALTER TABLE stripe_transaction ADD COLUMN amount_minor INTEGER;
ALTER TABLE stripe_transaction ADD COLUMN currency TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_event_day ON stripe_transaction(event_day);
CREATE INDEX IF NOT EXISTS idx_stripe_event_type ON stripe_transaction(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_customer ON stripe_transaction(customer_id);
