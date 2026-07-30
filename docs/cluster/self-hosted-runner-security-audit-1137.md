# Self-hosted runner security audit — Issue #1137

## Summary

Issue #1137 reported self-hosted GitHub Actions runner usage in six workflows.

Reviewed workflows:

- `.github/workflows/cluster-status-audit.yml`
- `.github/workflows/deploy-alert-api.yml`
- `.github/workflows/etl-espocrm-to-lake.yml`
- `.github/workflows/rollout-pi-force.yml`
- `.github/workflows/sync-smtp-secrets.yml`
- `.github/workflows/wire-pi-cognito-from-pi.yml`

## Result

The reviewed workflows do not use untrusted pull-request style triggers on self-hosted runners.

No reviewed self-hosted workflow currently uses:

- `pull_request`
- `pull_request_target`
- `issue_comment`
- `workflow_run`
- `repository_dispatch`

The workflows use trusted operational triggers such as:

- `schedule`
- `workflow_dispatch`
- `push`

`sync-smtp-secrets.yml` currently runs on `ubuntu-latest`, not self-hosted.

## Security rule

Self-hosted runners in this repository must remain restricted to trusted operational workflows.

Do not add these triggers to self-hosted runner jobs:

- `pull_request`
- `pull_request_target`
- `issue_comment`
- `workflow_run`
- `repository_dispatch`

If one of those triggers is required, use a GitHub-hosted runner or add an explicit maintainer approval gate and avoid checking out untrusted PR code.

## Rationale

Self-hosted runners are persistent systems managed by the repository owner. They are useful for Pi, cluster, and private-network operations, but they should not execute untrusted pull-request code.

GitHub recommends least-privilege token permissions and careful secret handling in workflows.
