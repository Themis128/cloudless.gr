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

### Option A — Terraform (full stack)

```bash
cd infrastructure/r24-dr
terraform init \
  -backend-config="bucket=cloudless-analytics-data" \
  -backend-config="key=r24-dr/terraform.tfstate" \
  -backend-config="region=us-east-1"
terraform apply \
  -var="primary_region=us-east-1" \
  -var="hosted_zone_id=Z…" \
  -var="primary_alias_dns_name=d3k7muo3c6lw6s.cloudfront.net"
```

### Option B — CI for Global Tables only

```bash
# dry-run
gh workflow run r24-add-replicas.yml -f apply=false
# apply replicas
gh workflow run r24-add-replicas.yml -f apply=true
```

## Failover procedure

1. Route 53 health check detects primary unhealthy
2. DNS fails over to SECONDARY (standby Lambda URL)
3. Standby serves health + minimal surface with replicated DDB data
4. When primary recovers, switch back (PRIMARY health check healthy)

## Files

- `main.tf` — standby Lambda + IAM (us-west-2)
- `route53.tf` — health check + failover records
- `dynamodb.tf` — Global Tables replica provisioner
- `.github/workflows/r24-add-replicas.yml` — CI path for replicas
