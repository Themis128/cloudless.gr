#!/usr/bin/env python3
"""AWS Cleanup — deletes migrated resources while preserving core
Lambda functions (SES-to-EspoCRM, pi-proxy). Interactive
confirmation per destructive step.

Resources: DynamoDB tables, Athena workgroup, Cognito, Bedrock IAM,
S3 buckets, CloudWatch alarms, migrated SSM parameters."""

import os
import subprocess

RED, GREEN, YELLOW, NC = ("\033[0;31m", "\033[0;32m", "\033[1;33m", "\033[0m")

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
AWS_ACCOUNT_ID = os.environ.get("AWS_ACCOUNT_ID", "278585680617")


def aws(*args: str) -> str:
    r = subprocess.run(["aws", *args, "--region", AWS_REGION], capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


def confirm(message: str) -> bool:
    reply = input(f"{message} [y/N] ").strip().lower()
    if reply != "y":
        print("Skipped.")
        return False
    return True


print(
    f"=== AWS Migrated Resources Cleanup ===\n"
    f"Region: {AWS_REGION}\nAccount: {AWS_ACCOUNT_ID}\n\n"
    f"⚠️  PRESERVED: Core Lambda functions (SES-to-EspoCRM, "
    f"pi-proxy)\n"
)

# 1. DynamoDB
print(f"\n{YELLOW}=== Step 1: DynamoDB Tables ==={NC}")
print("Tables migrated to D1 database (user-auth-db):")
TABLES = [
    "cloudless-production-UserProfileTable-bctubzrn",
    "cloudless-production-SessionTokenStoreTable-mrbwcwzt",
    "cloudless-production-StripeTransactionsTable-nhtvnuew",
    "cloudless-production-AdminNotificationsTable-uuhacatu",
    "cloudless-production-AnalyticsCacheTable-fneaemkr",
    "cloudless-production-CloudlessSiteRevalidationTable-srcdceah",
]
for t in TABLES:
    print(f"  - {t}")
if confirm("Delete all 6 DynamoDB tables above?"):
    for t in TABLES:
        print(f"Processing table: {t}")
        aws(
            "dynamodb",
            "update-table",
            "--table-name",
            t,
            "--cli-input-json",
            '{"DeletionProtectionEnabled": false}',
        )
        aws("dynamodb", "delete-table", "--table-name", t)
    print(f"{GREEN}✓ DynamoDB tables deletion initiated{NC}")

# 2. Athena
print(f"\n{YELLOW}=== Step 2: Athena Workgroup ==={NC}")
print("Workgroup: cloudless-analytics-workgroup")
if confirm("Delete Athena workgroup?"):
    aws(
        "athena",
        "delete-work-group",
        "--work-group",
        "cloudless-analytics-workgroup",
        "--recursive-delete-option",
    )
    print(f"{GREEN}✓ Athena workgroup deletion initiated{NC}")

# 3. Cognito
print(f"\n{YELLOW}=== Step 3: Cognito User Pool ==={NC}")
print("User Pool ID from SSM: /cloudless/production")
if confirm("Delete Cognito User Pool and Client?"):
    pool_id = aws(
        "ssm",
        "get-parameter",
        "--name",
        "/cloudless/production/COGNITO_USER_POOL_ID",
        "--query",
        "Parameter.Value",
        "--output",
        "text",
    )
    if pool_id and "Error" not in pool_id:
        print(f"Deleting user pool: {pool_id}")
        clients = aws(
            "cognito-idp",
            "list-user-pool-clients",
            "--user-pool-id",
            pool_id,
            "--query",
            "UserPoolClients[].ClientId",
            "--output",
            "text",
        )
        for c in clients.split():
            aws(
                "cognito-idp",
                "delete-user-pool-client",
                "--user-pool-id",
                pool_id,
                "--client-id",
                c,
            )
        aws("cognito-idp", "delete-user-pool", "--user-pool-id", pool_id)
    print(f"{GREEN}✓ Cognito cleanup completed{NC}")

# 4. Bedrock IAM
print(f"\n{YELLOW}=== Step 4: Bedrock IAM Permissions ==={NC}")
print("Policy: cloudless-bedrock-access")
if confirm("Delete Bedrock IAM policy?"):
    arn = aws(
        "iam",
        "list-policies",
        "--scope",
        "Local",
        "--query",
        "Policies[?contains(PolicyName, 'bedrock')].Arn",
        "--output",
        "text",
    )
    if arn and "Error" not in arn:
        for r in arn.split():
            roles = aws(
                "iam",
                "list-entities-for-policy",
                "--policy-arn",
                r,
                "--query",
                "PolicyRoles[].RoleName",
                "--output",
                "text",
            )
            for role in roles.split():
                aws("iam", "detach-role-policy", "--role-name", role, "--policy-arn", r)
            aws("iam", "delete-policy", "--policy-arn", r)
    print(f"{GREEN}✓ Bedrock IAM policy cleanup completed{NC}")

# 5. S3
print(f"\n{YELLOW}=== Step 5: S3 Buckets ==={NC}")
print("Buckets migrated to R2:")
BUCKETS = [
    "cloudless-production-assets",
    "cloudless-production-analytics",
    "cloudless-production-backups",
]
for b in BUCKETS:
    print(f"  - {b}")
if confirm("Delete S3 buckets and all contents?"):
    for b in BUCKETS:
        print(f"Emptying and deleting bucket: {b}")
        aws("s3", "rm", f"s3://{b}", "--recursive")
        aws("s3api", "delete-bucket", "--bucket", b)
    print(f"{GREEN}✓ S3 buckets cleanup completed{NC}")

# 6. CloudWatch alarms
print(f"\n{YELLOW}=== Step 6: CloudWatch Alarms ==={NC}")
alarms = aws(
    "cloudwatch",
    "describe-alarms",
    "--query",
    "MetricAlarms[?contains(AlarmName, 'cloudless') || contains(AlarmName, 'Cloudless')].AlarmName",
    "--output",
    "text",
)
if alarms and "Error" not in alarms:
    for a in alarms.split():
        print(f"  - {a}")
    if confirm("Delete CloudWatch alarms?"):
        for a in alarms.split():
            aws("cloudwatch", "delete-alarms", "--alarm-names", a)
        print(f"{GREEN}✓ CloudWatch alarms cleanup completed{NC}")
else:
    print("  No cloudless-related alarms found")

# 7. SSM params
print(f"\n{YELLOW}=== Step 7: SSM Parameters ==={NC}")
print("SSM parameters to review for cleanup:")
params = aws(
    "ssm",
    "describe-parameters",
    "--parameter-filters",
    "Key=Path,Option=Recursive,Values=/cloudless/production",
    "--query",
    "Parameters[?contains(Name, 'DYNAMODB') || "
    "contains(Name, 'ATHENA') || contains(Name, 'COGNITO')"
    " || contains(Name, 'BEDROCK') || "
    "contains(Name, 'S3')].Name",
    "--output",
    "text",
)
if params and "Error" not in params:
    for p_ in params.split():
        print(f"  - {p_}")
    print(
        "\n⚠️  MANUAL REVIEW REQUIRED: Some SSM parameters may still be needed for Lambda functions"
    )
    print(
        "    The pi-proxy Lambda uses: FUNNEL_HOST_PARAM, "
        "PI_HOST_HEADER, BACKEND_TTL_SEC, "
        "UPSTREAM_TIMEOUT_SEC"
    )
    if confirm("Delete these SSM parameters? (Review carefully first!)"):
        for p_ in params.split():
            aws("ssm", "delete-parameter", "--name", p_)
        print(f"{GREEN}✓ SSM parameters cleanup completed{NC}")
else:
    print("  No migrated SSM parameters found")

# 8. Summary
print(f"\n{GREEN}=== Summary ==={NC}")
print(f"The following Lambda functions were {RED}PRESERVED{NC}:")
print("  - pi-proxy (Lambda: cloudless-pi-proxy) - HA failover proxy")
print("  - SES-to-EspoCRM (email webhook handler) - Application logic")
print(f"\nThese handle {GREEN}application logic{NC}, not monitoring.")
print(f"""
{YELLOW}Manual verification steps:{NC}
1. Verify DynamoDB tables are deleted (check AWS console)
2. Verify Athena workgroup is deleted
3. Verify Cognito resources are deleted
4. Verify Bedrock IAM policy is removed
5. Verify S3 buckets are empty and deleted
6. Verify pi-proxy Lambda still functions for HA failover
7. Verify SES-to-EspoCRM Lambda still processes webhooks""")
