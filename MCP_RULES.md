# MCP Server Usage Rules

This document defines when and how to use available MCP (Model Context Protocol) servers based on task requirements.

## Rule 1: Cloudflare MCP Server

**Use when:** Working with Cloudflare resources including Workers, Pages, KV, R2, D1, Containers, DNS, Load Balancer, Tunnel, or any Cloudflare platform feature.

**Specific triggers:**
- Cloudflare Tunnel configuration (`/etc/cloudflared/config.yml`)
- DNS record management
- Worker deployments
- R2/D1 database operations
- Load balancer setup
- WAF rules
- Turnstile/CAPTCHA

**Example commands:**
- `update cloudflare tunnel` - Configure ingress rules
- `check DNS records` - Verify tunnel routing
- `deploy worker` - Update edge functions

## Rule 2: Kubernetes MCP Server

**Use when:** Inspecting k3s cluster state, pods, deployments, services, or troubleshooting container workloads.

**Specific triggers:**
- k3s pod status checks
- Deployment health verification
- Service endpoints
- Namespace resource usage
- ConfigMap/secrets inspection
- Log retrieval from pods

**Example commands:**
- `get pods -A` - List all pods cluster-wide
- `describe pod <name>` - Troubleshoot pod issues
- `get deployments -n monitoring` - Check monitoring stack

## Rule 3: Sequential Thinking MCP Server

**Use when:** Complex multi-step problem solving, debugging cascading failures, or architectural analysis that requires step-by-step reasoning.

**Specific triggers:**
- Root cause analysis
- Multi-system troubleshooting
- Architecture planning
- Dependency chain analysis
- Performance optimization investigations

**Example use cases:**
- Diagnosing why tunnel → origin → app chain fails
- Planning service consolidation
- Analyzing audit failures to find underlying causes

## Rule 4: GitHub MCP Server

**Use when:** Managing repositories, issues, pull requests, workflows, or any GitHub operations.

**Specific triggers:**
- Workflow dispatch/runs
- Issue creation/comments
- PR management
- Repository settings
- Deployment status checks

**Example commands:**
- `gh workflow run` - Trigger CI/CD
- `gh issue comment` - Update tracking issues
- `gh pr create` - Submit changes

## Usage Priority

When multiple MCP servers could apply, choose in this order:

1. **Task-specific MCP** (Cloudflare for tunnel work, Kubernetes for cluster issues)
2. **Sequential thinking** for complex debugging
3. **GitHub** for workflow/automation integration

## Error Recovery Pattern

If an MCP server returns errors:
1. Check the error type (connection timeout, auth failure, resource not found)
2. Use sequential thinking to plan next steps
3. Fall back to GitHub workflow triggers if direct access fails
4. Document findings in tracking issues

## Current Available MCPs (from mcp.json)

- **Kubernetes**: Full cluster access via kubeconfig
- **Sequential Thinking**: Multi-step reasoning engine
- **Cloudflare**: Tunnel and DNS management (requires CLOUDFLARE_API_TOKEN)