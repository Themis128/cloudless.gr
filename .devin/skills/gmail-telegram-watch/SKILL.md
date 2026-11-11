# gmail-telegram-watch

Watches Gmail (baltzakis.themis@gmail.com) for new mail and posts alerts to
Telegram via @Cloudless_newbot. Fully automated: **one scheduled task
(`DevinGmailWatch`, every 10 min) runs every config in `scripts/watches/` —
new watches need zero schtasks work.**

## Creds

- Bot token: `%APPDATA%/devin/secrets/tg-bot-token` (@Cloudless_newbot)
- Gmail OAuth token: `%APPDATA%/devin/secrets/gmail-token.json` — scope
  `gmail.readonly`, account **baltzakis.themis@gmail.com**
- Send token: `%APPDATA%/devin/secrets/gmail-send-token.json` — scope
  `gmail.modify` (read+compose+send), separate file, same OAuth client.
  Outbound sends/drafts/scheduled replies → **gmail-send-ops** skill.
- OAuth client (for refreshing): `~/.config/google-calendar-mcp/gcp-oauth.keys.json`
- Telegram chat id: **7017840434** (default in all scripts)
- mail-outbound creds: `%APPDATA%/devin/secrets/mail-outbound.json`
  (`{url, token}` for `mail-outbound.*.workers.dev/send`)

## Re-auth (when refresh token dies)

**RESOLVED 2026-11-08:** the GCP OAuth consent screen (project
`credentials-462313`, app `cloudless.gr`) was pushed **Testing → In
production** via CDP console automation — refresh tokens no longer expire
every ~7 days. Branding was completed first (home/privacy/ToS links →
cloudless.gr pages). The app is unverified, so consent still shows Google's
"unverified app" warning — cosmetic only for own-account use; verification
is optional and only needed for >100 users.

`invalid_grant` on refresh means re-consent. Two paths:

- **Auto (default)**: `daily-ops.py` launches `auto-reauth.py`, which drives
  the whole consent flow inside chrome-debug-profile (CDP :9229) — opens the
  consent URL, clicks the account chooser (baltzakis.themis), scope
  checkboxes, the unverified-app warning and Allow, then saves the token and
  Telegrams "auto-renewed". Tested working. Falls back to a manual-approval
  Telegram nudge if the screens can't be completed (e.g. logged out).
- **Manual**: `python scripts/gmail_auth.py` → approve in the browser tab
  that opens (pick baltzakis.themis@gmail.com). The tab shows "connection
  refused" afterward — that's just the closed localhost callback, harmless.

Requires: chrome-debug-profile running on :9229 **and** a live Google session
for baltzakis.themis@gmail.com in it. If the session itself is dead,
`auto-reauth.py` now chains into `google-login.py` automatically — it drives
accounts.google.com sign-in with the password stored at
`%APPDATA%/devin/secrets/google-password`, then retries the consent flow once.
Optional `%APPDATA%/devin/secrets/google-totp-secret` enables fully-headless
2FA; without it Google 2FA falls back to a Telegram "approve on your phone"
nudge (or manual finish in the debug window). Tested end-to-end 2026-11-09
against a real signed-out state: account chooser -> password challenge ->
Google device-prompt ("check your phone") -> Telegram escalation fired
correctly. Notes: Google ignores synthetic `.click()`/JS-set input values —
all clicks/typing go through CDP `Input.dispatchMouseEvent`/`insertText`;
password-challenge pages render a hidden `input[type=email]`, so the state
machine checks `pw` before `email`. Fully headless 2FA still needs
`google-totp-secret` (dp-prompt has no TOTP path unless "Try another way"
→ Authenticator is offered).

## Adding a watch (the whole workflow)

```
python scripts/new-watch.py <name> "<gmail query>" ["<alert prefix>"] [--alert-test]
```

- writes `watches/<name>.json`, baselines the thread, posts a Telegram
  "watch armed" confirmation. `DevinGmailWatch` picks it up automatically.
- `--alert-test`: sends the confirmation without writing the config.
- If no thread matches yet, the watch stays dormant and arms when one appears.

Config shape: `{"name","query","alert_prefix","chat_id"}` — state goes to
`<name>-state.json` (delete to re-baseline).

## Scripts

