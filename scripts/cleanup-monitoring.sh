#!/bin/bash
# AWS Monitoring Services Cleanup for cloudless.gr
# This script removes ONLY monitoring-related services after migration to Cloudflare
#
# Prerequisites:
#   - AWS credentials configured via: aws configure, or
#   - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
#   - Or via IAM role/OIDC when running in CI

set -euo pipefail

# === 1. CLOUDWATCH LOG GROUPS (Monitoring) ===
echo "=== Deleting CloudWatch Log Groups (Monitoring) ==="

LOG_GROUPS=(
    "/aws/lambda/cloudless-production-CronAnalyticsRollupHandlerFunction-*"
    "/aws/lambda/cloudless-production-CronGscCacheRefreshHandlerFunction-*"
    "/aws/lambda/cloudless-production-CronCalendarDigestHandlerFunction-*"
    "/aws/lambda/cloudless-production-CronVoiceBriefHandlerFunction-*"
    "/aws/lambda/cloudless-production-CronReportCleanupHandlerFunction-*"
    "/aws/monitoring/cloudless-*"
)

for pattern in "${LOG_GROUPS[@]}"; do
    aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '$pattern')].[logGroupName]" --output text 2>/dev/null | while read lg; do
        if [ -n "$lg" ]; then
            echo "Deleting log group: $lg"
            aws logs delete-log-group --log-group-name "$lg"
        fi
    done
done

# === 2. CLOUDWATCH ALARMS (Monitoring) ===
echo ""
echo "=== Deleting CloudWatch Alarms (Monitoring) ==="
aws cloudwatch describe-alarms --alarm-name-prefix "cloudless" --query "MetricAlarms[].AlarmName" --output text 2>/dev/null | while read alarm; do
    if [ -n "$alarm" ]; then
        echo "Deleting alarm: $alarm"
        aws cloudwatch delete-alarms --alarm-names "$alarm"
    fi
done

# === 3. REMOVE PROVISIONED CONCURRENCY (Monitoring Optimization) ===
echo ""
echo "=== Removing Provisioned Concurrency (Monitoring Optimization) ==="
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName" --output text 2>/dev/null | while read func; do
    if [ -n "$func" ]; then
        echo "Removing provisioned concurrency for: $func"
        aws lambda delete-provisioned-concurrency-config --function-name "$func" --qualifier 1 2>/dev/null || true
    fi
done

# === 4. DELETE MONITORING SSM PARAMETERS ===
echo ""
echo "=== Deleting Monitoring SSM Parameters ==="
MONITORING_PARAMS=(
    "/cloudless/production/KUMA_BASE_URL"
    "/cloudless/production/KUMA_STATUS_PAGE_SLUG"
    "/cloudless/production/GRAFANA_BASE_URL"
    "/cloudless/production/PROMETHEUS_URL"
    "/cloudless/production/GRAFANA_ADMIN_PASSWORD"
    "/cloudless/production/GRAFANA_API_TOKEN"
    "/cloudless/production/SENTRY_ORG"
    "/cloudless/production/SENTRY_PROJECT"
    "/cloudless/production/NEXT_PUBLIC_SENTRY_DSN"
    "/cloudless/production/SENTRY_AUTH_TOKEN"
)

for param in "${MONITORING_PARAMS[@]}"; do
    echo "Deleting: $param"
    aws ssm delete-parameter --name "$param" 2>/dev/null || true
done

# === VERIFICATION ===
echo ""
echo "=== Verification - Remaining Services ==="
echo "CloudFront distributions:"
aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].{Id:Id,Status:Status}" --output table 2>/dev/null || echo "None found"

echo ""
echo "Remaining Lambda functions:"
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName" --output table 2>/dev/null || echo "None found"

echo ""
echo "Done. Check the migration-completion.md for next steps."