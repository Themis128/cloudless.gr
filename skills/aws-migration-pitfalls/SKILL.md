---
name: aws-migration-pitfalls
description: |
  Avoid 10 common AWS to Cloudflare migration pitfalls. Use when encountering
  migration issues, planning migration, or troubleshooting Worker problems.
  Triggered by phrases like "migration issue", "Lambda rewrite", "DynamoDB hot
  partition", "Postgres JSONB query", "s3 glacier", "Workers CPU limit",
  "Cognito export", "API Gateway stage var", "Lambda VPC", "SQS DLQ",
  "CloudFormation drift", or "migration gotcha".
---

# AWS to Cloudflare Migration Pitfalls

10 real migration pitfalls and how to avoid them.

## ① Python Lambda → must rewrite to TypeScript

Workers Python (Pyodide) is still preview. Rewriting to TypeScript is the standard path.

**Effort estimate:** 1 Python Lambda of 200 lines ≈ 2-4 days TypeScript rewrite.

**Mitigation:**

- Plan language migration upfront
- Allocate buffer time for learning
- Consider strangler fig for gradual transition

## ② DynamoDB hot partitions ≠ KV partitions

DynamoDB partitions by hash key. KV has no partition concept. A hot key can become a
single-key bottleneck on KV (write conflicts).

**Mitigation:**

- For high-throughput: use D1 with indexes OR keep DynamoDB behind Worker
- Monitor write patterns; KV works best for distributed keys
- Consider DOs for session/lock patterns

## ③ Postgres JSONB queries → D1 doesn’t have them

```sql
-- Postgres
SELECT * FROM events WHERE data->>'type' = 'login';
```

```sql
-- D1 (no jsonb op)
SELECT * FROM events WHERE json_extract(data, '$.type') = 'login';
```

**Mitigation:**

- Denormalize to separate columns: `event_type TEXT INDEXED`
- Use SQLite json_extract() function
- Consider Hyperdrive for heavy JSONB workloads

## ④ S3 Glacier lifecycle doesn’t map

R2 has no Glacier tier (cold storage 10x cheaper). Archive pattern differs.

**Mitigation:**

- Store compressed in R2
- Or keep AWS Glacier + Worker proxy
- Plan archive strategy before migration

## ⑤ Lambda memory vs CPU limit

Lambda memory config indirectly sets CPU. Worker charges pure CPU time.

**Mitigation:**

- CPU-bound handlers may hit 30s Worker limit
- Profile handlers before migration
- Consider breaking large handlers into smaller pieces

## ⑥ Cognito user export isn’t easy

Cognito doesn't export password hashes. Users must reset passwords.

**Mitigation:**

- Communicate migration to users
- Plan password reset flow
- Consider phased migration with email notifications

## ⑦ API Gateway stage vars are lost

API Gateway has stageVariables.key. Workers doesn’t.

**Mitigation:**

- Replace with environment variables
- Deploy via Wrangler with per-env config
- Update deployment pipeline for env handling

## ⑧ Lambda VPC doesn’t map

VPC Lambdas access private RDS directly. Edge Workers aren’t in a VPC.

**Mitigation:**

- Use Cloudflare Tunnel or Hyperdrive
- Expose Postgres publicly with auth
- Consider hybrid approach for VPC-dependent services

## ⑨ SQS DLQ ≠ Queues DLQ

SQS DLQ: after N retries, message moves to DLQ. Queues has different config.

**Mitigation:**

- Use dead_letter_queue binding in Queues
- Verify message format compatibility
- Add adapter for existing SQS consumers

## ⑩ CloudFormation drift

IaC (CloudFormation, Terraform AWS) doesn't map to Cloudflare.

**Mitigation:**

- Re-IaC for Cloudflare using Terraform provider
- Coverage differs; plan gaps upfront
- Maintain parallel IaC during transition

## When NOT to migrate

Keep AWS if you have:

- SageMaker training workloads
- EMR / Athena / Redshift (data warehouse)
- Kinesis streaming (high-throughput)
- Lambda on other runtimes (Rust, .NET)
- 100+ Lambdas, 50+ DynamoDB tables (migration cost > savings)
- Deep enterprise discounts (3-year RIs at 60% off)

## Checklist Before Migration

- [ ] Identify non-migrable workloads
- [ ] Budget for language rewrites (Python → TS)
- [ ] Plan data type conversions
- [ ] Configure DNS TTL reduction strategy
- [ ] Document rollback procedures
- [ ] Train team on CF primitives
- [ ] Set up monitoring parity

## See Also

- `skills/aws-migration-strategies/SKILL.md` — Strategy selection
- `skills/aws-data-migration/SKILL.md` — Data migration patterns
- `skills/aws-migration-preflight/SKILL.md` — Pre-flight checklist
- `FULL-CLOUDFLARE-CUTTOVER-PLAN.md` — Full migration plan
