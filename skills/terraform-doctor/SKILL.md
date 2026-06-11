---
name: terraform-doctor
description: |
  Diagnose and fix common Terraform CI/CD failures — expired Hashicorp GPG keys,
  provider version drift, schema migrations, fmt/validate failures. Use whenever
  a Terraform workflow fails at `terraform init`, `terraform fmt -check`, or
  `terraform validate`, especially with messages like "openpgp: key expired",
  "checksum mismatch", "Unsupported argument", or schema-drift errors after a
  provider bump.
---

# Terraform Doctor

A practical playbook for unsticking a stalled Terraform pipeline. Order is
deliberate — each stage gates the next.

## When to invoke this skill

- `terraform init` fails with `openpgp: key expired` or `signature: key expired`
- `terraform fmt -check -recursive` exits non-zero (formatting drift)
- `terraform validate` reports `Unsupported argument`, `Missing required argument`, or `expected X to be one of [...]`
- A CI workflow stops at Terraform with no obvious code cause

## Stage 0 — Diagnose

Pull the workflow log and find the **first** error.

```bash
gh run list --workflow=<wf.yml> --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <RUN_ID> --log 2>&1 | grep -iE "error|fail|expired|invalid" | head -20
```

## Stage 1 — `openpgp: key expired`

**Root cause:** the Terraform CLI binary embeds a GPG root key used to verify
registry responses. Older CLI versions (1.6.x, ~Oct 2023) ship a key that has
since expired (mid-2026). **Bumping the AWS provider alone does NOT fix this**
because the verification happens inside the CLI before the provider is even
loaded.

**Fix:** bump the CLI version in the workflow. Latest 1.x as of mid-2026 is
`1.15.6`.

```yaml
env:
  TF_VERSION: 1.15.6   # was 1.6.0
```

**Side-effects:** newer CLI versions enforce stricter `fmt -check` and stricter
`validate`. Expect Stages 2 and 3 to surface after this fix.

## Stage 2 — `terraform fmt -check` fails

```bash
# Get terraform locally (arm64 example; swap _linux_amd64 for x86_64)
curl -sLo /tmp/tf.zip https://releases.hashicorp.com/terraform/1.15.6/terraform_1.15.6_linux_arm64.zip
cd /tmp && unzip -oq tf.zip && chmod +x terraform

cd <your-tf-dir>
/tmp/terraform fmt -diff .   # preview
/tmp/terraform fmt .         # apply
```

Pure whitespace — no semantic change.

## Stage 3 — `terraform validate` fails (schema drift)

Common AWS provider 5.x migrations:

| Resource | Old | New |
|---|---|---|
| `aws_cloudfront_cache_policy` `headers_config` | `header_behavior = "all"` | `"none"` or `"whitelist"` |
| `aws_cloudfront_origin_request_policy` `headers_config` | `header_behavior = "all"` | `"allViewer"` |
| `aws_db_proxy` `target {}` block | inline | separate `aws_db_proxy_target` resource |
| `aws_db_proxy` `auth {}` | optional | **required** |
| `aws_db_proxy` `vpc_subnet_ids` | optional | **required** |
| `aws_db_proxy` `max_connections` | top-level | moved to `aws_db_proxy_default_target_group.connection_pool_config` |

Validate locally:

```bash
/tmp/terraform init -input=false
/tmp/terraform validate -no-color
```

## Stage 4 — `terraform plan` fails on a data source

Almost always an environment precondition, not code. Example:

- `data "aws_lambda_function" "x"` → function doesn't exist in this AWS account

Fix: create the prerequisite, point at the correct name, or gate behind a flag:

```hcl
variable "enable_lambda_optimization" {
  type    = bool
  default = false
}

data "aws_lambda_function" "main_app" {
  count         = var.enable_lambda_optimization ? 1 : 0
  function_name = "cloudless-app-${var.environment}"
}
```

Then references become `data.aws_lambda_function.main_app[0]`, gated by the
same `count` expression on dependent resources.

## Quick reference — known-good versions (mid-2026)

| Component | Version |
|---|---|
| Terraform CLI | `1.15.6` |
| `hashicorp/aws` provider | `~> 5.80.0` |
| `aws-actions/configure-aws-credentials` | `v4.x` |
| `hashicorp/setup-terraform` | `v3.x` (v2 nearing Node 20 EOL) |

## Idempotent fix script

`scripts/tf-validate-fix.py` applies the AWS provider 5.x schema fixes
documented above. Safe to re-run; checks for the old pattern before
substituting. Add new fixes as new `old/new` pairs guarded by `if old in s`.

## Companion tool

The cloudless-infra MCP server exposes a `tf_doctor` tool that runs the
diagnose-and-fix loop end-to-end from the Pi:

```
tf_doctor(workflow="deploy-infrastructure.yml", tf_dir="infrastructure/terraform")
```

It pulls the most recent failure log, classifies the error, downloads
terraform 1.15.6 to /tmp if needed, runs init+fmt+validate, and returns a
ready-to-paste diff. Read-only by default; pass `apply_fmt=true` to write the
fmt result.
