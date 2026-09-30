#!/usr/bin/env python3
"""Fix IAM permissions for the DynamoDB → D1 migration —
creates the DynamoDBMigrationAccess policy (or reuses it) and
prints the attach commands.

Usage: AWS_PROFILE=default python3 \
    scripts/fix-dynamodb-migration-permissions.py"""

import subprocess
from pathlib import Path

POLICY_NAME = "DynamoDBMigrationAccess"
POLICY_FILE = Path("scripts/dynamodb-migration-policy.json")

POLICY_DOC = """{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBMigrationReadOnly",
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBMigrationLogging",
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:DescribeTimeToLive"
      ],
      "Resource": "*"
    }
  ]
}
"""

print("=== Fixing DynamoDB Migration Permissions ===")

if not POLICY_FILE.is_file():
    print("Creating IAM policy file...")
    POLICY_FILE.write_text(POLICY_DOC)
    print(f"Created {POLICY_FILE}")

r = subprocess.run(
    ["aws", "iam", "list-policies", "--scope", "Local",
     "--query",
     f"Policies[?PolicyName=='{POLICY_NAME}'].Arn",
     "--output", "text"], capture_output=True, text=True)
existing_arn = r.stdout.strip()

if not existing_arn:
    print(f"Creating new IAM policy: {POLICY_NAME}")
    r = subprocess.run(
        ["aws", "iam", "create-policy", "--policy-name",
         POLICY_NAME, "--policy-document",
         f"file://{POLICY_FILE}", "--description",
         "Permissions for DynamoDB to D1 migration",
         "--query", "Policy.Arn", "--output", "text"],
        capture_output=True, text=True)
    policy_arn = r.stdout.strip()
    print(f"Created policy: {policy_arn}")
else:
    print(f"Policy already exists: {existing_arn}")
    policy_arn = existing_arn

print(f"""
To attach this policy to a user or role, run:
aws iam attach-user-policy --user-name cloudless-ops \\
    --policy-arn {policy_arn}
Or for a role:
aws iam attach-role-policy \\
    --role-name cloudless-migration-role \\
    --policy-arn {policy_arn}

After attaching, verify with:
aws dynamodb scan \\
    --table-name cloudless-production-UserProfileTable-bctubzrn \\
    --select COUNT""")
