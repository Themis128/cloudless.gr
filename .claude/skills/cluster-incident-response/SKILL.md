---
name: cluster-incident-response
description: Diagnose and recover omv k3s cluster outages from a cloud session that has NO kubectl/ssh/aws. Use when auth.cloudless.gr returns 503, a pod is OOMKilled/CrashLoopBackOff, login is down, PrometheusRuleFailures fires, PrometheusKubernetesListWatchFailures fires, k3s API server is down, or the user says "fix what's broken on the cluster", "is the cluster healthy", "recover Keycloak". Drives cluster ops through path-triggered GitHub workflows (hosted runner + Tailscale + KUBECONFIG_B64) that post diagnostics to issue #382.
argument-hint: "what's broken, e.g. 'keycloak 503', 'PrometheusRuleFailures', 'PrometheusKubernetesListWatchFailures', 'k3s API server down'"
---

# Cluster Incident Response — cloudless.gr (omv k3s)

Recover the omv k3s cluster when you're in a **cloud session with no direct
cluster access** — no `kubectl`, `ssh`, `aws`, no `OMV_SSH_KEY_CONTENTS`, and the
tailnet API (`100.113.41.119:6443`) is blocked by the network policy. You drive
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

## Tools (all in repo)

| Command / Workflow | What it does |
| --- | --- |
| `pnpm cluster:doctor` (`scripts/cluster-doctor.sh`) | Read-only diagnostics: node memory/pressure, non-Running pods, a target deploy's pods/limits/events/logs, OOMKilled/CrashLoop, container field-managers & ownership, **Prometheus pod + failing rules** (`/api/v1/rules` via a throwaway curl pod, parsed with `jq`). |
| `.github/workflows/cluster-doctor.yml` | Runs the doctor on a hosted runner over Tailscale, posts the snapshot to **#382**. Trigger by editing `scripts/cluster-doctor.sh` or the workflow. |
| `pnpm keycloak:smoke` (`scripts/keycloak-smoke.sh`) | Credential-free verification of the live login+registration surface (discovery, JWKS, hosted login, registration, token endpoint, next-auth provider, app→Keycloak handoff). |
| `pnpm keycloak:restore` (`scripts/restore-keycloak.sh`) | Direct strategic-merge **patch** of the keycloak deploy (size container to fit heap), restart, verify, with before/after/revert-check logging. |
| `.github/workflows/restore-keycloak.yml` | Runs `keycloak:restore` on a hosted runner, posts the log to #382. Trigger by editing the workflow file. |
| `pnpm prometheus:tune` (`scripts/prometheus-tune.sh`) | Deletes the heavy kube-apiserver SLO/burnrate/availability PrometheusRules that time out and trip `PrometheusRuleFailures`; reports remaining failing rules. |
| `.github/workflows/prometheus-tune.yml` | Runs `prometheus:tune` on a hosted runner, posts the log to #382. Trigger by editing the workflow file. |
| `pnpm keycloak:ensure` (`scripts/keycloak-ensure.sh`) | **Self-heal**: idempotent reconciler that restores auth to its known-good state — OOM-recovers Keycloak (768Mi + `-Xmx512m`), fixes realm flags + the cloudless-app `groups` mapper (`full.path=false`) + admin group/membership, **and restores the Pi `cloudless` app's auth wiring** (`cloudless-app-auth` secret + `envFrom`). Reports only what it `CORRECTED`. |
| `.github/workflows/keycloak-ensure.yml` | Runs `keycloak:ensure` on a **cron (`*/15`)** + dispatch + push; posts to #382 only when it corrects drift or auth is still broken (silent on healthy runs). |
| `.github/workflows/k3s-ssh-restart.yml` | **SSH-based k3s restart** — runs on `ubuntu-latest`, connects via Tailscale, SSHes to Pi with `OMV_SSH_KEY` secret, restarts k3s, waits for port 6443, posts result to #382. Requires `OMV_SSH_KEY` repo secret. |
| `.github/workflows/k3s-restart.yml` | **Runner-based k3s restart** — runs on `[self-hosted, omv, build]`. Only works when the Pi host is up but the runner is alive. Falls back to queued-forever when Pi is down. Prefer `k3s-ssh-restart.yml`. |
| `.github/workflows/k3s-watchdog-deploy.yml` | Deploys `scripts/k3s-watchdog-install.sh` to the Pi via SSH — installs a systemd override (`Restart=always`, no start limit) so k3s auto-recovers without manual intervention. |

## Triage workflow

1. **See the cluster** — fire `cluster-doctor` (edit `scripts/cluster-doctor.sh`
   → PR → squash-merge), wait ~2 min, read #382. Never guess pod state; the
   doctor is your eyes.
2. **Classify the failure mode** — see decision table below.
3. **Apply the fix** by editing the relevant manifest/script and re-triggering
   the workflow (path filter). Read the posted log to confirm it stuck.
4. **Verify** end-to-end (`keycloak:smoke`, or curl the discovery endpoint).

## Failure mode decision table

