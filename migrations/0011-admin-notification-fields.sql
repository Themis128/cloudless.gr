-- Expand admin_notification for Dynamo-parity / Workers free-tier inserts.
-- All of these columns (and the indexes) are already defined in
-- 0001-auth-schema.sql. No-op so remote DBs that applied the full 0001
-- CREATE TABLE can advance past this migration without duplicate-column errors.
SELECT 1;
