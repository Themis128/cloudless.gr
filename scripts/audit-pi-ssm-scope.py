#!/usr/bin/env python3
"""audit-pi-ssm-scope — assert the Pi IAM user can read every SSM
key under /cloudless/production/.

Closes pi-cloud-sync.md gap #2 / master-todo R18. Wired into
.github/workflows/probe-pi-ssm-scope.yml (daily 06:00 UTC);
drift triggers a /api/webhooks/admin-alert ping → Slack + ntfy.

Usage:
  python3 scripts/audit-pi-ssm-scope.py           # human output
  python3 scripts/audit-pi-ssm-scope.py --json    # machine-readable
  PI_USER=other-user python3 audit-pi-ssm-scope.py

Required IAM (caller): ssm:DescribeParameters,
iam:SimulatePrincipalPolicy. Env: AWS_REGION (default us-east-1),
PI_USER, PREFIX, ACCOUNT_ID."""

import argparse
import json
import os
import subprocess
import sys

PI_USER = os.environ.get("PI_USER", "cloudless-pi-standby")
PREFIX = os.environ.get("PREFIX", "/cloudless/production/")
REGION = os.environ.get("AWS_REGION", "us-east-1")
ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")
ACTIONS = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]

p = argparse.ArgumentParser()
p.add_argument("--json", action="store_true", dest="json_out")
args = p.parse_args()
JSON_OUT = args.json_out


def aws(*a: str) -> subprocess.CompletedProcess:
    return subprocess.run(["aws", *a, "--region", REGION], capture_output=True, text=True)


if not ACCOUNT_ID:
    r = aws("sts", "get-caller-identity", "--query", "Account", "--output", "text")
    ACCOUNT_ID = r.stdout.strip()
    if r.returncode != 0 or not ACCOUNT_ID:
        print("::error::Unable to determine AWS account id (aws sts get-caller-identity failed)")
        sys.exit(2)

USER_ARN = f"arn:aws:iam::{ACCOUNT_ID}:user/{PI_USER}"

r = aws(
    "ssm",
    "describe-parameters",
    "--parameter-filters",
    f"Key=Name,Option=BeginsWith,Values={PREFIX}",
    "--query",
    "Parameters[].Name",
    "--output",
    "text",
)
keys = sorted(set(r.stdout.split())) if r.returncode == 0 else []

if not keys:
    if JSON_OUT:
        print(
            '{"keys_total":0,"keys_denied":[],"action":'
            '"no SSM params under prefix — nothing to '
            'assert"}'
        )
    else:
        print(f"No SSM parameters found under {PREFIX} — nothing to assert.")
    sys.exit(0)

arns = [f"arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter{k}" for k in keys if k]

# Batch by 32 — simulate-principal-policy accepts up to 32
# ResourceArns per call; sequential calls previously timed out.
denied: list[str] = []
BATCH = 32
for i in range(0, len(arns), BATCH):
    batch = arns[i : i + BATCH]
    r = subprocess.run(
        [
            "aws",
            "iam",
            "simulate-principal-policy",
            "--policy-source-arn",
            USER_ARN,
            "--action-names",
            *ACTIONS,
            "--resource-arns",
            *batch,
            "--query",
            "EvaluationResults[].[EvalActionName,EvalResourceName,EvalDecision]",
            "--output",
            "text",
            "--region",
            REGION,
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print(f"::warning::simulate-principal-policy batch failed (i={i}): {r.stdout + r.stderr}")
        denied += [f"simulate-failed:{a.split(':parameter')[-1]}" for a in batch]
        continue
    for line in r.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        action, arn, decision = parts[0], parts[1], parts[2]
        if decision != "allowed":
            denied.append(f"{action}:{arn.split(':parameter')[-1]}")

total, denied_count = len(keys), len(denied)

if JSON_OUT:
    print(
        json.dumps(
            {
                "keys_total": total,
                "keys_denied_count": denied_count,
                "keys_denied": denied,
                "pi_user": PI_USER,
                "action": (
                    f"Grant SSM read actions on the denied resources to {PI_USER}"
                    if denied_count
                    else "ok"
                ),
            }
        )
    )
else:
    print("=== Pi SSM scope audit ===")
    print(f"Pi user:    {PI_USER}")
    print(f"User ARN:   {USER_ARN}")
    print(f"Prefix:     {PREFIX}")
    print(f"Total keys: {total}")
    print(f"Denied:     {denied_count}")
    if denied_count:
        print(f"\nKeys NOT readable by {PI_USER}:")
        for k in denied:
            print(f"  - {k}")
        print(f"\nFix: extend {PI_USER}'s SSM read statement to cover these action/resource pairs.")
        print("Typical inline policy (replace existing statement Resource:):")
        print('    "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],')
        print(f'    "Resource": "arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter{PREFIX}*"')
    else:
        print(f"\nAll {total} SSM keys are readable by {PI_USER}.")

sys.exit(1 if denied_count else 0)
