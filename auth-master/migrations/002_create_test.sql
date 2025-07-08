CREATE TABLE IF NOT EXISTS test (
  id serial PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
