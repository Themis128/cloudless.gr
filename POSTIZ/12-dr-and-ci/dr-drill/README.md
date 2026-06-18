# DR drill — quarterly automated restore

## What it does

1. Renders `restore-cluster-template.yaml` substituting `<RECOVERY_TARGET>` with "12 hours ago".
2. `kubectl apply`s it — CNPG provisions a brand-new `postiz-pg-restore-test` cluster, pulling base + WAL from R2.
3. Waits up to 15 min for the cluster to become `Ready`.
4. Connects to the restored primary and runs sanity assertions:
   - `SELECT COUNT(*) FROM "User"` ≥ 1
   - `SELECT COUNT(*) FROM "Post"` ≥ 0 (cluster exists with the schema)
5. Tears down the test cluster.
6. Posts result to Slack — **success** = green ✅, **failure** = red 🚨 with the failing step.

## Why a CronJob and not just docs

Documented drills don't happen. CronJobs do. The whole point: if R2 credentials rotate, retention pruning eats a backup, or barman-cloud breaks across upgrades — you learn from a quarterly Slack ping, not from a Tuesday outage.

## RBAC scope

The drill SA can:
- `create/get/list/delete` CNPG `Cluster` in `postiz` namespace
- `get/list` PG `Pod` (for `exec`)
- `create` `pod/exec` (to run psql inside the restored pod)

It **cannot** touch the production `postiz-pg` cluster or any other namespace. Verified in `rbac.yaml`.

## Schedule tuning

Default `0 3 1 */3 *` = 03:00 UTC, day 1 of every quarter (Jan/Apr/Jul/Oct). Increase to `0 3 1 * *` (monthly) if you're paranoid; the drill costs ~5-10 min of cluster time and a few hundred MB of R2 egress.

## Failure modes the drill catches

| Failure | Symptom |
|---|---|
| R2 creds rotated, CNPG secret stale | Cluster stuck in "WAL fetch failing" — drill times out at step 3 |
| Backups not actually being taken | Cluster comes up but has zero rows — step 4 fails |
| Schema drift (manual DB edits no longer in source) | psql assertion fails on missing table — step 4 fails |
| WAL retention too short, recovery point unreachable | Recovery fails with "no base backup before target" — step 3 fails |
| barman-cloud version skew after CNPG upgrade | Restore pod CrashLoopBackOff — step 3 fails |

All five surface as a clear Slack message that names which step failed.
