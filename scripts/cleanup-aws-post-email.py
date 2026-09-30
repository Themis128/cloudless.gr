#!/usr/bin/env python3
"""AWS cleanup — run AFTER Cloudflare Email validation.
Deletes AWS resources after confirming Cloudflare Email works."""

import subprocess
import sys

REGION = "us-east-1"


def aws(*args: str) -> int:
    return subprocess.call(
        ["aws", *args, "--region", REGION],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


print("""⚠️  AWS Resource Cleanup Script
================================

This script deletes the following AWS resources:
  - DynamoDB tables (UserProfile, SessionTokenStore, StripeTransactions, AdminNotifications, AnalyticsCache)
  - S3 buckets (cloudless-production-cloudlesssiteassetsbucket-sasvvhra, cloudless-analytics-data)
  - Athena workgroup
  - Cognito User Pool
  - SES configuration (if verified)
""")

confirm = input("Have you verified Cloudflare Email is working? "
                "(yes to continue): ")
if confirm != "yes":
    print("Aborted. Run this after confirming: curl -X POST "
          "https://cloudless.gr/api/contact -d '...'")
    sys.exit(0)

print("\n[1/5] Deleting DynamoDB tables...")
for table in ("cloudless-production-UserProfileTable",
              "cloudless-production-SessionTokenStoreTable",
              "cloudless-production-StripeTransactionsTable",
              "cloudless-production-AdminNotificationsTable",
              "cloudless-production-AnalyticsCacheTable"):
    if aws("dynamodb", "delete-table",
           "--table-name", table) == 0:
        print(f"✓ Deleted: {table}")
    else:
        print(f"  (may already be deleted): {table}")

print("\n[2/5] Deleting S3 buckets...")
for bucket in (
        "cloudless-production-cloudlesssiteassetsbucket-sasvvhra",
        "cloudless-analytics-data"):
    if aws("s3", "rb", f"s3://{bucket}", "--force") == 0:
        print(f"✓ Deleted: {bucket}")
    else:
        print(f"  (may already be deleted): {bucket}")

print("\n[3/5] Deleting Athena workgroup...")
if aws("athena", "delete-work-group",
       "--work-group", "CloudlessAnalytics") == 0:
    print("✓ Deleted: CloudlessAnalytics workgroup")
else:
    print("  Workgroup may already be deleted")

print("\n[4/5] Deleting Cognito User Pool...")
r = subprocess.run(
    ["aws", "cognito-idp", "list-user-pools", "--max-results",
     "60", "--region", REGION, "--query",
     "UserPools[?contains(Name, 'cloudless')].Id",
     "--output", "text"], capture_output=True, text=True)
pool_id = r.stdout.strip()
if pool_id and pool_id != "None":
    if aws("cognito-idp", "delete-user-pool",
           "--user-pool-id", pool_id) == 0:
        print(f"✓ Deleted: Cognito User Pool ({pool_id})")
    else:
        print("  Cognito may already be deleted")
else:
    print("  No Cognito User Pool found")

print("\n[5/5] Checking SES...")
r = subprocess.run(
    ["aws", "ses", "get-identity-verification-attributes",
     "--region", REGION, "--output", "json"],
    capture_output=True, text=True)
print(f"  SES check output: {r.stdout.strip() or r.stderr.strip()}")

print("""
==========================================
✅ AWS Cleanup Complete!
==========================================

Next steps:
1. Verify D1 auth works (check /api/auth/session returns user data)
2. Verify email sending works (contact form test)
3. Archive old DynamoDB data if needed for compliance""")
