# MinIO in-cluster S3 for Postiz uploads

## Why this layout
Postiz only supports two `STORAGE_PROVIDER` values: `local` and `cloudflare`. The "cloudflare" path is just an S3-compatible client (AWS SDK pointed at an S3 endpoint), so we point it at MinIO and reuse the same `CLOUDFLARE_*` env vars. This is a well-known pattern.

## Install operator
```bash
helm repo add minio-operator https://operator.min.io
helm repo update
helm upgrade --install minio-operator minio-operator/operator \
  --namespace minio-operator --create-namespace
```

## Provision tenant
Replace placeholders in `tenant.yaml`, then:
```bash
kubectl apply -f 04-minio/tenant.yaml
```

## In-cluster endpoint
- S3 API: `http://minio.postiz.svc.cluster.local`
- Console: `postiz-minio-console.postiz.svc.cluster.local:9090` (expose via Ingress if you want a UI)
- Bucket: `postiz-uploads`

## How Postiz consumes it (set in 05-postiz/secrets.yaml)
```yaml
STORAGE_PROVIDER: "cloudflare"
CLOUDFLARE_ACCOUNT_ID: "unused-but-required"
CLOUDFLARE_ACCESS_KEY: "postiz-app"                # from postiz-minio-app-user
CLOUDFLARE_SECRET_ACCESS_KEY: "<app secret>"
CLOUDFLARE_BUCKETNAME: "postiz-uploads"
CLOUDFLARE_BUCKET_URL: "http://minio.postiz.svc.cluster.local/postiz-uploads/"
CLOUDFLARE_REGION: "auto"
```
