-- Cloudless Data Lake — Athena DDL
-- All tables use S3 (cloudless-analytics-data) as storage.
-- Cost: S3 free tier = 5GB storage + 20k GET/2k PUT per month.
-- Athena: $5/TB scanned. Parquet columnar = minimal scan cost.
-- Run this once in Athena console or via CLI.

CREATE DATABASE IF NOT EXISTS cloudless_analytics;

-- ============================================================================
-- EVENTS (existing — behavioral analytics)
-- ============================================================================
-- Already defined in docs/analytics-athena.sql

-- ============================================================================
-- CLIENTS — unified client profile (synced from Cognito + portals + EspoCRM)
-- ============================================================================
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.clients (
  user_id         string,
  email           string,
  name            string,
  company         string,
  phone           string,
  plan            string,
  plan_label      string,
  portal_status   string,   -- none | waiting | approved
  portal_token    string,
  signup_date     string,
  last_login      string,
  email_verified  boolean,
  cognito_status  string,   -- CONFIRMED | FORCE_CHANGE_PASSWORD etc
  hubspot_id      string,
  country         string,
  source          string,   -- how they found us
  rfm_score       double,
  churn_risk      double,
  lifetime_value  double
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/clients/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- ============================================================================
-- TRANSACTIONS — Stripe payments, invoices, subscriptions
-- ============================================================================
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.transactions (
  transaction_id  string,
  email           string,
  user_id         string,
  type            string,   -- checkout | invoice | subscription
  status          string,   -- paid | failed | refunded | active | canceled
  amount_cents    bigint,
  currency        string,
  product_id      string,
  product_name    string,
  plan            string,
  interval_unit   string,   -- month | year | null
  stripe_id       string,   -- session/invoice/subscription id
  created_at      string,
  paid_at         string
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/transactions/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- ============================================================================
-- PORTALS — project portal state snapshots
-- ============================================================================
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.portals (
  token           string,
  client_email    string,
  client_name     string,
  label           string,
  created_at      string,
  expires_at      string,
  workspace_id    string,
  total_steps     int,
  completed_steps int,
  blocked_steps   int,
  total_deliverables    int,
  approved_deliverables int,
  open_payments   int,
  paid_payments   int,
  total_revenue_cents   bigint,
  last_comment_at string,
  health_score    int
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/portals/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- ============================================================================
-- NOTIFICATIONS — admin notifications archive (replaces DynamoDB)
-- ============================================================================
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.notifications (
  id              string,
  type            string,   -- order | contact | subscription | error | deploy
  title           string,
  message         string,
  email           string,
  channel         string,   -- email | slack | both
  created_at      string,
  metadata        string    -- JSON blob
)
PARTITIONED BY (year string, month string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://cloudless-analytics-data/lake/notifications/'
TBLPROPERTIES ('has_encrypted_data'='false');
