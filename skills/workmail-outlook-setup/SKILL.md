old: 7909 bytes, new: 12873 bytes (+4964)
rkMail mailbox to Microsoft Outlook (new or classic), or
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

## Post-install tuning (IMAP-mode in New Outlook)

Once the account is wired up, four axes are worth checking. Each step is
marked **(verify)** = test, no change needed if it passes; **(action)** =
click through; **(limitation)** = a real cap of the IMAP-in-New-Outlook
combination with workarounds.

### A. Folder mapping

The risk: New Outlook's IMAP wizard sometimes creates its own `Sent` /
`Trash` / `Junk` folders alongside WorkMail's server folders (`Sent Items`,
`Deleted Items`, `Junk E-Mail`). Mail you send from New Outlook then
silently does NOT appear in WorkMail webmail's `Sent Items`. WorkMail's
IMAP server doesn't advertise SPECIAL-USE flags, so clients have to guess.

- **(verify)** Send yourself a test message from New Outlook → open WorkMail
  webmail (`https://<org>.awsapps.com/mail`) → confirm it shows up in
  `Sent Items`. Also delete a message from New Outlook → confirm it lands
  in `Deleted Items` on the web (not a new `Trash` folder).
- **(action) if the test fails:** Settings → Accounts → click the WorkMail
  account → Sync (or "Folders") → map Sent → `Sent Items`, Drafts →
  `Drafts`, Deleted → `Deleted Items`, Junk → `Junk E-Mail`. If the UI
  doesn't expose mapping, delete the duplicate client-side folders so
  New Outlook falls back to the canonical server folders.

### B. Identity (display name, reply-to, signatures, aliases)

- **(action) Display name:** Settings → Accounts → the WorkMail account →
  Account name & sync → set "Name people see" to a human name. Default is
  often just the email local-part.
- **(action) Reply-to:** Same pane → "Reply address". Leave blank unless
  replies should land in a different mailbox.
- **(action) Signature:** Settings → Mail → Compose and reply → Signatures
  → New → write HTML → bottom of pane set as default for "New messages"
  and "Replies/forwards" **for the WorkMail account specifically** (the
  per-account dropdown is easy to miss).
- **(action + limitation) Send-as aliases:** WorkMail supports aliases on
  user objects. Add via AWS Console → WorkMail → org → Users → your user →
  Aliases. New Outlook's IMAP profile has no per-message "From" picker, so
  to actually SEND from `info@cloudless.gr` etc., add the alias as a
  second IMAP account in New Outlook pointing at the same WorkMail
  mailbox (same hostnames, alias address as username, same password). Two
  account entries in the sidebar, one mailbox under both.

### C. Sync behavior

- **(verify) IMAP IDLE (push):** WorkMail's IMAP server supports IDLE, so
  New Outlook should receive instant pushes. Test: send from webmail,
  expect arrival in New Outlook within ~5 s. If it takes minutes, a
  firewall or NAT is killing idle TCP connections; raise the poll
  interval explicitly.
- **(action) Sync window:** Settings → Mail → Storage (or General →
  Storage) → "Sync only the last N days" if the mailbox is large.
- **(action) Attachment auto-download:** Settings → Mail → Attachments →
  toggle "Always download all attachments" based on bandwidth posture.
- **(action) External images:** Settings → Mail → Junk email → "Block
  external images" defaults ON for tracking-pixel defense. Leave on.
- **(verify) Metered connection:** Settings → General → Battery / metered
  connection → confirm New Outlook isn't auto-disabling sync on Wi-Fi.

### D. The calendar + contacts gap

IMAP carries only mail. WorkMail itself supports EWS, ActiveSync, and
iCal publishing — the gap is on the New Outlook side. Three options in
increasing scope:

1. **Read-only calendar via published iCal.** WorkMail webmail → Calendar
   → Publish → copy the `.ics` URL → New Outlook Calendar view → Add
   calendar → Subscribe from web. Read-only — view but can't RSVP.
2. **Windows 11 Calendar/People apps via EAS (read-write).** The built-in
   `outlookcalendar:` / `outlookpeople:` apps speak Exchange ActiveSync,
   which WorkMail supports natively. Add Account → Advanced setup →
   Exchange ActiveSync → server `mobile.mail.<region>.awsapps.com` →
   domain blank → username = full email. Calendar + contacts now sync
   read-write. Mail stays in New Outlook. Caveat: split UX, two apps.
3. **Replace New Outlook with an EWS client.** eM Client (free up to 2
   accounts) or Thunderbird + TbSync both speak EWS to WorkMail and give
   mail + calendar + contacts + tasks in one app. The most "native"
   experience for WorkMail; means leaving Outlook.

### Default recommendation for a fresh WorkMail-in-New-Outlook setup

1. Run (A) folder-mapping verify immediately — it's the only step that
   silently breaks something visible (sent mail missing from webmail).
2. Set display name + signature while you're in Settings anyway.
3. Add aliases in WorkMail admin only when needed; use the second-IMAP
   workaround for send-as.
4. Add Windows 11 Calendar app via EAS (Option D.2). Best ratio of
   "works" to "effort" for the IMAP-mode constraint.
5. Leave sync defaults alone unless something feels slow.

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
