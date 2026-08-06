---
name: cluster-incident-response
description: Diagnose and recover omv k3s cluster outages from a cloud session that has NO kubectl/ssh/aws. Use when a pod is OOMKilled/CrashLoopBackOff, PrometheusRuleFailures fires, PrometheusKubernetesListWatchFailures fires, k3s API server is down, Metabase/DuckDB/ntfy/Grafana/Loki is down, or the user says "fix what's broken on the cluster", "is the cluster healthy", "analytics down", "Grafana unreachable", "ntfy not working". Drives cluster ops through path-triggered GitHub workflows (hosted runner + Tailscale + KUBECONFIG_B64) that post diagnostics to issue #382.
argument-hint: "what's broken, e.g. 'Metabase OOM', 'ntfy crash', 'PrometheusRuleFailures', 'k3s API server down'"
---

# Cluster Incident Response — cloudless.gr (omv k3s)

Recover the omv k3s cluster when you're in a **cloud session with no direct
cluster access** — no `kubectl`, `ssh`, `aws`, no `OMV_SSH_KEY_CONTENTS`, and the
tailnet API (`100.74.191.58:6443`) is blocked by the network policy. You drive
the cluster entirely through **GitHub Actions workflows** that run on a hosted
runner, reach k3s over Tailscale, and **report back into GitHub issue #382**.

## The core constraint & pattern

You cannot run kubectl from the session, and the GitHub MCP here **cannot
dispatch `workflow_dispatch`**. So every cluster action is triggered by a
**path-filtered `push` to `main`**: a workflow has

```yaml
on:
  push: { branches: [main], paths: [".github/workflows/<wf>.yml"] }
```

and editing/merging that file fires it. Workflows run on `ubuntu-latest`,
connect with `tailscale/github-action` (`TS_AUTHKEY`), configure kubectl from
the `KUBECONFIG_B64` secret (it is **`system:admin`** — full write), do the
work, and `gh issue comment 382` the result so you can read it via
`mcp__github__issue_read(method=get_comments, issue_number=382)`.

Workflow runner billing can break — `ubuntu-latest` + Tailscale is the robust
path; do **not** pin recovery to `[self-hosted, omv, pi]` (those runners go
offline during cluster incidents and the job queues forever).

## Cluster Service Map

| Tier | Namespace | Service | Memory limit | OOM risk |
|---|---|---|---|---|
| App | cloudless | cloudless | — | Low |
| App | ntfy | ntfy | 96Mi | Medium (tight) |
| App | n8n | n8n | 256Mi | Low |
| Monitoring | monitoring | prometheus | 700Mi | Low |
| Monitoring | monitoring | grafana | 256Mi | Low |
| Monitoring | monitoring | alertmanager | 128Mi | Low |
| Monitoring | monitoring | loki | 400Mi | Medium |
| Analytics | analytics | metabase | 400Mi | **HIGH** — JVM `-Xmx320m` |
| Analytics | analytics | duckdb-api | 1500Mi | Low |
| Infra | monitoring | etcd-defrag | CronJob | — |
| Infra | monitoring | cluster-alerts | CronJob | — |

## Tools (all in repo)

| Command / Workflow | What it does |
| --- | --- |
| `pnpm cluster:doctor` (`scripts/cluster-doctor.sh`) | **Full diagnostics** — App (cloudless+ntfy+n8n), Monitoring (Prometheus+Grafana+Alertmanager+Loki+rules), Analytics (Metabase+DuckDB), Infra (nodes+etcd+CronJobs), External (HTTP surfaces+runners). Posts to #382. |
| `.github/workflows/cluster-doctor.yml` | Runs the doctor on a hosted runner over Tailscale, posts the snapshot to **#382**. Trigger by editing `scripts/cluster-doctor.sh` or the workflow. |
| `pnpm prometheus:tune` (`scripts/prometheus-tune.sh`) | Removes heavy kube-apiserver burnrate/SLO PrometheusRules that time out and trip `PrometheusRuleFailures`. |
| `.github/workflows/prometheus-tune.yml` | Runs `prometheus:tune` on a hosted runner, posts the log to #382. |
| `scripts/analytics-restore.sh` | Recovers OOMKilled Metabase (patches to 600Mi + restarts) and DuckDB API (restarts if high restarts). |
| `.github/workflows/analytics-restore.yml` | Runs `analytics-restore.sh` on a hosted runner, posts to #382. Trigger by editing the workflow. |
| `scripts/ntfy-restore.sh` | Recovers ntfy from Error/CrashLoopBackOff — patches memory to 128Mi if OOMKilled, restarts. |
| `.github/workflows/ntfy-restore.yml` | Runs `ntfy-restore.sh` on a hosted runner, posts to #382. Trigger by editing the workflow. |
| `.github/workflows/k3s-ssh-restart.yml` | **SSH-based k3s restart** — Tailscale + `OMV_SSH_KEY` secret → SSH to Pi → restart k3s → wait for port 6443. Requires `OMV_SSH_KEY` repo secret. |
| `.github/workflows/k3s-watchdog-deploy.yml` | Deploys `scripts/k3s-watchdog-install.sh` to the Pi via SSH — installs `Restart=always` systemd drop-in so k3s auto-recovers. Requires `OMV_SSH_KEY`. |

## Triage workflow

1. **See the cluster** — fire `cluster-doctor` (edit `scripts/cluster-doctor.sh`
   → PR → squash-merge), wait ~2 min, read #382. Never guess pod state; the
   doctor is your eyes.
2. **Classify the failure mode** — see decision table below.
3. **Apply the fix** by editing the relevant workflow file → PR → squash-merge.
   Read the posted log to confirm it stuck.
