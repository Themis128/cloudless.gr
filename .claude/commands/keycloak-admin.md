# /keycloak-admin — export Keycloak admin password to SSM and set permanent login

Gets the Keycloak bootstrap admin password out of the cluster pod and into SSM,
then sets a permanent verified password for `tbaltzakis@cloudless.gr`.
Works from a cloud session — all cluster access goes through GitHub Actions.

## What this command does

1. Checks if `KEYCLOAK_ADMIN_PASSWORD` is already in SSM.
2. If missing, triggers `keycloak-export-admin-password.yml` (push-path trigger)
   to extract it from the Keycloak pod and write it to SSM.
3. Monitors result via issue #382.
4. Once the SSM param exists, triggers `keycloak-finalize-admin.yml` to set
   a permanent password for `tbaltzakis@cloudless.gr` (reads from SSM,
   no GitHub Secret required).

## Steps

### Step 1 — Check current SSM state

Dispatch `keycloak-export-admin-password.yml` with no inputs (it's idempotent).
The push-path trigger fires by touching the workflow file.
Check issue #382 for the result.

Look for:
- `REST_AUTH=ok` — password verified against auth.cloudless.gr
- `SSM_WRITE=done` — written to `/cloudless/production/KEYCLOAK_ADMIN_PASSWORD`

If SSM_WRITE=done, skip to step 3 (finalize).

### Step 2 — Trigger the export workflow

Touch the workflow file to fire it via the push trigger:

```bash
git checkout -b claude/keycloak-admin-$(date +%s)
echo "# triggered $(date -u)" >> .github/workflows/keycloak-export-admin-password.yml
git add .github/workflows/keycloak-export-admin-password.yml
git commit -m "chore: trigger keycloak-export-admin-password"
git push -u origin HEAD
```

Then create + merge the PR immediately. The workflow fires on the push to main.

Monitor issue #382 for `SSM_WRITE=done` or failure details.

**If the workflow fails (k3s API unavailable):**
The workflow retries kubectl exec 5×30s. If all retries fail, the k3s API
server is down — use `k3s-restart` or check cluster health first.

**If the workflow finds the password but REST_AUTH fails:**
Keycloak may be down or the bootstrap password is wrong. Check cluster state.

### Step 3 — Finalize admin (set permanent password)

Once `KEYCLOAK_ADMIN_PASSWORD` is in SSM, trigger `keycloak-finalize-admin.yml`:

Touch it to fire the push trigger, or dispatch it directly.

This workflow:
- Reads the bootstrap password from SSM
- Authenticates to Keycloak REST API
- Sets `tbaltzakis@cloudless.gr` as the permanent admin (proper username/email/password)
- Posts result to issue #382

Look for:
- `PERM_LOGIN=ok` — permanent credentials verified
- Login URL: https://auth.cloudless.gr with `tbaltzakis@cloudless.gr`

## Key SSM parameters

| Parameter | Type | Written by |
|---|---|---|
| `/cloudless/production/KEYCLOAK_ADMIN_PASSWORD` | SecureString | keycloak-export-admin-password.yml |

## Notes

- The Keycloak pod must be running and the k3s API server must be accessible
  via Tailscale for the export to work. Check `cluster-doctor` first if unsure.
- The `keycloak-export-admin-password.yml` workflow uses both a k8s Secret scan
  (API-server only, resilient to kubelet flapping) and kubectl exec as fallback.
- After finalize, the bootstrap password in SSM is no longer the active one.
  Re-running export after finalize would fail REST_AUTH — that's expected.
- `keycloak-finalize-admin.yml` reads `KEYCLOAK_ADMIN_PASSWORD` from SSM;
  it does NOT need the `ADMIN_BOOTSTRAP_PASSWORD` GitHub Secret.
