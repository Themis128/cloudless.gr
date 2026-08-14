-- Agency delivery projects + time entries on user-auth-db (Next app).
-- Not a separate project-db Worker. AppFlowy /admin/projects stays CMS-only.
CREATE TABLE IF NOT EXISTS agency_project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_email TEXT,
  espo_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'done', 'cancelled')),
  hourly_rate_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  stripe_customer_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS time_entry (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT,
  work_date TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  billable INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  stripe_invoice_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (project_id) REFERENCES agency_project(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_time_entry_project_date
  ON time_entry (project_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_agency_project_client
  ON agency_project (client_email);

CREATE INDEX IF NOT EXISTS idx_agency_project_status
  ON agency_project (status);
