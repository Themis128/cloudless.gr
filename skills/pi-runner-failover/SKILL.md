---
name: pi-runner-failover
description: "Playbook for keeping CI moving when one or both self-hosted Pi runners (`omv`, `omv-build`) go offline. Covers detection, immediate triage (flip RUNNER_GENERIC to hosted, cancel stuck queued jobs), the per-workflow GH-hosted-with-tailnet fallback pattern, and the operator side (bring Pi runners back). Pairs with `scripts/pi-runner-doctor.sh`."
metadata:
  type: skill
---

# Pi runner failover

When both Pi self-hosted runners (`omv`, `omv-build`) go offline,
workflows pinned to them sit `queued` forever. This skill covers the
3-step response: **detect → triage → restore**.

Read this skill BEFORE flipping `RUNNER_GENERIC`, BEFORE editing a
workflow's `runs-on:`, or BEFORE escalating Pi runner outages — there
is a known recipe for each case, and skipping the recipe leads to
half-broken state (e.g. `RUNNER_GENERIC` flipped but workflows
hard-pinned to Pi still stuck).

## 1. Detect

```bash
bash scripts/pi-runner-doctor.sh
```

What it shows:

- Status of every `self-hosted` runner registered to the repo
- Whether `RUNNER_GENERIC` is set, and to what
- Workflows currently `queued` against Pi runner labels
- Recommended action

You can also do it manually:

```bash
gh api /repos/Themis128/cloudless.gr/actions/runners \
  | jq -r '.runners[] | "\(.name): status=\(.status) busy=\(.busy)"'
gh variable get RUNNER_GENERIC || echo "(unset → ubuntu-latest)"
```

**Trigger thresholds:**

- One Pi runner offline → no action needed; the other absorbs the load
  unless it's also busy. Note it; check in 30 min.
- Both Pi runners offline AND workflows visibly queueing → triage.

## 2. Triage (when both offline)

### Step 2a — flip `RUNNER_GENERIC` to hosted

```bash
.github/scripts/toggle-runner.sh hosted
```

This clears the repo variable. Workflows using the pattern
`runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}`
flip back to GH-hosted on their next run.

**Already-queued jobs are NOT re-routed** — they stay pinned to
whatever was set when they queued. Cancel them:

```bash
gh run list --status queued --limit 30 --json databaseId,workflowName \
  | jq -r '.[] | "\(.databaseId)\t\(.workflowName)"'
# pick the ones targeted at Pi → cancel each:
gh run cancel <id>
```

Then `gh workflow run <name>` to re-trigger them. They'll pick up the
new `RUNNER_GENERIC` value.

### Step 2b — for workflows hard-pinned to Pi, decide

Inventory (run this — list changes as workflows are added):

```bash
grep -l "runs-on:.*self-hosted.*omv.*pi\|runs-on:.*omv.*pi.*build" \
  .github/workflows/*.yml | sed 's|.github/workflows/||'
```

As of 2026-06-22 the 5 hard-pinned workflows are:

| Workflow | Can move to GH-hosted? | How |
|---|---|---|
| `sync-smtp-secrets.yml` | ✅ Yes | Already refactored — pattern below |
| `etl-espocrm-to-lake.yml` | ✅ Yes | Add Tailscale + KUBECONFIG_B64 + OIDC AWS |
| `deploy-alert-api.yml` | ⚠️ Partial | Needs `pi-standby-aws-creds` k8s Secret → requires kubectl from CI; doable |
| `rollout-pi-force.yml` | ❌ No | Literally restarts the Pi k3s service via SSH; needs to be on the Pi or pivot through SSM |
| `wire-pi-cognito-from-pi.yml` | ❌ No | Injects creds into the Pi runner's env; on-Pi by design |

When a hard-pinned workflow is needed during a Pi outage and can't
move, use the **GitHub Actions tailnet fallback** from CLAUDE.md
"Cluster Incident Response" — write the change in a workflow file
(e.g. `prometheus-tune.yml`), `gh pr merge` it, and let the ubuntu
runner do the cluster work via `tailscale/github-action` +
`KUBECONFIG_B64`.

## 3. The GH-hosted-with-tailnet fallback pattern

This is the canonical replacement for `runs-on: [self-hosted, omv, pi, build]`
when the work is "needs AWS + kubectl, doesn't need to be physically
on the Pi":

