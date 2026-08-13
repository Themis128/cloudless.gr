# CI Runner Failover & Capacity

No Jenkins (or other CI controller) on omv. Capacity is **GitHub Actions**
plus **omv systemd timers** for deploy pull / heal / housekeeping.

## Capacity matrix (defaults)

| Workload | Default runner | Failover | Hard rule |
| -------- | -------------- | -------- | --------- |
| PR CI (`ci.yml`, lint/typecheck/unit) | `ubuntu-latest` via `RUNNER_GENERIC` | Pi `["self-hosted","omv","build"]` | OK on Pi for short jobs |
| `deploy-pi` Next **build** | `ubuntu-24.04-arm` | — | Never compile Next on omv happy path |
| `deploy-pi` **publish** + edge smoke | `ubuntu-latest` via `RUNNER_GENERIC` | Pi build pool | Smoke is curl-only |
| Lighthouse / Playwright e2e / a11y | `ubuntu-latest` via `RUNNER_X64` | Legion `["self-hosted","legion","x64"]` | **Never** omv/`RUNNER_GENERIC=pi` |
| Cluster-bound (`omv,pi`) | self-hosted Pi | — | CWV, kubectl, NodePort probes only |
| Mail host (`omv-ha`) | — | — | No always-on heavy CI |

**`RUNNER_GENERIC=pi` never applies to Lighthouse / e2e / a11y.** Those use
`RUNNER_X64` only. Pi `build` stays for Docker/image/ETL-style jobs.

```yaml
# Generic CI / publish
runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}

# Browser suites (lighthouse.yml, e2e-full-coverage.yml, a11y-audit.yml)
runs-on: ${{ fromJSON(vars.RUNNER_X64 || '"ubuntu-latest"') }}
```

## Post-deploy truth

Production edge: `cloudless.gr` → Worker `cloudless2` → Tunnel → k3s
`cloudless-app` on omv. Deploy happy path:

1. `deploy-pi.yml` builds on `ubuntu-24.04-arm`, uploads R2 artifact
2. `publish` POSTs Cloudflare Workflow `/trigger` (durable `/api/health` wait)
3. omv `pi-release-pull.timer` pulls when load OK
4. GH **edge smoke** (same publish job) polls health SHA + `/en`, `/en/store`, `/en/contact`
5. `lighthouse.yml` runs on `workflow_run` success of
   **Deploy to Pi (R2 + Cloudflare Workflows pull)**

Do **not** restore SSH/rsync rollout as the happy path.

## How the toggles work

| Variable | Unset (default) | Set value | Affects |
| -------- | --------------- | --------- | ------- |
| `RUNNER_GENERIC` | `ubuntu-latest` | `["self-hosted","omv","build"]` | Instrumented generic CI + deploy-pi publish |
| `RUNNER_X64` | `ubuntu-latest` | `["self-hosted","legion","x64"]` | Lighthouse, e2e-full-coverage, a11y-audit |

`fromJSON('"ubuntu-latest"')` → string; `fromJSON('[...]')` → label array.
Both shapes are valid for `runs-on`.

### CLI

```bash
.github/scripts/toggle-runner.sh status
.github/scripts/toggle-runner.sh pi          # RUNNER_GENERIC → omv build
.github/scripts/toggle-runner.sh hosted      # clear RUNNER_GENERIC
.github/scripts/toggle-runner.sh x64-legion  # RUNNER_X64 → Legion WSL
.github/scripts/toggle-runner.sh x64-hosted  # clear RUNNER_X64
```

### GitHub UI

Actions → **Switch Runner Mode** → `hosted` | `pi` | `x64-hosted` | `x64-legion`
(`.github/workflows/runner-mode.yml`).

**Already-queued jobs are not re-routed** — cancel and re-run after flipping.

## Workflows on `RUNNER_GENERIC`

