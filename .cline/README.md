# Cline Integration

Ready-to-use configuration for Cline AI coding assistant.

## Quick Setup

```bash
# Register the model with Cline
./scripts/register-cline-model.sh
```

## Model Configuration

The configuration in `config.json` provides:

- **Provider**: Ollama (local LLM backend)
- **Model**: qwen2.5-coder (default)
- **Fallback models**: llama3.1, mistral
- **Tools**: All 11 ClineAdapter tools

## Available Models

| Name | Model | Description |
|------|-------|-------------|
| ollama-local | qwen2.5-coder | Primary coding model |
| ollama-llama3 | llama3.1 | Alternative model |
| ollama-mistral | mistral | Lightweight model |

## Available Tools

| Tool | Description |
|------|-------------|
| list_files | List project files |
| read_file | Read file content |
| write_file | Write to files |
| run_command | Execute shell commands |
| ask_agent | Query Ollama LLM |
| list_models | Show available models |
| pull_model | Download new models |
| check_ollama | Verify server status |
| search_files | Find files by pattern |
| get_file_info | Get file metadata |
| analyze_code | Analyze project structure |
| generate_test | Create test scaffolding |

## Manual Configuration

If automatic registration doesn't work:

1. Copy `.cline/config.json` to your Cline config directory
2. Ensure Ollama is running: `ollama serve`
3. Pull the model: `ollama pull qwen2.5-coder`
4. In Cline, select Ollama provider and use `http://localhost:11434`

## Project Context

The integration automatically provides context for:
- `/home/tbaltzakis/cloudless.gr` (Next.js 16 + Typescript)
- 8 DeepAgents skills
- 4 specialized subagents
- 8 Cloudflare skills (if configured)