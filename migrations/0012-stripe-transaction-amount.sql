-- Catch-up for slim remote stripe_transaction (pre-0001 column set).
-- On databases created from the full 0001-auth-schema.sql CREATE TABLE,
-- tag_*/event_day/amount_minor/currency already exist — ALTER ADD would fail
-- with duplicate column. No-op for that case; indexes are also in 0001.
SELECT 1;
