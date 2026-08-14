-- Short-TTL EspoCRM API response cache (latency only — not a CRM store).
-- Mirrors analytics_cache shape with a real PRIMARY KEY for INSERT OR REPLACE.
CREATE TABLE IF NOT EXISTS espocrm_cache (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  result_json TEXT,
  cached_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_espocrm_cache_expires ON espocrm_cache(expires_at);
