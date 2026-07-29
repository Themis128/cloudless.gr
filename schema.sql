-- User table (replaces Cognito User Pool)
CREATE TABLE user (
    id TEXT NOT NULL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    company TEXT,
    phone TEXT,
    preferences_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Session table (replaces SessionTokenStore)
CREATE TABLE session (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_user_username ON user(username);
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_session_expires ON session(expires_at);

-- Stripe transactions table
CREATE TABLE stripe_transaction (
    event_id TEXT NOT NULL PRIMARY KEY,
    event_type TEXT NOT NULL,
    tag_category TEXT,
    tag_stage TEXT,
    stage_category TEXT,
    event_day TEXT,
    customer_id TEXT,
    processing_status TEXT,
    received_at INTEGER NOT NULL,
    processed_at INTEGER,
    processing_error TEXT,
    payload_json TEXT
);

CREATE INDEX idx_stripe_event_type ON stripe_transaction(event_type);
CREATE INDEX idx_stripe_received_at ON stripe_transaction(received_at);

-- Admin notifications table
CREATE TABLE admin_notification (
    pk TEXT NOT NULL,
    sk TEXT NOT NULL,
    category TEXT NOT NULL,
    id TEXT,
    type TEXT,
    title TEXT,
    message TEXT,
    actor TEXT,
    route TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    cat_pk TEXT,
    cat_sk TEXT,
    payload_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_sk ON admin_notification(sk);
CREATE INDEX IF NOT EXISTS idx_admin_notif_category ON admin_notification(category);
CREATE INDEX IF NOT EXISTS idx_admin_notif_id ON admin_notification(id);

-- Analytics cache table
CREATE TABLE analytics_cache (
    pk TEXT NOT NULL,
    sk TEXT NOT NULL,
    result_json TEXT,
    cached_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER
);

CREATE INDEX idx_analytics_expires ON analytics_cache(expires_at);

-- User roles (for admin access control)
CREATE TABLE user_role (
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    PRIMARY KEY (user_id, role),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- User token store (replaces DynamoDB SessionTokenStore for next-auth)
-- Stores id_token + refresh_token keyed by user_id (OIDC sub)
CREATE TABLE user_token (
    user_id TEXT NOT NULL PRIMARY KEY,
    id_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL
);

CREATE INDEX idx_user_token_expires ON user_token(expires_at);

-- Config table (replaces SSM for simple key-value settings)
-- Used for AB flags, portal data, and other small JSON config
CREATE TABLE config (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Pending clients (replaces SSM PENDING_CLIENTS_JSON)
CREATE TABLE pending_client (
    email TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    plan TEXT NOT NULL,
    plan_label TEXT,
    submitted_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('waiting', 'approved', 'declined')),
    portal_token TEXT,
    approved_at TEXT,
    notes TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_pending_client_status ON pending_client(status);

-- Voice brief store (replaces SSM VOICE_BRIEF_LATEST)
CREATE TABLE voice_brief (
    id TEXT NOT NULL PRIMARY KEY,
    text TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    week TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Client portals (stored in config table as JSON)
-- The config table handles both AB_FLAGS_JSON and CLIENT_PORTALS_JSON
