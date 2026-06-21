# Grafana dashboards (provisioned via Grafana API)

JSON definitions live here; deployment is a one-shot push via Grafana's
REST API (`POST /api/dashboards/db` with `overwrite: true`). The dashboards
are NOT mounted into the Grafana pod as filesystem provisioning — we use
the REST API path because it works equally well from CI and from an
operator laptop.

## Catalogue

| File | UID | Source | Provisioner |
| ---- | --- | ------ | ----------- |
| `aws-cost.json` | `aws-cost` | Athena view `cloudless_analytics.v_aws_cost_by_service` (fed by `etl-aws-cost-to-lake.yml`) | `node scripts/provision-aws-cost-dashboard.mjs` |

## Pre-reqs (one-time, operator)

1. **AWS Cost Explorer enabled** — Billing console → Cost Explorer → Enable.
   Free. Takes ~24h for the API to start returning data.
2. **`ce:GetCostAndUsage` granted to `AWS_DEPLOY_ROLE_ARN`** — inline policy:
   ```json
   { "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow", "Action": "ce:GetCostAndUsage", "Resource": "*" }] }
   ```
3. **Athena table + view** — run once via the `awsathena` CLI or the AWS
   console (Athena query editor, workgroup `primary`):
   ```sql
   CREATE EXTERNAL TABLE IF NOT EXISTS cloudless_analytics.aws_cost_daily (
     cost_date   string,
     service     string,
     amount_usd  double,
     currency    string
   )
   STORED AS PARQUET
   LOCATION 's3://cloudless-analytics-data/lake/aws-cost/'
   TBLPROPERTIES ('parquet.compression' = 'SNAPPY');

   CREATE OR REPLACE VIEW cloudless_analytics.v_aws_cost_by_service AS
     SELECT cost_date, service, amount_usd, currency
     FROM   cloudless_analytics.aws_cost_daily
     WHERE  cost_date IS NOT NULL;
   ```
4. **Grafana Athena data source** — Grafana → Connections → Data sources →
   Athena, with UID `athena`. The dashboard JSON references that UID.
5. **Provision the dashboard** — from anywhere with AWS CLI + the
   `GRAFANA_API_TOKEN` SSM key readable:
   ```bash
   node scripts/provision-aws-cost-dashboard.mjs
   ```
   Re-runnable; overwrites in place.

## Verifying

After the first ETL run lands `s3://cloudless-analytics-data/lake/aws-cost/cost.parquet`:

```bash
# Athena smoke check
aws athena start-query-execution --region us-east-1 \
  --query-string "SELECT sum(amount_usd) FROM cloudless_analytics.v_aws_cost_by_service" \
  --result-configuration OutputLocation=s3://cloudless-analytics-data/athena-results/
```

The Grafana panel `Total spend (30d)` should match within rounding.
