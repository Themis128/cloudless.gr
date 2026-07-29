# Claude Desktop asset inventory for cloudless.gr

## Purpose

Track which Claude Desktop skills, MCP servers, and connectors should be migrated into the local cloudless.gr Deep Agent setup.

## Classification

Use one of:

- keep-as-skill
- migrate-as-mcp
- wrap-as-python-tool
- do-not-migrate
- needs-review

## Assets

### Skills

| Name | Current source | Target | Status | Notes |
|---|---|---|---|---|
| appflowy-operator | skills/appflowy-operator/SKILL.md | keep-as-skill | needs-review | Load only for AppFlowy questions |
| espocrm-operator | skills/espocrm-operator/SKILL.md | keep-as-skill | needs-review | Load only for EspoCRM questions |
| terraform-doctor | skills/terraform-doctor/SKILL.md | keep-as-skill | needs-review | Load for Terraform/IaC |
| cloudflare-tunnel-ops | skills/cloudflare-tunnel-ops/SKILL.md | keep-as-skill | needs-review | Requires token safety |

### MCP servers

| Name | Claude config | Target | Read-only? | Secrets? | Status |
|---|---|---|---:|---:|---|
| TBD | TBD | .deepagents/.mcp.json | TBD | TBD | needs-review |

### Connectors

| Name | Type | Target | Status | Notes |
|---|---|---|---|---|
| TBD | MCP/API/Claude-only | TBD | needs-review | TBD |

## MCP migration checklist

Before migrating any Claude Desktop MCP server into cloudless.gr Deep Agent config, verify:

- [ ] Server purpose is clear.
- [ ] Server is read-only or has write/destructive tools disabled.
- [ ] Server does not require production secrets in committed files.
- [ ] Required tokens are loaded from local environment only.
- [ ] Server does not duplicate existing Python tools.
- [ ] Server does not expose unrestricted shell access.
- [ ] Server does not expose unrestricted filesystem write access.
- [ ] Server does not mutate AWS, Cloudflare, Stripe, Cognito, or production data.
- [ ] Server has a rollback/removal path.
- [ ] Server is documented in this inventory.

## Initial migration decision

Do not create an active project `.mcp.json` yet.

Use `docs/agentic-migration/mcp-config-template.json` as the non-secret template.

For real local-only MCP config, prefer:

- `.deepagents/.mcp.json`

because `.deepagents/` is local/generated and should not be committed.
