## Wave A status (2026-07-30)

| PR | Status | Notes |
|----|--------|-------|
| PR-01 | **Done in tree** | SSM fetch removed from `getConfig` + instrumentation; Cognito needs `ALLOW_LEGACY_COGNITO=1` |
| PR-02 | **Done in tree** | `email.ts` Resend / Workers Email only — no SES |
| PR-03 | **Done in tree** | `ses-suppression.ts` → D1 only |
| PR-07 | **Done in tree** | Portals / pending / workspaces / AB / voice-brief → D1 `app_config` via `app-config-json.ts` |
| PR-08 | **Done in tree** | Chat + agents + embeddings → Workers AI REST; Bedrock stubbed |
| PR-10 | **Done in tree** | `deploy-pi.yml` hostPath-only; `build-pi-image.yml` workflow_dispatch emergency only |
| PR-11 | **Done in tree** | `store-cloudflare-token.yml` → `gh secret set` (no SSM) |
| PR-12 | **Partial** | athena/sns/amplify stubbed; full dead-code sweep continues |

**Operator follow-ups before merge to main:**
1. Add `RESEND_API_KEY` to k8s `cloudless-secrets` (Node email path).
2. Confirm `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` already in secrets (Workers AI).
3. Wave B (PR-04…06) still gated on Cognito/Dynamo data migration.

---


Merge **one service family per PR**. Do not merge **PR-14** (SDK uninstall) until call sites from PR-02…PR-13 are gone.

```
PR-01
  ├─ PR-02 → PR-03          (email)
  ├─ PR-07                  (SSM writers)
  ├─ PR-08                  (Bedrock → Workers AI)
  ├─ PR-09                  (inbound mail)
  └─ PR-10 → PR-11          (CI / secrets bus)
PR-04 → PR-05               (Cognito out)
PR-06                       (Dynamo → D1)
PR-12 → PR-13 → PR-14       (dead code → R2 client → uninstall SDKs)
PR-15 → PR-16 → PR-17       (archive → AWS teardown → Cost Explorer)
```

---

## Wave A — safe code locks (start now)

| PR | Title | Replace | With | Risk | Depends | Done when |
|----|-------|---------|------|------|---------|-----------|
| **PR-01** | Hard-disable AWS runtime paths | Accidental SSM / Cognito | Never call SSM unless explicitly re-enabled (prefer delete path); default `AUTH_PROVIDER=d1`; fail-closed stubs | Low | — | Pi unchanged; LocalStack/Lambda paths cannot activate without explicit env |
| **PR-02** | Email off SES | `SESv2Client` in `src/lib/email.ts` | Resend primary (`email-resend.ts`); Workers Email binding on CF; **no SES fallback** | Med | PR-01; `RESEND_API_KEY` in `cloudless-secrets` | Order/contact/newsletter send works; `@aws-sdk/client-sesv2` unused by `email.ts` |
| **PR-03** | Suppression off SES | `ses-suppression.ts` SES APIs | `ses-suppression-d1.ts` only; delete SES fallback import | Low | PR-02; D1 `email_suppression` | subscribe/unsubscribe hit D1 only |
| **PR-07** | SSM writers → D1 / k8s | `PutParameter`/`GetParameter` in portals, pending-clients, AB tests, voice-brief, `instrumentation.ts` | D1 `app_config` + `cloudless-secrets`; remove SSM cold-start hydrate | Med | PR-01 | No `@aws-sdk/client-ssm` imports outside deleted files |
| **PR-08** | Bedrock → Workers AI | `bedrock-chat`, embeddings, agents | Workers AI (`@cf/*`) — same path as `/api/admin/ai/generate` | Med | CF token has Workers AI Run | `/api/chat` + agents work without Bedrock SDK |
| **PR-11** | GH secrets bus off SSM | `store-cloudflare-token.yml`, rotate workflows writing SSM | GitHub Secrets + Wrangler only | Low | PR-10 confirmed | No `aws-actions/configure-aws-credentials` for CF token storage |
| **PR-12** | Dead AWS libs | `athena.ts`, `sns-notify.ts`, `amplify-config.ts`, unused Lambda stubs | `athena-d1`, Slack/ntfy; delete shims | Low | PR-02…PR-08 | Dead files gone; tests updated |

---

## Wave B — identity + data (gated on migration)

| PR | Title | Replace | With | Risk | Depends | Done when |
|----|-------|---------|------|------|---------|-----------|
| **PR-04** | Auth admin Cognito → D1 | `/api/admin/users*`, confirm/activate/delete Cognito | D1 users + admin role; drop `@aws-sdk/client-cognito-identity-provider` | High | PR-01; **admin users migrated to D1** | Admin user CRUD works on D1; Cognito API unused |
| **PR-05** | Delete Cognito client surface | `cognito-auth.ts`, next-auth Cognito provider, Amplify shim, `NEXT_PUBLIC_COGNITO_*` | `auth-d1` + cookie sessions only | High | PR-04 | Login/signup/logout D1-only; no Cognito Hosted UI |
| **PR-06** | DynamoDB → D1 | profiles, admin-notifications, GSC cache, Stripe txs, session store, bookmarks | D1 tables + `*-d1` helpers; `scripts/migrate-dynamodb-to-d1.ts` if data remains | High | PR-01; **data verified in D1/R2** | No `@aws-sdk/client-dynamodb` imports |

