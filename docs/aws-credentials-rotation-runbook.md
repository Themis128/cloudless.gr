# AWS Credentials Rotation — k3s + Pi Workloads

Step-by-step recovery for the three IAM issues found during the 2026-05-29 audit. Run these in an **admin AWS session** (your `cloudless-ops` user does not have the IAM perms to do most of this).

## Problem inventory

| # | Symptom | Root cause | Visible effect |
|---|---|---|---|
| 1 | `s3-to-duckdb-sync` CronJob crash-loops every 30 min | `omv-main-cli` IAM user has `AWSCompromisedKeyQuarantineV3` attached | Currently SUSPENDED; analytics ingest stopped |
| 2 | etcd S3 snapshots silently fail since 2026-05-24 12:00 UTC | `cloudless-ops` IAM lacks `s3:PutObject` on the etcd bucket — the access key was likely tied to a policy version that has since been narrowed | Local etcd backups still write (3 retained on USB SSD + mirror to bulk), but no off-site backup since 2026-05-24 |
| 3 | Mismatch between embedded keys and active keys | k3s config references `AKIAUBXIAELUVFKKEHQJ` (cloudless-ops, SES); the active key on `omv-main-cli` is a different ID (`AKIAUBXIAELU5SADA3XL`) | etcd-s3 config uses the wrong user; should use the same purpose-specific user as the rest of cluster S3 ops |

## Step 1 — Rotate `omv-main-cli` (unblocks s3-to-duckdb-sync)

In your **admin AWS console** (root or a user with `iam:*` on this user):

### 1a. Detach the quarantine policy

```bash
aws iam detach-user-policy \
  --user-name omv-main-cli \
  --policy-arn arn:aws:iam::aws:policy/AWSCompromisedKeyQuarantineV3
```

### 1b. Rotate the access key

```bash
# Create new
NEW_KEY=$(aws iam create-access-key --user-name omv-main-cli --output json)
NEW_ID=$(echo "$NEW_KEY" | jq -r '.AccessKey.AccessKeyId')
NEW_SECRET=$(echo "$NEW_KEY" | jq -r '.AccessKey.SecretAccessKey')
echo "New key: $NEW_ID"

# Delete old (the leaked one)
aws iam delete-access-key --user-name omv-main-cli \
  --access-key-id AKIAUBXIAELU5SADA3XL
```

### 1c. Update k8s secrets that hold `omv-main-cli` creds

```bash
# Path: maintenance/aws-creds is the one s3-to-duckdb-sync mounts
ssh tbaltzakis@100.113.41.119 "
  kubectl -n maintenance create secret generic aws-creds \
    --from-literal=AWS_ACCESS_KEY_ID='$NEW_ID' \
    --from-literal=AWS_SECRET_ACCESS_KEY='$NEW_SECRET' \
    --dry-run=client -o yaml | kubectl apply -f -
"
```

There are TWO other secrets that may also need the rotation depending on
their owner-user (verify before patching):

- `monitoring/aws-creds`
- `cloudless/pi-standby-aws-creds`

Confirm with:

```bash
ssh tbaltzakis@100.113.41.119 \
  "kubectl -n monitoring get secret aws-creds -o jsonpath='{.data.AWS_ACCESS_KEY_ID}' | base64 -d"
```

If it returns the OLD `AKIAUBXIAELU5SADA3XL`, repeat 1c for that namespace too.

### 1d. Un-suspend `s3-to-duckdb-sync`

```bash
ssh tbaltzakis@100.113.41.119 "
  kubectl -n analytics patch cronjob s3-to-duckdb-sync \
    -p '{\"spec\":{\"suspend\":false}}'
"
```

## Step 2 — Restore etcd S3 snapshots

Two architectural questions to decide first:

- **Option A (minimal):** keep using `cloudless-ops` SMTP key for etcd-s3; just give cloudless-ops `s3:PutObject` on the etcd bucket. Conflates SMTP-creds with backup-creds but is one-policy-change.
- **Option B (recommended):** create a purpose-specific IAM user `cloudless-etcd-backup` with ONLY `s3:PutObject + s3:DeleteObject + s3:ListBucket` on `cloudless-etcd-snapshots`. Update k3s config to use it.

### Option B (cleaner)

