-- Expand admin_notification for Dynamo-parity / Workers free-tier inserts
ALTER TABLE admin_notification ADD COLUMN id TEXT;
ALTER TABLE admin_notification ADD COLUMN type TEXT;
ALTER TABLE admin_notification ADD COLUMN title TEXT;
ALTER TABLE admin_notification ADD COLUMN message TEXT;
ALTER TABLE admin_notification ADD COLUMN actor TEXT;
ALTER TABLE admin_notification ADD COLUMN route TEXT;
ALTER TABLE admin_notification ADD COLUMN read INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_notification ADD COLUMN archived_at TEXT;
ALTER TABLE admin_notification ADD COLUMN cat_pk TEXT;
ALTER TABLE admin_notification ADD COLUMN cat_sk TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_notif_sk ON admin_notification(sk);
CREATE INDEX IF NOT EXISTS idx_admin_notif_category ON admin_notification(category);
CREATE INDEX IF NOT EXISTS idx_admin_notif_id ON admin_notification(id);
CREATE INDEX IF NOT EXISTS idx_admin_notif_cat_pk ON admin_notification(cat_pk);