**Gate:** Do not start Wave B until a one-time export confirms D1 (or R2) holds production rows that Dynamo still owns.

---

## Wave C — CI + packaging

| PR | Title | Replace | With | Risk | Depends | Done when |
|----|-------|---------|------|------|---------|-----------|
| **PR-10** | CI off ECR / AWS OIDC | `deploy-pi.yml`, `build-pi-image.yml` ECR push | Document + enforce `pi-native-standalone` / hostPath only (already live) | Med | Confirm no ECR consumers | Workflows do not use `aws-actions` / ECR; `AWS_DEPLOY_ROLE_ARN` unused |
| **PR-13** | R2 without S3 SDK brand | `@aws-sdk/client-s3` → R2 endpoint | `aws4fetch` or native R2 binding (`r2-client.ts`); ETL via `_r2-config` | Med | PR-12 | Object I/O works; no `client-s3` in app/ETL |
| **PR-14** | Uninstall all `@aws-sdk/*` | package.json + `next.config` externals | `pnpm remove` all AWS clients; fix tests | Med | PR-02…PR-13 | `rg '@aws-sdk' package.json src/` empty |
| **PR-15** | Archive SST / TF / boto3 | `sst.config.ts` Cognito/Dynamo/Lambda; R24 DR TF; Python boto3 helpers | Move under `archive/` or delete; update runbooks | Low | PR-14 | No active operator path requires AWS CLI |

---

## Wave D — account teardown (final)

| PR | Title | Replace | With | Risk | Depends | Done when |
|----|-------|---------|------|------|---------|-----------|
| **PR-09** | Inbound mail off SES Lambda | `infrastructure/ses-to-espocrm` | CF Email Routing → `/api/inbound-email` → EspoCRM | Med | MX/SPF/DKIM on Cloudflare | Inbound support mail creates EspoCRM cases without SES |
| **PR-16** | Decommission AWS resources | Cognito pool, SES, SSM params, Lambdas, ECR repo, Dynamo tables, IAM OIDC deploy role | Operator teardown in AWS console (no new SDK installs) | High | **PR-14 live ≥7 days**; rollback not needed | Resources deleted; billing shows residual CE only or $0 |
| **PR-17** | Drop Cost Explorer ETL | `etl-aws-cost-to-r2`, `@aws-sdk/client-cost-explorer` | Remove cost dashboard or freeze last export | Low | PR-16 (AWS spend ≈ $0) | No AWS API calls remain anywhere |

---

## Already done on live Pi (do not re-migrate)

| Capability | Evidence | Implication |
|------------|----------|-------------|
| Secrets | `SSM_DISABLED=1` + `cloudless-secrets` | PR-01/07 delete dead code only |
| Auth | `NEXT_PUBLIC_AUTH_PROVIDER=d1` | PR-04/05 remove Cognito, not rebuild login |
| Deploy | `node:22` + hostPath `/home/tbaltzakis/cloudless-standalone` | PR-10 retires ECR workflows |
| Object storage | R2 `datalake-bucket` PVC backups | PR-13 keeps R2 |
| Edge | CF Tunnel + Workers (`cloudless2`, analytics worker) | No CloudFront work |

---

## Acceptance — “AWS removed”

1. `rg '@aws-sdk' package.json src/` → empty (after PR-14).
2. Active `.github/workflows/*` have no `aws-actions` / `AWS_DEPLOY_ROLE_ARN`.
3. App pods do not mount `pi-standby-aws-creds`.
4. After PR-16: Cognito / SES / SSM / ECR / Dynamo idle then deleted; only optional CE until PR-17.

---

## Key file map (for implementers)

| AWS surface | Primary files | CF replacement already in tree |
|-------------|---------------|--------------------------------|
| SES | `src/lib/email.ts`, `ses-suppression.ts` | `email-resend.ts`, Email binding, `ses-suppression-d1.ts` |
| Cognito | `cognito-auth.ts`, `api/admin/users*`, `api/auth/confirm|activate` | `auth-d1.ts`, `api/auth/*-d1/*` |
| SSM | `ssm-config.ts`, portals/pending-clients/voice-brief/AB | `ssm-config-d1.ts`, k8s secrets |
| DynamoDB | `user-profile`, `admin-notifications`, `gsc-cache`, `stripe-transactions`, `session-token-store` | D1 + `session-token-store-d1.ts` |
| Bedrock | `bedrock-*.ts`, `agent-*.ts` | Workers AI admin routes, `recommendations.ts` |
| S3 (R2) | `r2-upload.ts`, ETL `*-to-r2.mjs` | Keep R2; PR-13 drops SDK brand |
| ECR CI | `deploy-pi.yml`, `build-pi-image.yml` | `k8s/cloudless-app-hostpath.yaml`, `scripts/pi-native-standalone.sh` |
| Cost Explorer | `scripts/etl/aws-cost-to-r2.mjs` | Delete after AWS off |

---

## Suggested first PR titles

1. `chore(aws): hard-disable SSM and Cognito opt-in paths (PR-01)`
2. `feat(email): Resend/Workers only — remove SES fallback (PR-02)`
3. `feat(email): D1 suppression only — drop SES APIs (PR-03)`
4. `refactor(config): move SSM Put/Get callers to D1/secrets (PR-07)`
5. `feat(ai): route chat/agents through Workers AI — drop Bedrock (PR-08)`
