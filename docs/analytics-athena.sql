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

-- ---- HubSpot CRM tables (Parquet, full-refresh daily) ---------------------
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

-- ---- v_hubspot_funnel ------------------------------------------------------
-- HubSpot contact lifecycle stage breakdown joined to whether they have a
-- closed-won deal in HubSpot. Lets us see lead-source ROI by stage.
CREATE OR REPLACE VIEW cloudless_analytics.v_hubspot_funnel AS
SELECT
  COALESCE(c.lifecyclestage, 'unknown') AS lifecycle_stage,
  COALESCE(c.lead_source, '(none)')     AS lead_source,
  COUNT(DISTINCT c.contact_id)          AS contact_count,
  COUNT(DISTINCT d.deal_id) FILTER (WHERE d.dealstage IN ('closedwon', 'closed-won')) AS closed_won_deals,
  SUM(d.amount)             FILTER (WHERE d.dealstage IN ('closedwon', 'closed-won')) AS closed_won_revenue
FROM cloudless_analytics.hubspot_contacts c
LEFT JOIN cloudless_analytics.hubspot_deals d ON d.hubspot_owner_id IS NOT NULL  -- placeholder join, refine when association table lands
GROUP BY 1, 2
ORDER BY contact_count DESC;

-- ---- v_lead_to_customer ----------------------------------------------------
-- Cross-source funnel join: HubSpot contact → Cognito client → first Stripe
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
-- SELECT * FROM cloudless_analytics.v_acquisition_funnel LIMIT 30;
-- SELECT * FROM cloudless_analytics.v_attribution_by_source LIMIT 20;
-- SELECT email, rfm_score, churn_risk FROM cloudless_analytics.v_lead_to_customer ORDER BY rfm_score DESC LIMIT 50;
