---
name: postiz-doctor
description: |
  Staged troubleshooter for Postiz on the cloudless.gr cluster — work the
  layers from outside in (DNS → tunnel → service → pod → DB → upstream
  API) and stop at the first stage that fails. Use whenever Postiz is
  unhealthy from the public URL, the /admin/postiz page is empty, a
  scheduled post didn't fire, the API returns 5xx, or a pod restart
  doesn't resolve a "channel disabled" issue. Pair with the general
  `postiz` skill once root cause is identified.
---

# Postiz Doctor

A practical, layered playbook for unsticking the cloudless.gr Postiz
deployment. **Stop at the first failing stage** — fixing it usually
resolves everything downstream.

## When to invoke this skill

- `https://postiz.cloudless.gr` returns 521/522/523/5xx, or hangs
- `/api/admin/postiz` returns 503 or 502 in the cloudless.gr admin UI
- The Postiz pod is `CrashLoopBackOff`, `OOMKilled`, or `Pending`
- A scheduled post is stuck in `QUEUE` past its publish time
- The Channels tab in `/admin/postiz` is empty when Postiz UI shows channels
- LinkedIn / Instagram / X / TikTok channel shows the red `!` badge

## Stage 0 — Decide what kind of failure this is

```bash
# Public path
curl -sI https://postiz.cloudless.gr | head -3

# Through the cluster, bypassing Cloudflare
kubectl -n postiz get svc postiz -o jsonpath='{.spec.ports[0].nodePort}'   # should be 30500
kubectl -n postiz exec deploy/postiz -- wget -qO- http://localhost:5000 | head -5
```

| Symptom | Most likely stage |
|---|---|
| Cloudflare error page (5xx) | 1 (DNS) or 2 (Tunnel) |
| Connection refused / timeout from in-cluster curl | 3 (Service) |
| 5xx from in-pod curl | 4 (Pod) or 5 (DB/Redis) |
| API returns a valid 4xx | 6 (Upstream / config) |

## Stage 1 — DNS

```bash
dig +short postiz.cloudless.gr
# Expect: a CNAME ending in `.cfargotunnel.com`
```

If the CNAME is missing or wrong:

```bash
# From Cowork
mcp__cloudless-infra__cloudflare_list_dns_records_gr({ name: "postiz" })
# Re-create if needed (proxied, CNAME → <tunnel-id>.cfargotunnel.com)
mcp__cloudless-infra__cloudflare_add_dns_record_gr({
  type: "CNAME",
  name: "postiz",
  content: "e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com",
  proxied: true
})
```

## Stage 2 — Cloudflare Tunnel

```bash
mcp__cloudless-infra__cloudflare_tunnel_status()
```

If the tunnel is down or missing the postiz route:

```bash
# On omv-main
sudo grep -A 3 "postiz.cloudless.gr" /etc/cloudflared/config.yml
sudo systemctl reload cloudflared
sudo journalctl -u cloudflared -n 30 --no-pager
```

The expected ingress rule is at `infrastructure/postiz/cloudflare-tunnel.yaml`
— append-paste before the catch-all if missing.

A 522 specifically means the tunnel reached Postiz's NodePort but Postiz
didn't ACK in time — usually the pod is up but unhealthy (skip to stage 4).

## Stage 3 — Kubernetes Service

```bash
kubectl -n postiz get svc postiz -o wide
# Type=NodePort, NodePort=30500, Endpoints non-empty

kubectl -n postiz get endpoints postiz
# Must list the pod IP. Empty = label-selector mismatch or pod down.
```

If `Endpoints` is empty, the pod isn't `Ready` — go to stage 4.

## Stage 4 — Postiz pod

```bash
kubectl -n postiz get pods -l app=postiz -o wide
kubectl -n postiz describe pod -l app=postiz | tail -40
kubectl -n postiz logs deploy/postiz --tail=200
```

Common verdicts:

| Sign | Cause / Fix |
|---|---|
| `CrashLoopBackOff` + log `ECONNREFUSED postiz-postgres:5432` | Postgres not ready yet → wait, or stage 5 |
| `CrashLoopBackOff` + log `JWT_SECRET not set` | The `postiz-secrets` Secret is missing or has empty keys → re-run `./install.sh` |
| `OOMKilled` | Bump `postiz.resources.limits.memory` in `values-prod.yaml`. Do NOT lower requests (see CLAUDE.md JVM lesson). Re-run `./install.sh`. |
| `Pending` + `no available nodes match selector` | omv-main not Ready, or the chart was applied with the wrong node selector |
| `ImagePullBackOff` | Hub rate-limit, or the tag was bumped past v2.11.2 (the cluster has no Temporal — pin it back) |
| HTTP 5xx from in-pod curl | App is up but failing — read the next 200 log lines, jump to stage 5 or 6 |

