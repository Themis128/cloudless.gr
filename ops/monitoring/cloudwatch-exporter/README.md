# Cloudless CloudWatch Exporter

Monitors AWS CloudWatch SQS metrics for the Cloudless revalidation FIFO queue.

## Queue

`cloudless-production-CloudlessSiteRevalidationEventsQueue-mvunfhmd.fifo`

## Metrics

- `AWS/SQS ApproximateAgeOfOldestMessage`
- `AWS/SQS ApproximateNumberOfMessagesVisible`

## Prometheus queries

```promql
aws_sqs_approximate_age_of_oldest_message_maximum{queue_name="cloudless-production-CloudlessSiteRevalidationEventsQueue-mvunfhmd.fifo"}
```

```promql
aws_sqs_approximate_number_of_messages_visible_maximum{queue_name="cloudless-production-CloudlessSiteRevalidationEventsQueue-mvunfhmd.fifo"}
```

## Alert rules

- `CloudlessRevalidationQueueOldMessagesWarning`
- `CloudlessRevalidationQueueOldMessagesCritical`
- `CloudlessRevalidationQueueBacklogWarning`
- `CloudlessRevalidationQueueBacklogCritical`

## Thresholds

Oldest message age:

- Warning: `>= 300s` for 10 minutes
- Critical: `>= 900s` for 5 minutes

Visible backlog:

- Warning: `>= 10` messages for 10 minutes
- Critical: `>= 50` messages for 5 minutes

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
```