| Symptom | Likely cause | Tool |
|---|---|---|
| `auth.cloudless.gr` HTTP 503 | Keycloak pod OOMKilled / CrashLoop | `keycloak:restore` → `keycloak:smoke` |
| `auth.cloudless.gr` HTTP 000000 (no TCP) | k3s API server down AND cloudflared tunnel broken | `k3s-ssh-restart` → re-doctor |
| Doctor: `connection refused` on `100.113.41.119:6443` | k3s API server process not listening — Pi host is UP (TCP RST means host is reachable via Tailscale), k3s service has stopped | `k3s-ssh-restart.yml` (if `OMV_SSH_KEY` set) or physical intervention |
| Doctor: `ServiceUnavailable` on `100.113.41.119:6443` | k3s API server starting / overloaded / etcd under pressure | Wait 2–5 min and re-doctor; if persistent, `k3s-ssh-restart.yml` |
| Doctor: all kubectl = `connection refused` AND runner job queued forever | Pi host is completely down (power loss / kernel panic) | Physical access or out-of-band reboot |
| `PrometheusRuleFailures` alert | Heavy `kube-apiserver-burnrate.rules` group timing out | `pnpm prometheus:tune` |
| `PrometheusKubernetesListWatchFailures` alert | Prometheus cannot list-watch the k8s API server — **almost always means the k3s API server is down** | Run doctor first; if API down → `k3s-ssh-restart.yml` |
| Pod `OOMKilled` (exit 137) | Memory limit too low | Raise limit via `kubectl patch` in a cluster-remediate style workflow |
| Pod `CrashLoopBackOff` + probe `connection refused` | Usually still OOMing during startup | Same as OOMKilled |

## Distinguishing `PrometheusRuleFailures` from `PrometheusKubernetesListWatchFailures`

These are **two different alerts** requiring different fixes:

- **`PrometheusRuleFailures`** = Prometheus is running and can talk to the API server, but a specific alerting rule fails to evaluate (e.g. `kube-apiserver-burnrate.rules` — multi-day `rate()` over high-cardinality metrics → `context deadline exceeded`). Fix: `pnpm prometheus:tune`.

- **`PrometheusKubernetesListWatchFailures`** = Prometheus pod is running but cannot reach the Kubernetes API server to discover/watch resources (`GET /api/v1/nodes`, `/api/v1/pods`, etc. all fail). The alert fires from inside the cluster (pod IP `10.42.x.x`), which means pods are still running, but the k3s API server process has crashed or is returning `ServiceUnavailable`. Fix: restart k3s.

## Decoding `connection refused` vs `ServiceUnavailable`

| Error | What it means |
|---|---|
| `dial tcp 100.113.41.119:6443: connect: connection refused` | Pi host is reachable via Tailscale (TCP RST received), but nothing is listening on port 6443 — k3s server process has stopped |
| `Error from server (ServiceUnavailable): the server is currently unable to handle the request` | k3s is listening but the API server is overloaded or starting up — may self-recover in 2–5 min |
| `connection timed out` or no response | Pi host itself unreachable — Tailscale on Pi may be down, or Pi lost power/network |

## SSH recovery path (requires `OMV_SSH_KEY` repo secret)

The most reliable recovery when k3s is down. Requires `OMV_SSH_KEY` (the Pi's
private key, base64-encoded or raw) stored as a GitHub repo secret.

**Add the secret once:**
1. Go to GitHub → Settings → Secrets → Actions → New repository secret
2. Name: `OMV_SSH_KEY`
3. Value: the private key for `omv@100.113.41.119` (same key as `OMV_SSH_KEY_CONTENTS` in the Claude Code session secrets)

**Trigger the restart:** edit `.github/workflows/k3s-ssh-restart.yml` → PR → squash-merge. The workflow SSHes in, restarts k3s, waits for port 6443, and posts the result to #382.

## Hard-won lessons (do not relearn these the hard way)

- **Never cap a JVM container below its `-Xmx` + non-heap working set.** Keycloak
  26.2 (Quarkus) needs heap **plus ~180–220 MiB** non-heap. A 384 MiB cap on a
  `-Xmx512m` heap → `OOMKilled` crash-loop. Size: 512 MiB heap → 768 MiB limit.
- **Keycloak's operative heap variable is `JAVA_OPTS_APPEND`, not `JAVA_OPTS_KC_HEAP`.** Patching the wrong one is a silent no-op.
- **`kubectl apply -f <manifest>` from CI did not stick** while a direct `kubectl patch` did. Prefer strategic-merge patch for recovery.
- **`error=Configuration` on a GET to `/api/auth/signin/keycloak` is NOT a bug.** Real login is POST+CSRF → `302` with `code_challenge_method=S256`.
- **`PrometheusRuleFailures` ≠ `PrometheusKubernetesListWatchFailures`.** See decision table above. Running `pnpm prometheus:tune` does nothing for list-watch failures.
- **`[self-hosted, omv, build]` runners are systemd services on the Pi host**, not k8s pods. They survive k3s crashes — but they also go offline when the Pi itself crashes or loses power. If the job queues for >2 min, the Pi is down.
- **The watchdog is the durable fix.** Run `k3s-watchdog-deploy.yml` once to install `Restart=always` on the k3s systemd unit. This auto-recovers k3s crashes without any manual intervention.
- **`PrometheusKubernetesListWatchFailures` self-resolves** once k3s API server is back up — Prometheus reconnects automatically within a few minutes.

## Reading results

```
mcp__github__issue_read(method="get_comments", owner="themis128",
  repo="cloudless.gr", issue_number=382, perPage=1, page=<last>)
```
Comments are chronological; the newest snapshot/log is the last page.

## Reference

- Keycloak deploy: ns `keycloak`, deploy `keycloak`, image `quay.io/keycloak/keycloak:26.2`, fronted by a Cloudflare tunnel.
- Pi control-plane: `omv` / `192.168.1.128` / Tailscale `100.113.41.119`. k3s kubeconfig: `/etc/rancher/k3s/k3s.yaml`.
- App login path: CloudFront → Lambda (primary) + Pi origin both serve `/api/auth/*`; both hand off to Keycloak once it is up.
- Incident 2026-06-01: Keycloak OOM (384Mi → 768Mi fix). Incident 2026-06-02: k3s API server crash → `PrometheusKubernetesListWatchFailures` + `auth.cloudless.gr` 000000.
