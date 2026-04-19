# MCP Security Scanner

A lightweight static security scanner for MCP (Model Context Protocol) servers.

## Features

- 13 rule-based checks mapped to OWASP and MCP security classifications
- Detects missing authentication, authorization weaknesses, injection risks, secret exposure, prompt injection patterns, wildcard CORS, unsafe logging, and more
- Hybrid TypeScript CLI + Python prompt injection analyzer
- GitHub Actions workflow and VS Code task integration

## Installation

```bash
cd tools/mcp-security-scanner
npm install
```

## Usage

```bash
npm run scan -- --path "src/**/*.{ts,tsx,js,jsx,py,md}"
```

For JSON output:

```bash
npm run scan -- --json
```

To skip the Python prompt injection analyzer:

```bash
npm run scan -- --skip-python
```