- `ci.yml`, `ha-sync-orchestrator.yml`, `labeler.yml`, `links-audit.yml`,
  `pi-tls-cert-check.yml`, `pr-review.yml`, `secret-scan.yml`,
  `sha-drift-detector.yml`, `sha-drift-watchdog.yml`, `api-contract-audit.yml`,
  `bundle-budget.yml`, `structured-data-audit.yml`, `seo-hygiene.yml`,
  `mcp-security-scan.yml`, `codeql.yml`, `preview.yml`,
  `dependabot-automerge.yml`, `dependency-review.yml`, `ecr-lifecycle.yml`,
  `i18n-audit.yml`, `monthly-security-audit.yml`, `notion-docs-sitemap.yml`,
  `notion-schema-check.yml`, `notion-schema-drift.yml`, `release.yml`,
  `slack-manifest-apply.yml`, `stale.yml`, `teardown-staging.yml`,
  `weekly-article-draft.yml`, `weekly-gsc-sync.yml`, `weekly-newsletter.yml`,
  `weekly-subscriber-report.yml`
- `deploy-pi.yml` **publish** job only (`build` stays on `ubuntu-24.04-arm`)

## Workflows on `RUNNER_X64` (browser / Chrome)

- `lighthouse.yml`
- `e2e-full-coverage.yml`
- `a11y-audit.yml`

Default remains GitHub-hosted. Set `RUNNER_X64` only when Legion WSL is online.

## Workflows that stay pinned / cluster-bound

- `deploy.yml` (SST) — stays GH-hosted; does not fit Pi cold-deploy
- `k3s-e2e.yml` — GH-hosted Playwright against live cluster (do not add Pi load)
- `core-web-vitals-audit.yml` — `[self-hosted, omv, pi]` (leave unless lab CWV moves off-box)
- Cluster remediations (`cluster-doctor.yml`, `k3s-restart.yml`, …) —
  path-triggered / `workflow_dispatch`; no app CronJob for deploys

## deploy-pi topology (GH build → R2 → CF Workflow → omv pull)

`deploy-pi.yml` **never SSHs or rsyncs to omv** on the happy path.

| Job | `runs-on` | Role |
| --- | --------- | ---- |
| `build` | `ubuntu-24.04-arm` | Next standalone; upload `releases/<sha>.tar.zst` to R2 |
| `publish` | `ubuntu-latest` (or `RUNNER_GENERIC`) | `/trigger` + edge smoke + issue #382 comment |

**omv** `pi-release-pull.timer` (every 2m): reads `desired.json`, skips when
load/iowait high, downloads from R2, BUILD_ID-gates, flips symlink, restarts app.

Worker: [`workers/pi-deploy-orchestrator/`](../../workers/pi-deploy-orchestrator/).
Install: `sudo bash infrastructure/omv/install-pi-release-pull.sh`.

Repo variable: `PI_DEPLOY_ORCHESTRATOR_URL`. Secrets: `DEPLOY_ORCHESTRATOR_TOKEN`,
`CF_ACCOUNT_ID`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`.

- Skip-if-live probes `https://pi-origin.cloudless.gr/api/health`
- Concurrency `deploy-pi` / `cancel-in-progress: true`
- `workflow_dispatch` `trigger_only=true` re-fires Workflow when R2 object exists

### Legacy (retired)

SSH/rsync via omv-ha deploy runner is retired. Do not restore on the happy
path. `scripts/pi-rollout-from-artifact.sh` remains for emergency manual use.

## omv timers (ops checklist — no new CI server)

| Timer | Role |
| ----- | ---- |
| `pi-release-pull.timer` | Pull R2 release when load OK |
| `safedeploy-watchdog.timer` | Health + auto-rollback |
| `gha-runner-heal.timer` | Ghost-busy runner heal after reboot |
| `pi-connectivity-heal.timer` | SSH/Tailscale heal |
| `cloudless-cleanup.timer` | Host housekeeping |
| `k3s-etcd-defrag.timer` | Weekly etcd defrag (Sunday) |

### After power-cycle

1. `systemctl is-active k3s-k3s-omv.service` (not bare `k3s.service`)
2. Heal timer installed: `systemctl is-active gha-runner-heal.timer`
3. Runners online in GitHub → Settings → Actions → Runners
4. App: `kubectl -n … get pods` / edge `curl -sI https://cloudless.gr` shows
   `x-served-by: pi-tunnel-proxy`

Manual runner heal:

```bash
sudo systemctl restart 'actions.runner.*'
# or
sudo /usr/local/sbin/gha-runner-heal.sh --boot
```

