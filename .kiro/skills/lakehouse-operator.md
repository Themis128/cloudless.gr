# Lakehouse Operator Skill

**Inclusion:** auto

**Keywords:** athena, data lake, analytics, bigquery, snowflake, warehouse

---

## Overview

The Lakehouse Operator skill provides tools for querying and managing the AWS Athena-based data lake. It enables natural language queries against structured data stored in S3, with automatic SQL generation and result formatting.

## What It Does

- Queries the data lake using natural language to SQL translation
- Provides schema discovery for external tables
- Manages query results and caching
- Integrates with Slack for scheduled reports
- Supports ad-hoc analytics via Slack slash commands

## Key Commands

### `/analytics help`

Show available analytics commands and syntax.

### `/analytics query <natural-language>`

Execute a natural language query against the data lake.

Example: `/analytics query monthly revenue by service`

### `/analytics schema <table>`

Show schema for a specific table.

### `/analytics runs`

List recent query runs.

## Key Concepts

### Data Lake Structure

```
s3://cloudless-data-lake/
├── raw/                    # Raw data (event logs, API responses)
├── processed/              # Cleaned/transformed data
├── analytics/              # Aggregated metrics and reports
└── external_tables/        # Athena external table definitions
```

### Core Tables

| Table | Description |
|-------|-------------|
| `page_views` | Website visit data |
| `event_logs` | User interaction events |
| `lead_conversions` | Lead source tracking |
| `revenue` | Stripe payment data |
| `user_profiles` | Customer demographics |

## Integration Points

- **Slack**: `/analytics` slash commands
- **Notion**: Dashboard reports
- **Grafana**: Visualization dashboards
- **SES**: Scheduled report emails

## Typical Workflows

### 1. Investigate Revenue Drop

```slack
/user: /analytics query daily revenue last 30 days
```

### 2. Check Campaign Performance

```slack
/user: /analytics query conversions by campaign source
```

### 3. Schema Discovery

```slack
/user: /analytics schema lead_conversions
```

## Error Handling

- Query timeouts: 30-second max execution
- Invalid schema: Automatic table refresh
- Permission errors: Verify IAM role has Athena access

## Security

- Queries are sandboxed to read-only operations
- PII data is masked in outputs
- Access controlled via Cognito groups

## Troubleshooting

1. Check query execution status via `/analytics runs`
2. Verify table exists with `/analytics schema <table>`
3. Review IAM permissions for `athena:*` actions
4. Check S3 bucket policies for data access
