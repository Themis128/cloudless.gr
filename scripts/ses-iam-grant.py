#!/usr/bin/env python3
"""ses-iam-grant — attach the SES SMTP provisioning policy to the
OIDC role. Called by grant-ses-iam-permissions.yml; writes
GITHUB_OUTPUT vars."""

import json
import os
import subprocess
import sys
from pathlib import Path

r = subprocess.run(
    ["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"],
    capture_output=True,
    text=True,
)
ACCOUNT_ID = r.stdout.strip()

ROLE_ARN = os.environ.get("AWS_DEPLOY_ROLE_ARN", "")
ROLE_NAME = ROLE_ARN.rsplit("/", 1)[-1]
POLICY_NAME = "AllowSesSmtpUserProvisioning"

print(f"Account: {ACCOUNT_ID}")
print(f"Role:    {ROLE_NAME}")

policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "CreateSesSmtpUser",
            "Effect": "Allow",
            "Action": [
                "iam:GetUser",
                "iam:CreateUser",
                "iam:PutUserPolicy",
                "iam:ListAccessKeys",
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey",
            ],
            "Resource": f"arn:aws:iam::{ACCOUNT_ID}:user/cloudless-ses-smtp",
        },
        {
            "Sid": "SsmPutSesParams",
            "Effect": "Allow",
            "Action": ["ssm:PutParameter", "ssm:GetParameter"],
            "Resource": f"arn:aws:ssm:us-east-1:{ACCOUNT_ID}:parameter/cloudless/production/SES*",
        },
    ],
}

policy_file = Path("/tmp/ses-policy.json")
policy_file.write_text(json.dumps(policy))
print(f"Policy:\n{json.dumps(policy)}")

gh_out = os.environ.get("GITHUB_OUTPUT", "")
out_lines: list[str] | None = None
if gh_out:
    out_lines = []


def emit(key: str, value: str) -> None:
    if out_lines is not None:
        out_lines.append(f"{key}={value}")


r = subprocess.run(
    [
        "aws",
        "iam",
        "put-role-policy",
        "--role-name",
        ROLE_NAME,
        "--policy-name",
        POLICY_NAME,
        "--policy-document",
        f"file://{policy_file}",
    ],
    capture_output=True,
    text=True,
)

if r.returncode == 0:
    emit("status", "success")
    emit("role_name", ROLE_NAME)
    emit("account_id", ACCOUNT_ID)
    print(f"Policy '{POLICY_NAME}' attached to role '{ROLE_NAME}'")
    code = 0
else:
    emit("status", "failed")
    emit("role_name", ROLE_NAME)
    emit("account_id", ACCOUNT_ID)
    print("::error::iam:PutRolePolicy denied — see issue #382 for manual fix")
    print(r.stderr)
    code = 1

if out_lines is not None:
    with open(gh_out, "a") as f:
        f.write("\n".join(out_lines) + "\n")

sys.exit(code)
