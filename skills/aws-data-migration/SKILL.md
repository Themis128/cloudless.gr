---
name: aws-data-migration
description: |
  Migrate AWS data stores (DynamoDB, RDS, S3) to Cloudflare equivalents (D1,
  R2, KV). Use when migrating databases, choosing between KV vs D1, syncing
  S3 to R2, or handling data type conversions. Triggered by phrases like
  "DynamoDB to D1", "migrate database", "S3 to R2 sync", "RDS dump to
  Workers", "data migration", "KV vs D1", or "DynamoDB hot partition".
---

# AWS Data Migration Patterns

Migrate AWS data stores to Cloudflare equivalents with proper mapping and tools.

## DynamoDB → KV or D1

### Simple key-value → KV

When access pattern is single key lookup with eventual consistency OK:

```typescript
// DynamoDB pattern
await ddb.put({ TableName: "users", Item: { id, name, email } });
const { Item } = await ddb.get({ TableName: "users", Key: { id } });

// KV equivalent
await env.USERS_KV.put(id, JSON.stringify({ name, email }));
const user = JSON.parse(await env.USERS_KV.get(id));
```

**Use KV when:**
- Single key lookups
- Eventual consistency acceptable
- No queries by index needed
- Simple caching, no joins

### Query by index → D1

When you need filtering, sorting, aggregation:

```typescript
// DynamoDB with GSI
await ddb.query({ 
  TableName: "posts", 
  IndexName: "byTag", 
  KeyConditionExpression: "tag = :t",
  ...
});

// D1 equivalent
await env.DB.prepare(
  "SELECT * FROM posts WHERE tag = ? ORDER BY pubdate DESC LIMIT 10"
).bind(tag).all();
```

**Use D1 when:**
- Queries by index, filter, aggregate
- Joins between tables
- Sorting required
- Relational data

### Hot partition warning

DynamoDB partitions by hash key. KV has no such concept. A hot key can become a
write bottleneck on KV (no partition isolation). For high-throughput workloads,
use D1 with proper indexing or keep DynamoDB behind Worker.

## S3 → R2 Migration Tools

### rclone (Recommended)

```bash
# Configure both remotes
rclone config  # add s3 + r2

# Sync
rclone sync s3:my-bucket r2:my-bucket --progress --transfers=10

# Verify
rclone check s3:my-bucket r2:my-bucket
```

Parallel, resumable, delta sync. Handles 10TB in hours.

### superglue (Cloudflare tool)

Cloudflare's official bulk migration tool for S3 → R2.

### Custom Worker Sync

```typescript
export async function syncToR2(request: Request, env: Env) {
  const { files } = await request.json();
  
  for (const url of files) {
    const s3Response = await fetch(url);
    const body = await s3Response.arrayBuffer();
    const key = url.split("/").pop();
    
    await env.BUCKET.put(key, body, {
      httpMetadata: { contentType: s3Response.headers.get("content-type") }
    });
  }
}
```

## RDS / Aurora → D1 or Hyperdrive

### Small schema → D1

For schemas under 10GB with moderate traffic:

```bash
# Export RDS
pg_dump -h rds-endpoint -U admin dbname > backup.sql

# Convert Postgres → SQLite types
# SERIAL → INTEGER PRIMARY KEY AUTOINCREMENT
# TIMESTAMPTZ → TEXT (ISO 8601)
# JSONB → TEXT (parse in app)

# Import to D1
wrangler d1 execute my-db --file=backup.sql
```

### Large schema → Hyperdrive

Keep Postgres, add Cloudflare edge layer:

```typescript
import postgres from "postgres";

const sql = postgres(env.HYPERDRIVE.connectionString);
const users = await sql`SELECT * FROM users WHERE id = ${id}`;
```

**No stored procedures, arrays, or extensions** in D1. No JSONB operators
(jsonb_extract). Use denormalized columns or Hyperdrive.

## DynamoDB Export to D1

```bash
# DynamoDB export to S3
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:xxx:table/my-table \
  --s3-bucket export-bucket
```

Worker ingestion:

```typescript
export async function importDynamoDB(request: Request, env: Env) {
  const { files } = await request.json();
  
  for (const url of files) {
    const response = await fetch(url);
    const text = await response.text();
    const records = text.split("\n").filter(Boolean).map(JSON.parse);
    
    const stmts = records.map((r) =>
      env.DB.prepare("INSERT INTO users VALUES (?, ?, ?)")
        .bind(r.id, r.name, r.email)
    );
    await env.DB.batch(stmts);
  }
}
```

## Data Type Conversion Guide

| Postgres | DynamoDB | D1/SQLite | Notes |
|----------|----------|-----------|-------|
| SERIAL | N | INTEGER PRIMARY KEY AUTOINCREMENT | Auto-increment ID |
| TIMESTAMPTZ | S | TEXT | ISO 8601 string in app |
| JSONB | S/M | TEXT | json_extract() in queries |
| ARRAY | L | TEXT | JSON encode in app |
| BOOLEAN | BOOL | 1/0 | No native boolean in SQLite |
| DECIMAL | N | REAL | Or TEXT for precision |

## Migration Checklist

- [ ] Identity access patterns (key-value vs query)
- [ ] Check schema size (< 10GB for D1)
- [ ] Identify non-migrable features (stored procs, extensions)
- [ ] Choose target (KV, D1, Hyperdrive, or keep AWS)
- [ ] Plan data sync timing (offline vs incremental)
- [ ] Test with sample data
- [ ] Verify query performance
- [ ] Document rollbacks

## See Also

- `scripts/migrate-dynamodb-to-d1.ts` — DynamoDB migration script
- `scripts/migrate-s3-to-r2.mjs` — S3 to R2 migration
- `skills/aws-migration-preflight/SKILL.md` — Pre-flight checklist
- `skills/aws-post-migration/SKILL.md` — Post-migration cleanup