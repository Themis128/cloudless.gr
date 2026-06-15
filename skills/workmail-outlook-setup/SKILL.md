# workmail-outlook-setup

Add an Amazon WorkMail mailbox to Microsoft Outlook (new or classic), or
diagnose why one won't connect. Region-aware; covers EWS/Autodiscover and
IMAP/SMTP fallbacks; includes a connectivity-doctor script.

Use this skill whenever the user says any of:

- "add my WorkMail to Outlook"
- "WorkMail not working in Outlook"
- "Outlook keeps asking for password" against a WorkMail address
- "Autodiscover failed" for a `*.awsapps.com` mailbox
- "set up IMAP for WorkMail"
- "new Outlook can't find my Exchange server"

## What it covers

1. Pick the right Outlook client given the user's needs (calendar/contacts vs
   mail-only).
2. Resolve the AWS region of the WorkMail org from the webmail URL.
3. Drive the right connection path: **Autodiscover/EWS** for classic Outlook,
   **IMAP/SMTP** for new Outlook (the only path it supports against WorkMail).
4. Apply the Autodiscover registry fix when classic Outlook tries to hijack the
   lookup to Microsoft 365.
5. Run `scripts/workmail-connectivity-test.sh` to confirm DNS, TLS, and
   IMAP login work before blaming Outlook.

## Client capability matrix

| Capability        | Classic Outlook (EWS) | New Outlook (IMAP) |
| ----------------- | --------------------- | ------------------ |
| Mail              | ✓                     | ✓                  |
| Calendar sync     | ✓                     | ✗ local only       |
| Contacts sync     | ✓                     | ✗ local only       |
| Server-side rules | ✓                     | ✗                  |
| Shared mailbox    | ✓                     | ✗                  |
| Setup steps       | email + password      | 7 manual fields    |

**Recommend classic Outlook** unless the user explicitly wants the new UI and
is OK with mail-only.

## Authoritative endpoints

The canonical table is at `reference/endpoints.md` (mirrored from the AWS
General Reference so the skill stays usable offline). All hostnames follow
the `*.mail.<region>.awsapps.com` pattern; the Autodiscover host is
**`autodiscover-service.mail.<region>.awsapps.com`**, NOT
`autodiscover.mail.<region>.awsapps.com` — newer WorkMail mailboxes ONLY
resolve via the `-service` variant, which is the single most common cause of
Autodiscover failures.

## Workflow

### 1. Region detection

Ask the user for their webmail URL (the page they log into to read mail
in a browser). The hostname format is `https://<org-alias>.awsapps.com/mail`
and the region is encoded in the redirect. If unknown:

```bash
curl -s -o /dev/null -w "%{redirect_url}\n" "https://<org-alias>.awsapps.com/mail"
# → contains us-east-1 / us-west-2 / eu-west-1
```

If the user can't find their URL, ask whether they originally created the org
in Ireland, N. Virginia, or Oregon. Default Greek/EU customers to eu-west-1.

### 2. Decide path

```
Does the user need calendar/contacts/rules?
  ├─ Yes  → Classic Outlook + Autodiscover (Section 3)
  └─ No   → New Outlook + IMAP/SMTP (Section 4)
```

### 3. Classic Outlook + Autodiscover

1. If "New Outlook" toggle is on in the title bar, flip it off.
2. `File → Add Account → <email>` → **Connect**.
3. If Outlook resolves: enter the password, done.
4. If Outlook redirects to a Microsoft 365 sign-in page or fails with
   "Cannot connect to server", run
   `scripts/workmail-outlook-autodiscover-fix.ps1 -Region <region>` from an
   admin PowerShell, restart Outlook, retry. The script writes registry keys
   that disable SCP/SRV/HttpsRootDomain lookups so Autodiscover goes straight
   to the WorkMail endpoint.

### 4. New Outlook + IMAP/SMTP

