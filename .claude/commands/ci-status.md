# /ci-status — CI health summary for cloudless.gr

Shows the latest run for every active workflow. Flags failures, skips always-passing noise (schedule-only audit workflows), and prints a one-line summary at the end.

## Steps

1. Run `gh run list --repo Themis128/cloudless.gr --limit 100 --json workflowName,status,conclusion,databaseId,createdAt,event,url` to get recent runs.

2. For each unique workflow name, take the most recent run.

3. Group into three buckets:
   - **FAIL** — conclusion is `failure` or `cancelled`
   - **RUNNING** — status is `in_progress` or `queued`
   - **OK** — conclusion is `success` or `skipped`

4. Print the table in this order: FAIL first, then RUNNING, then OK.
   Format each row as:

   ```
   [STATUS] Workflow Name — <link to run>
   ```

5. For each FAIL entry, run `gh run view <id> --repo Themis128/cloudless.gr --log-failed 2>&1 | Select-Object -First 40` and print the relevant error lines.

6. Print a final summary line:

   ```
   ✓ N passing  ● N failing  ⟳ N running
   ```

   If N failing > 0, suggest running `/k3s-e2e-rerun` if the failures are in k3s standby E2E, or inspect the logs above for other failures.

## Notes

- Use PowerShell (`gh` is on PATH).
- For workflows triggered by `workflow_run`, note the upstream trigger name.
- Do not re-run failed workflows automatically — just report.
