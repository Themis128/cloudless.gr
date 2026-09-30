#!/usr/bin/env python3
"""Seed LocalStack with the SSM parameters + DynamoDB table the
test suite expects. Idempotent — safe to re-run."""

import os
import shutil
import subprocess
import sys

ENDPOINT = os.environ.get("AWS_ENDPOINT_URL",
                          "http://localhost:4566")
REGION = os.environ.get("AWS_REGION", "us-east-1")
PREFIX = os.environ.get("SSM_PREFIX", "/cloudless/test")

print(f"Seeding LocalStack at {ENDPOINT} ({PREFIX})")

aws = "aws" if shutil.which("aws") else "awslocal"
if aws == "awslocal" and not shutil.which("awslocal"):
    subprocess.call(["pip", "install", "--quiet",
                     "awscli-local"])


def put_param(name: str, value: str) -> None:
    subprocess.run(
        [aws, "--endpoint-url", ENDPOINT, "--region", REGION,
         "ssm", "put-parameter", "--name",
         f"{PREFIX}/{name}", "--value", value,
         "--type", "String", "--overwrite"],
        stdout=subprocess.DEVNULL)


# Test values — non-secret placeholders so the AppConfig type
# fills out
params = {
    "SES_FROM_EMAIL": "noreply@cloudless.test",
    "SES_TO_EMAIL": "team@cloudless.test",
    "AWS_SES_REGION": "us-east-1",
    "NEWSLETTER_SEND_SECRET": "test-newsletter-secret",
    "STRIPE_SECRET_KEY": "sk_test_localstack",
    "STRIPE_PUBLISHABLE_KEY": "pk_test_localstack",
    "STRIPE_WEBHOOK_SECRET": "whsec_test_localstack",
    "AUTH_SECRET": "test-auth-secret-32-chars-minimum-xxxx",
    "HUBSPOT_API_KEY": "test-hubspot-key",
    "HUBSPOT_CLIENT_SECRET": "test-hubspot-secret",
    "NOTION_API_KEY": "secret_test_notion",
    "NOTION_BLOG_DB_ID":
        "00000000-0000-0000-0000-000000000001",
    "NOTION_WEBHOOK_SECRET": "test-notion-webhook-secret",
    "SLACK_SIGNING_SECRET": "test-slack-signing-secret",
    "GSC_SITE_URL": "sc-domain:cloudless.test",
}
for name, value in params.items():
    put_param(name, value)
print("SSM params seeded.")

TABLE = os.environ.get("STRIPE_TRANSACTIONS_TABLE",
                       "cloudless-test-StripeTransactions")

r = subprocess.run(
    [aws, "--endpoint-url", ENDPOINT, "--region", REGION,
     "dynamodb", "describe-table", "--table-name", TABLE],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if r.returncode != 0:
    subprocess.run(
        [aws, "--endpoint-url", ENDPOINT, "--region", REGION,
         "dynamodb", "create-table", "--table-name", TABLE,
         "--attribute-definitions",
         "AttributeName=eventId,AttributeType=S",
         "--key-schema",
         "AttributeName=eventId,KeyType=HASH",
         "--billing-mode", "PAY_PER_REQUEST"],
        stdout=subprocess.DEVNULL)

print(f"DynamoDB table {TABLE} ready.")
print("Seed complete.")
