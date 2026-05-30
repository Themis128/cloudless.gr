# Tabby + Pochi local model stack

Self-hosted LLM stack for in-editor completion and agentic chat. Everything
runs on the developer machine — no third-party API calls, no code leaves
the box.

## Hardware target

| Component | Value |
|---|---|
| GPU | NVIDIA RTX 3070 Laptop, 8 GB VRAM |
| Driver | 596.36+ (CUDA 12.4 runtime) |
| OS | Windows 11 |

The CUDA toolkit itself is **not** required — the Tabby release ships its own
`ggml-cuda.dll`.

## What runs where

```
┌──────────────────────────┐    /v1/completions      ┌─────────────────────┐
│ VS Code Tabby extension  │ ──────────────────────► │ Tabby server        │
│ (FIM completions)        │ ◄────────────────────── │ 127.0.0.1:8080      │
└──────────────────────────┘                         │                     │
                                                     │ completion model:   │
┌──────────────────────────┐  /v1/chat/completions   │  Qwen2.5-Coder-3B   │
│ VS Code Pochi extension  │ ──────────────────────► │  (CUDA)             │
│ (agentic chat)           │ ◄────────────────────── │                     │
└──────────────────────────┘                         │ chat model:         │
                                                     │  Qwen2.5-Coder-7B-  │
                                                     │  Instruct (CUDA)    │
                                                     └─────────────────────┘
```

Both endpoints are loopback-only (`--host 127.0.0.1`).

## Model choice rationale

| Slot | Model | VRAM Q4 | Why |
|---|---|---|---|
| Completion (FIM) | `Qwen2.5-Coder-3B` | ~1.5 GB | Fast latency (~3 s on a 30-line prefix), strong code understanding, supports proper FIM tokens. 1.5B variant is also fine; 7B+ overshoots VRAM when paired with chat. |
| Chat / agent | `Qwen2.5-Coder-7B-Instruct` | ~4.7 GB | Best agentic coder model that fits with the 3B FIM under 8 GB. Same tokenizer + same code style as the FIM model. Tool-use capable. |
| Embedding (auto) | `Nomic-Embed-Text` | ~0.3 GB | Bundled by Tabby for code-context retrieval. |

Total resident: **~6.5 GB / 7.4 GB free** — leaves a ~1 GB cushion for the
desktop and Chrome. If you start hitting OOM (typically: long chat plus a
busy GPU elsewhere), drop the chat model to `Qwen2.5-Coder-3B-Instruct` for
~3 GB total savings.

`--parallelism 1` keeps a single inference slot per model. Bumping to 2
roughly doubles steady-state VRAM and is only worth it if you frequently
trigger multiple completions on the same keystroke (multi-cursor).

## Setup

```powershell
# from the repo root
pwsh scripts/tabby/setup-tabby.ps1
```

The script:

1. Downloads `tabby_x86_64-windows-msvc-cuda124.zip` (152 MB) into `D:\tabby\<version>`.
2. Pre-downloads both GGUFs (~16 GB on disk, all quant variants the model
   pulls).
3. Boots Tabby just long enough to register a local admin user
   (`admin@cloudless.local`) via the GraphQL `register` mutation and pull
   the long-lived `authToken`.
4. Writes the token into `~/.tabby-client/agent/config.toml` (Tabby IDE
   extension) and `~/.pochi/config.jsonc` (Pochi).
5. Stops the bootstrap server.

Re-running the script is safe: existing models are skipped, an already
registered admin is logged into instead of re-registered.

## Daily use

Start the server in a dedicated PowerShell window:

```powershell
pwsh scripts/tabby/start-tabby.ps1
```

On first start each session Tabby loads both models into VRAM
(~20-30 s). Subsequent requests are warm.

VS Code Insiders picks up:

- `tabbyml.vscode-tabby` — reads `~/.tabby-client/agent/config.toml` and
  starts firing FIM requests at `/v1/completions` automatically once the
  status bar shows "Ready".
- `tabbyml.pochi` — reads `~/.pochi/config.jsonc` and uses the same Tabby
  server for chat/agent flows via OpenAI-compatible API.

## Smoke test

```powershell
pwsh scripts/tabby/test-tabby.ps1
```

Validates `/v1/health`, a Python FIM completion, and a one-token streaming
chat reply. Exits non-zero if any check fails. Useful right after
`start-tabby.ps1` to confirm the models actually loaded onto CUDA before
opening the editor.

Expected on this hardware:

| Check | Latency |
|---|---|
| `/v1/health` | <100 ms |
| FIM completion (30-line prefix) | 3-5 s cold, <1 s warm |
| Chat reply (single token) | 1-2 s warm |

## Endpoints reference

| Path | Method | Use |
|---|---|---|
| `/v1/health` | GET | Liveness + which models/devices are loaded |
| `/v1/completions` | POST | Tabby-native FIM API used by the IDE extension |
| `/v1/chat/completions` | POST | OpenAI-compatible chat. **Streaming required** (`"stream": true`). Used by Pochi and any other OpenAI-SDK consumer. |
| `/graphql` | POST | Admin operations: user management, telemetry settings, model swap |

All require `Authorization: Bearer <authToken>`. The token is in
`~/.tabby-client/agent/config.toml`.

## Updating Tabby

```powershell
pwsh scripts/tabby/setup-tabby.ps1 -Version v0.33.0
```

The symlink `D:\tabby\current` is repointed; old versioned directories stay
around so you can rollback by editing the symlink target.

## Switching models

```powershell
pwsh scripts/tabby/setup-tabby.ps1 `
  -CompletionModel Qwen2.5-Coder-1.5B `
  -ChatModel Qwen2.5-Coder-3B-Instruct
```

This downloads the new models (if not cached), updates both client
configs, and leaves the bigger models on disk for a quick switch back.

## Troubleshooting

**Tabby starts but Pochi gets 401**
The `authToken` in `~/.pochi/config.jsonc` is stale (you deleted
`~/.tabby` or wiped the SQLite users table). Re-run `setup-tabby.ps1` —
it will detect the existing admin record and refresh both configs.

**FIM extension says "Server is not ready"**
Models are still loading. Watch `D:\tabby\logs\tabby-test.log` — the ASCII
art logo prints right before `/v1/completions` becomes responsive.

**`nvidia-smi` shows the server taking >7.5 GB and the GPU stalls**
You probably bumped `--parallelism` past 1 or have another process on the
GPU (a browser with WebGL, GPU-accelerated Discord, etc.). Drop
parallelism back to 1 or close the other consumer.

**Port 4000-style "wslrelay" conflict on 8080**
WSL2 can grab loopback ports when a Linux process binds them. Run
`netstat -ano | findstr :8080` — if you see `wslrelay`, kill it
(`taskkill /F /PID <id>`) before starting Tabby.

## Files this stack writes outside the repo

| Path | Purpose | Generated by |
|---|---|---|
| `D:\tabby\<version>\` | Tabby binary + DLLs | setup-tabby.ps1 |
| `D:\tabby\current` | Symlink to active version | setup-tabby.ps1 |
| `D:\tabby\models\` | GGUF cache | setup-tabby.ps1 / tabby download |
| `D:\tabby\logs\` | stdout/stderr captures | start-tabby.ps1 |
| `D:\tabby\local-admin-creds.json` (hidden) | Admin email/password/token | setup-tabby.ps1 |
| `~/.tabby-client/agent/config.toml` | Tabby IDE extension config | setup-tabby.ps1 |
| `~/.pochi/config.jsonc` | Pochi extension config | setup-tabby.ps1 |
| `~/.tabby/` | Tabby server SQLite + state | tabby serve |