```yaml
jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      id-token: write     # for OIDC to AWS
      contents: read
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5

      - name: Connect to tailnet
        uses: tailscale/github-action@0263d9e6d793eaefcf1de98ff7fde47abe6664d3 # v3.2.4
        with:
          authkey: ${{ secrets.TS_AUTHKEY }}

      - name: Configure kubectl
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBECONFIG_B64 }}" | base64 -d > ~/.kube/config
          chmod 600 ~/.kube/config

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1

      - name: Run the work
        run: bash scripts/<your-script>.sh
```

Required repo secrets (all already exist):

- `TS_AUTHKEY` — Tailscale ephemeral pre-auth key
- `KUBECONFIG_B64` — `cat ~/.kube/config | base64 -w0` from omv-main;
  uses `system:admin` rolebinding (full cluster access)
- `AWS_DEPLOY_ROLE_ARN` — OIDC trust for `Themis128/cloudless.gr`

Reference workflows that already use this pattern:

- `cluster-doctor.yml` — read-only diagnostics
- `prometheus-tune.yml` — write to cluster (kubectl delete + apply)
- `etl-selfhosted-to-lake.yml` — AppFlowy postgres-direct via
  `kubectl exec`

## 4. Restore (operator-side)

The Pi runners are systemd units on `omv` and `omv-2`:

```bash
ssh tbaltzakis@omv
systemctl --user status actions.runner.Themis128-cloudless.gr.omv
systemctl --user restart actions.runner.Themis128-cloudless.gr.omv

ssh tbaltzakis@omv-2
systemctl --user status actions.runner.Themis128-cloudless.gr.omv-2
systemctl --user restart actions.runner.Themis128-cloudless.gr.omv-2
```

Common reasons they go offline:

1. **Pi rebooted** — runner service is `--user` so it needs the user
   session active. Fix: `loginctl enable-linger tbaltzakis` once.
2. **Disk pressure** — `pi-disk-cleanup.timer` should catch this, but
   if `/srv/dev-disk-by-uuid-a9a5a108-…` (sda1, k3s data) is >85%,
   crictl prune first.
3. **Runner token expired** — re-register from
   `Settings → Actions → Runners → Add new runner`.
4. **Tailnet flap** — `tailscale up --reset` on the Pi.

After restart, verify both come back online:

```bash
gh api /repos/Themis128/cloudless.gr/actions/runners \
  | jq -r '.runners[] | "\(.name): \(.status)"'
```

Flip `RUNNER_GENERIC` back to Pi only if you want to push load there
again:

```bash
.github/scripts/toggle-runner.sh pi
```

## 5. When NOT to use the GH-hosted fallback

Keep the Pi pin (i.e. **don't** add a GH-hosted fallback) when the
work fundamentally needs to be on the Pi:

- Anything that reads `pi-standby-aws-creds` from the Pi's local
  k3s Secret without going through the cluster API
- Anything that writes to a Pi local filesystem (e.g.
  `/etc/rancher/k3s/config.yaml`, OMV web UI, USB-SSD mount)
- Anything that needs to be triggered FROM the Pi (e.g. a heartbeat
  that proves the Pi is healthy — a GH-hosted runner doing it would
  be a lie)

For those, the right answer when the Pi is down is "fix the Pi", not
"move the work."

## Apply this skill

- When you see workflows stuck queued and the Pi runners are offline,
  run `scripts/pi-runner-doctor.sh` first, then follow Step 2.
- When you're adding a new workflow that needs cluster access, default
  to the GH-hosted-with-tailnet pattern (Step 3). Only pin to Pi if it
  hits one of the Step 5 conditions.
- When the Pi runners are flapping, follow Step 4. Don't keep
  flipping `RUNNER_GENERIC` back and forth — it confuses queued jobs.

## See also

- `scripts/pi-runner-doctor.sh` — single-command diagnostic + remediation
- `.github/scripts/toggle-runner.sh` — flip `RUNNER_GENERIC` between
  Pi and hosted modes
- `docs/runners.md` — broader design doc on the runner failover model
- CLAUDE.md "Cluster Incident Response" — the broader pattern (when
  the infra MCP also can't reach the Pi)
- Memory `pi-runner-failover` — pointer to this skill
