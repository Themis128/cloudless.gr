---
name: cluster-incident-response
description: Diagnose and recover omv k3s cluster outages from a cloud session that has NO kubectl/ssh/aws. Use when auth.cloudless.gr returns 503, a pod is OOMKilled/CrashLoopBackOff, login is down, PrometheusRuleFailures fires, or the user says "fix what's broken on the cluster", "is the cluster healthy", "recover Keycloak". Drives cluster ops through path-triggered GitHub workflows (hosted runner + Tailscale + KUBECONFIG_B64) that post diagnostics to issue #382, plus the cluster:doctor / keycloak:smoke / keycloak:restore scripts.
argument-hint: "what's broken, e.g. 'keycloak 503' or 'PrometheusRuleFailures'"
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
| `pnpm keycloak:ensure` (`scripts/keycloak-ensure.sh`) | **Self-heal**: idempotent reconciler that restores auth to its known-good state — OOM-recovers Keycloak (768Mi + `-Xmx512m`), and fixes realm flags + the cloudless-app `groups` mapper (`full.path=false`) + admin group/membership. Reports only what it `CORRECTED`. |
| `.github/workflows/keycloak-ensure.yml` | Runs `keycloak:ensure` on a **cron (`*/15`)** + dispatch + push; posts to #382 only when it corrects drift or auth is still broken (silent on healthy runs). This is the auto-recovery that brings auth back to the last working condition. |

## Triage workflow

1. **See the cluster** — fire `cluster-doctor` (edit `scripts/cluster-doctor.sh`
   → PR → squash-merge), wait ~2 min, read #382. Never guess pod state; the
   doctor is your eyes.
2. **Classify** the broken pod: `OOMKilled (exit 137)` = memory; `Error/Completed`
   = app/config; `CrashLoopBackOff` with probe `connection refused` = process
   never reaches ready (often still OOM during startup).
3. **Apply the fix** by editing the relevant manifest/script and re-triggering
   the workflow (path filter). Read the posted log to confirm it stuck (the
   restore script prints `before / immediately-after / +15s revert-check`).
4. **Verify** end-to-end (`keycloak:smoke`, or curl the discovery endpoint).

## Hard-won lessons (do not relearn these the hard way)

- **Never cap a JVM container below its `-Xmx` + non-heap working set.** Keycloak
  26.2 (Quarkus) needs heap **plus ~180–220 MiB** non-heap (metaspace, threads,
  code cache, GC, startup augmentation). A 384 MiB cap on a `-Xmx512m` heap →
  `OOMKilled` crash-loop → `auth.cloudless.gr` 503. Size the container to the
  heap (512 MiB heap → 768 MiB limit). Actual RSS is ~500 MiB regardless of the
  ceiling, and a higher *limit* does not raise real usage — it only stops the
  kernel OOMKill.
- **Keycloak's operative heap variable is `JAVA_OPTS_APPEND`, not
  `JAVA_OPTS_KC_HEAP`.** Patching the wrong one is a silent no-op. Verify with
  the doctor's deploy `env` dump.
- **`kubectl apply -f <manifest>` from CI did not stick** while a direct
  `kubectl patch` did — and the deploy's `last-applied-configuration` revealed
  the apply never reached it. Prefer a direct strategic-merge **patch** of the
  single object for recovery; confirm with a revert-check (re-read after 15 s).
- **error=Configuration on a GET to `/api/auth/signin/keycloak` is NOT a bug.**
  next-auth's real flow is **POST + CSRF**; that returns `302 → auth.cloudless.gr/
  …/openid-connect/auth?…code_challenge_method=S256`. Always test login with the
  POST+CSRF flow, not a bare GET.
- **`PrometheusRuleFailures` is usually a specific broken rule, not memory** —
  but check first: the doctor shows the prometheus pod restarts/OOM and the
  failing rule's `lastError`. Only raise Prometheus's memory if it is actually
  OOMing. The known offender here is the kube-prometheus-stack
  **`kube-apiserver-burnrate.rules`** group (e.g. `apiserver_request:burnrate3d`):
  multi-day `rate()` over high-cardinality `apiserver_request_total` →
  `expanding series: context deadline exceeded`. Fix with `pnpm prometheus:tune`
  (deletes the heavy apiserver SLO/burnrate/availability rule groups — unused on
  this homelab). Durable fix: Helm values
  `defaultRules.rules.kubeApiserverBurnrate/Availability/Slos: false`.
- **Watch omv memory.** Node limits are oversubscribed (>130%); raising one
  pod's ceiling is fine (limits ≠ usage) but confirm `MemoryPressure: False`
  and node memory headroom in the doctor before/after.

## Reading results

```
mcp__github__issue_read(method="get_comments", owner="themis128",
  repo="cloudless.gr", issue_number=382, perPage=1, page=<last>)
```
Comments are chronological; the newest snapshot/log is the last page.

## Reference

- Incident writeup & memory math: `docs/cluster-memory-relief-2026-05-31.md`
  (the "Correction (2026-06-01)" section).
- Keycloak deploy: ns `keycloak`, deploy `keycloak`, image
  `quay.io/keycloak/keycloak:26.2`, fronted by a Cloudflare tunnel (503 "no
  available server" = origin/pod down).
- App login path: CloudFront → Lambda (primary) and the Pi origin both serve
  `/api/auth/*`; both hand off to Keycloak correctly once it is up.
