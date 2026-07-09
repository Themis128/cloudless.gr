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
    customer_id TEXT,
    processing_status TEXT,
    received_at INTEGER NOT NULL,
    payload_json TEXT
);

CREATE INDEX idx_stripe_event_type ON stripe_transaction(event_type);
CREATE INDEX idx_stripe_received_at ON stripe_transaction(received_at);

-- Admin notifications table
CREATE TABLE admin_notification (
    pk TEXT NOT NULL,
    sk TEXT NOT NULL,
    category TEXT NOT NULL,
    payload_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

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