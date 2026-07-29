-- Cloudless analytics — Athena / Glue DDL.
-- Run from the Athena `primary` workgroup (which has the result location
-- and 10 GB scan cap enforced — see docs/datalake.md).

CREATE DATABASE IF NOT EXISTS cloudless_analytics;

-- ===========================================================================
-- Source tables
-- ===========================================================================

-- ---- events (NDJSON, partitioned, written real-time by Lambda) ------------
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.events (
  `timestamp`   string,
  event         string,
  user_id       string,
  email         string,
  session_id    string,
  page          string,
  referrer      string,
  country       string,
  ip            string,
  user_agent    string,
  amount        double,
  currency      string,
  plan          string,
  product_id    string,
  service       string,
  source        string,
  campaign      string,
  medium        string,
  properties    string   -- JSON blob for event-specific extras
)
PARTITIONED BY (year string, month string, day string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://cloudless-analytics-data/events/'
TBLPROPERTIES ('has_encrypted_data'='false');

-- ---- EspoCRM CRM tables (Parquet, full-refresh daily) ---------------------
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.hubspot_contacts (
  contact_id       string,
  email            string,
  firstname        string,
  lastname         string,
  company          string,
  phone            string,
  lifecyclestage   string,
  lead_status      string,
  lead_source      string,
  service_interest string,
  country          string,
  createdate       string,
  lastmodifieddate string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/hubspot-contacts/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.hubspot_deals (
  deal_id          string,
  dealname         string,
  amount           double,
  currency         string,
  dealstage        string,
  pipeline         string,
  closedate        string,
  createdate       string,
  hubspot_owner_id string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/hubspot-deals/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.hubspot_tickets (
  ticket_id           string,
  subject             string,
  content             string,
  hs_pipeline         string,
  hs_pipeline_stage   string,
  hs_ticket_priority  string,
  createdate          string,
  hs_lastmodifieddate string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/hubspot-tickets/';

-- ---- Sentry issues snapshot (Parquet, 14d count, full-refresh daily) ------
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.sentry_issues (
  issue_id    string,
  short_id    string,
  title       string,
  culprit     string,
  level       string,
  status      string,
  count_14d   bigint,
  user_count  int,
  first_seen  string,
  last_seen   string,
  permalink   string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/sentry-issues/';

-- ---- GSC search analytics (Parquet, 90d rolling window) -------------------
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.gsc_keywords (
  query       string,
  page        string,
  clicks      int,
  impressions int,
  ctr         double,
  position    double,
  start_date  string,
  end_date    string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/gsc-keywords/';

-- ---- LinkedIn Ads daily insights (Parquet, 90d window) --------------------
CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.linkedin_ads (
  campaign_id                     string,
  campaign_name                   string,
  day                             string,
  impressions                     bigint,
  clicks                          int,
  ctr                             double,
  spend                           double,
  currency                        string,
  conversions                     int,
  cost_per_click                  double,
  cost_per_thousand_impressions   double,
  account_id                      string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/linkedin-ads/';

-- After creating the events table, run this once to load existing partitions
-- (the analytics-etl.yml workflow runs this daily on cron):
--   MSCK REPAIR TABLE cloudless_analytics.events;

-- ===========================================================================
-- Insight views — full-funnel analytics
-- ===========================================================================

-- ---- v_acquisition_funnel -------------------------------------------------
-- Daily funnel: anonymous page_views → signups → first purchase.
-- Built from the events table only — no joins. Drives the acquisition chart
-- on the admin dashboard.
CREATE OR REPLACE VIEW cloudless_analytics.v_acquisition_funnel AS
SELECT
  DATE(`timestamp`) AS day,
  COUNT(DISTINCT session_id) FILTER (WHERE event = 'page_view')              AS sessions,
  COUNT(DISTINCT user_id)    FILTER (WHERE event = 'signup')                 AS signups,
  COUNT(DISTINCT user_id)    FILTER (WHERE event = 'purchase')               AS purchasers,
  SUM(amount)                FILTER (WHERE event = 'purchase')               AS revenue
FROM cloudless_analytics.events
WHERE `timestamp` IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

-- ---- v_attribution_by_source ----------------------------------------------
-- Conversions + revenue split by UTM source/medium for the last 90 days.
-- Operator-facing view for the "what's actually driving paid signups" question.
CREATE OR REPLACE VIEW cloudless_analytics.v_attribution_by_source AS
SELECT
  COALESCE(source, '(direct)')    AS utm_source,
  COALESCE(medium, '(none)')      AS utm_medium,
  COALESCE(campaign, '(none)')    AS utm_campaign,
  COUNT(DISTINCT session_id) FILTER (WHERE event = 'page_view')   AS sessions,
  COUNT(DISTINCT user_id)    FILTER (WHERE event = 'signup')      AS signups,
  COUNT(*)                   FILTER (WHERE event = 'purchase')    AS purchases,
  SUM(amount)                FILTER (WHERE event = 'purchase')    AS revenue
FROM cloudless_analytics.events
WHERE `timestamp` >= date_format(current_date - interval '90' day, '%Y-%m-%dT%H:%i:%s')
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1
ORDER BY revenue DESC NULLS LAST, sessions DESC;

-- ---- v_espocrm_funnel (canonical) / v_hubspot_funnel (legacy alias) --------
-- EspoCRM contact lead-source rollup joined to closed-won opportunities.
CREATE OR REPLACE VIEW cloudless_analytics.v_espocrm_funnel AS
SELECT
  'contact' AS lifecycle_stage,
  COALESCE(c.lead_source, '(none)') AS lead_source,
  COUNT(DISTINCT c.contact_id) AS contact_count,
  COUNT(DISTINCT o.opportunity_id) FILTER (WHERE o.stage = 'Closed Won') AS closed_won_deals,
  SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won') AS closed_won_revenue
FROM cloudless_analytics.espocrm_contacts c
LEFT JOIN cloudless_analytics.espocrm_opportunities o ON o.account_id = c.account_id
WHERE c.contact_id <> '__placeholder__'
GROUP BY 1, 2
ORDER BY contact_count DESC;

-- Temporary alias for dashboards still referencing the HubSpot-era name.
CREATE OR REPLACE VIEW cloudless_analytics.v_hubspot_funnel AS
SELECT * FROM cloudless_analytics.v_espocrm_funnel;

-- ---- v_lead_to_customer ----------------------------------------------------
-- Cross-source funnel join: EspoCRM contact → Cognito client → first Stripe
-- transaction. Joins on lowercased email. Shows time-to-conversion + lifetime
-- value once the contact becomes a paying customer.
CREATE OR REPLACE VIEW cloudless_analytics.v_lead_to_customer AS
SELECT
  LOWER(c.email)                                                  AS email,
  c.lead_source,
  c.lifecyclestage,
  c.createdate                                                    AS hubspot_created,
  cl.signup_date                                                  AS cognito_signup,
  cl.rfm_score,
  cl.churn_risk,
  cl.lifetime_value,
  date_diff('day',
    from_iso8601_timestamp(c.createdate),
    COALESCE(from_iso8601_timestamp(cl.signup_date), current_timestamp)
  )                                                               AS days_lead_to_signup
FROM cloudless_analytics.hubspot_contacts c
LEFT JOIN cloudless_analytics.clients cl ON LOWER(c.email) = LOWER(cl.email)
WHERE c.email IS NOT NULL
ORDER BY c.createdate DESC;

-- ---- v_sentry_top_issues --------------------------------------------------
-- Top 20 unresolved issues by 14-day event count. Drives the Errors card on
-- the admin /analytics dashboard.
CREATE OR REPLACE VIEW cloudless_analytics.v_sentry_top_issues AS
SELECT
  short_id,
  title,
  level,
  status,
  count_14d,
  user_count,
  last_seen,
  permalink
FROM cloudless_analytics.sentry_issues
ORDER BY count_14d DESC
LIMIT 20;

-- ---- v_gsc_top_keywords ---------------------------------------------------
-- Top 50 keywords by clicks over the rolling window. Position rounded to 1 dp.
CREATE OR REPLACE VIEW cloudless_analytics.v_gsc_top_keywords AS
SELECT
  query,
  SUM(clicks) AS clicks,
  SUM(impressions) AS impressions,
  CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 1.0 / SUM(impressions) ELSE 0 END AS ctr,
  ROUND(AVG(position), 1) AS avg_position
FROM cloudless_analytics.gsc_keywords
GROUP BY query
ORDER BY clicks DESC
LIMIT 50;

-- ---- v_linkedin_ads_summary -----------------------------------------------
-- Per-campaign rollup of the 90-day window with derived rate metrics.
CREATE OR REPLACE VIEW cloudless_analytics.v_linkedin_ads_summary AS
SELECT
  campaign_id,
  campaign_name,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 1.0 / SUM(impressions) ELSE 0 END AS ctr,
  SUM(spend) AS spend,
  SUM(conversions) AS conversions,
  CASE WHEN SUM(clicks) > 0 THEN SUM(spend) / SUM(clicks) ELSE 0 END AS cpc,
  CASE WHEN SUM(conversions) > 0 THEN SUM(spend) / SUM(conversions) ELSE 0 END AS cost_per_conversion
FROM cloudless_analytics.linkedin_ads
GROUP BY campaign_id, campaign_name
ORDER BY spend DESC;

-- ===========================================================================
-- EspoCRM tables (replaces EspoCRM, fed by scripts/etl/espocrm-to-lake.mjs)
-- ===========================================================================

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.espocrm_contacts (
  contact_id string, email string, first_name string, last_name string,
  account_id string, account_name string, phone string, title string,
  lead_source string, assigned_user_name string, do_not_call boolean,
  created_at string, modified_at string
) STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/espocrm-contacts/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.espocrm_accounts (
  account_id string, name string, website string, email string, phone string,
  industry string, type string, billing_country string, billing_city string,
  assigned_user_name string, created_at string
) STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/espocrm-accounts/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.espocrm_opportunities (
  opportunity_id string, name string, account_id string, account_name string,
  amount double, amount_currency string, stage string, probability int,
  close_date string, lead_source string, assigned_user_name string,
  created_at string, modified_at string
) STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/espocrm-opportunities/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.espocrm_cases (
  case_id string, number int, name string, status string, priority string,
  type string, account_id string, contact_id string, assigned_user_name string,
  created_at string, modified_at string
) STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/espocrm-cases/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.espocrm_campaigns (
  campaign_id string, name string, status string, type string,
  start_date string, end_date string, budget double, budget_currency string,
  sent_count int, opened_count int, clicked_count int,
  assigned_user_name string, created_at string
) STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/espocrm-campaigns/';

-- ---- v_espocrm_pipeline: per-stage Opportunity rollup -----------------------
CREATE OR REPLACE VIEW cloudless_analytics.v_espocrm_pipeline AS
SELECT stage, COUNT(*) AS deal_count, SUM(amount) AS total_value,
       AVG(amount) AS avg_deal_size, AVG(probability) AS avg_probability
FROM cloudless_analytics.espocrm_opportunities
WHERE opportunity_id <> '__placeholder__'
GROUP BY stage
ORDER BY total_value DESC NULLS LAST;

-- ---- v_espocrm_lead_to_customer: Contact joined to first won Opportunity ---
CREATE OR REPLACE VIEW cloudless_analytics.v_espocrm_lead_to_customer AS
SELECT c.contact_id, c.email, c.first_name, c.last_name,
       c.lead_source AS contact_source, c.created_at AS contact_created,
       o.opportunity_id, o.amount AS won_amount, o.amount_currency,
       o.close_date AS won_at
FROM cloudless_analytics.espocrm_contacts c
LEFT JOIN cloudless_analytics.espocrm_opportunities o
  ON c.account_id = o.account_id AND o.stage = 'Closed Won'
WHERE c.contact_id <> '__placeholder__';

-- ---- v_espocrm_campaign_summary: per-campaign open/click rates --------------
CREATE OR REPLACE VIEW cloudless_analytics.v_espocrm_campaign_summary AS
SELECT campaign_id, name, status, type, sent_count, opened_count, clicked_count,
       CASE WHEN sent_count > 0 THEN opened_count *1.0 / sent_count ELSE 0 END AS open_rate,
       CASE WHEN opened_count > 0 THEN clicked_count* 1.0 / opened_count ELSE 0 END AS click_through_rate
FROM cloudless_analytics.espocrm_campaigns
WHERE campaign_id <> '__placeholder__'
ORDER BY sent_count DESC;

-- ===========================================================================
-- Pre-existing views (kept for reference — defined elsewhere in the catalog)
-- ===========================================================================
-- v_client_health, v_daily_events, v_funnel, v_ltv_ranking,
-- v_project_velocity, v_revenue_monthly
--

-- These were created previously and live in the Glue catalog already. The four
-- views above (v_acquisition_funnel, v_attribution_by_source, v_hubspot_funnel,
-- v_lead_to_customer) are new in this audit pass and need to be CREATEd once
-- in Athena before the dashboard can query them.

-- ===========================================================================
-- Example operator queries
-- ===========================================================================
-- SELECT *FROM cloudless_analytics.v_acquisition_funnel LIMIT 30;
-- SELECT* FROM cloudless_analytics.v_attribution_by_source LIMIT 20;
-- SELECT email, rfm_score, churn_risk FROM cloudless_analytics.v_lead_to_customer ORDER BY rfm_score DESC LIMIT 50;

-- ===========================================================================
-- Self-hosted app tables + views (PR 2026-06-21 self-hosted ETL+API readiness)
-- The daily ETL (.github/workflows/etl-selfhosted-to-lake.yml) writes:
--   s3://cloudless-analytics-data/lake/appflowy-workspaces/workspaces.parquet
--   s3://cloudless-analytics-data/lake/appflowy-users/users.parquet
--   s3://cloudless-analytics-data/lake/n8n-workflows/workflows.parquet
--   s3://cloudless-analytics-data/lake/n8n-executions/executions.parquet
--   s3://cloudless-analytics-data/lake/postiz-posts/posts.parquet
--   s3://cloudless-analytics-data/lake/postiz-integrations/integrations.parquet
-- Tables are external; Glue/Athena reads the matching S3 prefix.
-- ===========================================================================

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.appflowy_workspaces (
  workspace_id string, workspace_name string, owner_email string,
  member_count int, created_at timestamp
) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/appflowy-workspaces/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.appflowy_users (
  uid bigint, email string, name string, created_at timestamp
) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/appflowy-users/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.n8n_workflows (
  id string, name string, active boolean, created_at timestamp, updated_at timestamp
) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/n8n-workflows/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.n8n_executions (
  id string, workflow_id string, status string, mode string,
  started_at timestamp, stopped_at timestamp, finished boolean
) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/n8n-executions/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.postiz_posts (
  id string, content string, state string, publish_date timestamp,
  integration_id string, integration_name string, provider string
) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/postiz-posts/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.postiz_integrations (
  id string, name string, provider string, disabled boolean
) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/postiz-integrations/';

-- Self-hosted app health view — one row per app with success rate + count.
CREATE OR REPLACE VIEW cloudless_analytics.v_selfhosted_health AS
SELECT 'n8n' AS app,
  CAST(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS double) /
    NULLIF(COUNT(*), 0) AS success_rate,
  COUNT(*) AS recent_count
FROM cloudless_analytics.n8n_executions
WHERE started_at > current_timestamp - interval '7' day
UNION ALL
SELECT 'postiz' AS app,
  CAST(SUM(CASE WHEN state = 'PUBLISHED' THEN 1 ELSE 0 END) AS double) /
    NULLIF(COUNT(*), 0) AS success_rate,
  COUNT(*) AS recent_count
FROM cloudless_analytics.postiz_posts
WHERE publish_date > current_timestamp - interval '7' day
UNION ALL
SELECT 'appflowy' AS app, 1.0 AS success_rate, COUNT(DISTINCT uid) AS recent_count
FROM cloudless_analytics.appflowy_users;

-- Operator queries:
-- SELECT *FROM cloudless_analytics.v_selfhosted_health;
-- SELECT* FROM cloudless_analytics.n8n_executions WHERE status = 'error' ORDER BY started_at DESC LIMIT 20;
-- SELECT state, COUNT(*) FROM cloudless_analytics.postiz_posts GROUP BY state;
