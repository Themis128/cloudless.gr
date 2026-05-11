# /k3s-e2e-rerun — safely retrigger k3s standby E2E

Waits for the deploy-pi.yml rollout to finish (if in progress) before dispatching
the k3s standby E2E, avoiding the timing race where E2E fires against a mid-rollout image.

## Steps

1. **Get HEAD SHA** of main:
   ```powershell
   gh api repos/Themis128/cloudless.gr/git/refs/heads/main --jq '.object.sha'
   ```

2. **Check deploy-pi.yml status** for that SHA:
   ```powershell
   gh run list --repo Themis128/cloudless.gr --workflow deploy-pi.yml --limit 10 --json headSha,status,conclusion,databaseId,url
   ```
   - Find the run whose `headSha` matches HEAD.
   - If `status` is `in_progress` or `queued`, wait and poll every 15 seconds until `status == completed`.
   - If `conclusion` is `failure`, print a warning but continue (E2E will confirm the state).
   - If no run exists for HEAD SHA, note it (SHA may have been superseded) and continue.

3. **Check k3s rollout convergence** — poll `https://cloudless.online/en` until the Pi is self-consistent:
   ```powershell
   # Fetch homepage HTML, extract first /_next/static/chunks/*.js reference,
   # verify it returns HTTP 200. Retry every 10s for up to 2 minutes.
   ```
   If not converged within 2 minutes, print a warning but continue.

4. **Dispatch k3s standby E2E**:
   ```powershell
   gh workflow run "k3s standby E2E" --repo Themis128/cloudless.gr --ref main
   ```

5. **Wait for the new run** to appear (poll `gh run list --workflow "k3s standby E2E" --limit 3` until a run newer than dispatch time appears), then watch it:
   ```powershell
   gh run watch <new-run-id> --repo Themis128/cloudless.gr
   ```

6. Report final conclusion: pass or fail, with a link to the run.

## Notes

- Use PowerShell.
- This is a diagnostic/manual tool — only run it after confirming a rollout completed but the automatic k3s E2E fired too early (timing race).
- Do not use `--force` or skip the convergence check — the polling is what prevents false failures.
