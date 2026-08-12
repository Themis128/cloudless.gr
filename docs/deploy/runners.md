# CI Runner Failover

GitHub Actions has no native runner failover — when GitHub-hosted billing
breaks or hosted capacity is exhausted, `runs-on: ubuntu-latest` jobs are
rejected by the GitHub control plane _before_ any YAML runs, so a workflow
cannot self-detect or recover from it.

This repo gets the same practical result by combining:

1. A **repo variable** (`RUNNER_GENERIC`) that resolves into the `runs-on`
   field at queue time via `fromJSON()`.
2. A **second runner profile** on each Pi host (labels `omv,build`),
   running alongside the existing `pi`-labelled cluster runner.
3. A **one-command toggle** that flips every instrumented workflow between
   GitHub-hosted and Pi-hosted runners.

## How the toggle works

Instrumented workflows declare:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}
```

| `RUNNER_GENERIC` value          | Effective `runs-on`               |
| ------------------------------- | --------------------------------- |
| _unset_ (default)               | `ubuntu-latest`                   |
| `["self-hosted","omv","build"]` | self-hosted Pi build runners      |
| `["self-hosted","omv","foo"]`   | any matching label set you define |

`fromJSON('"ubuntu-latest"')` resolves to the string literal; `fromJSON('[...]')`
resolves to the array. Both shapes are accepted by `runs-on`.

## Toggling

**From the terminal** (requires `gh` CLI):

```bash
# Show current state + runner inventory
.github/scripts/toggle-runner.sh status

# Route generic jobs to the Pi build runners
.github/scripts/toggle-runner.sh pi

# Route them back to ubuntu-latest (clears the variable)
.github/scripts/toggle-runner.sh hosted
```

**From GitHub UI** (no `gh` CLI required — useful in cloud sessions):

Actions → **Switch Runner Mode** → Run workflow → choose `hosted` or `pi`.

This runs `.github/workflows/runner-mode.yml`, which uses `GITHUB_TOKEN`
with `actions: write` to set or clear `RUNNER_GENERIC` directly.

**Already-queued jobs are not re-routed** — cancel and re-run them after
flipping. New runs pick up the new value immediately.

## Workflows opted in

These read `vars.RUNNER_GENERIC` and fail over automatically:

- `ci.yml` (lint, typecheck, format, build, test)
- `deploy-pi.yml` (`build` stays on `[self-hosted, omv, build]`; `rollout` on `[self-hosted, omv-ha, deploy]` — not `RUNNER_GENERIC`)
- `ha-sync-orchestrator.yml`
- `labeler.yml`
- `links-audit.yml`
- `pi-tls-cert-check.yml`
- `pr-review.yml`
- `secret-scan.yml`
- `sha-drift-detector.yml`
- `sha-drift-watchdog.yml`
- `api-contract-audit.yml`
- `bundle-budget.yml`
- `structured-data-audit.yml`
- `seo-hygiene.yml`
- `mcp-security-scan.yml` (pure JS/TS scanner, ARM-safe; informational-only via `continue-on-error: true`)
- `codeql.yml` (CodeQL CLI v4 supports linux-arm64 for JS/TS analysis)
- `preview.yml` (SST/CDK — prior Pi attempt in run `26321031309` hung past timeout under cold-deploy; retrying with 40-min timeout)
- `dependabot-automerge.yml`
- `dependency-review.yml`
- `ecr-lifecycle.yml`
- `i18n-audit.yml`
- `monthly-security-audit.yml`
- `notion-docs-sitemap.yml`
- `notion-schema-check.yml`
- `notion-schema-drift.yml`
- `release.yml`
- `slack-manifest-apply.yml`
- `stale.yml`
- `teardown-staging.yml`
- `weekly-article-draft.yml`
- `weekly-gsc-sync.yml`
- `weekly-newsletter.yml`
- `weekly-subscriber-report.yml`

## Workflows that stay GitHub-hosted

These pin `runs-on: ubuntu-latest` because they need x86_64, a system
Chromium, more RAM than a Pi 4/5 has, or do not converge in a sensible
time on ARM:

- `deploy.yml` (SST → AWS Lambda) — tried failover on 2026-05-23 in run
  [`26321031309`](https://github.com/Themis128/cloudless.gr/actions/runs/26321031309);
  the `Deploy (SST)` step hung past the 40 min job timeout on the omv
  Pi runner. SST + CDK synth + Sentry sourcemap upload don't fit on ARM
  under cold-deploy conditions. **Lesson:** "mostly network-bound" was
  the wrong heuristic — sourcemap upload alone is multi-hundred-MB
  through Sentry's API and CDK synth is CPU-heavy on cold cache. When
  billing is broken this workflow goes red and `cloudless.gr` (Lambda)
  cannot be updated until billing is fixed. The Pi/k3s surface (`pi-origin.cloudless.gr`)
  stays deployable via `deploy-pi.yml` and is the documented failover
  surface, so user-visible features still ship through the secondary.
- `lighthouse.yml` — needs system Chrome; ARM has no official Chromium binary in the runner image.
- `k3s-e2e.yml` — Playwright + browser deps; runs against the live Pi standby so adding Pi-side load is also counterproductive.
- `a11y-audit.yml` — tried failover on 2026-05-23 in run [`26341722748`](https://github.com/Themis128/cloudless.gr/actions/runs/26341722748/job/77544838049); ran for 11 minutes on the omv-build Pi runner and failed. Playwright + Chromium accessibility checks need x86_64 Chrome behaviour; the ARM64 Chromium build does not produce the same axe-core results consistently. Pinned back to ubuntu-latest.

When billing is broken, these stay red until billing is fixed.

## deploy-pi topology (GH build → R2 → CF Workflow → omv pull)

`deploy-pi.yml` **never SSHs or rsyncs to omv**. Compiling or pushing
~350MB onto the Pi 5 control plane pegs the USB SSD and trips the hardware
watchdog / freezes CI.

| Job | `runs-on` | Role |
| --- | --------- | ---- |
| `build` | `ubuntu-24.04-arm` | Next standalone compile; pack (BUILD_ID + tracing deps); upload `releases/<sha>.tar.zst` to R2 bucket `cloudless-pi-releases` |
| `publish` | `ubuntu-latest` (or `RUNNER_GENERIC`) | `POST` Cloudflare Worker `/trigger` → durable Workflow waits on `/api/health` |

**omv** runs `pi-release-pull.timer` (every 2m): reads `desired.json` via the
orchestrator, skips when load/iowait is high, otherwise downloads from R2,
BUILD_ID-gates, flips `cloudless-standalone`, restarts `cloudless-app`.

**Tracking (correlate by sha):** GH step summary + issue [#382](https://github.com/Themis128/cloudless.gr/issues/382) comment;
Workflow Slack/ntfy; `/var/log` via `journalctl -t pi-release-pull`.

Worker: [`workers/pi-deploy-orchestrator/`](../../workers/pi-deploy-orchestrator/).
Install pull agent: `sudo bash infrastructure/omv/install-pi-release-pull.sh`
(after filling `/etc/cloudless/pi-release-pull.env`).

Repo variable: `PI_DEPLOY_ORCHESTRATOR_URL`. Secrets: `DEPLOY_ORCHESTRATOR_TOKEN`,
`CF_ACCOUNT_ID`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`.

