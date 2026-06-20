# SES → EspoCRM Case bridge

Inbound email to `tbaltzakis@cloudless.gr` (or any `@cloudless.gr` recipient
matching the SES rule) becomes an EspoCRM `Case` record, which fires the
existing `Case.create` webhook → Slack `#notifications`.

## Why this exists (and not IMAP polling)

Microsoft retired basic-auth IMAP on Exchange Online in April 2026
([MS Learn](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online)).
EspoCRM's bundled IMAP client doesn't speak OAuth2 over IMAP. AWS WorkMail
still allows IMAP basic-auth, but coupling Case creation to a long-lived
password introduces a rotation hazard. SES → Lambda → API push has no
password surface at all and matches the rest of the AWS-native stack.

## Architecture

```
                Internet
                   │
                   ▼
   ┌─────────────────────────────────────┐
   │ SES Inbound (rule m-e5cdc97d…)      │
   │   recipients: cloudless.gr +        │
   │               cloudless-org-…       │
   │   actions:                          │
   │     1. S3Action  → cloudless-ses-   │
   │                    inbound/inbound/ │
   │     2. WorkmailAction → org m-e5c…  │
   └────┬────────────────────────┬───────┘
        │                        │
        ▼                        ▼
  ┌───────────────────┐    ┌────────────────┐
  │ S3 cloudless-ses- │    │ WorkMail       │
  │ inbound/inbound/  │    │ (Outlook /     │
  │   raw MIME, 90 d  │    │  IMAP clients) │
  └────┬──────────────┘    └────────────────┘
       │ PutObject event
       ▼
  ┌───────────────────────────────────┐
  │ Lambda cloudless-ses-to-espocrm   │
  │   Node 22 arm64, 256 MiB, 30s     │
  │   - fetches raw MIME from S3      │
  │   - parses via mailparser         │
  │   - finds Contact by from-addr    │
  │   - POSTs /api/v1/Case            │
  └────┬──────────────────────────────┘
       │ X-Api-Key (cloudless-app user)
       ▼
  ┌───────────────────────────────────┐
  │ EspoCRM (cluster-internal)        │
  │   - Case created (status=New)     │
  │   - Case.create webhook fires     │
  │     → cloudless.gr/api/webhooks/  │
  │        espocrm                    │
  │     → SlackClient → #notifications│
  └───────────────────────────────────┘
```

## Deploy

Requires AWS creds in env (`AWS_ACCESS_KEY_ID` + `_SECRET_ACCESS_KEY` or
`aws configure sso`). Run from this directory or anywhere — the script
`cd`s into its own dir.

```bash
bash infrastructure/ses-to-espocrm/deploy.sh
```

Idempotent: re-running upgrades the Lambda code in place, leaves all
other resources untouched.

## What gets created (or updated)

| Resource | Name | Purpose |
|---|---|---|
| S3 bucket | `cloudless-ses-inbound` | raw MIME storage, 90-day lifecycle |
| IAM role | `cloudless-ses-to-espocrm-role` | Lambda execution role |
| IAM policy | `cloudless-ses-to-espocrm-policy` | S3:GetObject + SSM:GetParameter for the 2 espo keys |
| Lambda | `cloudless-ses-to-espocrm` | Node 22 arm64, handler `index.handler` |
| Lambda permission | `AllowS3Invoke` | S3 → Lambda invoke grant |
| SES receipt rule | `m-e5cdc97d89c94942a8354ae6c4aa4a72` | **UPDATED** — S3Action prepended to existing WorkmailAction |
| S3 notification | `ses-inbound-to-espocrm` | `s3:ObjectCreated:Put` on `inbound/*` → Lambda |

The dual-action SES rule means **WorkMail users still receive their mail**;
the Case bridge runs in parallel.

## Filtered traffic (won't create a Case)

The Lambda drops these at the gate to avoid junk in the queue:

- `MAILER-DAEMON@*`, `postmaster@*`, `no-reply@*`, `do-not-reply@*`
- Empty `From` address

Spam filtering is out of scope — if the mail volume becomes a problem,
enable SES spam scanning (`ScanEnabled=true`) and check `X-SES-Spam-Verdict`
in the MIME headers before POSTing.

## Verify a real send

After deploy:

```bash
# 1. send a test email
echo "Hello, this is a support request." | \
  aws ses send-email \
    --from yourpersonal@gmail.com \
    --destination ToAddresses=tbaltzakis@cloudless.gr \
    --message Subject={Data="Test from CLI"},Body={Text={Data="..."}}
# (or just send a normal email from any client)

# 2. watch the Lambda log
aws logs tail /aws/lambda/cloudless-ses-to-espocrm --follow --region us-east-1

# 3. confirm the Case appeared in EspoCRM
kubectl -n espocrm exec deploy/espocrm -- curl -sS \
  -H "X-Api-Key: $(aws ssm get-parameter --name /cloudless/production/ESPOCRM_API_KEY \
    --with-decryption --query Parameter.Value --output text)" \
  'http://localhost/api/v1/Case?orderBy=createdAt&order=desc&maxSize=3' | jq '.list[].name'

# 4. verify the Slack notification landed in #notifications
```

## Cost

- SES Inbound: $0.10 per 1k emails (we're at ~tens/day → pennies/mo)
- S3: ~$0.023/GiB-mo storage + $0.0004 per 1k PUT — negligible at our volume
- Lambda: 256 MiB, ~500ms per invocation, free tier covers thousands/mo
- SSM GetParameter: free for the first 10k calls/mo
- Total ongoing: **&lt; $1/month** under normal SMB email load.

## Rollback

```bash
# 1. revert the SES rule to WorkmailAction-only
aws ses update-receipt-rule --rule-set-name INBOUND_MAIL --rule '{
  "Name":"m-e5cdc97d89c94942a8354ae6c4aa4a72","Enabled":true,
  "Recipients":["cloudless-org-us-east.awsapps.com","cloudless.gr"],
  "Actions":[{"WorkmailAction":{"OrganizationArn":"arn:aws:workmail:us-east-1:278585680617:organization/m-e5cdc97d89c94942a8354ae6c4aa4a72"}}]}'

# 2. (optional) delete the Lambda + bucket + role
aws lambda delete-function --function-name cloudless-ses-to-espocrm
aws s3 rb s3://cloudless-ses-inbound --force
aws iam detach-role-policy --role-name cloudless-ses-to-espocrm-role \
  --policy-arn arn:aws:iam::278585680617:policy/cloudless-ses-to-espocrm-policy
aws iam detach-role-policy --role-name cloudless-ses-to-espocrm-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name cloudless-ses-to-espocrm-role
aws iam delete-policy --policy-arn arn:aws:iam::278585680617:policy/cloudless-ses-to-espocrm-policy
```
