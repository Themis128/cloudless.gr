#!/usr/bin/env python3
"""AWS Monitoring services cleanup for cloudless.gr — removes ONLY
monitoring-related services after migration to Cloudflare.

Prerequisites: AWS credentials via `aws configure`, env vars, or
IAM role/OIDC."""

import subprocess

LOG_PATTERNS = [
    "/aws/lambda/cloudless-production-CronAnalyticsRollupHandlerFunction-",
    "/aws/lambda/cloudless-production-CronGscCacheRefreshHandlerFunction-",
    "/aws/lambda/cloudless-production-CronCalendarDigestHandlerFunction-",
    "/aws/lambda/cloudless-production-CronVoiceBriefHandlerFunction-",
    "/aws/lambda/cloudless-production-CronReportCleanupHandlerFunction-",
    "/aws/monitoring/cloudless-",
]

MONITORING_PARAMS = [
    "/cloudless/production/KUMA_BASE_URL",
    "/cloudless/production/KUMA_STATUS_PAGE_SLUG",
    "/cloudless/production/GRAFANA_BASE_URL",
    "/cloudless/production/PROMETHEUS_URL",
    "/cloudless/production/GRAFANA_ADMIN_PASSWORD",
    "/cloudless/production/GRAFANA_API_TOKEN",
    "/cloudless/production/SENTRY_ORG",
    "/cloudless/production/SENTRY_PROJECT",
    "/cloudless/production/NEXT_PUBLIC_SENTRY_DSN",
    "/cloudless/production/SENTRY_AUTH_TOKEN",
]


def aws(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["aws", *args], capture_output=True, text=True)


# 1. CloudWatch log groups
print("=== Deleting CloudWatch Log Groups (Monitoring) ===")
r = aws("logs", "describe-log-groups", "--query", "logGroups[].logGroupName", "--output", "text")
if r.returncode == 0:
    for lg in r.stdout.split():
        if any(lg.startswith(p) for p in LOG_PATTERNS):
            print(f"Deleting log group: {lg}")
            aws("logs", "delete-log-group", "--log-group-name", lg)

# 2. CloudWatch alarms
print("\n=== Deleting CloudWatch Alarms (Monitoring) ===")
r = aws(
    "cloudwatch",
    "describe-alarms",
    "--alarm-name-prefix",
    "cloudless",
    "--query",
    "MetricAlarms[].AlarmName",
    "--output",
    "text",
)
if r.returncode == 0:
    for alarm in r.stdout.split():
        print(f"Deleting alarm: {alarm}")
        aws("cloudwatch", "delete-alarms", "--alarm-names", alarm)

# 3. Provisioned concurrency
print("\n=== Removing Provisioned Concurrency (Monitoring Optimization) ===")
r = aws(
    "lambda",
    "list-functions",
    "--query",
    "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName",
    "--output",
    "text",
)
if r.returncode == 0:
    for func in r.stdout.split():
        print(f"Removing provisioned concurrency for: {func}")
        aws(
            "lambda",
            "delete-provisioned-concurrency-config",
            "--function-name",
            func,
            "--qualifier",
            "1",
        )

# 4. Monitoring SSM parameters
print("\n=== Deleting Monitoring SSM Parameters ===")
for p in MONITORING_PARAMS:
    print(f"Deleting: {p}")
    aws("ssm", "delete-parameter", "--name", p)

# Verification
print("\n=== Verification - Remaining Services ===")
print("CloudFront distributions:")
r = aws(
    "cloudfront",
    "list-distributions",
    "--query",
    "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].{Id:Id,Status:Status}",
    "--output",
    "table",
)
print(r.stdout if r.returncode == 0 and r.stdout.strip() else "None found")

print("\nRemaining Lambda functions:")
r = aws(
    "lambda",
    "list-functions",
    "--query",
    "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName",
    "--output",
    "table",
)
print(r.stdout if r.returncode == 0 and r.stdout.strip() else "None found")

print("\nDone. Check the migration-completion.md for next steps.")
