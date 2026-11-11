# cloudless-mail-ops — tbaltzakis@cloudless.gr mailbox

Read, search, and send mail for **tbaltzakis@cloudless.gr** — the
self-hosted mailbox on omv-ha (Dovecot Maildir). Use this when asked to
check the cloudless.gr inbox, find a sent mail, verify delivery/bounces,
or send a text mail as @cloudless.gr.

## Tool

`scripts/cloudless-mail.py` — one file, no deps beyond stdlib.

```
CM="python C:/Users/tbaltzakis/AppData/Roaming/devin/skills/cloudless-mail-ops/scripts/cloudless-mail.py"

$CM folders                          # message counts per folder
$CM list [FOLDER] --max 20 --since 2026-11-10
$CM search [FOLDER|all] TERM [TERM...] [--max N] [--since DATE]
$CM read [FOLDER] SUBSTR             # SUBSTR = Maildir filename fragment
$CM get [FOLDER] SUBSTR [--att N | --name X] [--out PATH]
                                     # download an attachment to a file
$CM send --to a@b --subject S (--body T | --body-file f) [--cc a,b]
```

- Folders: `INBOX` (root `cur`/`new`), `Sent`, `Drafts`, `Trash`,
  `Junk`, `Heartbeat`. Case-insensitive; omit the folder arg to scan all.
- Search terms are ANDed substrings; `from:x`, `to:x`, `subject:x`
  prefixes restrict to that header, anything else matches the whole
  message (headers + body). First positional arg is treated as the
  folder only when a second term follows — `search mpaltzakis` searches
  all folders for the term.
- `read` matches against the Maildir filename (the delivery timestamp
  prefix, e.g. `1794369603`), not the subject.
- Output is JSON; on Windows pipe through `python -X utf8` or write to a
  file before pretty-printing (console codepage can't encode Greek).

## How it works

- **Read path:** SSH `tbaltzakis@100.95.117.84` (Tailscale, key
  `~/.ssh/id_rsa`, `BatchMode=yes`), then `sudo -n python3 -` runs an
  embedded parser over `/var/mail/vhosts/cloudless.gr/<user>/`. Maildir
  files need root — always go through `sudo -n`. Other mailboxes on the
  same host: `espocrm`, `polar` (`--user`).
- **Send path:** POST to the mail-outbound Cloudflare worker
  (`%APPDATA%/devin/secrets/mail-outbound.json` → `{url, token}`). Sends
  **as @cloudless.gr** (the only domain it can send as — Resend/CF
  verified). Requires a non-default `User-Agent` (the worker 403s
  `Python-urllib`). **Text only — no attachments.** For attachments or
  HTML mail use `webmail.cloudless.gr` (behind Cloudflare Access OTP).
- **External recipients:** the worker's `send_email` binding 502s on any
  non-@cloudless.gr address (verified 2026-11-11 — self-sends work,
  hotmail/gmail fail). `send` automatically falls back to SMTP via
  `ssh omv-ha /usr/sbin/sendmail -t -i` (postfix localhost relay →
  Resend), which delivers externally. `--category` must be one of the
  worker's allowlist (`ops-alert` default) even when the fallback is
  used, since the worker is tried first.
- Delivery verification: bounces land in INBOX from
  `MAILER-DAEMON@cloudless.gr` ("Undelivered Mail Returned to Sender").
  `search all mailer-daemon --since <date>` checks for fresh bounces.

## Gotchas

- Inbound cloudless.gr mail routes Cloudflare Email Routing →
  `mail-ingest` worker → `webmail.cloudless.gr/ingest` → this Maildir.
  Outbound to the outside goes via the mail-outbound worker, NOT via
  this mailbox's SMTP — `.Sent` only contains webmail/IMAP sends.
- `sudo -n` is passwordless on omv-ha for this user; if it fails the
  SSH key or sudoers changed — do not retry with a password.
- `send` returning `HTTP 401` means the worker's `MAIL_OUTBOUND_TOKEN`
  secret drifted from `mail-outbound.json`. **Auto-heal is wired:**
  `scripts/mail-outbound-heal.py` probes `/send`, and on 401 PUTs the
  local token as the worker secret via the Cloudflare API
  (`PUT .../workers/scripts/mail-outbound/secrets`,
  `{name, text, type:"secret_text"}`), then re-probes and prints a
  JSON verdict — no secret values in output. `mail-pipeline-watch.py`
  calls it automatically on probe 401 and retries once, so the 30-min
  scheduled probe self-repairs. Run it by hand:
  `python .../cloudless-mail-ops/scripts/mail-outbound-heal.py`.
  Auth: `secrets/cf-workers-deploy-token` (needs Workers Scripts:Edit —
  the plain `CLOUDFLARE_API_TOKEN` in cu130-slim/.env lacks it).
  **Probe semantics:** any non-401 response (400/200) means auth is
  fine — 400 = malformed probe payload, not a heal failure. Manual fix
  (done 2026-11-11): same PUT via the cloudflare MCP `execute` tool or
  `wrangler secret put`. Secret changes propagate in seconds; retry
  once before assuming failure. Worker source:
  `cloudless-pipeline/workers/mail-outbound/src/index.ts`.
- The Gmail MCP / google-workspace MCPs are a different account
  (baltzakis.themis@gmail.com); cloudless.gr mail does NOT appear there
  unless a forward exists. For Gmail use `gmail-telegram-watch` /
  `gmail-send-ops` instead.
- Long `list`/`search` over INBOX (3k+ msgs) parses every file — it
  takes ~30-60s. Prefer `--since` or a specific folder.

## Related

- `cloudless-mail-mcp` — stdio MCP server exposing the same
  capabilities as tools (`mail_folders`, `mail_list`, `mail_search`,
  `mail_read`, `mail_get_attachment`, `mail_send`); registered in
  `mcp_config.json` as `cloudless-mail`.
- `gmail-local-mcp` — local MCP server for the Gmail account
  (search/read/send/drafts via Gmail API; use when the hosted `gmail`
  MCP fails).
- `gmail-telegram-watch` — the probe (`mail-pipeline-watch.py`) that
  verifies this same inbound pipeline end-to-end.
- `gmail-send-ops` — outbound for the Gmail account (separate token).
- `nextcloud-admin` — same omv-ha host, different service.
