# Cloudless CloudWatch Exporter

Monitors AWS CloudWatch SQS metrics for the Cloudless revalidation FIFO queue.

## Queue

`cloudless-production-CloudlessSiteRevalidationEventsQueue-mvunfhmd.fifo`

## Metrics

- `AWS/SQS ApproximateAgeOfOldestMessage`
- `AWS/SQS ApproximateNumberOfMessagesVisible`

## Alert rules

- `CloudlessRevalidationQueueOldMessagesWarning`
- `CloudlessRevalidationQueueOldMessagesCritical`
- `CloudlessRevalidationQueueBacklogWarning`
- `CloudlessRevalidationQueueBacklogCritical`

## Kubernetes Secret

The deployment expects this Secret in the `monitoring` namespace:

`cloudless-cloudwatch-exporter-aws`

Required keys:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Do not commit this Secret manifest or AWS credentials.

## Apply

```bash
kubectl apply -f ops/monitoring/cloudwatch-exporter/configmap.yaml
kubectl apply -f ops/monitoring/cloudwatch-exporter/deployment.yaml
kubectl apply -f ops/monitoring/cloudwatch-exporter/service.yaml
kubectl apply -f ops/monitoring/cloudwatch-exporter/servicemonitor.yaml
kubectl apply -f ops/monitoring/cloudwatch-exporter/prometheusrule.yaml
