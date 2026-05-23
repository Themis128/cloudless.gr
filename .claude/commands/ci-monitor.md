# /ci-monitor — Full CI health dashboard

Comprehensive CI health check across all three repos. Runs in parallel and gives a single at-a-glance status.

## Steps

1. **CI summary for each repo** — call `mcp__cloudless-infra__gh_ci_summary` for:
   - `cloudless.gr` (limit 100)
   - `cloudless-manager` (limit 30)
   - `omv-ha` (limit 30)

   Run all three in parallel. Each call returns a HEALTHY/DEGRADED/CRITICAL verdict with per-workflow breakdown.

2. **Runner fleet health** — call `mcp__cloudless-infra__gh_runner_health` for `cloudless.gr` to get the fleet status and detect zombie runners or billing locks.

3. **Deployment status** — call `mcp__cloudless-infra__gh_deployment_status` for `cloudless.gr` / `deploy-pi.yml` to confirm what SHA is live and when it deployed.

4. **Triage failing runs** — for any workflow showing `❌ FAILING` across any repo:
   - Note the run ID from the summary output
   - Call `mcp__cloudless-infra__gh_workflow_failure_logs` with that run ID (max_lines 60) to surface the error
   - Print the first meaningful error line(s)

5. **Print a consolidated summary table**:
   ```
   Repo                  Verdict     Fail  Running  OK
   ─────────────────────────────────────────────────
   cloudless.gr          HEALTHY       0        0    N
   cloudless-manager     HEALTHY       0        0    N
   omv-ha                HEALTHY       0        0    N

   Runners:   N/N online, N busy
   Live SHA:  xxxxxxxx (deployed Xh ago)
   ```

6. If anything is DEGRADED or CRITICAL, suggest the appropriate follow-up:
   - Runner issues → `/runner-ops` or `gh_runner_restart`
   - Billing lock → go to github.com/settings/billing
   - Failing workflow → `gh_workflow_failure_logs` or `/ci-flaky` to check if it's flaky

## Notes

- Do not re-run failed workflows automatically — diagnose first.
- If a workflow has been failing for >24h and is not flaky, it is likely a real regression.
- The `lh-artifact-download` and `cwv-pr-push` workflows are known-stale — skip them in the summary.