| script | role |
|---|---|
| `gmail-thread-watch.py <cfg>` | thread watcher — alerts on new INBOUND msgs (SENT filtered), errors → TG once/24h |
| `run-all-watches.py` / `.bat` / `.vbs` | master runner — executes every `watches/*.json`; `.vbs` launches the `.bat` windowless (this is what `DevinGmailWatch` calls via `wscript.exe`) |
| `new-watch.py` | CLI to create + baseline + confirm a watch |
| `self-test.py [flags]` | full check: Gmail auth, every watch's thread+state, schtasks task. Flags: `--tg` live test msg, `--fix` recreates DevinGmailWatch if missing, `--tg-alert` Telegrams only on failure |
| `run-self-test.bat` / `.vbs` | wrapper scheduled as `GmailWatchSelfTest` (every 6h, via wscript): `self-test.py --fix --tg-alert` → self-healing loop, silent on success, log `self-test.log` |
| `tg-send.py "<text>" [--chat ID]` | generic Telegram notify CLI — any script/agent can alert the user |
| `gmail-fetch.py "<query>" [--save DIR] [--all]` | fetch newest matching Gmail message: headers, plain-text body, saves attachments |
| `auto-reauth.py` | headless OAuth re-consent (readonly token) via CDP :9229; account chooser uses `cdp.py` real mouse clicks (synthetic `.click()` is ignored there); on login-wall failure chains into `google-login.py` + one retry |
| `gmail-send-auth.py` | same flow for the SEND token (`gmail.modify` → `gmail-send-token.json`); tested 2026-11-11 |
| `cdp.py` | minimal CDP helper — `Tab.click_text`/`click_xy` use real `Input.dispatchMouseEvent` (needed for Google account chooser) |
| `oauth-callback-once.py` | localhost:50000 OAuth callback listener → writes `secrets/gmail-send-code.txt` |
| `google-login.py` | automated Google sign-in for the debug profile (password from secrets; TOTP/phone-prompt 2FA handling) |
| `gmail_auth.py` | manual OAuth re-consent fallback |
| `inbox-watch.py` | sweep: alerts on ANY new mail (`in:anywhere -in:sent`, minus authority domains + bulk categories); first run seeds silently |
| `case-watch.py` | sweep: any new mail from authority domains (synigoros/dypa/gov/hli/yeka/efka), `in:anywhere -in:trash` |
| `skc-watch.py` | sweep: any new mail from @sofiakakkava.com |
| `daily-ops.py` | daily: refresh-token expiry guard + SKC deadline reminders + cu130-slim `.env` truncation guard + launches `auto-reauth.py` on refresh failure |
| `resolve-chat.sh` | resolve a Telegram chat id |
| `watch.py` | legacy loop-style micro1 watcher (GmailTelegramWatch task) |
| `mail-pipeline-watch.py` / `.bat` / `.vbs` | inbound pipeline probe: POSTs a unique `PIPELINE-TEST-AUTO-*` mail via mail-outbound, polls the dovecot Maildir on omv-ha (SSH `tbaltzakis@100.95.117.84`, `sudo -n grep`) until it lands (6 min deadline). TG alert on failure, throttled 4h; silent on success. Log `mail-pipeline.log` |

## Live tasks

- **DevinGmailWatch** — every 10 min → `run-all-watches.bat`, log `watches.log`.
  Currently armed: `dypa` (sent thread to protokollo@dypa.gov.gr, "Ερώτημα…
  Κωδικός Θέσης 114"), `dypa-kpamark` (sent thread to kpamark@dypa.gov.gr,
  επανεξέταση επιδόματος).
- **GmailWatchSelfTest** — every 6h → `run-self-test.bat`: verifies auth + all watches + the DevinGmailWatch task (recreates it if missing), Telegrams only on failure.
- **GmailDailyOps** — daily 09:00 → `daily-ops.py`: warns ~2d before refresh-token expiry; on refresh failure auto-launches `auto-reauth.py` (headless consent in debug Chrome) + Telegrams; also guards the cu130-slim `.env` against truncation (the 2026-11-08 stub incident).
- **CaseMailWatch / InboxMailWatch / SkcOfferWatch** — sweeps every 5–10 min: authority domains (`case-watch.py`), everything else (`inbox-watch.py`), @sofiakakkava.com (`skc-watch.py`). All cover spam (`in:anywhere`).
- **GmailTelegramWatch** — legacy at-logon micro1 watcher (`watch.py`).
- **MailPipelineWatch** — every 30 min → `mail-pipeline-watch.vbs`: end-to-end inbound mail probe (mail-outbound → CF Email Sending → Email Routing → `mail-ingest` worker → `webmail.cloudless.gr/ingest` → dovecot). Covers the path that bounced on 2026-11-05 (`555 5.7.1 Mailbox ingest not configured`).

## Gotchas

- MSYS bash mangles schtasks `/create` — run it via powershell; `/tr` nested
  quotes are fragile → always point tasks at a wrapper file.
- Tasks pointing at a `.bat` flash a console window every run → always go
  through the matching `.vbs` launcher (`wscript.exe file.vbs`) which runs
  the bat hidden and keeps its log redirect. `--fix` in self-test.py
  recreates tasks this way — keep it in sync if wrappers change.
- Console is cp1252 — wrap stdout in utf-8 before printing Greek subjects
  (`sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")`);
  `tg()` handles UTF-8 natively.
- Every refresh path must propagate `refresh_expires_at` when Google returns
  `refresh_token_expires_in` — `daily-ops.py` keys its expiry warning off it.
  Since production publish this should stay far-future, but the tracking
  remains as a safety net. `daily-ops.py` also launches `auto-reauth.py`
  proactively ~36h before expiry (verified working end-to-end 2026-11-08).
- `gmail-thread-watch.py` reads its config path from `sys.argv[1]` at import
  time — set `sys.argv` before `exec_module` when embedding it.
- mail-outbound `/send` rejects the default `Python-urllib` UA (403) —
  always set an explicit `User-Agent`.
- mail-outbound MIME-encodes subjects (`=?utf-8?B?...?=`), so Maildir
  greps for probe tags must also try the leading base64 chars.
- Widening a watcher's query scope re-baselines: first run alerts on all
  previously-unseen matches (one-time storm — happened when inbox-watch moved
  to `in:anywhere`).
- Multiple agents edit this dir concurrently — re-read files before editing;
  `edit` may hit stale strings.

## Related

- **gmail-send-ops** — outbound side: threaded drafts, `drafts.send`,
  one-time schtasks scheduled sends, `gmail.modify` re-consent flow
  (`cdp.py`, `oauth-callback-once.py`, `gmail-send-auth.py` live here).
