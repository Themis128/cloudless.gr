# Deploy to Production

This document describes the CI/CD pipeline for deploying cloudless.gr to AWS using
[SST v4](https://sst.dev) and GitHub Actions OIDC.

## Overview

The deploy workflow (`.github/workflows/deploy.yml`) runs automatically on every push to
`main` that touches source files, and can also be triggered manually via `workflow_dispatch`.

### Steps

1. Checkout + install dependencies
2. Lint, type-check, unit tests
3. Bump service-worker `CACHE_VERSION` to the current short SHA
4. Assume the deploy role via OIDC (`aws-actions/configure-aws-credentials`)
5. **Preflight permissions check** — verifies the assumed role can tag IAM resources
6. Notify Slack — deploy started
7. `pnpm sst deploy --stage production`
8. Notify Slack — success or failure

## Required IAM permissions for the deploy role

The role referenced by the `AWS_DEPLOY_ROLE_ARN` repository secret must have, at minimum,
the permissions below. This list is **in addition to** the standard permissions SST needs
(CloudFormation, Lambda, S3, CloudFront, Route 53, ACM, etc.).

### IAM role-tagging (required by SST `defaultTags`)

`sst.config.ts` sets `defaultTags` on the AWS provider, which causes SST/Pulumi to call
`iam:TagRole` / `iam:UntagRole` on every IAM Role it manages (e.g., Lambda execution
roles, warmer roles). Without these permissions the deploy fails with:

```
CloudlessSiteWarmerUseast1HandlerRole aws:iam:Role
  updating tags for IAM Role ... operation error IAM: TagRole, ... AccessDenied
```

**Minimum policy statement to add:**

```json
{
  "Sid": "AllowSSTIAMTagging",
  "Effect": "Allow",
  "Action": [
    "iam:TagRole",
    "iam:UntagRole",
    "iam:ListRoleTags"
  ],
  "Resource": "*"
}
```

If you prefer a tighter scope, restrict to SST-created roles (they are prefixed with the
app name and stage):

```json
{
  "Sid": "AllowSSTIAMTagging",
  "Effect": "Allow",
  "Action": [
    "iam:TagRole",
    "iam:UntagRole",
    "iam:ListRoleTags"
  ],
  "Resource": "arn:aws:iam::*:role/cloudl-production-*"
}
```

> **Note:** If your AWS Organization uses Tag Policies or SCPs that restrict which tag keys
> can be applied, ensure the SST-managed keys are explicitly allowed:
> `Project`, `Environment`, `Owner`, `ManagedBy`.

## Troubleshooting

### Deploy fails with `AccessDenied` on `iam:TagRole` / `iam:UntagRole`

**Symptom** (from the deploy log):

```
CloudlessSiteWarmerUseast1HandlerRole aws:iam:Role
  sdk-v2/provider2.go:572: ... updating tags for IAM Role ...
  operation error IAM: TagRole, AccessDenied
```

**Root cause:** The IAM role assumed during the GitHub Actions deploy
(`AWS_DEPLOY_ROLE_ARN`) is missing `iam:TagRole`, `iam:UntagRole`, and/or
`iam:ListRoleTags` permissions. SST's `defaultTags` feature tags every managed resource,
including IAM Roles.

**Fix:**

1. In the AWS Console go to **IAM → Roles** and open the role whose ARN matches
   `AWS_DEPLOY_ROLE_ARN` (check the repo secret in GitHub → Settings → Secrets).
2. Attach or inline the policy statement shown above in
   [IAM role-tagging](#iam-role-tagging-required-by-sst-defaulttags).
3. Re-run the failed workflow.

**Reference:** [Example failing run (historical)](https://github.com/Themis128/cloudless.gr/actions/runs/25247664393/job/74034538240)

### Preflight check warns "Could not run iam:SimulatePrincipalPolicy"

If the deploy role also lacks `iam:SimulatePrincipalPolicy`, the preflight step prints a
`::warning::` and continues. The warning itself is safe — but it means you will only
discover missing IAM permissions when SST actually attempts the tagging operation.

**Fix:** Add `iam:SimulatePrincipalPolicy` to the deploy role so the preflight check can
catch permission gaps before the deploy starts.

### Checking which permissions the deploy role currently has

```bash
# Get the ARN of the assumed role from a recent workflow run
aws sts get-caller-identity

# Simulate the three required actions (replace ROLE_ARN with the actual ARN)
aws iam simulate-principal-policy \
  --policy-source-arn ROLE_ARN \
  --action-names iam:TagRole iam:UntagRole iam:ListRoleTags \
  --resource-arns "arn:aws:iam::*:role/*"
```

The output field `EvalDecision` should be `"allowed"` for all three actions.

## See also

- [SST `defaultTags` configuration](https://sst.dev/docs/providers/#defaulttags) — explains why every managed resource is tagged
- [`sst.config.ts`](../sst.config.ts) — this project's tag keys (`Project`, `Environment`, `Owner`, `ManagedBy`)
- [AWS IAM policy simulator docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html)
- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
