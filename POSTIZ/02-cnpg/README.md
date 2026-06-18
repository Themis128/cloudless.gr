# CloudNativePG for Postiz

## Why CNPG instead of the bundled subchart
- Built-in physical backups (continuous WAL archiving to S3/MinIO when you add the backup tier).
- Rolling upgrades + point-in-time recovery.
- Native Prometheus metrics.
- Better fit for K3s than the Bitnami subchart for production.

## Install the operator (once per cluster)
```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update
helm upgrade --install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system --create-namespace
```

## Connection string Postiz needs
After the cluster is `Ready`, the in-cluster DSN is:
```
postgresql://postiz:<password>@postiz-pg-rw.postiz.svc.cluster.local:5432/postiz
```
`postiz-pg-rw` = primary (read/write). `postiz-pg-ro` = read replicas (none yet, single instance).

## Verify
```bash
kubectl -n postiz get cluster postiz-pg
kubectl cnpg status postiz-pg -n postiz
```
