-- AWS Cost Explorer rows for /admin/cost (replaces Athena v_aws_cost_by_service reads)
CREATE TABLE IF NOT EXISTS aws_cost_daily (
  cost_date TEXT NOT NULL,
  service TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (cost_date, service)
);

CREATE INDEX IF NOT EXISTS idx_aws_cost_date ON aws_cost_daily(cost_date);
CREATE INDEX IF NOT EXISTS idx_aws_cost_synced ON aws_cost_daily(synced_at);
