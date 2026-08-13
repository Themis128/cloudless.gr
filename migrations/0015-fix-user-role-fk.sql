-- Rebuild user_role so FK references `user` (not a stale `user_old` rename).
-- Local miniflare DBs can end up with REFERENCES "user_old"(id) after ad-hoc
-- schema edits; INSERT into user_role then fails with "no such table: user_old"
-- and signup returns "Failed to create user".
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS user_role__new (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO user_role__new SELECT user_id, role FROM user_role;

DROP TABLE user_role;
ALTER TABLE user_role__new RENAME TO user_role;

PRAGMA foreign_keys=ON;
