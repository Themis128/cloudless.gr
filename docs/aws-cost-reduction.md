# AWS Cost Reduction Analysis

Based on VAT invoice **EUINGR26-58586** (billing period **May 1–31, 2026**),
AWS account `278585680617`.

- **Total billed:** USD 22.56 (incl. 24% VAT)
- **Net charges (pre-tax):** USD 18.19
- Annualized: ≈ **USD 218/yr net** (≈ USD 270/yr incl. VAT)

## Scope

This is **one AWS account hosting two apps**:

- **cloudless.gr** — Next.js on SST (Lambda + CloudFront), with the Pi k3s standby.
- **baltzakisthemis.com** — the portfolio app (on Amplify / CloudFront; Amplify
  shows $0.00 = free tier).

The invoice is account-wide, so it sums both apps plus shared/peripheral
services. Two hard constraints from the owner:

- **Keep WorkMail** (`tbaltzakis@cloudless.gr`) — it is a required mailbox, so
  its $4.00/mo is **fixed cost, not a saving**.
- **Lose no functionality** in either app.

Every cut below is account-wide peripheral spend — none of it touches either
app's runtime or the mailbox.

## TL;DR

**The actual web apps cost almost nothing to run.** The Lambda + CloudFront +
API Gateway + DynamoDB + ECR runtime that serves both apps totals **~$0.50/mo
net**. The rest is the required mailbox ($4.00, kept) plus peripheral services —
audit logging, secrets, a config recorder, encryption keys, DNS health checks —
none of which serve a single page request.

So: **yes — keeping WorkMail and full functionality, the bill can still be cut
~35–40% (~$6–7/mo).** The savings are proportional, not large in absolute terms
(the whole bill is ~$18/mo net).

## Full breakdown (net "Charges", pre-VAT)

| Service | Net $ | % | What it actually is | Serves the web apps? |
|---|--:|--:|---|---|
| Amazon Route 53 | 4.22 | 23% | 2 hosted zones (cloudless.gr + portfolio) + HA health checks | Partly |
| Amazon WorkMail | 4.00 | 22% | Mailbox `tbaltzakis@cloudless.gr` — **KEEP (required)** | ❌ No |
| **AWS CloudTrail** | **2.31** | **13%** | Audit-log trail (1st management trail is free) | ❌ No |
| AWS KMS | 2.13 | 12% | Customer-managed encryption keys ($1/key/mo) | Indirect |
| Amazon SES | 1.93 | 11% | Transactional email (contact form, signup) | ✅ Yes |
| **AWS Secrets Manager** | **1.20** | 7% | ~3 secrets × $0.40/mo | Indirect |
| **AWS Config** | **0.84** | 5% | Continuous resource-change recorder | ❌ No |
| Amazon S3 | 0.64 | 4% | Object storage (deploy artifacts / assets) | Partly |
| AWS Systems Manager | 0.33 | 2% | Parameters / sessions | ✅ Yes |
| Amazon CloudFront | 0.17 | 1% | CDN for the site | ✅ Yes |
| AWS Lambda | 0.13 | <1% | Next.js server runtime | ✅ Yes |
| Amazon API Gateway | 0.13 | <1% | Pi failover (SECONDARY) frontend | ✅ Yes |
| AmazonCloudWatch | 0.08 | <1% | Logs/metrics | ✅ Yes |
| ECR | 0.06 | <1% | Pi container image registry | ✅ Yes |
| DynamoDB | 0.01 | <1% | Stripe transactions table | ✅ Yes |
| Cost Explorer | 0.01 | <1% | Billing analytics API | — |
| Glue, Cognito, SNS, SQS, Amplify, ACM, Data Transfer | 0.00 | 0% | idle / free-tier | — |
| **Net total** | **18.19** | | | |

> Note: the "AWS Service Charges" page totals USD 22.56 because it includes the
> $4.37 VAT. The $18.19 figure is the pre-tax sum of the per-service "Charges"
> lines and is the number to optimize.

## Recommended cuts — ranked by safety × savings

These are ordered so the safest, most decoupled-from-functionality wins come
first. None of them touch the code that serves either app, and none touch the
mailbox.

### WorkMail — KEEP (required), $4.00/mo fixed

`tbaltzakis@cloudless.gr` is a mailbox the owner must keep. WorkMail is a flat
$4/user/mo with no usage-based component, so there is **nothing to trim here**
without dropping the mailbox — which we are not doing. Treat the $4.00 as a
fixed floor. (It is unrelated to the apps: the sites send mail via **SES**, not
WorkMail.)

### 1. CloudTrail → keep one free trail, drop the rest — saves up to **~$2.30/mo**

The **first** trail logging **management events is free**. A $2.31 charge means
one of: a second trail, **data-event** logging (S3/Lambda object-level), or
**CloudTrail Insights**. Keep a single management-events trail (free) and
disable data events / Insights / any duplicate trail. **Caveat:** this is a
security/audit control — see `docs/security/`. Reducing it lowers audit
granularity, so confirm it's not required for a compliance posture you care
about.

### 2. Secrets Manager → migrate to SSM Parameter Store — saves **$1.20/mo ($14/yr)**

