#!/usr/bin/env python3
"""rootkey.csv credential detector — checks whether a downloaded
credential file is AWS or GCP format, prints the AWS monitoring
cleanup commands to run after credentials are configured."""

import csv
import os
from pathlib import Path

ROOTKEY = Path("/mnt/c/Users/baltz/Downloads/rootkey.csv")

if ROOTKEY.is_file():
    print(f"Found credential file at {ROOTKEY}")
    with ROOTKEY.open() as f:
        rows = list(csv.reader(f))
    if rows:
        header = ",".join(rows[0])
        print(header)
        if "AWS_ACCESS_KEY_ID" in header and len(rows) > 1:
            print("Detected AWS credentials format")
            os.environ["AWS_ACCESS_KEY_ID"] = rows[1][0]
            os.environ["AWS_SECRET_ACCESS_KEY"] = rows[1][1]
        else:
            print("Detected GCP credentials format - AWS CLI will need separate AWS credentials")

print("""
# Commands to remove AWS monitoring services:

# 1. List and remove CloudWatch log groups
aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless')].[logGroupName]" --output text | while read lg; do
    aws logs delete-log-group --log-group-name "$lg"
done

# 2. List and remove SSM parameters
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" --query "Parameters[].Name" --output text | while read p; do
    aws ssm delete-parameter --name "$p"
done

# 3. List and remove Lambda functions
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName" --output text | while read f; do
    aws lambda delete-provisioned-concurrency-config --function-name "$f" --qualifier 1 2>/dev/null || true
    aws lambda delete-function-url-config --function-name "$f" 2>/dev/null || true
    aws lambda delete-function --function-name "$f"
done

# 4. List and disable CloudFront distribution
aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].[Id,Status]" --output table
""")
