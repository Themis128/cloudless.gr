#!/usr/bin/env python3
"""Add IAM permissions for the DynamoDB → D1 migration."""

import subprocess

print("Adding DynamoDB migration permissions to cloudless-ops user...")

r = subprocess.run(
    [
        "aws",
        "iam",
        "create-policy",
        "--policy-name",
        "cloudless-dynamodb-migration",
        "--policy-document",
        "file://scripts/dynamodb-migration-policy.json",
    ],
    capture_output=True,
    text=True,
)
if r.returncode != 0:
    print("Policy may already exist")

subprocess.run(
    [
        "aws",
        "iam",
        "attach-user-policy",
        "--user-name",
        "cloudless-ops",
        "--policy-arn",
        "arn:aws:iam::278585680617:policy/cloudless-dynamodb-migration",
    ],
    capture_output=True,
)

print("✅ DynamoDB migration permissions added")
