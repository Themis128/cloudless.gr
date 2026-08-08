# SafeDeploy — atomic-symlink deploys with instant rollback

**SafeDeploy** is the deploy + rollback system for the cloudless.gr Next.js
app on the Pi. It's the answer to "if something breaks, how do I restore to
the last perfect condition immediately?" — the answer is **one command,
~15 seconds, no rebuild required**, and it also **auto-rolls-back if a new
deploy fails health checks**.

Built and verified live 2026-08-08. Rooted in the atomic-symlink pattern
that's been standard for zero-downtime deploys since the Capistrano days.

## What it protects

- The Pi-hosted Next.js app (`deploy-pi.yml` → `k8s deploy/cloudless-app`).
- Not: k3s workloads (`kubectl rollout undo deploy/…` works for those), D1
  (Cloudflare has PITR), R2 (bucket versioning available).

## How it works

**On disk** (omv, Pi 5):

```
/home/tbaltzakis/cloudless-releases/
    ├── <sha-A>/     ← past release (Aug 5)
    ├── <sha-B>/     ← past release (Aug 6)
    └── <sha-C>/     ← current release (Aug 8)
/home/tbaltzakis/cloudless-standalone -> cloudless-releases/<sha-C>
```

The k8s Deployment mounts `cloudless-standalone` via `hostPath` (unchanged).
The atomic operation `ln -sfn cloudless-releases/<sha> cloudless-standalone`
+ `kubectl rollout restart` swaps versions in ~15 seconds. Old releases stay
on disk (last 5 kept), so any of them can be re-selected.

**On deploy** (`deploy-pi.yml` "Sync standalone → releases/ + flip symlink"):
1. Build Next.js standalone.
2. rsync into `releases/<new-sha>/` (staging).
3. Remember the *previous* symlink target for possible rollback.
4. `ln -sfn cloudless-releases/<new-sha> cloudless-standalone` (atomic flip).
5. `kubectl rollout restart` the Deployment.
6. Prune to newest 5 releases.

**On failed deploy** (`deploy-pi.yml` "Verify rollout (auto-rollback on failure)"):
- Poll `/api/health` up to 6× / ~1 min.
- If healthy → success.
- If unhealthy → **flip symlink back to previous, restart, verify** — the
  bad release **never stays live**. Fails the workflow with a clear log
  message so you know a fix is needed.

**Manual rollback** (any time, no rebuild):

```bash
scripts/rollback.sh --check         # show current live + linked SHAs
scripts/rollback.sh list            # list all available releases (newest first)
scripts/rollback.sh previous        # flip to the release before current
scripts/rollback.sh <sha-prefix>    # flip to a specific release
```

The script SSHes to omv over Tailscale, flips the symlink, restarts the
Deployment, and verifies `/api/health` reports the expected SHA. Refuses to
leave things half-flipped.

## Recovery scenarios

| Problem | Response |
|---|---|
| **Deploy fails health check** | Auto-rollback fires inside the workflow. Bad release never stays live. |
| **Site broken 5 min after "successful" deploy** | `scripts/rollback.sh previous` |
| **Need to bisect** | `scripts/rollback.sh list` → pick any of the 5 → flip. Roll forward and backward freely. |
| **Symlink itself corrupt / release dir deleted** | SSH to omv, `ln -sfn cloudless-releases/<known-good-sha> cloudless-standalone` manually. |
| **D1 auth broken** | Different problem — use `scripts/restore-auth.sh` (see `login-500-pi-d1-token` memory). |

## Design decisions

- **Symlink, not bind-mount** — no root/systemd needed; `ln -sfn` is atomic.
  K8s `hostPath` follows the symlink at container startup (verified live).
- **Keep 5 releases** — bounded disk (~94MB each × 5 = 470MB). Prune-safe:
  never deletes the currently-linked release.
- **Same filesystem** — `mv` (atomic) instead of `cp` for the final promote.
- **Health verification includes SHA match** — a rollback that starts a
  process but returns the wrong version is caught (edge case: pod uses a
  cached previous mount). Refuses to declare success.
- **`revisionHistoryLimit`** stays 10 on the Deployment. Not the primary
  rollback path (only holds env-var revisions, not code), but doesn't hurt.

## Testing

Verified 2026-08-08:
- Migration to new layout preserved live site (`/api/health` = ok before
  and after; version unchanged).
- Full pod restart after symlink swap works — k8s does follow the symlink.
- `rollback.sh --check` / `list` / `<sha>` / `previous` all work end-to-end.
- Deliberate flip to a fake SHA correctly triggers the version-mismatch
  guard rather than declaring false success.
- `previous` restores the real release cleanly, `/api/health` recovers.

## What SafeDeploy is NOT

- **Not a snapshot system.** It rolls back code, not user data. D1 rows
  written by a bad release stay in D1. Use Cloudflare D1 PITR for that.
- **Not for the k3s cluster itself.** For k3s workloads (grafana, postiz,
  espocrm, appflowy, etc.), use `kubectl rollout undo deploy/<name>` —
  each Helm-installed deployment keeps its own revision history.
- **Not zero-downtime.** The `cloudless-app` Deployment is
  `strategy: Recreate` (1 replica). Any restart is a brief blip. Adding
  RollingUpdate is a separate change; SafeDeploy is the rollback story
  regardless.

## Related

- `scripts/rollback.sh` — the manual rollback command
- `.github/workflows/deploy-pi.yml` — the deploy pipeline + auto-rollback
- `k8s/cloudless-app-hostpath.yaml` — the Deployment that mounts the symlink
- Project memory `login-500-pi-d1-token` — separate D1 auth recovery
- Project memory `feedback_audit_verify_before_proposing` — meta-lesson
