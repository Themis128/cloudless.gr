# Verify the backups actually restore

> "An untested backup is not a backup." Walk through both flows once, then re-test quarterly.

## A. CNPG point-in-time recovery test

1. **Confirm WAL is archiving.**
   ```bash
   kubectl -n postiz get cluster postiz-pg -o jsonpath='{.status.firstRecoverabilityPoint}{"\n"}'
   ```
   You should see a recent timestamp. If empty, WAL archive isn't working — check `kubectl -n postiz logs postiz-pg-1 -c postgres | grep -i barman`.

2. **Confirm a base backup exists.**
   ```bash
   kubectl -n postiz get backups
   ```
   The first one is triggered immediately by `scheduledbackup.yaml` (because `immediate: true`).

3. **Restore into a fresh cluster.**

   Save as `restore-test.yaml`:
   ```yaml
   apiVersion: postgresql.cnpg.io/v1
   kind: Cluster
   metadata:
     name: postiz-pg-restore-test
     namespace: postiz
   spec:
     instances: 1
     imageName: ghcr.io/cloudnative-pg/postgresql:16.4
     storage: { size: 10Gi }
     bootstrap:
       recovery:
         source: postiz-pg
         recoveryTarget:
           targetTime: "2026-06-18 12:00:00.00000+00"   # any time inside your retention window
     externalClusters:
       - name: postiz-pg
         barmanObjectStore:
           destinationPath: "s3://postiz-pg-backups"
           endpointURL: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
           s3Credentials:
             accessKeyId:     { name: postiz-pg-r2-creds, key: ACCESS_KEY_ID }
             secretAccessKey: { name: postiz-pg-r2-creds, key: ACCESS_SECRET_KEY }
   ```
   ```bash
   kubectl apply -f restore-test.yaml
   kubectl -n postiz wait --for=condition=Ready cluster/postiz-pg-restore-test --timeout=600s
   ```

4. **Sanity-check the data.**
   ```bash
   kubectl -n postiz exec -it postiz-pg-restore-test-1 -- psql -U postgres -d postiz \
     -c "SELECT COUNT(*) FROM \"User\";"
   ```

5. **Clean up the test cluster.**
   ```bash
   kubectl -n postiz delete cluster postiz-pg-restore-test
   ```

## B. MinIO mirror test

1. **Force-run the mirror CronJob once:**
   ```bash
   kubectl -n postiz create job --from=cronjob/minio-r2-mirror minio-mirror-test
   kubectl -n postiz logs job/minio-mirror-test -f
   ```

2. **List objects in R2 to confirm they arrived:**
   ```bash
   # From any machine with mc installed
   mc alias set r2 https://<ACCOUNT_ID>.r2.cloudflarestorage.com <KEY> <SECRET> --api S3v4
   mc ls r2/postiz-uploads-mirror
   ```

3. **Simulated disaster recovery** — point a *new* Postiz install at the R2 mirror by:
   - Setting `STORAGE_PROVIDER=cloudflare`,
   - `CLOUDFLARE_BUCKET_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com/postiz-uploads-mirror/`,
   - keys from the R2 token.

   Confirm a previously uploaded media file loads in the UI.

## Schedule

Re-run both A and B every quarter. Calendar it. Backups that have never been tested have a way of failing the day you need them.