```bash
# Create user
aws iam create-user --user-name cloudless-etcd-backup

# Inline policy
aws iam put-user-policy --user-name cloudless-etcd-backup \
  --policy-name etcd-s3-snapshots \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":[
        "s3:PutObject","s3:GetObject","s3:DeleteObject",
        "s3:ListBucket","s3:GetBucketLocation"
      ],
      "Resource":[
        "arn:aws:s3:::cloudless-etcd-snapshots",
        "arn:aws:s3:::cloudless-etcd-snapshots/etcd/*"
      ]
    }]
  }'

# Generate access key
BACKUP_KEY=$(aws iam create-access-key --user-name cloudless-etcd-backup --output json)
BACKUP_ID=$(echo "$BACKUP_KEY" | jq -r '.AccessKey.AccessKeyId')
BACKUP_SECRET=$(echo "$BACKUP_KEY" | jq -r '.AccessKey.SecretAccessKey')
```

### Update k3s config and restart

```bash
ssh tbaltzakis@100.113.41.119 "
  sudo sed -i.bak \
    -e 's|^etcd-s3-access-key:.*|etcd-s3-access-key: $BACKUP_ID|' \
    -e 's|^etcd-s3-secret-key:.*|etcd-s3-secret-key: $BACKUP_SECRET|' \
    /etc/rancher/k3s/config.yaml

  sudo systemctl restart k3s
"
```

> ⚠️ k3s restart takes ~30s during which the apiserver is unavailable.
> Site is served by Lambda PRIMARY throughout, but `kubectl` calls will
> time out briefly. Time the restart for a quiet window.

### Trigger a fresh snapshot and verify

```bash
ssh tbaltzakis@100.113.41.119 "
  sudo k3s etcd-snapshot save \
    --etcd-s3 --etcd-s3-bucket cloudless-etcd-snapshots
  sleep 5
  kubectl get etcdsnapshotfile | grep s3 | tail -3
"

aws s3 ls s3://cloudless-etcd-snapshots/etcd/ --recursive | tail -3
```

The newest file in `aws s3 ls` should be from <2 min ago.

## Step 3 — Don't forget the SES side

The `AKIAUBXIAELUVFKKEHQJ` key on `cloudless-ops` was being used for **SES SMTP** (the omv-main alerts). When you rotate, also make sure `/etc/msmtprc` on omv-main is updated with the new key, otherwise alert emails (including the daily heartbeat) will start failing silently.

```bash
ssh tbaltzakis@100.113.41.119 "sudo cat /etc/msmtprc | grep -E 'user|password'"
```

If `user=AKIAUBXIAELUVFKKEHQJ`, that's the key you're rotating. Generate a
new SES-only IAM user OR just rotate cloudless-ops and re-issue an SES
SMTP password from the new key:

```bash
# AWS console: IAM → cloudless-ops → Security credentials →
# Create access key with "SMTP credentials for SES" purpose
```

Then update `/etc/msmtprc` with the new SMTP username/password and test:

```bash
ssh tbaltzakis@100.113.41.119 \
  "sudo /usr/local/bin/omv-main-alert 'test after rotation' 'body'"
```

## Verification checklist

After all three steps:

- [ ] `omv-main-cli` has NO `AWSCompromisedKeyQuarantineV3` attached
- [ ] `s3-to-duckdb-sync` CronJob: suspend=false; next run succeeds (check `kubectl -n analytics get jobs --sort-by=.metadata.creationTimestamp | tail -3`)
- [ ] etcd S3 snapshot uploaded within last 6h (`aws s3 ls s3://cloudless-etcd-snapshots/etcd/ | tail -3`)
- [ ] omv-main heartbeat email arrives next 07:00 EEST
- [ ] No new SES `501 Invalid RCPT TO` or `AccessDenied` lines in `/var/log/msmtp.log`

## Rollback

If anything goes wrong in step 2:

```bash
ssh tbaltzakis@100.113.41.119 "
  sudo cp /etc/rancher/k3s/config.yaml.bak /etc/rancher/k3s/config.yaml
  sudo systemctl restart k3s
"
```

This restores the pre-rotation config. Local etcd snapshots continue to
write to `/srv/dev-disk-by-uuid-a9a5a108-*/k3s/server/db/snapshots/`
regardless of S3 status, so cluster recovery is not blocked.