Secrets Manager is $0.40/secret/mo; **SSM SecureString parameters are free**
(and KMS-encrypted with the free AWS-managed key). The app **already** reads its
config from SSM `/cloudless/production/*` (`src/lib/ssm-config.ts`, `sst.config.ts`).
Move the ~3 Secrets Manager entries to SSM SecureString and update any
`secretsmanager:GetSecretValue` callers. This also removes their KMS request
load (helps item 4).

### 3. AWS Config → scope down or disable the recorder — saves up to **$0.84/mo**

Config bills $0.003 per configuration item recorded. For an account this small
it's pure overhead unless you specifically need a compliance timeline. Either
disable the recorder, or scope it to a handful of resource types / daily
snapshot instead of continuous recording. **Caveat:** same as CloudTrail — it's
a governance control, not functionality.

### 4. KMS → audit for orphaned customer-managed keys — saves **~$1–2/mo**

Each customer-managed key (CMK) is $1/mo whether used or not. $2.13 ≈ 2 CMKs +
request volume. Audit `aws kms list-keys` for keys with no recent usage, and
prefer **AWS-managed keys (free)** wherever a CMK isn't strictly required (S3,
SES, SQS default encryption all work with AWS-managed keys). Deleting one
orphaned CMK saves $12/yr. **Do not** delete a key still referenced by SES, S3
bucket encryption, or Secrets Manager without re-keying first.

### 5. Route 53 → trim health-check features — saves **~$1–2/mo**

The hosted zone itself is $0.50/mo (unavoidable — it's your DNS). The rest is the
**two HA failover health checks** (PRIMARY=CloudFront, SECONDARY=Pi/APIGW, see
`sst.config.ts`) plus optional features (HTTPS, string-matching, fast 10s
interval each add ~$1/mo). Options:

- Drop **fast interval** (30s instead of 10s) and **string matching** on the
  health checks → keeps failover working, shaves the per-feature surcharges.
- If the Pi SECONDARY failover path isn't worth maintaining, removing the
  secondary health check saves ~$0.50–1.50/mo — **but you lose the documented
  HA failover** (`/ha-failover`, `/ha-status`). Trade-off, not free.

### 6. Systems Manager → downgrade advanced parameters — saves **~$0.30/mo**

Standard SSM parameters are free; **advanced** parameters are $0.05/mo each.
$0.33 suggests a few advanced params (or Session Manager logging). Downgrade any
advanced parameter that doesn't need >4KB or parameter policies.

### 7. S3 → lifecycle-expire old versions — saves a few cents

$0.64 is mostly SST deploy artifacts and old object versions. Add a lifecycle
rule to expire noncurrent versions after 30 days. Minor, but free to set up.

## What to leave alone (this **is** the functionality)

- **SES ($1.93)** — transactional email for contact forms / signup. Cheap per
  message; cutting it breaks email. Keep.
- **Lambda / API Gateway / CloudFront / DynamoDB / ECR / CloudWatch (~$0.60
  total)** — the live site + Pi failover + chat widget. Already optimized
  (arm64, 512 MB, right-sized). Nothing to cut.
- **ACM, SNS, SQS, Cognito, Amplify, Glue, Data Transfer** — already $0.

## Projected result

Applying items 1–5 conservatively:

| | Net/mo | Incl. VAT/mo | Annual (net) |
|---|--:|--:|--:|
| Today | $18.19 | $22.56 | $218 |
| WorkMail (kept, fixed) | $4.00 | $4.96 | $48 |
| After cuts (incl. WorkMail) | **~$11–12** | **~$14–15** | **~$140** |

≈ **35–40% reduction, with no change to either app's behavior and WorkMail
intact** — because the apps were never the expensive part. (Of the ~$6–7
trimmed, none comes from app runtime or the mailbox.)

## How to execute

A ready-to-run, audit-first script implements every item:
**[`scripts/aws-cost-reduction.sh`](../scripts/aws-cost-reduction.sh)**.

- Run with **no flags** → audits only (prints current state + estimated savings,
  changes nothing).
- Each **reversible** cut is gated behind its own flag and `DRY_RUN=0`:
  - `DO_CLOUDTRAIL=1` — drop Insights + data events, keep one free trail (item 1)
  - `DO_SECRETS=1` — copy each secret to free SSM SecureString (item 2; add
    `CONFIRM_DELETE=1` to schedule 30-day-recoverable deletion)
  - `DO_CONFIG=1` — stop the Config recorder (item 3)
  - `DO_SSM=1` — downgrade advanced parameters to free standard tier (item 6)
- **Destructive / business-decision** items (KMS key deletion, Route 53
  health-check recreation) are **audit-only** — the script prints the exact
  command but never runs it. WorkMail is reported as **KEEP** (no action).

It refuses to mutate unless the caller is authenticated to account
`278585680617`. Must run from a machine/CI with AWS reachability — **this repo's
cloud Claude sessions can't reach the AWS API** (blocked by the network policy).

Two paths overall:

1. **Console / CLI** (fastest for the one-off cuts above) — run the
   reconfigurations directly. Items 1, 3, 4, 5, 6 are console actions.
2. **IaC** — item 2 (Secrets→SSM) and any Route 53 health-check change should
   be reflected in `sst.config.ts` / wherever the resource is declared so they
   don't drift back.

**Decisions only you can make** (each trades a few $/mo against
functionality/security/effort):

- Do you need the **CloudTrail** / **Config** audit trail for compliance? (items 1, 3)
- Is the **Pi HA failover** worth its Route 53 health-check cost? (item 5)
