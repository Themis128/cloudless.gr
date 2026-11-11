# cloudless-mail-mcp — MCP server for tbaltzakis@cloudless.gr

Stdio MCP server wrapping the `cloudless-mail-ops` CLI. Gives agents
structured tools for the self-hosted cloudless.gr mailbox (Dovecot
Maildir on omv-ha) — the counterpart to `gmail-local-mcp` for the Gmail
account.

## Tools

| Tool | Purpose |
|---|---|
| `mail_folders` | Folder list + message counts |
| `mail_list` | Recent messages (`folder`, `max`, `since`) |
| `mail_search` | ANDed substring search; `from:`/`to:`/`subject:`/`body:` prefixes |
| `mail_read` | Full message by Maildir filename fragment (usually the delivery timestamp) |
| `mail_get_attachment` | Extract an attachment — `att` index, `name` substring, or single attachment; `save_path` writes the file |
| `mail_send` | Plain-text send **as @cloudless.gr** via the mail-outbound worker (no attachments/HTML) |

All tools take optional `user` (default `tbaltzakis`); other mailboxes
on omv-ha: `espocrm`, `polar`.

## Registration

Already in `%APPDATA%/devin/mcp_config.json` as `cloudless-mail`
(python + `scripts/cloudless_mail_mcp.py`). Requires a Devin restart to
load — until then use the CLI directly:

```
python C:/Users/tbaltzakis/AppData/Roaming/devin/skills/cloudless-mail-ops/scripts/cloudless-mail.py <cmd>
```

## Notes

- Read path is SSH to `tbaltzakis@100.95.117.84` + `sudo -n python3`;
  INBOX scans are slow (~30-60s for 3k+ messages) — pass `folder`/`since`.
- `mail_send` needs the `MAIL_OUTBOUND_TOKEN` worker secret to match
  `secrets/mail-outbound.json` — resync procedure in the
  `cloudless-mail-ops` SKILL.md Gotchas.
- For HTML mail or attachments on send, use webmail.cloudless.gr.
