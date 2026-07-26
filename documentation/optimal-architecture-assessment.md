# Optimal architecture — best-practices assessment for cloudless.gr

**Constraint:** AWS Lambda is the **primary**; the Pi k3s cluster is the
**HA warm-standby failover**; both must exchange data continuously so they
stay in sync. The 8 self-hosted apps (AppFlowy, EspoCRM, Postiz, n8n,
Mosquitto, Grafana, Uptime Kuma, ntfy) live **only on the Pi** — they
have no AWS-side replica.

This doc grades each sync surface and per-app config against current
2026 best practices, then proposes a ranked roadmap (R10-R20 candidates).

---

## 1) Current state — sync surface scorecard

What's enforced today, from `docs/pi-cloud-sync.md` + recent session work:

| Sync surface | Mechanism | Grade | Note |
|---|---|---|---|
| Code (image) | Both pin to `cloudless-pi-app:<sha>` via SSM `/cloud-sha` | ✅ A | Drift detector runs every 6 h |
| Public env (`NEXT_PUBLIC_*`) | Baked into image at build time | ✅ A | Identical image = identical env |
| Runtime secrets | Both halves read SSM `/cloudless/production/*` | ✅ A | 29 self-hosted keys all in sync (verified this session) |
| Auth sessions | Both verify against shared Cognito JWKS | ✅ A | Per PR #677 |
| Webhooks (Stripe etc.) | Route to whichever surface is live | ✅ A | Idempotent on DDB side |
| Notion → Athena content | Live fetch + ISR | ✅ B | TTL-based drift acceptable |
| **EspoCRM CRM state** | Pi-only; ETL espocrm→S3 nightly | ⚠️ C | 24 h replication lag; Pi-loss = CRM-loss for that window |
| **AppFlowy doc state** | Pi-only; postgres-direct ETL → S3 nightly | ⚠️ C | Same 24 h lag |
| **Postiz scheduled posts** | Pi-only; no S3 mirror | 🔴 D | Pi-loss = lost queue |
| **n8n workflow exec history** | Pi-only; no S3 mirror | 🔴 D | Pi-loss = lost run history (configs are in git) |
| **Mosquitto retained messages** | Pi-only, not persisted off-Pi | 🔴 D | Cluster-internal alert state lost on Pi reboot |
| **Uptime Kuma history** | Pi-only PVC | 🔴 D | Monitor history lost |
| **Grafana dashboards** | PVC + REST-API-provisioned | ✅ B | JSON in git; can be re-pushed any time |
| **ntfy auth.db + topics** | Pi-only PVC | 🟡 C | Re-creatable from `ntfy user add` runbook |
| TLS cert | Independent (ACM on AWS, Let's Encrypt on Pi) | 🔴 D | **Highest silent-failure risk per the existing doc** |
| Outbound IP / SES reputation | Differs by half | 🟡 C | Both whitelisted today |

**Read in one line:** the *cloudless.gr web app* fails over cleanly because
its state lives in AWS-managed services that both halves reach. The
*self-hosted apps* don't fail over at all — they're 8 SPOFs glued to omv.

---

## 2) Per-app best-practices gaps (vs. each app's official docs)

The skills in `skills/` already encode operator-side learnings; this
section adds the **upstream-doc-aligned** hardening each app's vendor
recommends but we haven't shipped yet.

### AppFlowy Cloud

- ✅ Already done: nginx ingress, GoTrue, postgres + redis + minio, worker pinned to omv-ha (16 K-page jemalloc fix).
- ⚠️ Gap: **no off-Pi Postgres replication.** AppFlowy docs recommend either logical replication or wal-g to S3 for production. We do daily postgres-direct ETL but it's row-extract, not byte-for-byte.
- ⚠️ Gap: **MinIO bucket isn't mirrored.** AppFlowy uses MinIO for file attachments; loss = file loss. Mirror to S3 via `mc mirror` cron.

### EspoCRM

- ✅ Already done: webhooks → Slack via `SlackClient`, IMAP-via-SES bridge, ETL to lake.
- ⚠️ Gap: **rate-limiting not configured.** EspoCRM docs recommend `requestLimiter` in `data/config.php`. Today the API key is unrestricted. With public tunnel exposure, this is exploit surface.
- ⚠️ Gap: **`Auth Token Lifetime` is default (1 day).** Doc recommends 30 m for API keys + IP whitelist for admin users.
- ⚠️ Gap: **scheduled `Cron` job not verified.** EspoCRM relies on cron for workflows/notifications; verify the cluster `CronJob` actually fires.
- 🔴 Gap: **MariaDB binlog backup to S3.** Daily `mariadb-backup` is the upstream-recommended path; we have neither logical dumps nor binlogs off-Pi.

### Postiz

- ✅ Already done: SES SMTP, webhook receiver, tunnel + auth.
- ⚠️ Gap: **per-provider OAuth credentials in env.** Postiz docs recommend rotating provider tokens quarterly; we have no rotation cron.
- ⚠️ Gap: **`POSTIZ_FRONTEND_URL` mismatch risk** — must equal the tunnel hostname or Postiz's OAuth callbacks 404.
- ⚠️ Gap: **postgres + redis PVCs not snapshotted to S3.**

### n8n

- ✅ Already done: REST API + workflow trigger pattern, 2 starter workflows live.
- ⚠️ Gap: **`N8N_ENCRYPTION_KEY` not rotated since install.** n8n docs say rotate annually + on suspected key compromise.
- ⚠️ Gap: **task runners disabled** — n8n 1.84+ recommends external Task Runner mode for CPU-intensive workflows. We're still on legacy mode.
- ⚠️ Gap: **execution data retention default (336 h)** — long-running keeps the SQLite/Postgres bloated. Doc recommends 168 h + `N8N_PRUNE_EXECUTION` enabled.
- 🔴 Gap: **workflows-as-code drift.** The 2 JSON files in `infrastructure/n8n/workflows/` are *starters* — the live versions may have diverged. Run a weekly export + diff job.

### Mosquitto MQTT

- ✅ Already done: auth-only mode (allow_anonymous=false), tbaltzakis admin, pi-alert-api publisher.
- ⚠️ Gap: **no TLS on the broker.** Mosquitto docs strongly recommend MQTTS (port 8883) for prod. Today's traffic is in-cluster plain TCP. Acceptable inside the cluster but breaks if you ever want to publish from outside.
- ⚠️ Gap: **persistence file is on the SD card.** Move `/mosquitto/data` to the SSD PVC.
- ⚠️ Gap: **bridge to ntfy not wired.** A Mosquitto→ntfy bridge would let MQTT alerts auto-fan-out to your phone without round-tripping through the app.

### Uptime Kuma

- ✅ Already done: tunnel + admin.
- 🔴 Gap: **no monitors actually defined yet** (status-page slug 404). Per Kuma docs, you need at least 1 monitor per critical surface: cloudless.gr/api/health, each self-hosted app, each cluster node.
- ⚠️ Gap: **no notification channel configured** in Kuma itself. Today notifications come via the cloudless.gr app's chip. Kuma can push directly to Slack/Discord/ntfy on monitor-down — set this up so Kuma alerts even when the app is down.

### Grafana (kube-prom)

- ✅ Already done: token, dashboards as JSON, plugin installed (this session).
- 🔴 Gap: **Athena datasource blocked by SCP** (this session). Workaround: render in `/admin/cost` page using existing `src/lib/athena.ts`.
- ⚠️ Gap: **dashboard versioning** — Grafana docs recommend `provisioning/dashboards/*.yaml` filesystem mode (vs REST POST). Survives full pod recreation without re-running the script.
- ⚠️ Gap: **alerting rules in Grafana, not just Prometheus.** Migrate `kube-prom-alerts` → Grafana Alerting for richer routing.

### ntfy

- ✅ Already done: Bearer auth, public tunnel (R7), R8 push wired to `notifyAdmin()`.
- ⚠️ Gap: **no rate-limit per-topic.** ntfy docs recommend `visitor-request-limit-burst: 60` to prevent abuse if the topic name leaks.
- ⚠️ Gap: **no message retention tuning.** Default keeps 12 h; for incident audit, raise to 7 d on the `cloudless-ops` topic.
- ⚠️ Gap: **no attachment storage cap.** Default unlimited → fills SSD.

### Cloudflare Tunnel

- ✅ Already done: HA pair on omv + omv-ha, shared tunnel UUID, config drift watchdog.
- 🔴 Gap: **CLOUDFLARE_API_TOKEN rotation overdue.** Per CLAUDE.md blocks 3 stale items.
- ⚠️ Gap: **no Service Token (mTLS) on internal routes.** Anyone with the hostname can hit grafana / kuma / ntfy. Add `cloudflare-tunnel-ops` Access Application + Service Token for admin surfaces.

---

## 3) Bidirectional sync — what's missing for "always in sync"

The user's hard requirement: AWS↔Pi must exchange data continuously.
What's already flowing and what's not:

### Outbound: AWS Lambda → Pi (working ✅)

- Lambda hits Pi's public tunnel for EspoCRM/n8n/Postiz/ntfy calls.
- Webhook fan-out fires regardless of which surface is live (idempotent on DDB).

### Outbound: Pi → AWS (working ✅)

- Pi reads SSM, DDB, S3, Cognito directly via `cloudless-pi-standby` IAM user.
- All 29 SSM keys, all DDB tables, all S3 buckets are reachable.
- ETLs push EspoCRM/AppFlowy/Stripe/Sentry/GSC/LinkedIn → S3 lake nightly.

### Outbound: Pi → AWS for **stateful self-hosted apps** (gap 🔴)

- EspoCRM MariaDB: snapshotted to S3? **No.**
- AppFlowy Postgres: snapshotted to S3? **Daily ETL only — not WAL/binlog.**
- AppFlowy MinIO files: mirrored to S3? **No.**
- Postiz Postgres: snapshotted? **No.**
- n8n DB (SQLite or Postgres depending on mode): snapshotted? **No.**
- Kuma SQLite: snapshotted? **No.**
- Mosquitto retained messages: snapshotted? **No.**

This is THE gap. If Pi dies, you keep cloudless.gr running on AWS, but
you lose every self-hosted app's state since the last nightly ETL.

### The missing daemon: **velero or restic to S3**

Run a Pi-side k8s CronJob that takes a daily snapshot of every PVC and
writes a Restic backup to `s3://cloudless-analytics-data/pvc-backups/`.
Single, generic, app-agnostic solution. RTO ~30 min (restore PVCs +
restart pods). RPO 24 h.

For RPO < 1 h on the highest-value apps (EspoCRM + AppFlowy):

- EspoCRM: `mariadb-backup --backup --compress --stream=xbstream` every
  hour into S3.
- AppFlowy: wal-g WAL archive to S3 (continuous, RPO ~5 min).

---

## 4) Ranked roadmap — R10 through R20 candidates

Each row: PR-sized, ranked by `value × (1/effort)`. Ship top-down.

| # | Title | What | Why now | Effort | Risk |
|---|---|---|---|---|---|
| **R10** | **PVC daily backup to S3 (restic)** | `infrastructure/backup/cronjob.yaml` → Restic backs up every PVC daily to `s3://cloudless-analytics-data/pvc-backups/`. Sweep + retain 7 daily + 4 weekly. | Closes the #1 SPOF gap. Generic = covers all 8 apps in one PR. | M | LOW |
| **R11** | **TLS cert parity probe** | Workflow runs daily, asserts both AWS (ACM) and Pi (Let's Encrypt) certs are valid + >14 d to expiry. Fires `notifyAdmin()` if either fails. | "Highest silent-failure risk" per `docs/pi-cloud-sync.md`. | S | LOW |
| **R12** | **`/admin/cost` panel rendering Athena directly** | Bypass the Grafana SCP block — read `v_aws_cost_by_service` via `src/lib/athena.ts`, render with Chart.js. | Unblocks R9 visibility without org-admin. | S | LOW |
| **R13** | **EspoCRM `mariadb-backup` hourly to S3** | CronJob exec into mariadb pod → stream xbstream → S3. RPO 1 h on the most valuable app. | EspoCRM is canonical CRM record. | S | LOW |
| **R14** | **Sentry environment tagging** | `SENTRY_ENVIRONMENT=pi-standby` on Pi build, `prod` on Lambda. Per pi-cloud-sync.md gap #3. | Sentry blames the right surface during failover. | XS | LOW |
| **R15** | **Cloudflare Access Service Token on admin tunnel hosts** | Grafana / kuma / appflowy admin / n8n behind Cloudflare Access. Tokens for k8s service accounts. | Removes "if you know the hostname you're in" exposure. | M | LOW |
| **R16** | **AppFlowy WAL-G to S3** | wal-g sidecar on the postgres pod streams WAL to S3 continuously. RPO ~5 min for knowledge base. | Lower RPO for docs than nightly ETL. | M | MED |
| **R17** | **Kuma monitors + Slack/ntfy channels** | Operator: define 12 monitors (6 self-hosted + cloudless.gr + each Pi node + Stripe/Cognito + EspoCRM + AppFlowy DBs). Wire Kuma → ntfy direct. | Independent observability — Kuma alerts even when the app is down. | S | LOW (operator-side) |
| **R18** | **Pi-side SSM scope assertion** | Daily workflow that diffs the SSM key list AWS-side vs what `cloudless-pi-standby` IAM can read. Per pi-cloud-sync.md gap #2. | Catches "added new key, forgot to grant Pi" silently. | S | LOW |
| **R19** | **Monthly failover drill** | Manual-dispatch workflow that disables R53 PRIMARY health check for 90 s, asserts SECONDARY served, re-enables. Per pi-cloud-sync.md gap #4. | Proves failover works before you need it. | M | MED |
| **R20** | **n8n + Postiz + Kuma logical-replication subscriber on AWS** | Tiny EC2 / Lightsail running a Postgres subscriber to AppFlowy + Postiz primary. RPO seconds. | Last-mile: full state mirror for the apps with the most operational dependencies. | L | MED-HIGH |

Plus the persistent **operator-only items** from CLAUDE.md:

- Cloudflare API token rotation (unlocks 3 stale workflows)
- Sentry webhook URL + secret (R8 closure)
- Athena SCP lift / different IAM user (or R12)
- Kuma status page slug
- ESP32 Notion page restore

---

## 5) The 30-day shape

If we ship in order:

**Week 1:** R10 (backups) + R14 (sentry tag) + R12 (cost panel).
**Week 2:** R11 (TLS probe) + R13 (mariadb hourly) + R18 (SSM scope assertion).
**Week 3:** R15 (Cloudflare Access) + R17 (Kuma monitors).
**Week 4:** R19 (failover drill) + R16 (AppFlowy WAL-G).
**Beyond:** R20 only if you actually need RPO seconds.

By end of week 4 you'll have:

- Every PVC backed up daily, EspoCRM hourly, AppFlowy continuous.
- TLS expiry alerts on both halves.
- Cost dashboard rendering inside admin.
- Independent observability via Kuma → ntfy.
- Failover drill proving the path.
- Sentry blaming the right surface.
- Admin surfaces behind Cloudflare Access.

That's the **optimal** state given the AWS-primary / Pi-failover /
must-stay-in-sync constraints.

---

## See also

- `docs/pi-cloud-sync.md` — canonical sync contract
- `docs/architecture-purchase-flow.md` — end-to-end purchase flow + diagrams
- `skills/selfhosted-admin-bootstrap/SKILL.md` — per-app admin recipes
- `skills/cloudflare-tunnel-ops/SKILL.md` — tunnel + DNS ops
- Memory: `project_selfhosted_ssm_baseline`, `project_r7_r8_r9_shipped`,
  `project_grafana_athena_blocked_scp`
