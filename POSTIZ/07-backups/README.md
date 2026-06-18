# Backups → Cloudflare R2

Two independent flows:

| Source | What it backs up | Mechanism | Where to |
|---|---|---|---|
| **CloudNativePG** | Full PG cluster (base backup + continuous WAL) | Native `barmanObjectStore` | R2 bucket `postiz-pg-backups` |
| **MinIO `postiz-uploads`** | User-uploaded media | Nightly `mc mirror` CronJob | R2 bucket `postiz-uploads-mirror` |

n8n's bundled SQLite isn't backed up here — switch n8n to use the CNPG cluster (see `06-automation/n8n/README.md`) and it gets backed up automatically.

## R2 setup (once)

1. **Create two buckets** in the Cloudflare R2 dashboard:
   - `postiz-pg-backups`
   - `postiz-uploads-mirror`
2. **Create an R2 API token** scoped to **Object Read & Write** on those two buckets. Save the **Access Key ID** + **Secret Access Key**.
3. **Note your account ID** — it's in the R2 dashboard URL (`https://dash.cloudflare.com/<ACCOUNT_ID>/r2`). The S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## Fill secrets

```bash
cp 07-backups/cnpg/r2-creds.yaml.example   07-backups/cnpg/r2-creds.yaml
cp 07-backups/minio/r2-creds.yaml.example  07-backups/minio/r2-creds.yaml
$EDITOR 07-backups/cnpg/r2-creds.yaml      # paste access key + secret
$EDITOR 07-backups/minio/r2-creds.yaml     # paste account ID + same keys
```

## Apply

```bash
chmod +x install-backups.sh
./install-backups.sh
```

## Verify the backups actually work

See `verify-restore.md` — backup is theatre until you've proven a restore. Walk through both flows at least once.
