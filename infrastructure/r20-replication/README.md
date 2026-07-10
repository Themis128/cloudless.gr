# R20: Postgres Logical Replication Subscriber on AWS

# Streams AppFlowy/Postiz/Postgres changes → DDB for cross-region DR

## Architecture

```
Pi Cluster (omv-main)
    │
    ▼
Postgres logical decoding (wal2json or pgoutput)
    │
    ▼
Lambda subscriber (poll via replication slot)
    │
    ▼
DDB write (same tables used by primary us-east-1)
    │
    ▼
us-west-2 Lambda standby can read replicated state
```

## Components

- **Replication slot** on AppFlowy/Postiz postgres primary
- **Lambda function** that polls the replication stream
- **DDB writers** for state tables (orders, profiles, etc.)

## Usage

1. Enable `wal2json` extension on postgres pods
2. Create replication slot: `CREATE SLOT cloudless_drain LOGICAL wal2json`
3. Deploy this subscriber Lambda
4. Lambda writes to DDB tables already configured with Global Tables

## Files

- `infrastructure/r20-replication/subscriber.ts` - Lambda handler
- `infrastructure/r20-replication/wal2json-config.yaml` - postgres config snippet
- `.github/workflows/deploy-replication-subscriber.yml` - deploy workflow
