# MCP Server Usage Rules

## Purpose
Rules for MCP server activation and usage patterns based on task categories.

## Server Rules Matrix

| MCP Server | AutoStart | Trigger Conditions |
|------------|-----------|-------------------|
| `github-mcp-server` | false | PR workflow, issue operations, code review |
| `mcp-server-kubernetes` | false | k3s cluster ops, pod status, node queries |
| `sequentialthinking` | false | Troubleshooting, root cause analysis |
| `cloudless-infra` | false | SSH ops on omv-main |
| `athena` | false | Data lake queries |
| `cognito-setup` | false | Auth configuration |
| `ollama` | true | Local LLM inference |
| `project` | true | Task/project management |
| `langsmith` | true | AI tracing/debugging |

## Activation Patterns

### GitHub Operations
Use when: PR creation, issue management, CI status checks, repository ops

### Kubernetes/Cluster
Use when: k3s diagnostics, pod/service troubleshooting, node inspection

### Sequential Thinking
Use when: Complex investigation, multi-step analysis, architecture planning

### SSH/Infra
Use when: Direct host access, system logs, configuration changes
