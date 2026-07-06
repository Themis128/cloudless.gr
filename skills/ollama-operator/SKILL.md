---
name: ollama-operator
description: |
  Use the local Ollama inference server from Amazon Q via the mcp-ollama-server
  MCP bridge. Triggered by phrases like "ask the local model", "use Ollama",
  "run qwen2.5-coder locally", "generate code with the local LLM",
  "what models are pulled", "pull a new model", "ollama is down",
  "local inference", or any task where you want to delegate to the on-device
  model instead of a cloud API.
---

# Ollama operator

The local Ollama instance runs as a systemd service on this machine and is
exposed to Amazon Q via the `mcp-ollama-server` MCP bridge in `mcp.json`.

## Architecture

```
Amazon Q (IDE plugin)
  └─ MCP client
       └─ mcp__ollama__* tools  (tools/mcp-ollama-server/src/index.ts)
            └─ HTTP → http://localhost:11434
                 └─ ollama.service  (systemctl)
                      └─ qwen2.5-coder:latest  (7.6B Q4_K_M, 32K ctx)
```

## Available MCP tools

| Tool | When to use |
|------|-------------|
| `mcp__ollama__ollama_chat` | Multi-turn reasoning, code review, Q&A with context |
| `mcp__ollama__ollama_generate` | Single-shot code generation, transformations |
| `mcp__ollama__ollama_list_models` | See what's pulled locally |
| `mcp__ollama__ollama_pull_model` | Pull a new model (streams, waits for completion) |
| `mcp__ollama__ollama_show_model` | Inspect model metadata / template |

## Quick usage patterns

### Ask the local model to write code

```
mcp__ollama__ollama_chat({
  prompt: "Write a TypeScript function that validates an email address",
  system: "You are an expert TypeScript developer. Return only the function, no explanation."
})
```

### Single-shot generation (faster)

```
mcp__ollama__ollama_generate({
  prompt: "Convert this Python dict to a TypeScript interface:\n{ name: str, age: int }",
  temperature: 0.0
})
```

### Multi-turn with history

```
mcp__ollama__ollama_chat({
  prompt: "Now add error handling to that function",
  history: [
    { role: "user", content: "Write a fetch wrapper" },
    { role: "assistant", content: "..." }
  ]
})
```

### Check what's available

```
mcp__ollama__ollama_list_models()
```

### Pull a new model

```
mcp__ollama__ollama_pull_model({ model: "llama3.1:8b" })
# Takes 5-10 min for a 4-5 GB model — the tool waits for completion
```

## Service management

```bash
# Status
systemctl status ollama

# Restart (if the API stops responding)
sudo systemctl restart ollama

# Logs
journalctl -u ollama -n 50 --no-pager

# Verify API is up
curl http://localhost:11434/api/tags
```

## Environment variables (mcp.json)

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `qwen2.5-coder` | Default model for all tools |
| `OLLAMA_TIMEOUT_MS` | `120000` | Per-request timeout (ms) |

Override in `mcp.json` → `ollama.env` to switch the default model globally,
or pass `model:` per-call to override for a single request.

## Current model: qwen2.5-coder:latest

- Parameters: 7.6B  
- Quantization: Q4_K_M  
- Context: 32 768 tokens  
- Capabilities: completion, **tools**, insert  
- Size on disk: ~4.4 GB  

The model supports tool-calling natively, which means `ollama_chat` can
be used for agentic loops where the model decides which tool to invoke.

## Switching models

To use a different model for a session without changing `mcp.json`:

```
# Pull it first
mcp__ollama__ollama_pull_model({ model: "deepseek-coder-v2:16b" })

# Then pass model: explicitly on each call
mcp__ollama__ollama_chat({ model: "deepseek-coder-v2:16b", prompt: "..." })
```

To change the default permanently, edit `mcp.json` → `ollama.env.OLLAMA_MODEL`
and restart the MCP server (reload Amazon Q).

## When NOT to use Ollama

- Tasks requiring internet access (web search, live data) → use cloud APIs
- Tasks needing >32K context → Ollama's context window is the limit
- Production API calls (contact form, Stripe, SES) → use the app's own routes
- Admin analytics queries → use `mcp__athena__*` or the admin API

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Error: fetch failed` / `ECONNREFUSED` | `sudo systemctl restart ollama` |
| `model not found` | `mcp__ollama__ollama_pull_model({ model: "..." })` |
| Response truncated | Increase `max_tokens` (up to 32768) |
| Slow first response | Normal — model loads into RAM on first call (~5s) |
| MCP tool not found | Reload Amazon Q; check `mcp.json` has `"ollama"` entry |

## Source files

- `tools/mcp-ollama-server/src/index.ts` — MCP server implementation
- `tools/mcp-ollama-server/package.json` — dependencies
- `mcp.json` → `ollama` entry — registration + env config
- `/home/tbaltzakis/ollama/` — DeepAgents + Ollama integration (separate project)
