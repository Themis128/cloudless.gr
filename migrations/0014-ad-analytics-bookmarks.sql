-- Ad-analytics poll bookmarks (replaces DynamoDB AD_ANALYTICS_BOOKMARKS_TABLE).
-- One row per (campaign × platform × metric × window) bookmark key.
CREATE TABLE IF NOT EXISTS ad_analytics_bookmark (
  pk TEXT PRIMARY KEY,
  last_posted_at TEXT,
  snapshot_json TEXT,
  updated_at INTEGER
);
