-- Run once in Athena to create the events table over S3.
-- Replace the LOCATION with your actual bucket if it differs.

CREATE DATABASE IF NOT EXISTS cloudless_analytics;

CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.events (
  `timestamp`   string,
  event         string,
  user_id       string,
  email         string,
  session_id    string,
  page          string,
  referrer      string,
  country       string,
  ip            string,
  user_agent    string,
  amount        double,
  currency      string,
  plan          string,
  product_id    string,
  service       string,
  source        string,
  campaign      string,
  medium        string,
  properties    string   -- JSON blob for event-specific extras
)
PARTITIONED BY (year string, month string, day string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://cloudless-analytics-data/events/'
TBLPROPERTIES ('has_encrypted_data'='false');

-- After creating the table, run this to load existing partitions:
MSCK REPAIR TABLE cloudless_analytics.events;

-- Example queries:
-- SELECT event, COUNT(*) AS n FROM cloudless_analytics.events GROUP BY event ORDER BY n DESC;
-- SELECT DATE(timestamp) AS day, COUNT(*) AS signups FROM cloudless_analytics.events WHERE event='signup' GROUP BY 1 ORDER BY 1;
-- SELECT email, SUM(amount) AS total FROM cloudless_analytics.events WHERE event='purchase' GROUP BY email ORDER BY total DESC;
