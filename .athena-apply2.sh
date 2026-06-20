#!/usr/bin/env bash
set -uo pipefail
RESULT="s3://cloudless-analytics-data/athena-results/"
run() {
  local sql="$1"; local label="$2"
  local qid
  qid=$(aws athena start-query-execution --work-group primary --query-string "$sql" --result-configuration "OutputLocation=$RESULT" --query "QueryExecutionId" --output text)
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 3
    local state
    state=$(aws athena get-query-execution --query-execution-id "$qid" --query "QueryExecution.Status.State" --output text)
    if [ "$state" = "SUCCEEDED" ]; then printf '  %-40s OK\n' "$label"; return 0; fi
    if [ "$state" = "FAILED" ] || [ "$state" = "CANCELLED" ]; then
      local reason; reason=$(aws athena get-query-execution --query-execution-id "$qid" --query "QueryExecution.Status.StateChangeReason" --output text)
      printf '  %-40s FAILED: %s\n' "$label" "$reason"; return 1
    fi
  done
  printf '  %-40s TIMEOUT\n' "$label"; return 1
}
echo "=== new tables ==="
run "CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.sentry_issues (issue_id string, short_id string, title string, culprit string, level string, status string, count_14d bigint, user_count int, first_seen string, last_seen string, permalink string) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/sentry-issues/'" "sentry_issues"
run "CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.gsc_keywords (query string, page string, clicks int, impressions int, ctr double, position double, start_date string, end_date string) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/gsc-keywords/'" "gsc_keywords"
run "CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.linkedin_ads (campaign_id string, campaign_name string, day string, impressions bigint, clicks int, ctr double, spend double, currency string, conversions int, cost_per_click double, cost_per_thousand_impressions double, account_id string) STORED AS PARQUET LOCATION 's3://cloudless-analytics-data/lake/linkedin-ads/'" "linkedin_ads"
echo "=== new views ==="
run "CREATE OR REPLACE VIEW cloudless_analytics.v_sentry_top_issues AS SELECT short_id, title, level, status, count_14d, user_count, last_seen, permalink FROM cloudless_analytics.sentry_issues ORDER BY count_14d DESC LIMIT 20" "v_sentry_top_issues"
run "CREATE OR REPLACE VIEW cloudless_analytics.v_gsc_top_keywords AS SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions, CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 1.0 / SUM(impressions) ELSE 0 END AS ctr, ROUND(AVG(position), 1) AS avg_position FROM cloudless_analytics.gsc_keywords GROUP BY query ORDER BY clicks DESC LIMIT 50" "v_gsc_top_keywords"
run "CREATE OR REPLACE VIEW cloudless_analytics.v_linkedin_ads_summary AS SELECT campaign_id, campaign_name, SUM(impressions) AS impressions, SUM(clicks) AS clicks, CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 1.0 / SUM(impressions) ELSE 0 END AS ctr, SUM(spend) AS spend, SUM(conversions) AS conversions, CASE WHEN SUM(clicks) > 0 THEN SUM(spend) / SUM(clicks) ELSE 0 END AS cpc, CASE WHEN SUM(conversions) > 0 THEN SUM(spend) / SUM(conversions) ELSE 0 END AS cost_per_conversion FROM cloudless_analytics.linkedin_ads GROUP BY campaign_id, campaign_name ORDER BY spend DESC" "v_linkedin_ads_summary"
rm -f .athena-apply2.sh
