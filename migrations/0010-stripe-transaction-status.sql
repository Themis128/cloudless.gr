-- Stripe webhook processing status columns (Dynamo parity for D1 idempotency path)
ALTER TABLE stripe_transaction ADD COLUMN processed_at INTEGER;
ALTER TABLE stripe_transaction ADD COLUMN processing_error TEXT;
