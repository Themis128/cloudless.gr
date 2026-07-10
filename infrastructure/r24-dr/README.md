# R24: Route 53 DR - Terraform for AWS-side passive disaster recovery

Creates a secondary-region (us-west-2) passive Lambda + DDB Global Tables for AWS-side failover.

## Architecture

- **Primary**: us-east-1 SST stack (active)
- **Standby**: us-west-2 Lambda (passive, Route 53 failover target)
- **Global Tables**: DDB tables replicate to us-west-2 automatically

## What this provides

- **RPO**: < 1 second (DDB Global Tables)
- **RTO**: ~2 min (Lambda cold start)
- **Cost**: ~$5/mo Route 53 health check + ~$0.5/mo standby Lambda

## Usage

```bash
# Deploy to us-west-2
cd infrastructure/r24-dr
terraform init -backend-config="bucket=cloudless-analytics-data" -backend-config="key=r24-dr/terraform.tfstate" -backend-config="region=us-west-2"
terraform apply -var="primary_region=us-east-1"
```

## Failover procedure

1. Route 53 health check detects primary unhealthy
2. Operator manually switches DNS to standby
3. Standby Lambda activates with replicated data
4. When primary recovers, switch back

## Files

- `main.tf` - Primary resources (Lambda, IAM)
- `route53.tf` - Health check + failover record
- `dynamodb.tf` - Global table configurations (updates existing tables)