Install heal on omv (and omv-ha if it still hosts a runner):

```bash
sudo bash infrastructure/omv/install-gha-runner-heal.sh
```

## Legion WSL runner (x64 browser failover)

Use only when GH-hosted billing/capacity fails for Chrome suites. Labels:
`self-hosted`, `legion`, `x64`. Workdir: `~/actions-runner-legion`
(separate from any omv profile).

### Register (once, on Legion WSL2)

```bash
mkdir -p ~/actions-runner-legion && cd ~/actions-runner-legion
curl -fsSL -o actions-runner-linux-x64.tar.gz \
  https://github.com/actions/runner/releases/download/v2.323.0/actions-runner-linux-x64-2.323.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

TOKEN=$(gh api -X POST repos/Themis128/cloudless.gr/actions/runners/registration-token --jq .token)
./config.sh --url https://github.com/Themis128/cloudless.gr \
  --token "$TOKEN" \
  --name legion-wsl \
  --labels self-hosted,legion,x64 \
  --work _work

# User systemd so the runner survives logout (linger required once):
sudo loginctl enable-linger "$USER"
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/actions.runner.legion.service <<'EOF'
[Unit]
Description=GitHub Actions runner (legion x64)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/actions-runner-legion
ExecStart=%h/actions-runner-legion/run.sh
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now actions.runner.legion.service
```

Pin the runner tarball version to whatever
[actions/runner releases](https://github.com/actions/runner/releases) lists
as current when you install; bump on upgrade.

### Fail over browser suites

```bash
.github/scripts/toggle-runner.sh x64-legion   # when Legion is Idle in GH UI
# … re-run failed LH / e2e / a11y …
.github/scripts/toggle-runner.sh x64-hosted   # restore default
```

Install Chrome/Playwright deps in WSL before the first run
(`npx playwright install --with-deps chromium` from a checkout).

## Pi build runner profile (omv)

Existing runner (`~/actions-runner`, labels `omv,pi`) stays. Optional second
profile (`~/actions-runner-build`, labels `omv,build`) for Docker/image work:

```bash
./.github/scripts/register-build-runner.sh <REG_TOKEN> omv-build
```

| Labels | Purpose | Workflows |
| ------ | ------- | --------- |
| `ubuntu-24.04-arm` | Next standalone build + R2 upload | `deploy-pi.yml` (build) |
| `self-hosted, omv, build` | Docker arm64 / spare generic CI | `build-pi-image.yml`, `RUNNER_GENERIC=pi` |
| `self-hosted, omv, pi` | Cluster reachability, CWV | `core-web-vitals-audit.yml`, cluster audits |
| `self-hosted, legion, x64` | Browser suite failover | via `RUNNER_X64` only |

Do **not** put CWV or full Playwright on exclusive `build` — one busy browser
run queues Docker builds for tens of minutes.

## Caveat: Pi runners share resources with production

omv runs `cloudless-app`. Prefer GH-hosted or Legion for Chrome. If you must
park work on omv: `nice`, cgroup CPU limits, lower `max-parallel`.

## Lab vs CI Lighthouse

| Surface | Config | Command / trigger |
| ------- | ------ | ----------------- |
| **Lab (local)** | [`lighthouserc.local.cjs`](../../lighthouserc.local.cjs) | `pnpm lighthouse:audit` → [`scripts/lighthouse-local.sh`](../../scripts/lighthouse-local.sh) |
| **CI (post-deploy)** | [`.github/lighthouserc.cjs`](../../.github/lighthouserc.cjs) + budget | `lighthouse.yml` after successful Deploy to Pi (+ daily cron / `workflow_dispatch`) |

Lab audits hit whatever URL you pass (often production or local). CI uses the
budgeted CI config against the live edge after deploy. See also
[`docs/performance/`](../performance/).

## References

- [GitHub Docs — Choosing the runner for a job](https://docs.github.com/en/actions/using-jobs/choosing-the-runner-for-a-job)
- [GitHub Docs — Configuring the self-hosted runner application as a service](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service)
- [GitHub Community — Dynamic runs-on labelling (Discussion #49302)](https://github.com/orgs/community/discussions/49302)