## Stage 5 — Postgres / Redis

```bash
# Postgres reachable?
kubectl -n postiz exec deploy/postiz-postgres -- \
  pg_isready -U postiz -d postiz

# Postgres logs (last error)
kubectl -n postiz logs deploy/postiz-postgres --tail=100 | grep -iE "error|fatal"

# Redis
kubectl -n postiz exec deploy/postiz-redis -- redis-cli ping     # PONG
```

If Postgres restarted with a corrupt PGDATA:

```bash
# Try a clean restart first
kubectl -n postiz rollout restart deploy/postiz-postgres
# If that fails: restore from the most recent backup
kubectl -n postiz exec -it deploy/postiz-postgres -- \
  psql -U postiz -d postiz < /path/to/postiz-YYYYMMDD.sql
```

## Stage 6 — Upstream / Public API

By here the pod is up and serving. Failures are now provider-side or
config-side.

```bash
# Auth check
curl -sI -H "Authorization: $POSTIZ_API_KEY" \
  https://postiz.cloudless.gr/api/public/v1/integrations | head -3

# 401 → API key wrong/expired → rotate from Postiz UI, update SSM
# 503 → POSTIZ_API_URL or POSTIZ_API_KEY missing in SSM
# 200 + empty array → no channels connected (different problem)
```

Channel-specific:

| Symptom | Stage-6 fix |
|---|---|
| Red `!` badge after page selection (LinkedIn page, IG) | v2.11.2 known issue. Apply the in-pod sed hot-fix from `docs/POSTIZ.md` Troubleshooting, redo the page selection. |
| Post stuck `QUEUE`, never moves to `PUBLISHED` | Provider OAuth token expired in Postiz. Disconnect + reconnect the channel from the Postiz UI. |
| `redirect_uri_mismatch` on connect | Provider developer-app whitelist missing `https://postiz.cloudless.gr/integrations/social/<provider>` |
| `429 Too Many Requests` from `POST /posts` | The instance-wide 30/hr limit — batch posts in one request, or bump `API_LIMIT` env var (chart `postiz.apiLimit`). |
| Image upload silently fails | `STORAGE_PROVIDER=local` + `UPLOAD_DIRECTORY=/uploads` mismatch — check the PVC is mounted at `/uploads` in the pod. |

## Stage 7 — App-side (cloudless.gr admin)

If `/admin/postiz` is broken but the underlying API works:

```bash
# Is the SSM cache stale? Lambda caches /cloudless/production/* for ~5min.
aws ssm get-parameter --name /cloudless/production/POSTIZ_API_URL --query 'Parameter.Value' --output text
aws ssm get-parameter --name /cloudless/production/POSTIZ_API_KEY --query 'Parameter.Value' --with-decryption --output text | head -c 8
echo  # truncated peek

# Force-refresh by redeploying the Lambda or waiting out the TTL.
```

Routes the page hits — verify each:

```bash
COOKIE=...  # admin session cookie
curl -s -b "$COOKIE" https://cloudless.gr/api/admin/postiz/integrations | jq .integrations[0]
curl -s -b "$COOKIE" "https://cloudless.gr/api/admin/postiz/posts?startDate=$(date -I -d '-30 days')T00:00:00Z&endDate=$(date -I -d '+30 days')T00:00:00Z" | jq .posts[0]
```

A 503 from these = `POSTIZ_API_URL`/`POSTIZ_API_KEY` not yet in
`getConfig()`. A 502 = the upstream Postiz returned 5xx — go back to stage 4.

## Verification once green

```bash
# Public roundtrip
curl -sI https://postiz.cloudless.gr | head -1                  # 200 or 302
# API roundtrip
curl -s -H "Authorization: $POSTIZ_API_KEY" \
  https://postiz.cloudless.gr/api/public/v1/integrations | jq 'length'
# Admin roundtrip — open https://cloudless.gr/en/admin/postiz in a browser
```

## Don't do this

- Don't lower `postiz.resources.limits.memory` — the limit doesn't reduce
  real RSS, it only invites OOMKills. See CLAUDE.md JVM workload lesson.
- Don't bump the image tag past v2.11.2 without first standing up Temporal.
- Don't `kubectl delete pvc postiz-postgres-data` on a hunch — that's the
  database. Restore from `pg_dump` only.
- Don't add an in-cluster ingress for `postiz.cloudless.gr` — Cloudflare
  Tunnel already routes it; doubling the path causes redirect loops.
