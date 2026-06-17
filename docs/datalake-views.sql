-- Athena Views — run once after tables are populated.
-- These provide ready-made reports queryable from the admin dashboard or BI tools.

-- ============================================================================
-- REVENUE SUMMARY — monthly revenue, MRR, transaction counts
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_revenue_monthly AS
SELECT
  SUBSTR(created_at, 1, 7) AS month,
  COUNT(*) AS total_transactions,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
  SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END) AS revenue_cents,
  SUM(CASE WHEN status = 'paid' AND type = 'subscription' THEN amount_cents ELSE 0 END) AS mrr_cents,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count,
  COUNT(DISTINCT email) AS unique_customers
FROM cloudless_analytics.transactions
GROUP BY SUBSTR(created_at, 1, 7)
ORDER BY month DESC;

-- ============================================================================
-- CLIENT HEALTH OVERVIEW — at-risk clients ranked by score
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_client_health AS
SELECT
  p.client_email,
  p.client_name,
  p.label AS project,
  p.health_score,
  CASE
    WHEN p.health_score >= 75 THEN 'healthy'
    WHEN p.health_score >= 50 THEN 'watch'
    ELSE 'at_risk'
  END AS band,
  p.completed_steps,
  p.total_steps,
  p.blocked_steps,
  p.open_payments,
  p.total_revenue_cents,
  p.last_comment_at
FROM cloudless_analytics.portals p
ORDER BY p.health_score ASC;

-- ============================================================================
-- CHURN RISK — clients most likely to churn (from ML + engagement signals)
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_churn_risk AS
SELECT
  c.email,
  c.name,
  c.plan,
  c.churn_risk,
  c.rfm_score,
  c.lifetime_value,
  c.last_login,
  DATE_DIFF('day', DATE(c.last_login), CURRENT_DATE) AS days_since_login,
  c.portal_status
FROM cloudless_analytics.clients c
WHERE c.churn_risk IS NOT NULL
ORDER BY c.churn_risk DESC;

-- ============================================================================
-- CUSTOMER LIFETIME VALUE — top clients by revenue
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_ltv_ranking AS
SELECT
  t.email,
  c.name,
  c.company,
  c.plan,
  COUNT(*) AS transaction_count,
  SUM(t.amount_cents) AS total_cents,
  MIN(t.created_at) AS first_purchase,
  MAX(t.created_at) AS last_purchase,
  c.rfm_score
FROM cloudless_analytics.transactions t
LEFT JOIN cloudless_analytics.clients c ON LOWER(c.email) = LOWER(t.email)
WHERE t.status = 'paid'
GROUP BY t.email, c.name, c.company, c.plan, c.rfm_score
ORDER BY total_cents DESC;

-- ============================================================================
-- FUNNEL — signup → portal enrollment → active project → paid
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_funnel AS
SELECT
  COUNT(*) AS total_signups,
  COUNT(CASE WHEN portal_status IN ('waiting', 'approved') THEN 1 END) AS enrolled,
  COUNT(CASE WHEN portal_status = 'approved' THEN 1 END) AS active_portal,
  COUNT(CASE WHEN lifetime_value > 0 THEN 1 END) AS has_paid,
  ROUND(CAST(COUNT(CASE WHEN portal_status IN ('waiting','approved') THEN 1 END) AS DOUBLE) / NULLIF(COUNT(*), 0) * 100, 1) AS enrollment_rate,
  ROUND(CAST(COUNT(CASE WHEN lifetime_value > 0 THEN 1 END) AS DOUBLE) / NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
FROM cloudless_analytics.clients;

-- ============================================================================
-- PROJECT VELOCITY — avg time to complete steps, delivery speed
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_project_velocity AS
SELECT
  p.label AS project,
  p.client_name,
  p.total_steps,
  p.completed_steps,
  ROUND(CAST(p.completed_steps AS DOUBLE) / NULLIF(p.total_steps, 0) * 100, 0) AS pct_complete,
  p.blocked_steps,
  p.approved_deliverables,
  p.total_deliverables,
  p.created_at AS project_started
FROM cloudless_analytics.portals p
WHERE p.total_steps > 0
ORDER BY pct_complete DESC;

-- ============================================================================
-- DAILY EVENTS — behavioral analytics from the events table
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_daily_events AS
SELECT
  year || '-' || month || '-' || day AS date,
  event,
  COUNT(*) AS count,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT session_id) AS sessions
FROM cloudless_analytics.events
GROUP BY year, month, day, event
ORDER BY date DESC, count DESC;

-- ============================================================================
-- ACQUISITION — where clients come from (source/medium/campaign)
-- ============================================================================
CREATE OR REPLACE VIEW cloudless_analytics.v_acquisition AS
SELECT
  COALESCE(source, 'direct') AS source,
  COALESCE(medium, 'none') AS medium,
  COALESCE(campaign, 'none') AS campaign,
  COUNT(*) AS events,
  COUNT(DISTINCT user_id) AS users,
  COUNT(CASE WHEN event = 'signup' THEN 1 END) AS signups,
  COUNT(CASE WHEN event = 'purchase' THEN 1 END) AS purchases
FROM cloudless_analytics.events
GROUP BY source, medium, campaign
ORDER BY users DESC;