4. **Verify** (HTTP check, re-doctor).

## Failure mode decision table

| Symptom | Likely cause | Tool |
|---|---|---|
| Cluster HTTP surfaces 000000 (no TCP) | k3s API server down AND Cloudflare tunnel broken | `k3s-ssh-restart.yml` → re-doctor |
| Doctor: `connection refused` on port 6443 | k3s process stopped (Pi host UP via Tailscale) | `k3s-ssh-restart.yml` (needs `OMV_SSH_KEY`) |
| Doctor: `ServiceUnavailable` on port 6443 | k3s starting / overloaded — wait 2–5 min | Re-doctor; if persistent → `k3s-ssh-restart.yml` |
| Doctor: all kubectl = `connection refused` + runner queued forever | Pi host completely down (power/kernel panic) | Physical access or out-of-band reboot |
| `PrometheusRuleFailures` alert | `kube-apiserver-burnrate.rules` timing out | `prometheus-tune.yml` |
| `PrometheusKubernetesListWatchFailures` alert | Prometheus can't reach k3s API | Run doctor first; if API down → `k3s-ssh-restart.yml` |
| Metabase OOMKilled / CrashLoop | JVM heap exceeds 400Mi container limit | `analytics-restore.yml` (patches to 600Mi) |
| DuckDB API high restarts / OOMKilled | Memory spike from heavy query | `analytics-restore.yml` (restarts DuckDB) |
| Grafana unreachable (HTTP 503) | Pod crash or OOM (256Mi limit) | `kubectl -n monitoring rollout restart deploy/kube-prom-grafana` (via remediate workflow) |
| ntfy in Error / CrashLoopBackOff | Exit 1 or OOM (96Mi limit is tight) | `ntfy-restore.yml` (restart + optional limit raise) |
| Pod `OOMKilled` (exit 137) — any service | Memory limit too low for workload | Patch limit up via strategic-merge patch in a workflow |
| etcd `Failed compaction` in k3s logs | etcd boltdb growing toward quota (no defrag) | Trigger `etcd-defrag` CronJob manually |

## Distinguishing `PrometheusRuleFailures` from `PrometheusKubernetesListWatchFailures`

- **`PrometheusRuleFailures`** = Prometheus is running, talks to the API server, but a specific alerting rule times out (`kube-apiserver-burnrate.rules` — multi-day `rate()` over high-cardinality metrics). Fix: `prometheus-tune.yml`.

- **`PrometheusKubernetesListWatchFailures`** = Prometheus pod is running but cannot reach the Kubernetes API server at all (k3s process crashed or returning `ServiceUnavailable`). Fix: restart k3s.

## Decoding `connection refused` vs `ServiceUnavailable`

| Error | What it means |
|---|---|
| `dial tcp 100.74.191.58:6443: connect: connection refused` | Pi host reachable (TCP RST), k3s process stopped |
| `Error from server (ServiceUnavailable)` | k3s listening but overloaded / starting up — may self-recover |
| `connection timed out` / no response | Pi host unreachable — Tailscale down, power loss |

## SSH recovery path (requires `OMV_SSH_KEY` repo secret)

**Add the secret once:**

1. GitHub → Settings → Secrets → Actions → New repository secret
2. Name: `OMV_SSH_KEY`
3. Value: `cat ~/.ssh/id_ed25519` on the Pi (`omv@100.74.191.58`)

**Trigger:** edit `.github/workflows/k3s-ssh-restart.yml` → PR → squash-merge.

## Hard-won lessons

- **Never cap a JVM container below `-Xmx` + non-heap working set.** Metabase needs 320Mi heap + 128Mi → 450Mi minimum (use 600Mi).
- **`kubectl apply -f <manifest>` from CI did not stick** while a direct `kubectl patch` did. Prefer strategic-merge patch for recovery.
- **`PrometheusRuleFailures` ≠ `PrometheusKubernetesListWatchFailures`.** See decision table. `prometheus:tune` does nothing for list-watch failures.
- **`[self-hosted, omv, build]` runners survive k3s crashes** (systemd service, not k8s pod) but go offline when the Pi itself crashes. If job queues >2 min, the Pi is down.
- **The watchdog is the durable fix** — install it once with `k3s-watchdog-deploy.yml` (`OMV_SSH_KEY` required) to prevent future manual k3s restarts.
- **`PrometheusKubernetesListWatchFailures` self-resolves** once k3s API is back up (Prometheus reconnects automatically).
- **ntfy at 96Mi is fragile** — any spike crashes it. `ntfy-restore.yml` raises to 128Mi by default.
- **Metabase at 400Mi can OOMKill** on heavy dashboard queries. `analytics-restore.yml` patches to 600Mi safely.

## Reading results

```
mcp__github__issue_read(method="get_comments", owner="themis128",
  repo="cloudless.gr", issue_number=382, perPage=1, page=<last>)
```

Comments are chronological; newest snapshot/log is the last page.

## Reference

- Pi control-plane: `omv` / `192.168.1.128` / Tailscale `100.74.191.58`. kubeconfig: `/etc/rancher/k3s/k3s.yaml`.
- Analytics: ns `analytics` — `metabase` (400Mi→600Mi), `duckdb-api` (1500Mi).
- Monitoring: ns `monitoring` — prometheus (700Mi), grafana (256Mi), loki (400Mi), alertmanager (128Mi).
- App services: ntfy (96Mi→128Mi), n8n (256Mi), cloudless (standby).
- Incident 2026-06-02: k3s API crash → `PrometheusKubernetesListWatchFailures`.