1. Settings (gear) → **Accounts → Email accounts → Add account**.
2. Enter the email → **Continue** → **Show advanced setup** → **IMAP**.
3. Use settings from `reference/endpoints.md` for the user's region.
4. **Both ports MUST be SSL/TLS**, not STARTTLS — WorkMail SMTP rejects
   STARTTLS on 465. The new-Outlook wizard sometimes preselects STARTTLS;
   flip it.

### 5. Verify

Always run the connectivity doctor before blaming Outlook:

```bash
scripts/workmail-connectivity-test.sh \
  --region eu-west-1 \
  --user tbaltzakis@cloudless.gr
```

The script tests DNS, TLS handshake on 993 + 465, the Autodiscover XML
endpoint, and (with `--password`) a real IMAP LOGIN.

## Common errors

| Symptom                                                | Likely cause                                            | Fix                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Outlook redirects to M365 sign-in                      | Classic Outlook hit SCP/AD lookup or SRV record         | Run `scripts/workmail-outlook-autodiscover-fix.ps1 -Region <r>`                                  |
| "Cannot connect to autodiscover"                       | Outlook tried `autodiscover.mail.<r>.awsapps.com`       | Fix script forces `autodiscover-service.mail.<r>.awsapps.com`                                    |
| New Outlook offers Exchange but fails to detect server | New Outlook only supports M365 Exchange, not WorkMail   | Use IMAP path (Section 4)                                                                        |
| IMAP login fails with "Authentication failed"          | Wrong username form, or IMAP disabled at org level      | Username must be the full address. Check WorkMail admin → Organizations → Access control rules. |
| Outgoing mail bounces with TLS error                   | Wizard set STARTTLS on port 465                         | Switch to SSL/TLS on 465                                                                         |
| TLS handshake times out                                | Outbound 993/465 blocked by firewall/VPN                | Run connectivity test from outside the network to confirm                                        |
| Password "wrong" but is correct                        | Wizard re-encoded non-ASCII chars                       | Copy-paste rather than type                                                                      |

## Security notes

- Never accept a WorkMail password pasted into chat — direct the user to type
  it into Outlook locally, or hand them the connectivity script to test on
  their own machine. If a password has already been shared in chat, advise
  rotating it in the WorkMail admin console.
- WorkMail has no concept of "app-specific passwords" — the IMAP/EWS password
  is the account password. For unattended integrations (forwarders,
  sync agents), create a dedicated mailbox rather than reusing the human
  user's credentials.

## Files

- `reference/endpoints.md` — mirror of AWS WorkMail endpoint table
- `../../scripts/workmail-outlook-autodiscover-fix.ps1` — registry helper
- `../../scripts/workmail-connectivity-test.sh` — DNS/TLS/IMAP doctor

## Sources

- [Amazon WorkMail endpoints and quotas — AWS General Reference](https://docs.aws.amazon.com/general/latest/gr/workmail.html)
- [Setting up Microsoft Outlook clients for Amazon WorkMail](https://docs.aws.amazon.com/workmail/latest/userguide/outlook-client.html)
- [Setting up IMAP for Amazon WorkMail](https://docs.aws.amazon.com/workmail/latest/userguide/using_IMAP.html)
- [Preventing Outlook (Classic) Autodiscover Hijack to Microsoft 365 — AWS re:Post](https://repost.aws/questions/QUm3TxTl15TcGk7iPJflOJZw/preventing-outlook-classic-autodiscover-hijack-to-microsoft-365-aws-workmail)
- [Outlook autodiscover fails for new WorkMail mailboxes (`autodiscover-service` vs `autodiscover`) — AWS re:Post](https://repost.aws/questions/QUQ4uJvhs6TySjirSsr4Hdjw/outlook-autodiscover-fails-for-new-work-mail-mailboxes-points-to-wrong-endpoint-autodiscover-mail-us-east-1-awsapps-com-instead-of-autodiscover-service-mail-us-east-1-awsapps-com)
