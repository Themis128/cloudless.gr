import os
#!/usr/bin/env python3
"""
Grant ssm:GetParametersByPath to the cloudless-pi-standby IAM user.

Background (Sentry CLOUDLESS-GR-4):
  The Pi k3s deployment authenticates with AWS using the `cloudless-pi-standby`
  IAM user (credentials injected via the `pi-standby-aws-creds` k8s Secret).
  The app calls GetParametersByPath on /cloudless/production/* at startup, but
  the user lacks that permission — causing 8 AccessDeniedException errors on
  POST /api/contact in the 14-day window ending 2026-05-17.

Fix:
  Attaches an inline policy `PiStandbySSMRead` to the `cloudless-pi-standby`
  IAM user with the minimum required SSM read actions scoped to the production
  parameter path.

Prerequisites:
  - Python 3 + boto3 installed
  - AWS credentials that allow iam:PutUserPolicy on cloudless-pi-standby.
    Use cloudless-ops credentials:
      AWS_ACCESS_KEY_ID=<from cloudless-ops_accessKeys.csv>
      AWS_SECRET_ACCESS_KEY=<from cloudless-ops_accessKeys.csv>
    Note: cloudless-ops may need iam:PutUserPolicy added to its policy first
    if it does not already have it. Run with --dry-run to confirm before applying.

Usage:
  # Dry-run (print what would be applied):
  python3 scripts/fix-pi-ssm-permission.py --dry-run

  # Apply:
  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \\
    python3 scripts/fix-pi-ssm-permission.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import boto3
from botocore.exceptions import ClientError

ACCOUNT_ID = os.environ.get("AWS_ACCOUNT_ID", "278585680617")
IAM_USER = "cloudless-pi-standby"
POLICY_NAME = "PiStandbySSMRead"
SSM_PATH = "/cloudless/production"
REGION = "us-east-1"

POLICY_DOC = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowSSMReadProductionParams",
            "Effect": "Allow",
            "Action": [
                "ssm:GetParametersByPath",
                "ssm:GetParameter",
                "ssm:GetParameters",
            ],
            "Resource": [
                f"arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter{SSM_PATH}",
                f"arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter{SSM_PATH}/*",
            ],
        }
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Grant ssm:GetParametersByPath to cloudless-pi-standby IAM user"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be applied without making changes",
    )
    args = parser.parse_args()

    iam = boto3.client("iam", region_name=REGION)

    if args.dry_run:
        print("[dry-run] Would apply the following inline policy:")
        print(f"  User: {IAM_USER}")
        print(f"  Policy name: {POLICY_NAME}")
        print(f"  Document:\n{json.dumps(POLICY_DOC, indent=4)}")
        return 0

    # Confirm caller identity before making changes.
    sts = boto3.client("sts", region_name=REGION).get_caller_identity()
    print(f"Acting as: {sts['Arn']}")

    print(f"\nApplying inline policy '{POLICY_NAME}' to IAM user '{IAM_USER}'...")
    try:
        iam.put_user_policy(
            UserName=IAM_USER,
            PolicyName=POLICY_NAME,
            PolicyDocument=json.dumps(POLICY_DOC),
        )
        print("  put_user_policy OK")
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        print(f"  ERROR {code}: {exc.response['Error']['Message']}", file=sys.stderr)
        if code in ("NoSuchEntityException",):
            print(
                f"  Hint: IAM user '{IAM_USER}' not found in account {ACCOUNT_ID}.",
                file=sys.stderr,
            )
        if code in ("AccessDenied",):
            print(
                "  Hint: cloudless-ops needs iam:PutUserPolicy on this user.\n"
                "  Add it via the AWS Console → IAM → cloudless-ops → policies.",
                file=sys.stderr,
            )
        return 1

    # Verify with simulate_principal_policy.
    user_arn = f"arn:aws:iam::{ACCOUNT_ID}:user/{IAM_USER}"
    print(f"\nVerifying permissions for {user_arn}...")
    try:
        resp = iam.simulate_principal_policy(
            PolicySourceArn=user_arn,
            ActionNames=[
                "ssm:GetParametersByPath",
                "ssm:GetParameter",
                "ssm:GetParameters",
            ],
            ResourceArns=[
                f"arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter{SSM_PATH}/EXAMPLE",
            ],
        )
        all_ok = True
        for result in resp["EvaluationResults"]:
            action = result["EvalActionName"]
            decision = result["EvalDecision"]
            marker = "v" if decision == "allowed" else "X"
            print(f"  {marker} {action}: {decision}")
            if decision != "allowed":
                all_ok = False
    except ClientError as exc:
        print(f"  simulate_principal_policy failed: {exc}", file=sys.stderr)
        all_ok = False

    if all_ok:
        print("\nAll SSM permissions granted and verified.")
        print(
            f"\nNext step: restart the cloudless deployment in k3s so the Pi app\n"
            f"picks up fresh SSM credentials on the next cold start.\n"
            f"  kubectl rollout restart deployment/cloudless -n cloudless"
        )
        return 0

    print(
        "\nSome permissions are still denied. Check for SCPs or permission boundaries.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
