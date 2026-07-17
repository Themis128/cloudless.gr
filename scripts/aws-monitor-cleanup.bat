# AWS Monitoring Cleanup Script
# Generated for cloudless.gr migration to Cloudflare
# Run this AFTER verifying Cloudflare services are operational

@echo off
REM === PREREQUISITES ===
REM 1. Install AWS CLI v2: https://aws.amazon.com/cli/
REM 2. Configure credentials: aws configure --profile cloudless-cleanup
REM    or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY as environment variables
REM 3. Verify Cloudflare services are working before running cleanup

REM === SAFETY: Dry-run first (uncomment to preview) ===
REM aws --profile cloudless-cleanup cloudfront list-distributions --query 'DistributionList.Items[*].{Id:Id,Status:Status,Domain:Domain}' --output table

REM === 1. DELETE CLOUDFRONT DISTRIBUTION ===
REM This disables the CloudFront edge cache for the migrated application
echo Checking CloudFront distributions...
for /f "delims=" %%i in ('aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].{Id:Id,Status:Status,Etag:ETag}" --output json 2^>nul') do (
    echo Distribution: %%i
)
REM Uncomment to delete (waits for deployment status):
REM aws cloudfront get-distribution-config --id E3XXXXXXXXXXXXXX --query "{ETag:ETag,Config:DistributionConfig}" > dist-config.json
REM aws cloudfront delete-distribution --id E3XXXXXXXXXXXXXX --if-match <ETag>

REM === 2. DELETE CLOUDWATCH LOGS ===
REM AWS monitoring services logs that are no longer needed
echo Checking CloudWatch log groups...
aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless') || starts_with(logGroupName, '/aws/apigateway/cloudless')].[logGroupName]" --output text 2>nul

REM Clean up specific log groups:
REM aws logs delete-log-group --log-group-name /aws/lambda/cloudless-app-production
REM aws logs delete-log-group --log-group-name /aws/apigateway/cloudless-api
REM aws logs delete-log-group --log-group-name /aws/monitoring/cloudless-alerts

REM === 3. DELETE SSM PARAMETERS ===
echo Checking SSM parameters...
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" --query "Parameters[*].{Name:Name,Type:Type}" --output table 2>nul

REM Clean up production secrets (run after D1 migration is verified):
REM aws ssm delete-parameter --name /cloudless/production/AUTH_SECRET
REM aws ssm delete-parameter --name /cloudless/production/SES_FROM_EMAIL
REM aws ssm delete-parameter --name /cloudless/production/SLACK_BOT_TOKEN
REM aws ssm delete-parameter --name /cloudless/production/STRIPE_SECRET_KEY

REM === 4. DELETE LAMBDA FUNCTIONS ===
echo Checking Lambda functions...
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'cloudless')].[FunctionName,Runtime,State]" --output table 2>nul

REM Remove function URLs and provisioned concurrency first:
REM aws lambda delete-function-url-config --function-name cloudless-app-production
REM aws lambda delete-provisioned-concurrency-config --function-name cloudless-app-production --qualifier 1
REM aws lambda delete-function --function-name cloudless-app-production

REM === 5. DELETE DYNAMODB TABLES (if any) ===
echo Checking DynamoDB tables...
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'cloudless')]" --output text 2>nul

REM Delete only after confirming all data migrated to R2/D1:
REM aws dynamodb delete-table --table-name cloudless-sessions
REM aws dynamodb delete-table --table-name cloudless-analytics-cache

REM === 6. DELETE CLOUDWATCH METRICS ALARMS ===
echo Checking CloudWatch alarms...
aws cloudwatch describe-alarms --alarm-name-prefix cloudless --query "MetricAlarms[*].{Name:AlarmName,State:StateValue}" --output table 2>nul

REM Clean up alarms:
REM aws cloudwatch delete-alarms --alarm-names cloudless-high-cpu cloudless-low-memory

REM === VERIFICATION ===
echo.
echo === Cleanup Status Check ===
echo - CloudFront distributions: Run 'aws cloudfront list-distributions' to verify
echo - Lambda functions: Run 'aws lambda list-functions' to verify
echo - SSM parameters: Run 'aws ssm describe-parameters' to verify

REM === ALTERNATIVE: Terraform Destroy ===
REM If these resources are managed by Terraform, use:
REM cd /path/to/infrastructure/terraform
REM terraform destroy -auto-approve -target aws_cloudfront_distribution.main_app
REM terraform destroy -auto-approve -target aws_lambda_function_url.main_app
REM terraform destroy -auto-approve -target aws_lambda_provisioned_concurrency_config.main_app