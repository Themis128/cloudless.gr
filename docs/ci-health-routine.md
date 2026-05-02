# Weekly CI Health Routine

A scheduled remote agent (Claude Code routine) checks every Monday morning that
the five GitHub Actions workflows we care about are still green on `main`.

## What it does

Every Monday at **09:00 Athens (06:00 UTC)** the routine runs in Anthropic Cloud
against this repo and inspects the latest run on `main` for each workflow:

- Deploy to Production
- build pi image
- Lighthouse Audit
- Core Web Vitals Route Audit
- Release

A workflow is **healthy** when:

- `conclusion == "success"`, AND
- the run is younger than 14 days (older = the pipeline has gone dormant).

If all five are healthy, the agent emits a single line — `ALL_HEALTHY` — and
exits silently. If any are unhealthy, it produces a markdown report with one
section per failing or stale workflow, including a one-line cause from
`gh run view <id> --log-failed | tail -20` for failures.

The agent is **read-only**: it is not authorized to modify files, push commits,
or re-run workflows. Triage and fix actions remain manual.

## Where to see the output

Each invocation is visible in the routines dashboard:

- **Routine page**: https://claude.ai/code/routines/trig_01WQ7NdStiHu4Ab3DpBrRuiV
- **All routines**: https://claude.ai/code/routines

The routine page shows the full transcript of every prior run (silent success
runs will show only the `ALL_HEALTHY` line).

## Routine configuration

| Field | Value |
|---|---|
| Routine ID | `trig_01WQ7NdStiHu4Ab3DpBrRuiV` |
| Cron | `0 6 * * 1` (06:00 UTC every Monday) |
| Local | 09:00 Europe/Athens (EEST = UTC+3 in summer, UTC+2 in winter) |
| Environment | `cloudless.gr` |
| Model | `claude-sonnet-4-6` |
| Allowed tools | `Bash`, `Read` |
| MCP connectors | none — the built-in `gh` CLI is sufficient |

> **Winter note**: Athens shifts to EET (UTC+2) on the last Sunday of October.
> The cron expression stays at `0 6 * * 1`, so during winter the routine fires
> at 08:00 Athens instead of 09:00. If you want strict 09:00 year-round, switch
> to `0 7 * * 1` from late October to late March.

## Updating, pausing, or deleting

Use the `/schedule` skill in Claude Code, or the routines dashboard:

- **Pause**: dashboard → toggle "enabled" off, or
  `RemoteTrigger {"action":"update","trigger_id":"trig_01WQ7NdStiHu4Ab3DpBrRuiV","body":{"enabled":false}}`
- **Run now (manual test)**: dashboard → "Run now", or
  `RemoteTrigger {"action":"run","trigger_id":"trig_01WQ7NdStiHu4Ab3DpBrRuiV"}`
- **Change schedule**: update with a new `cron_expression`
- **Change prompt**: update with new `job_config.ccr.events`
- **Delete**: only available via the dashboard (the API does not expose
  delete) — go to https://claude.ai/code/routines

## Why a routine instead of a workflow?

Three reasons we deliberately did not put this in `.github/workflows/`:

1. **Self-contained**: the routine runs even if every workflow on this repo is
   broken (including any new "monitor" workflow we'd add). It cannot be killed
   by the same regression it's meant to detect.
2. **Read-only by construction**: the routine is sandboxed and has only
   `Bash` + `Read`. There is no path for it to push commits, re-run jobs, or
   modify infrastructure.
3. **Diagnosis quality**: an LLM agent reads `gh run view --log-failed` output
   and produces one-line root causes. A workflow can only paste raw logs.

## What it does NOT do

- It does not page anyone. Output goes to the routine dashboard only.
- It does not retry failed workflows.
- It does not check the deployed site itself (cloudless.gr availability,
  uptime, etc.) — only the workflows that built and deployed it.
- It does not check workflows that are not in the five-name list. If you add a
  new workflow you care about, update the routine prompt.