- Skip-if-live probes `https://pi-origin.cloudless.gr/api/health`.
- Concurrency group `deploy-pi` with `cancel-in-progress: true`.
- `workflow_dispatch` `trigger_only=true` re-fires the Workflow when the R2
  object already exists.

### Legacy (retired)

Previously rollout used `[self-hosted, omv-ha, deploy]` + rsync. That path
stuck the Pi and left zombie busy runners after power-cycles — do not restore
it on the happy path. `scripts/pi-rollout-from-artifact.sh` remains for
emergency manual use from a trusted host.

## Runner auto-heal after reboot (ghost-busy)

After a power-cycle or sleep, GitHub often shows runners **offline + busy**
while systemd still says `active` — the queue stays blocked until restart
([actions/runner#4312](https://github.com/actions/runner/issues/4312)).

Install on **both** omv and omv-ha:

```bash
# From a machine with the repo checkout:
for host in 192.168.1.128 192.168.1.130; do
  scp infrastructure/omv/gha-runner-heal.sh \
      infrastructure/omv/gha-runner-heal.service \
      infrastructure/omv/gha-runner-heal-check.service \
      infrastructure/omv/gha-runner-heal.timer \
      infrastructure/omv/install-gha-runner-heal.sh \
      tbaltzakis@$host:/tmp/gha-heal/
  ssh tbaltzakis@$host "sudo bash /tmp/gha-heal/install-gha-runner-heal.sh"
done
```

- **Boot:** `gha-runner-heal.service` restarts every `actions.runner.*` unit.
- **Every 5 min:** timer runs `--check` and restarts units that are active
  but have no `Runner.Listener` process.

Manual recovery:

```bash
sudo systemctl restart 'actions.runner.*'
# or
sudo /usr/local/sbin/gha-runner-heal.sh --boot
```

## Setting up the second runner profile on each Pi host

The existing runner (`~/actions-runner`, labels `omv,pi`) stays put. We add a
second runner (`~/actions-runner-build`, labels `omv,build`) so cluster jobs
and generic jobs don't queue behind each other.

On each Pi host (`omv` = omv-main Pi 5, `omv-ha` = secondary):

1. Generate a registration token at
   <https://github.com/Themis128/cloudless.gr/settings/actions/runners> →
   **New self-hosted runner** (or via CLI: `gh api -X POST repos/Themis128/cloudless.gr/actions/runners/registration-token --jq '.token'`).
2. Run the bootstrap script (token expires in 1 hour, so do it inline):

   ```bash
   ./.github/scripts/register-build-runner.sh <REG_TOKEN> omv-build
   #                                                       omv-2-build
   ```

   The script handles download, config, systemd install, and start in one shot.
   For hosts without `gh` installed, rsync the binaries from omv-main first:

   ```bash
   # On omv-main:
   rsync -a --exclude '_work' --exclude '_diag' ~/actions-runner-build/ tbaltzakis@192.168.1.130:~/actions-runner-build/
   ```

3. Verify all runners online:

   ```bash
   gh api repos/Themis128/cloudless.gr/actions/runners \
     --jq '.runners[] | {name, status, labels: [.labels[].name]}'
   ```

Current active fleet (as of 2026-08-12):

| Host     | IP / Tailscale              | Runner name      | Labels                                         | Status / role |
| -------- | --------------------------- | ---------------- | ---------------------------------------------- | ------------- |
| omv-main | 192.168.1.128 / 100.74.191.58 | `omv`          | `self-hosted, Linux, ARM64, omv, pi`           | cluster jobs |
| omv-main | 192.168.1.128               | `omv-build`      | `self-hosted, Linux, ARM64, omv, pi, build`    | Docker / `build-pi-image.yml` only — **not** `deploy-pi` Next build |
| omv-ha   | 192.168.1.130 / 100.95.117.84 | `omv-ha-deploy` | `self-hosted, Linux, ARM64, omv-ha, deploy`   | **deploy proxy** (`deploy-pi` rollout) |
| omv-ha   | 192.168.1.130               | `omv-2-build`    | `self-hosted, Linux, ARM64, omv, build`        | optional spare — **do not** use for Next builds (1GB RAM) |
| GitHub   | hosted                      | `ubuntu-24.04-arm` | (managed)                                   | **Next standalone build** (`deploy-pi` build job) |

The `pi` label is for cluster-local jobs (NodePort audits, kubectl, CWV).
The `build` label is for heavy Docker work on omv (Pi 5), **not** for
`deploy-pi` Next compile:

| Labels | Purpose | Workflows |
| ------ | ------- | --------- |
| `ubuntu-24.04-arm` | Next standalone **build** + artifact upload | `deploy-pi.yml` (build) |
| `self-hosted, omv, build` | Docker arm64 image build (ECR path) | `build-pi-image.yml` |
| `self-hosted, omv-ha, deploy` | rsync SafeDeploy + kubectl over SSH to omv | `deploy-pi.yml` (rollout) |
| `self-hosted, omv, pi` | Cluster reachability, NodePort Lighthouse, alert-api import | `core-web-vitals-audit.yml`, `cluster-status-audit.yml`, `deploy-alert-api.yml` |

Do **not** put CWV, cluster-status, or ETL on exclusive `build` — one busy
Lighthouse run previously queued Docker builds for tens of minutes.

`deploy-pi` concurrency uses `cancel-in-progress: true` so rapid main merges
supersede older in-progress runs. A skip step no-ops when `/api/health`
already reports `version == github.sha`.

## Caveat: Pi runners share resources with production

Pi 5 (`omv`) also runs the `cloudless` k3s pod that serves
`pi-origin.cloudless.gr`. `deploy-pi` Next compile no longer runs there, but
Docker builds (`build-pi-image.yml` on `omv-build`) and other `omv,pi` jobs
still share disk/CPU with prod. If you park heavy work on omv, consider:

- A `nice -n 19` wrapper on the runner systemd unit
- `cpuset.cpus` cgroup limit on the runner service
- Reducing CI concurrency by setting a smaller `jobs.<id>.strategy.max-parallel`

For a short billing-block outage, none of this is needed — flip, ship the
critical PR, flip back.

## References

- [GitHub Docs — Choosing the runner for a job](https://docs.github.com/en/actions/using-jobs/choosing-the-runner-for-a-job)
- [GitHub Docs — Configuring the self-hosted runner application as a service](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service)
- [GitHub Community — Dynamic runs-on labelling (Discussion #49302)](https://github.com/orgs/community/discussions/49302)
