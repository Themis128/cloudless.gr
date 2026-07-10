-- Migration v2: Add user_token table for next-auth token storage (replaces DynamoDB SessionTokenStore)
CREATE TABLE IF NOT EXISTS user_token (
    user_id TEXT NOT NULL PRIMARY KEY,
    id_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_token_expires ON user_token(expires_at);
