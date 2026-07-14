#!/usr/bin/env python3
"""Create IAM policy for DynamoDB migration"""

import json
import subprocess

policy_doc = {
    "Version": "2012-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["dynamodb:Scan", "dynamodb:Query", "dynamodb:GetItem"],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:278585680617:table/*-production",
                "arn:aws:dynamodb:us-east-1:278585680617:table/*-production/index/*",
            ],
        }
    ],
}

# Write policy to temp file
with open("/tmp/policy.json", "w") as f:
    json.dump(policy_doc, f)

# Create and attach policy
print("Creating IAM policy...")
subprocess.run(
    [
        "aws",
        "iam",
        "create-policy",
        "--policy-name",
        "cloudless-dynamodb-migration",
        "--policy-document",
        json.dumps(policy_doc),
    ],
    check=False,
)

print("Attaching policy to cloudless-ops user...")
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
    check=False,
)

print("✅ Done")
