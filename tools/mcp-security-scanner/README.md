# MCP Security Scanner

A lightweight static security scanner for MCP (Model Context Protocol) servers.

## Features

- 13 rule-based checks mapped to OWASP and MCP security classifications
- Detects missing authentication, authorization weaknesses, injection risks, secret exposure, prompt injection patterns, wildcard CORS, unsafe logging, and more
- Hybrid TypeScript CLI + Python prompt injection analyzer
- GitHub Actions workflow and VS Code task integration
- JSON output mode for CI pipelines

## Installation

```bash
cd tools/mcp-security-scanner
npm install
```

## Usage

```bash
# Scan with default glob pattern
npm run scan

# Scan a custom path
npm run scan -- --path "src/**/*.{ts,tsx,js,jsx,py,md}"

# JSON output (exits with code 1 when findings exist)
npm run scan -- --json

# Skip the Python prompt injection analyzer
npm run scan -- --skip-python
```

From the project root:

```bash
pnpm mcp-security-scan
```

## Testing

```bash
npm test
```

Runs 31 tests covering:

- **Helper detection** -- `isServerRoute`, `hasAuthGuard`, `hasRateLimit`
- **Rules integrity** -- all 13 rules load, have required fields, and compile valid regex patterns
- **Per-rule scanning** -- each rule triggers on representative input and stays silent on clean code
- **Line number accuracy** -- findings report the correct source line

## Rules

| ID | Name | Severity | OWASP |
|----|------|----------|-------|
| mcp-001 | Missing authentication guard | critical | A1 |
| mcp-002 | Missing authorization check | high | A2 |
| mcp-003 | Command injection (shell) | critical | A4 |
| mcp-004 | Template string injection | high | A4 |
| mcp-005 | Path traversal risk | high | A4 |
| mcp-006 | Hardcoded secrets | critical | A3 |
| mcp-007 | Exposed env/config keys | high | A3 |
| mcp-008 | Prompt injection directive | high | MCP-2 |
| mcp-009 | Prompt injection pattern | medium | MCP-2 |
| mcp-010 | Missing rate limiting | medium | A6 |
| mcp-011 | Wildcard CORS | high | A6 |
| mcp-012 | Unvalidated redirect | medium | A4 |
| mcp-013 | Unsafe logging | low | A3 |

## Architecture

```
src/
  index.ts        CLI entrypoint (commander + chalk formatting)
  scanner.ts      Core scan logic (importable, testable)
  rules.ts        Rule definitions with regex patterns
  types.ts        TypeScript interfaces (Rule, Finding)
  scanner.test.ts Unit tests (vitest)
py/
  prompt_injection_analyzer.py   Python-based prompt injection analysis
```
