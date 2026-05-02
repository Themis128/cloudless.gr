#!/usr/bin/env python3
"""
Grant the IAM permissions our CI workflows need.

Two roles, two policies:
  1. The deploy role (from AWS_DEPLOY_ROLE_ARN env or --deploy-role flag) needs
     iam:GetRole, iam:TagRole, iam:UntagRole, iam:ListRoleTags, and
     iam:SimulatePrincipalPolicy so SST can manage roles + the preflight can
     probe permissions.

  2. The Pi-image build role (default: cloudless-github-actions) needs
     ecr:BatchDeleteImage on cloudless-pi-app so the workflow can untag the
     existing :latest before pushing under tag-immutable mutability.

Idempotent — uses put_role_policy (upsert). Verifies with
simulate_principal_policy after applying.

Usage:
  AWS_DEPLOY_ROLE_ARN=arn:aws:iam::278585680617:role/<role> \
    python3 scripts/grant-ci-iam-permissions.py

  # Or pass roles explicitly:
  python3 scripts/grant-ci-iam-permissions.py \
    --deploy-role arn:aws:iam::278585680617:role/your-deploy-role \
    --pi-image-role arn:aws:iam::278585680617:role/cloudless-github-actions

  # Dry-run (print what would be applied):
  python3 scripts/grant-ci-iam-permissions.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

import boto3
from botocore.exceptions import ClientError

ACCOUNT_ID = "278585680617"
PI_IMAGE_REPO = "cloudless-pi-app"
PI_IMAGE_REGION = "us-east-1"
SST_ROLE_PREFIX = "cloudl-production-"

DEPLOY_POLICY_NAME = "CICDSstRoleManagement"
DEPLOY_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowSSTIAMRoleLifecycle",
            "Effect": "Allow",
            "Action": [
                # Read state (refresh)
                "iam:GetRole",
                "iam:ListRoleTags",
                "iam:ListRolePolicies",
                "iam:GetRolePolicy",
                "iam:ListAttachedRolePolicies",
                # Update tags (defaultTags)
                "iam:TagRole",
                "iam:UntagRole",
                # Manage inline + attached policies
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                # Create/delete roles when stack changes Lambdas
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:UpdateRole",
                "iam:UpdateAssumeRolePolicy",
                # Pass roles to Lambda/etc.
                "iam:PassRole",
            ],
            "Resource": f"arn:aws:iam::*:role/{SST_ROLE_PREFIX}*",
        },
        {
            "Sid": "AllowPolicySimulation",
            "Effect": "Allow",
            "Action": "iam:SimulatePrincipalPolicy",
            "Resource": "*",
        },
    ],
}

PI_IMAGE_POLICY_NAME = "CICDEcrUntagLatest"
PI_IMAGE_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowEcrUntagForLatest",
            "Effect": "Allow",
            "Action": "ecr:BatchDeleteImage",
            "Resource": f"arn:aws:ecr:{PI_IMAGE_REGION}:{ACCOUNT_ID}:repository/{PI_IMAGE_REPO}",
        }
    ],
}


def role_name_from_arn(arn: str) -> str:
    m = re.match(r"^arn:aws:iam::\d+:role/(.+)$", arn)
    if not m:
        raise SystemExit(f"Not an IAM role ARN: {arn}")
    return m.group(1)


def put_inline(iam, role_arn: str, policy_name: str, policy_doc: dict, dry: bool) -> None:
    role = role_name_from_arn(role_arn)
    print(f"\n→ Role: {role_arn}")
    print(f"  Policy: {policy_name}")
    print(f"  Document: {json.dumps(policy_doc, indent=2)}")
    if dry:
        print("  [dry-run] skipped put_role_policy")
        return
    iam.put_role_policy(
        RoleName=role,
        PolicyName=policy_name,
        PolicyDocument=json.dumps(policy_doc),
    )
    print(f"  ✓ put_role_policy ok")


def verify(iam, role_arn: str, actions: list[str], resources: list[str]) -> bool:
    print(f"\n→ Simulating {actions} on {role_arn}")
    try:
        resp = iam.simulate_principal_policy(
            PolicySourceArn=role_arn,
            ActionNames=actions,
            ResourceArns=resources,
        )
    except ClientError as e:
        print(f"  ! simulate_principal_policy failed: {e.response['Error']['Code']}")
        return False
    ok = True
    for r in resp["EvaluationResults"]:
        action = r["EvalActionName"]
        decision = r["EvalDecision"]
        marker = "✓" if decision == "allowed" else "✗"
        print(f"  {marker} {action}: {decision}")
        if decision != "allowed":
            ok = False
    return ok


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--deploy-role",
        default=os.environ.get("AWS_DEPLOY_ROLE_ARN"),
        help="ARN of the deploy role (or set AWS_DEPLOY_ROLE_ARN)",
    )
    p.add_argument(
        "--pi-image-role",
        default=f"arn:aws:iam::{ACCOUNT_ID}:role/cloudless-github-actions",
        help="ARN of the Pi-image build role",
    )
    p.add_argument("--dry-run", action="store_true", help="Print intended changes; do not apply")
    p.add_argument("--skip-deploy", action="store_true")
    p.add_argument("--skip-pi-image", action="store_true")
    args = p.parse_args()

    if not args.skip_deploy and not args.deploy_role:
        sys.exit("error: --deploy-role or AWS_DEPLOY_ROLE_ARN is required (or use --skip-deploy)")

    iam = boto3.client("iam")

    # 1. Confirm we can act (skipped for dry-run so the script can be reviewed
    #    offline before any creds are wired up)
    if not args.dry_run:
        sts = boto3.client("sts").get_caller_identity()
        print(f"Acting as: {sts['Arn']}")
    else:
        print("[dry-run] skipping caller identity check")

    # 2. Apply deploy-role policy
    if not args.skip_deploy:
        put_inline(iam, args.deploy_role, DEPLOY_POLICY_NAME, DEPLOY_POLICY, args.dry_run)

    # 3. Apply pi-image-role policy
    if not args.skip_pi_image:
        put_inline(iam, args.pi_image_role, PI_IMAGE_POLICY_NAME, PI_IMAGE_POLICY, args.dry_run)

    if args.dry_run:
        print("\n[dry-run] no changes applied")
        return 0

    # 4. Verify
    print("\n" + "=" * 60 + "\nVerification\n" + "=" * 60)
    deploy_ok = pi_ok = True

    if not args.skip_deploy:
        sst_actions = [
            "iam:GetRole", "iam:ListRoleTags", "iam:ListRolePolicies",
            "iam:GetRolePolicy", "iam:ListAttachedRolePolicies",
            "iam:TagRole", "iam:UntagRole",
            "iam:PutRolePolicy", "iam:DeleteRolePolicy",
            "iam:AttachRolePolicy", "iam:DetachRolePolicy",
            "iam:CreateRole", "iam:DeleteRole", "iam:UpdateRole",
            "iam:UpdateAssumeRolePolicy", "iam:PassRole",
        ]
        deploy_ok = verify(
            iam,
            args.deploy_role,
            sst_actions,
            [f"arn:aws:iam::{ACCOUNT_ID}:role/{SST_ROLE_PREFIX}example"],
        ) and verify(
            iam,
            args.deploy_role,
            ["iam:SimulatePrincipalPolicy"],
            ["*"],
        )

    if not args.skip_pi_image:
        pi_ok = verify(
            iam,
            args.pi_image_role,
            ["ecr:BatchDeleteImage"],
            [PI_IMAGE_POLICY["Statement"][0]["Resource"]],
        )

    print()
    if deploy_ok and pi_ok:
        print("✅ All required permissions granted and verified.")
        return 0
    print("❌ Some actions are still denied. Review the role's other policies / SCPs.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
