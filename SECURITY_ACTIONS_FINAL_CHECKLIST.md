# 🔒 Security Actions - Final Checklist

Tasks requiring manual completion via AWS Console or GitHub UI.

Last updated: 2026-05-30

## ⚠️ IMPORTANT: Complete These Steps

### 1. Delete Exposed AWS Credentials (CRITICAL - Do First!)

The following AWS access key was committed to git history and must be deleted:

```
Access Key ID: AKIA[REDACTED — rotated]
Status: Must be deleted from AWS IAM Console
```

**Steps:**
1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
2. Navigate to: Users → cloudless-app → Security credentials
3. Find the access key starting with `AKIA[REDACTED]`
4. Click "Actions" → "Delete"
5. Confirm deletion

### 2. Delete GitHub Secrets (if no longer needed)

Deployments now authenticate to AWS via **OIDC** (`AWS_DEPLOY_ROLE_ARN` +
`role-to-assume`), so the static-key secrets are dead weight and should be removed.

**Verified safe to delete (2026-05-30):** `git grep "secrets.AWS_ACCESS_KEY_ID"`
and `secrets.AWS_SECRET_ACCESS_KEY` across `.github/` return **zero** matches —
no workflow consumes either secret. The only repo mentions are placeholders in
`.env.example` and a comment in `scripts/fix-pi-ssm-permission.py`.

- [ ] Delete `AWS_ACCESS_KEY_ID` from GitHub secrets
- [ ] Delete `AWS_SECRET_ACCESS_KEY` from GitHub secrets
- [ ] Verify deployments still work with OIDC

**How to delete** (either path):

- **GitHub UI:** Settings → Secrets and variables → Actions → 🗑 on each.
- **No UI access?** Use the `gh-secrets` tool with a token that can manage
  Actions secrets (classic PAT `repo` scope, or fine-grained PAT with
  "Secrets: Read & write"):

  ```bash
  # audit
  GITHUB_TOKEN=<pat> pnpm gh:secrets list
  # dry-run (default) — refuses if a workflow still references the secret
  GITHUB_TOKEN=<pat> pnpm gh:secrets delete
  # apply
  GITHUB_TOKEN=<pat> pnpm gh:secrets delete --apply
  ```
