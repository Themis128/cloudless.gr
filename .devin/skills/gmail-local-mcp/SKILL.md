# gmail-local-mcp — local Gmail MCP shim

Stdout MCP (stdio, newline-delimited JSON-RPC) for
**baltzakis.themis@gmail.com**. Registered as `gmail-local` in
`%APPDATA%/devin/mcp_config.json` — available next session as MCP tools
`gmail_search`, `gmail_read_thread`, `gmail_read_message`, `gmail_send`,
`gmail_create_draft`, `gmail_list_drafts`.

## Why this exists

The org-level `gmail` MCP (`https://gmailmcp.googleapis.com/mcp/v1`)
connects but every tool call fails with `Transport send error: Auth
required` — **no OAuth token is stored** for it
(`%APPDATA%/devin/mcp/oauth/` only has cloudflare). It is not manageable
via `devin mcp login` (not in local config). Re-auth requires the
Devin Desktop MCP UI. This shim bypasses it entirely using the local
OAuth tokens the watch/send skills already maintain.

## Tokens

- Read: `%APPDATA%/devin/secrets/gmail-token.json` — `gmail.readonly`
- Send/draft: `%APPDATA%/devin/secrets/gmail-send-token.json` —
  `gmail.modify`
- Both refresh via `~/.config/google-calendar-mcp/gcp-oauth.keys.json`
  (same OAuth client as google-calendar-mcp). `invalid_grant` on
  refresh → re-consent via `gmail-send-ops` skill (CDP flow).

## Usage

```
python scripts/gmail_mcp.py          # stdio MCP server (JSON-RPC per line)
```

Tools/call arguments are plain JSON. `gmail_send`/`gmail_create_draft`
support `thread_id` + `in_reply_to`/`references` for threading.
`gmail_search` mode=`threads` (default) or `messages`; query is native
Gmail syntax.

## Testing

Pipe JSON-RPC lines to stdin:

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"gmail_search","arguments":{"query":"is:unread","max_results":5}}}
```

Battle-tested 2026-11-11: initialize/tools-list/search/read-thread/
list-drafts all OK.

## Gotchas

- Output uses `ensure_ascii=True` — required, Windows stdout may be
  cp1252 and Greek subjects would crash the server otherwise.
- Send is immediate (no scheduling). For scheduled/threaded replies
  prefer `gmail-send-ops/scripts/gmail-schedule-reply.py`.
- Readonly token can't label/modify; send token can (gmail.modify).
- If the org `gmail` MCP gets re-authenticated later, prefer it — this
  shim is the fallback.

## Related

- `gmail-telegram-watch` — inbound watches, `gmail-fetch.py`, `tg-send.py`
- `gmail-send-ops` — scheduled sends, token re-consent
- `cloudless-mail-ops` — the OTHER mailbox (tbaltzakis@cloudless.gr,
  Dovecot on omv-ha)
