-- Stripe webhook processing status columns.
-- Already defined on stripe_transaction in 0001-auth-schema.sql
-- (processed_at, processing_error). This migration is intentionally a no-op
-- so older environments that expected a later ALTER can still advance the
-- migrations table without duplicate-column failures.
SELECT 1;
