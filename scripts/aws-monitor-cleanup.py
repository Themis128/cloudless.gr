#!/usr/bin/env python3
"""AWS Monitoring cleanup — inventory + optional removal of
cloudless AWS monitoring resources after the Cloudflare
migration. DRY_RUN=true (default) previews only; DRY_RUN=false
executes the cleanup.

Run AFTER verifying Cloudflare services are operational."""

import os
import subprocess

RED, GREEN, YELLOW, NC = ("\033[0;31m", "\033[0;32m", "\033[1;33m", "\033[0m")

DRY_RUN = os.environ.get("DRY_RUN", "true").lower() == "true"


def aws(*args: str) -> str:
    r = subprocess.run(["aws", *args], capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


def table(query_args: list) -> None:
    print(aws(*query_args) or "None found or error accessing")


print(f"{YELLOW}=== AWS Monitoring Cleanup for cloudless.gr ==={NC}")
print("Prerequisites: AWS CLI v2 installed and configured\n")
if DRY_RUN:
    print(f"{YELLOW}*** DRY-RUN MODE - No changes will be made ***{NC}")

print(f"\n{GREEN}=== Checking CloudFront Distributions ==={NC}")
table(
    [
        "cloudfront",
        "list-distributions",
        "--query",
        "DistributionList.Items[?contains(Aliases.Items,"
        " 'cloudless') || contains(Aliases.Items, 'cloudless.gr')]"
        ".[Id,Status,Aliases.Items]",
        "--output",
        "table",
    ]
)

print(f"\n{GREEN}=== Checking CloudWatch Log Groups ==={NC}")
table(
    [
        "logs",
        "describe-log-groups",
        "--query",
        "logGroups[?starts_with(logGroupName,"
        " '/aws/lambda/cloudless') || starts_with(logGroupName,"
        " '/aws/apigateway/cloudless') || starts_with(logGroupName,"
        " '/aws/monitoring/cloudless')]."
        "[logGroupName,storedBytes]",
        "--output",
        "table",
    ]
)

print(f"\n{GREEN}=== Checking SSM Parameters ==={NC}")
table(
    [
        "ssm",
        "describe-parameters",
        "--parameter-filters",
        "Key=Name,Option=BeginsWith,Values=/cloudless/",
        "--query",
        "Parameters[*].{Name:Name,Type:Type}",
        "--output",
        "table",
    ]
)

print(f"\n{GREEN}=== Checking Lambda Functions ==={NC}")
table(
    [
        "lambda",
        "list-functions",
        "--query",
        "Functions[?starts_with(FunctionName, 'cloudless')].[FunctionName,Runtime,State]",
        "--output",
        "table",
    ]
)

print(f"\n{GREEN}=== Checking DynamoDB Tables ==={NC}")
table(
    [
        "dynamodb",
        "list-tables",
        "--query",
        "TableNames[?starts_with(@, 'cloudless')]",
        "--output",
        "text",
    ]
)

print(f"\n{GREEN}=== Checking CloudWatch Alarms ==={NC}")
table(
    [
        "cloudwatch",
        "describe-alarms",
        "--alarm-name-prefix",
        "cloudless",
        "--query",
        "MetricAlarms[*].{Name:AlarmName,State:StateValue}",
        "--output",
        "table",
    ]
)

if not DRY_RUN:
    print(f"\n{RED}*** EXECUTING CLEANUP ***{NC}")

    print(f"\n{RED}Deleting CloudWatch Log Groups...{NC}")
    lgs = aws(
        "logs",
        "describe-log-groups",
        "--query",
        "logGroups[?starts_with(logGroupName,"
        " '/aws/lambda/cloudless') || "
        "starts_with(logGroupName,"
        " '/aws/monitoring/cloudless')].logGroupName",
        "--output",
        "text",
    )
    for lg in lgs.split():
        aws("logs", "delete-log-group", "--log-group-name", lg)
        print(f"Deleted: {lg}")

    print(f"\n{RED}Deleting SSM Parameters...{NC}")
    params = aws(
        "ssm",
        "describe-parameters",
        "--parameter-filters",
        "Key=Name,Option=BeginsWith,Values=/cloudless/",
        "--query",
        "Parameters[].Name",
        "--output",
        "text",
    )
    for p in params.split():
        aws("ssm", "delete-parameter", "--name", p)
        print(f"Deleted: {p}")

    print(f"\n{RED}Deleting Lambda Functions...{NC}")
    funcs = aws(
        "lambda",
        "list-functions",
        "--query",
        "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName",
        "--output",
        "text",
    )
    for f in funcs.split():
        aws(
            "lambda",
            "delete-provisioned-concurrency-config",
            "--function-name",
            f,
            "--qualifier",
            "1",
        )
        aws("lambda", "delete-function-url-config", "--function-name", f)
        aws("lambda", "delete-function", "--function-name", f)
        print(f"Deleted: {f}")

    print(f"\n{RED}Deleting CloudFront Distribution...{NC}")
    dist = aws(
        "cloudfront",
        "list-distributions",
        "--query",
        "DistributionList.Items[?contains(Aliases.Items,"
        " 'cloudless') || contains(Aliases.Items,"
        " 'cloudless.gr')].Id",
        "--output",
        "text",
    )
    if dist and dist != "None":
        print(f"Distribution {dist} needs to be disabled first (set Enabled=false in config)")
        print(f"Then run: aws cloudfront delete-distribution --id {dist} --if-match <ETAG>")

print(f"""
{GREEN}=== Recommendations ==={NC}
1. Verify Cloudflare Worker is deployed and healthy first
2. Ensure R2 buckets have all migrated data
3. Confirm D1 database has all user/auth data
4. Set DRY_RUN=false only after verification
5. Consider terraform destroy if resources are
   Terraform-managed""")
