# R24: DynamoDB Global Tables - us-west-2 replicas
# Uses AWS CLI to add replicas to existing SST-managed tables
# This is run AFTER the tables exist in us-east-1

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = var.primary_region
}

# us-west-2 provider
provider "aws" {
  alias  = "west"
  region = "us-west-2"
}

variable "primary_region" {
  type    = string
  default = "us-east-1"
}

# Note: SST v4 doesn't directly support Global Tables replicas in the
# sst.aws.Dynamo resource. We use a local-exec provisioner to run
# AWS CLI commands that add replicas to existing tables.
#
# Alternative: Use SST's `transform` function to modify the CFN template.
# See: https://sst.dev/docs/aws-dynamo

# Apply Global Tables replicas to the 5 core tables
# This is idempotent - safe to run multiple times

resource "null_resource" "add_global_tables_replicas" {
  triggers = {
    # Re-run if tables are recreated
    tables = "StripeTransactions,UserProfile,AdminNotifications,AnalyticsCache,SessionTokenStore"
  }

  provisioner "local-exec" {
    command = <<EOT
      set -e
      # StripeTransactions
      aws dynamodb update-table --table-name cloudless-StripeTransactions-production --region ${var.primary_region} \
        --replicas "RegionName=us-west-2" || true
      
      # UserProfile  
      aws dynamodb update-table --table-name cloudless-UserProfile-production --region ${var.primary_region} \
        --replicas "RegionName=us-west-2" || true
        
      # AdminNotifications
      aws dynamodb update-table --table-name cloudless-AdminNotifications-production --region ${var.primary_region} \
        --replicas "RegionName=us-west-2" || true
        
      # AnalyticsCache
      aws dynamodb update-table --table-name cloudless-AnalyticsCache-production --region ${var.primary_region} \
        --replicas "RegionName=us-west-2" || true
        
      # SessionTokenStore
      aws dynamodb update-table --table-name cloudless-SessionTokenStore-production --region ${var.primary_region} \
        --replicas "RegionName=us-west-2,AWSRegion=us-west-2,GlobalTableName=cloudless-SessionTokenStore-production" || true
    EOT
  }
}