# Lakehouse Queries Skill

**Inclusion:** manual

**Keywords:** athena, data lake, analytics, query, sql, warehouse, datalake

---

## Overview

This skill enables natural language querying of the Cloudless data lake powered by AWS Athena. It provides tools for exploring data, generating insights, and creating reports from structured analytics data.

## What It Does

- Translates natural language questions into Athena SQL queries
- Provides schema discovery for all tables and views
- Generates formatted reports with visualizations
- Integrates with Slack for ad-hoc analytics

## Key Commands

### Query the Data Lake

```slack
/analytics query monthly revenue by service
```

```slack
/analytics query top 10 keywords last 30 days
```

### Schema Discovery

```slack
/analytics schema stripe_transactions
```

```slack
/analytics list tables
```

### View Recent Runs

```slack
/analytics runs
```

## Available Tables

| Table | Description | Source |
|-------|-------------|--------|
| `events` | Real-time event tracking (page views, clicks) | Analytics Lambda |
| `gsc_keywords` | Google Search Console keyword data | GSC API (daily) |
| `stripe_transactions` | Stripe payment transactions | Stripe API (daily) |
| `clients` | Client RFM and churn analysis | Computed (daily) |
| `n8n_workflows` | n8n workflow execution data | n8n API (hourly) |
| `postiz_posts` | Social media posts via Postiz | Postiz API (hourly) |
| `espocrm_contacts` | CRM contact data | EspoCRM API (hourly) |
| `sentry_issues` | Error tracking data | Sentry API (hourly) |
| `linkedin_ads` | LinkedIn Ads performance | LinkedIn API (daily) |
| `aws_costs` | AWS cost by service | Cost Explorer (daily) |

## Pre-built Views

The following Athena views are available for common queries:

- `v_acquisition_funnel` - Daily acquisition funnel (sessions → signups → purchasers)
- `v_attribution_by_source` - UTM source/medium attribution
- `v_gsc_top_keywords` - Top GSC keywords by clicks
- `v_linkedin_ads_summary` - LinkedIn ads 90-day rollup
- `v_sentry_top_issues` - Top Sentry issues by 14d count
- `v_espocrm_funnel` - EspoCRM lifecycle stage funnel
- `v_espocrm_pipeline` - EspoCRM opportunity pipeline
- `v_lead_to_customer` - Lead-to-customer conversion funnel with RFM
- `v_selfhosted_health` - Self-hosted services health summary
- `v_n8n_workflow_health_30d` - n8n workflow success rate (30d)
- `v_aws_cost_by_service` - AWS cost by service (30d)

## Query Examples

### Revenue Analysis

```sql
-- Monthly revenue trend
SELECT 
  date_trunc('month', created_at) as month,
  sum(amount) as total_revenue,
  count(distinct email) as unique_customers
FROM stripe_transactions
WHERE status = 'paid'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;
```

### Customer Segmentation

```sql
-- RFM segments
SELECT 
  segment,
  count(*) as customers,
  avg(monetary) as avg_value
FROM clients
GROUP BY segment
ORDER BY avg_value DESC;
```

### Top Keywords

```sql
-- Top 20 keywords by clicks (last 30 days)
SELECT 
  keyword,
  sum(clicks) as total_clicks,
  sum(impressions) as total_impressions,
  avg(ctr) as avg_ctr,
  avg(position) as avg_position
FROM gsc_keywords
WHERE date >= current_date - interval '30' day
GROUP BY keyword
ORDER BY total_clicks DESC
LIMIT 20;
```

## Integration Points

### API Endpoint

```
GET /api/admin/analytics/datalake?refresh=1
```

Returns all pre-computed dashboard sections in one JSON payload.

### MCP Server

The `tools/mcp-athena-server` provides interactive querying via Model Context Protocol:

```typescript
// Execute natural language query
await mcp.call("athena_query", { 
  natural_language: "monthly revenue by service" 
});

// Execute raw SQL
await mcp.call("athena_execute_sql", { 
  sql: "SELECT * FROM stripe_transactions LIMIT 10" 
});

// List tables
await mcp.call("athena_list_tables", { database: "cloudless_analytics" });

// Get schema
await mcp.call("athena_get_schema", { 
  database: "cloudless_analytics", 
  table: "stripe_transactions" 
});
```

## ETL Pipeline Schedule

| Pipeline | Schedule | Target Table |
|----------|----------|--------------|
| n8n-to-lake | Hourly | n8n_workflows |
| postiz-to-lake | Hourly | postiz_posts |
| espocrm-to-lake | Hourly | espocrm_contacts |
| sentry-to-lake | Hourly | sentry_issues |
| appflowy-to-lake | Daily | appflowy_pages |
| stripe-to-lake | Daily | stripe_transactions |
| aws-cost-to-lake | Daily | aws_costs |
| linkedin-ads-to-lake | Daily | linkedin_ads |
| clients-to-lake | Daily | clients |
| portals-to-lake | Hourly | portals |
| gsc-to-lake | Daily | gsc_keywords |

## Cost Management

- Athena charges $5 per TB scanned
- All queries are cached for 60 seconds
- Workgroup has 10 GB scan limit per query
- Use partition pruning (year/month/day) to reduce costs

## Troubleshooting

1. **Query timeout**: Reduce date range or add more specific filters
2. **Table not found**: Check if ETL pipeline has run at least once
3. **Permission denied**: Verify IAM role has `athena:*` and S3 read access
4. **Slow queries**: Use pre-built views instead of raw tables

## Security

- All queries are read-only
- PII data is masked in outputs
- Access controlled via Cognito `admin` group
- Query results stored in private S3 bucket
