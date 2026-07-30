# Test Credential Provisioning — Phase 2+

This guide unlocks the final ~15 files that need real (test-mode) credentials to hit 100% coverage. Provision the three credential sets below — Stripe, Notion, AWS — in any order, then paste the resulting values into `.env.test.local` and I'll wire the tests.

## Why these three

The remaining low-coverage files all call out to a third-party SDK (`stripe`, `@notionhq/client`, `@aws-sdk/*`) and the test suite stubs at the network boundary. Without **a real test-mode token** the SDK initialization branches stay unreached. LocalStack covers DynamoDB/SSM but not Stripe/Notion.

Net effect: **+15 files to 100%**, project coverage moves from ~84% → ~99%.

---

## 1. Stripe Test Mode (~5 min)

### Mint URL

https://dashboard.stripe.com/test/apikeys

### Steps

1. Confirm dashboard is in **"Test mode"** (toggle, top-right).
2. **Create restricted key** → name `cloudless-test-coverage`. Permissions:
   - Charges → **Write**
   - Customers → **Write**
   - PaymentIntents → **Write**
   - Webhook endpoints → **Read**
3. Copy the `rk_test_...` value (shown once).
4. **Webhook secret** — Developers → Webhooks → Add endpoint → URL `http://localhost/stripe-test` → events `payment_intent.succeeded`, `checkout.session.completed` → reveal signing secret → copy `whsec_...`.

### Paste these

```
STRIPE_SECRET_KEY=rk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TRANSACTIONS_TABLE=cloudless-stripe-transactions-test
```

### Unlocks

`lib/stripe.ts` (4.76 → 100), `lib/stripe-transactions.ts` (25 → 100), `api/webhooks/stripe/route.ts` (70 → 100), `api/checkout/route.ts` (86 → 100), `lib/stripe-analytics-read.ts` (89 → 100).

---

## 2. Notion Test Workspace (~10 min)

### Mint URLs

- Workspace: https://www.notion.so/signup (use different email than prod)
- Integration: https://www.notion.com/my-integrations

### Steps

1. **Create a new free Notion workspace** named `cloudless-test`.
2. **+ New integration** → name `cloudless-test-coverage` → workspace `cloudless-test` → Type `Internal` → Save. Copy `Internal Integration Secret`.
3. **Create 13 empty databases** (just `+ New page` → `Table`) and for each, `•••` → **Connections** → add `cloudless-test-coverage`:
   Blog, Docs, Projects, Tasks, Case Studies, Services, Testimonials, FAQs, Submissions, Reports, Analytics, Calendar, GSC Reports.
4. Copy each database ID (32 chars from the URL, after the workspace slash, before `?v=`).

### Paste these

```
NOTION_API_KEY=secret_... (or ntn_...)
NOTION_BLOG_DB_ID=<32 chars>
NOTION_DOCS_DB_ID=<32 chars>
NOTION_PROJECTS_DB_ID=<32 chars>
NOTION_TASKS_DB_ID=<32 chars>
NOTION_CASE_STUDIES_DB_ID=<32 chars>
NOTION_SERVICES_DB_ID=<32 chars>
NOTION_TESTIMONIALS_DB_ID=<32 chars>
NOTION_FAQS_DB_ID=<32 chars>
NOTION_SUBMISSIONS_DB_ID=<32 chars>
NOTION_REPORTS_DB_ID=<32 chars>
NOTION_ANALYTICS_DB_ID=<32 chars>
NOTION_CALENDAR_DB_ID=<32 chars>
NOTION_GSC_REPORTS_DB_ID=<32 chars>
NOTION_WEBHOOK_SECRET=any-random-32-char-string
```

### Shortcut

If you don't want 13 databases, paste just `NOTION_API_KEY` + Blog + Tasks IDs. The other modules fall through `if (!process.env.NOTION_XXX_DB_ID) return null` branches — still a coverage win, ~95% instead of 100% on these files.

### Unlocks

`lib/notion.ts` (91 → 100), `lib/notion-blog.ts` (48 → 100), `lib/notion-docs.ts` (57 → 100), `lib/notion-projects.ts` (57 → 100), `lib/notion-search.ts` (92 → 100), `lib/notion-comments.ts` (90 → 100), `lib/notion-analytics.ts` (94 → 100), `lib/notion-reports.ts` (98 → 100), `api/webhooks/notion/route.ts` (91 → 100).

---

## 3. AWS Dev IAM User (~15 min)

### Steps

1. AWS Console → IAM → **Users → Create user**.
2. Name `cloudless-test-coverage`. Console access **No** (programmatic only).
3. **Attach policies directly → Create policy → JSON tab**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParameters","ssm:GetParametersByPath"],"Resource":"arn:aws:ssm:us-east-1:278585680617:parameter/cloudless/test/*"},
    {"Effect":"Allow","Action":["ses:GetSuppressedDestination","ses:ListSuppressedDestinations"],"Resource":"*"},
    {"Effect":"Allow","Action":["logs:DescribeLogGroups","logs:DescribeLogStreams"],"Resource":"arn:aws:logs:us-east-1:278585680617:log-group:*"}
  ]
}
```

   Name it `cloudless-test-coverage-policy`. Attach to user.
4. User → **Security credentials → Create access key** → Other → save the `AKIA...` + secret.
5. Seed test SSM params:

```bash
aws ssm put-parameter --name /cloudless/test/COVERAGE_PROBE --value "ok" --type String --region us-east-1
aws ssm put-parameter --name /cloudless/test/COVERAGE_SECRET --value "ok" --type SecureString --region us-east-1
```

### Paste these

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_SES_REGION=us-east-1
SES_FROM_EMAIL=tbaltzakis@cloudless.gr
SES_TO_EMAIL=tbaltzakis@cloudless.gr
```

### Unlocks

`lib/ssm-config.ts` real-AWS branches (27 → 100), `lib/ses-suppression.ts` (56 → 100), `lib/sentry.ts` (87 → 100).

---

## How to deliver

Ranked by safety:

1. **GitHub repo secrets (recommended)** — https://github.com/Themis128/cloudless.gr/settings/secrets/actions — add each as a repo secret with the exact name above. I'll wire the test workflow to consume them. Never in git, never in logs.
2. **SSM** — store under `/cloudless/test/*`. Same security as #1.
3. **Paste in chat** — only if you're OK rotating immediately after. I'll move to GH secrets and tell you to revoke.

## Reply with

`creds set — option <1|2|3>` and I'll:

1. Update `vitest.config.mts` to load the new env
2. Add the missing test specs for unlocked branches
3. Run the suite + report new coverage
4. Commit, push, merge to main as Phase 2 complete

Estimated my time: 45-60 min once creds land.
