# docker-mcp-gateway — Docker MCP Toolkit gateway

Runs the Docker MCP Toolkit gateway serving the **`github` profile**
(github-official, playwright, resend, context7 — 78 tools) over
streamable-HTTP MCP at **`http://127.0.0.1:8012/mcp`**.

## Pieces

- **Gateway process:** scheduled task `DockerMcpGateway` (AtLogOn,
  auto-restart ×3) runs
  `docker mcp gateway run --profile github --transport http --port 8012 --host 127.0.0.1 --allow-unauthenticated`
  via `C:\Users\tbaltzakis\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`.
  `--allow-unauthenticated` is safe: bound to 127.0.0.1 only.
- **Devin MCP config:** `docker-mcp` entry in
  `%APPDATA%/devin/mcp_config.json` → `http://127.0.0.1:8012/mcp`.
- **Tool names are prefixed** (`github-official__get_me`,
  `context7__query-docs`, `playwright__browser_navigate`,
  `resend__*`) — the `tool-name-prefix` feature is enabled globally, so
  no collisions with Devin's other MCP servers.
- **Secrets:** Docker Desktop secret store (`docker mcp secret ls`) —
  `docker/mcp/GITHUB.PERSONAL_ACCESS_TOKEN` and
  `docker/mcp/resend.api_key` are stored; github-official authenticates
  as Themis128.

## Ops

```powershell
# status / restart
Get-ScheduledTask DockerMcpGateway | Get-ScheduledTaskInfo
Start-ScheduledTask DockerMcpGateway   # or Stop-ScheduledTask

# manual run (foreground, for debugging)
docker mcp gateway run --profile github --transport http --port 8012 --host 127.0.0.1 --allow-unauthenticated

# other commands
docker mcp profile ls|server ls          # profiles/servers
docker mcp feature ls                    # experimental flags
docker mcp tools ls                      # builtin gateway tools
```

## Gotchas

- **Port 8000 is taken** by `com.docker.backend.exe` (Docker Desktop
  internal) — that's why the gateway uses **8012**.
- Killing the gateway: `kill_shell`/taskkill on the wrapper does NOT
  kill `docker-mcp.exe` — find it via
  `Get-CimInstance Win32_Process | ? CommandLine -match 'mcp gateway'`
  and Stop-Process, or the port stays bound and the next run fails with
  "Only one usage of each socket address".
- `docker mcp secret ls` timing out with
  `resolver.v1.ResolverService deadline_exceeded` means the Docker
  Desktop secrets engine is wedged → `docker desktop restart` fixes it
  (bounces the engine; compose containers auto-restart).
- Streamable-HTTP MCP needs the session handshake:
  `initialize` → read `mcp-session-id` response header →
  `notifications/initialized` → then `tools/list`/`tools/call` with that
  header. Calling `tools/list` before init returns
  "invalid during session initialization".
- `mcp/playwright` containers need `--memory`/`--cpus` headroom; default
  1 CPU / 2 GB per server is fine alongside the social stack.
