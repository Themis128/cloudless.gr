# R20: Postgres logical replication subscriber (AppFlowy → AWS)

Constraint: existing AWS services only (Lambda + DynamoDB). No EC2/RDS.

Flow:

1. AppFlowy postgres publishes logical decoding via wal2json.
2. In-cluster relay CronJob / sidecar posts change batches to
   `POST /api/admin/ops/replication` (or a dedicated Lambda URL).
3. Lambda subscriber writes normalized rows into DynamoDB.

This tree is the AWS-side subscriber + postgres publisher config.
Full RPO-seconds HA is optional; daily R10 backups remain the baseline.

## Files

| File | Role |
|------|------|
| `wal2json-config.yaml` | Postgres ConfigMap for logical decoding on AppFlowy |
| `subscriber.ts` | Lambda / Node handler: decode change batch → DynamoDB PutItem |
| `README.md` | This runbook |

## Enable publisher (Pi)

```bash
# Apply wal2json settings (requires postgres restart)
kubectl -n appflowy apply -f infrastructure/r20-replication/wal2json-config.yaml
kubectl -n appflowy rollout restart deploy/postgres
```

Create a publication (one-time, from inside the postgres pod):

```sql
CREATE PUBLICATION cloudless_appflowy FOR ALL TABLES;
SELECT * FROM pg_create_logical_replication_slot('cloudless_appflowy', 'wal2json');
```

## Deploy subscriber (AWS)

Package `subscriber.ts` as a Node 20 Lambda (or invoke from an admin API
route during early validation). Required env:

- `AWS_REGION` (us-east-1)
- `R20_DDB_TABLE` — destination table (e.g. `cloudless-ReplicationMirror-production`)

## Verify

```bash
# Peek replication slot
kubectl -n appflowy exec deploy/postgres -- \
  psql -U postgres -c "SELECT slot_name, active FROM pg_replication_slots;"

# Invoke subscriber with a sample payload
aws lambda invoke --function-name cloudless-r20-subscriber \
  --payload '{"changes":[{"kind":"insert","table":"af_user","columns":[{"name":"id","value":"1"}]}]}' \
  /tmp/r20-out.json
```

## Rollback

```sql
SELECT pg_drop_replication_slot('cloudless_appflowy');
DROP PUBLICATION cloudless_appflowy;
```

Remove the ConfigMap and restart postgres without logical decoding args.
