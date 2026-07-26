# Connecting WorkMail (`tbaltzakis@cloudless.gr`) to Outlook

Goal: read and send the WorkMail mailbox from the Outlook client. **WorkMail
keeps hosting the mailbox** (the $4/mo stays) — Outlook is just the client. No
MX/DNS migration required.

> Region note: WorkMail endpoints are region-specific. This account's other
> services are in **us-east-1**, so the endpoints below assume `us-east-1`.
> Confirm first (Step 1) — if the org is in `us-west-2` or `eu-west-1`, swap the
> region in every `*.mail.<region>.awsapps.com` hostname.

---

## Step 0 — Prerequisites (run from a machine with `aws` CLI + creds)

This Claude session has no `aws` CLI and the AWS API is network-blocked, so run
these yourself. They confirm the org/region, the user, and set a password.

```bash
REGION=us-east-1

# 1. Find the WorkMail organization id + region (try other regions if empty)
aws workmail list-organizations --region "$REGION"

ORG=m-xxxxxxxxxxxxxxxx   # OrganizationId from the output above

# 2. Find the user id for tbaltzakis@cloudless.gr and confirm State=ENABLED
aws workmail list-users --organization-id "$ORG" --region "$REGION" \
  --query "Users[?contains(Email,'tbaltzakis')].[Id,Email,State]" --output table

USER=xxxxxxxx-xxxx-...   # the user Id from above

# 3. Set/reset the mailbox password (you'll type this into Outlook)
aws workmail reset-password --organization-id "$ORG" --user-id "$USER" \
  --password 'CHOOSE-A-STRONG-PASSWORD' --region "$REGION"
```

Also verify protocol access is allowed:

- **Console → WorkMail → Organization → Access control rules.** The default rule
  allows all protocols. If a rule blocks `IMAP`/`WebMail`/`ActiveSync`/`EWS`,
  add an allow rule (or confirm the default is present) so Outlook can connect.

---

## Step 1 — Pick a connection method

| Method | Gets you | Best for |
| --- | --- | --- |
| **Exchange (EWS / Autodiscover)** | Mail **+ Calendar + Contacts**, server-side folders | Classic Outlook for Windows (recommended) |
| **IMAP + SMTP** | Mail + folders only (no calendar/contacts) | New Outlook for Windows, Outlook for Mac, any IMAP client |

---

## Step 2A — Classic Outlook for Windows (Exchange, full features)

1. **File → Add Account**, type `tbaltzakis@cloudless.gr`, click **Connect**.
2. If it can't auto-discover, choose **Exchange** / **advanced setup** and when
   prompted for the server use the EWS endpoint:

   ```
   https://ews.mail.us-east-1.awsapps.com/EWS/Exchange.asmx
   ```

3. Credentials when prompted:
   - **User name:** `tbaltzakis@cloudless.gr` (the full address)
   - **Password:** the one set in Step 0
4. Finish. Mail, calendar, and contacts sync.

**Optional — make auto-discovery "just work"** (and for any future users on the
domain): add a CNAME in the `cloudless.gr` Route 53 zone
(`Z079608614L53CC4EAZM3`):

```
autodiscover.cloudless.gr.  CNAME  autodiscover.mail.us-east-1.awsapps.com.
```

Then Outlook's automatic setup finds the server with no manual EWS URL.

---

## Step 2B — IMAP + SMTP (new Outlook / Mac / any client)

Add an account and choose **IMAP** (advanced/manual setup). Settings:

| Setting | Value |
| --- | --- |
| Email / Username | `tbaltzakis@cloudless.gr` |
| Password | the one set in Step 0 |
| **IMAP** incoming server | `imap.mail.us-east-1.awsapps.com` |
| IMAP port / security | `993` / SSL-TLS |
| **SMTP** outgoing server | `smtp.mail.us-east-1.awsapps.com` |
| SMTP port / security | `465` / SSL-TLS (or `587` / STARTTLS) |
| SMTP auth | Yes — same username + password |

---

## Step 3 — Verify

- Send a test message to an external address and reply back in; confirm both
  directions in Outlook.
- (Exchange path) Confirm the calendar and contacts folders appear.
- The WorkMail web client (`https://<alias>.awsapps.com/mail`) and Outlook now
  show the same mailbox — they're the same server-side store.

---

## Reference — WorkMail endpoints (us-east-1)

| Protocol | Endpoint | Port / notes |
| --- | --- | --- |
| IMAP | `imap.mail.us-east-1.awsapps.com` | 993 SSL |
| SMTP | `smtp.mail.us-east-1.awsapps.com` | 465 SSL / 587 STARTTLS |
| EWS (Exchange) | `https://ews.mail.us-east-1.awsapps.com/EWS/Exchange.asmx` | — |
| Autodiscover | `https://autodiscover.mail.us-east-1.awsapps.com/autodiscover/autodiscover.xml` | — |
| ActiveSync (mobile) | `https://mobile.mail.us-east-1.awsapps.com` | phones/tablets |
| Web client | `https://<alias>.awsapps.com/mail` | browser |

For `us-west-2` / `eu-west-1`, substitute the region in every hostname.

---

## Cost note

This keeps WorkMail, so the **$4.00/mo is unchanged** — it's the right call when
the mailbox must stay and you just want Outlook as the client. The separate
cost-reduction work (CloudTrail, Secrets Manager, Config, KMS, Route 53, SSM)
is unaffected; see [`aws-cost-reduction.md`](./aws-cost-reduction.md).
