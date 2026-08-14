-- Append-only log of ad-analytics anomalies that were successfully posted to Slack.
-- Dedup still uses ad_analytics_bookmark; this table is for admin history UI.
CREATE TABLE IF NOT EXISTS ad_analytics_anomaly_event (
  id TEXT PRIMARY KEY,
  fired_at TEXT NOT NULL,
  campaign_slug TEXT NOT NULL,
  platform TEXT NOT NULL,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  detail_json TEXT,
  snapshot_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_analytics_anomaly_fired
  ON ad_analytics_anomaly_event (fired_at DESC);
