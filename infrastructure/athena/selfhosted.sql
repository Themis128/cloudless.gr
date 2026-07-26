-- Athena DDL for the self-hosted-apps slice of the cloudless data lake.
-- Database: cloudless_analytics. Tables backed by s3://cloudless-analytics-data/lake/*.
--
-- ETLs:
--   scripts/etl/appflowy-to-lake.mjs   → 2 parquet files (workspaces, users)
--   scripts/etl/n8n-to-lake.mjs        → 2 parquet files (workflows, executions)
--   scripts/etl/postiz-to-lake.mjs     → 2 parquet files (posts, integrations)
--
-- Apply once with the Athena admin role; subsequent ETL runs overwrite
-- the underlying Parquet so SELECT works without re-running this DDL.

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.appflowy_workspaces (
  workspace_id   string,
  workspace_name string,
  owner_uid      bigint,
  workspace_type int,
  member_count   int,
  created_at     string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/appflowy-workspaces/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.appflowy_users (
  uid        bigint,
  uuid       string,
  email      string,
  name       string,
  created_at string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/appflowy-users/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.n8n_workflows (
  workflow_id string,
  name        string,
  active      boolean,
  tag_count   int,
  tags_json   string,
  created_at  string,
  updated_at  string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/n8n-workflows/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.n8n_executions (
  execution_id string,
  workflow_id  string,
  mode         string,
  status       string,
  finished     boolean,
  started_at   string,
  stopped_at   string,
  duration_ms  bigint
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/n8n-executions/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.postiz_posts (
  post_id          string,
  integration_id   string,
  integration_name string,
  platform         string,
  state            string,
  release_url      string,
  publish_date     string,
  released_at      string,
  content_length   int,
  created_at       string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/postiz-posts/';

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.postiz_integrations (
  integration_id string,
  name           string,
  platform       string,
  disabled       boolean,
  refresh_needed boolean,
  created_at     string
)
STORED AS PARQUET
LOCATION 's3://cloudless-analytics-data/lake/postiz-integrations/';

-- ---------------------------------------------------------------------------
-- Convenience views for /admin/integrations + /admin/analytics dashboards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW cloudless_analytics.v_selfhosted_health AS
SELECT 'appflowy' AS app,
       (SELECT count(*) FROM cloudless_analytics.appflowy_workspaces) AS workspaces,
       (SELECT count(*) FROM cloudless_analytics.appflowy_users)      AS users,
       0 AS workflows, 0 AS executions, 0 AS posts, 0 AS integrations
UNION ALL
SELECT 'n8n',
       0, 0,
       (SELECT count(*) FROM cloudless_analytics.n8n_workflows)       AS workflows,
       (SELECT count(*) FROM cloudless_analytics.n8n_executions)      AS executions,
       0, 0
UNION ALL
SELECT 'postiz',
       0, 0, 0, 0,
       (SELECT count(*) FROM cloudless_analytics.postiz_posts)        AS posts,
       (SELECT count(*) FROM cloudless_analytics.postiz_integrations) AS integrations;

CREATE OR REPLACE VIEW cloudless_analytics.v_n8n_workflow_health_30d AS
SELECT w.name,
       w.active,
       count(e.execution_id)                                                AS exec_count,
       sum(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END)                AS success_count,
       sum(CASE WHEN e.status = 'error'   THEN 1 ELSE 0 END)                AS error_count,
       100.0 * sum(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END)
              / NULLIF(count(e.execution_id), 0)                            AS success_pct,
       avg(e.duration_ms)                                                   AS avg_duration_ms
FROM cloudless_analytics.n8n_workflows w
LEFT JOIN cloudless_analytics.n8n_executions e
  ON e.workflow_id = w.workflow_id
 AND from_iso8601_timestamp(e.started_at) >= current_timestamp - interval '30' day
GROUP BY w.name, w.active
ORDER BY exec_count DESC;
