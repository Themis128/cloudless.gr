# Security Implementation Plan: GitHub AW Patterns for cloudless.gr

## Executive Summary

This document maps GitHub Agentic Workflows (AW) security architecture patterns to cloudless.gr's existing security posture. It identifies gaps, proposes mitigations, and provides a prioritized implementation plan for defense-in-depth security around MCP servers, AI agents, and workflow automation.

**Current MCP Landscape:**

- 17 MCP servers configured in `mcp.json`
- Mix of local (`ollama`, `cloudless-infra`, `sequentialthinking`, `filesystem`) and remote (`cloudflare-*`, `github.com/github-mcp-server`, `playwright`, `brave-search`) servers
- Credentials injected via environment variables
- No runtime isolation, content sanitization, or output validation

**Risk Assessment:**

- **High Risk:** GitHub MCP server with full repo access, Cloudflare MCP with infrastructure control, filesystem MCP with project root access
- **Medium Risk:** Kubernetes/SSH MCP with cluster control, network-exposed MCP servers
- **Low Risk:** Local inference (ollama), sequential thinking (no external access)

---

## Gap Analysis: GitHub AW vs. cloudless.gr

### Layer 1: Substrate-Level Trust

| GitHub AW Pattern | cloudless.gr Status | Gap |
|-------------------|---------------------|-----|
| Container isolation for MCP servers | ❌ None | MCP servers run as direct subprocesses or remote HTTP endpoints with no sandboxing |
| Network egress control (Squid proxy) | ❌ None | Unrestricted outbound access from MCP clients |
| Resource limits (CPU/memory) | ❌ None | No cgroups or resource constraints |
| Host filesystem isolation | ⚠️ Partial | `filesystem` MCP scoped to `/home/tbaltzakis/cloudless.gr`, but no read-only mounts |

**Recommendation:** Implement MCP server containerization using Docker/Podman with:

- Per-server network namespaces
- Domain allowlists via proxy
- Resource quotas (CPU/memory limits)
- Read-only root filesystem where possible

### Layer 2: Configuration-Level Trust

| GitHub AW Pattern | cloudless.gr Status | Gap |
|-------------------|---------------------|-----|
| Schema validation for MCP config | ❌ None | `mcp.json` has no schema enforcement |
| Tool allowlisting | ❌ None | All tools exposed by MCP servers are usable |
| Credential scoping | ⚠️ Partial | Env vars injected, but no per-tool credential binding |
| Action pinning (SHAs) | ❌ None | No integrity verification for MCP server binaries/packages |

**Recommendation:** Add `mcp.schema.json` validation, per-server `allowedTools` arrays, and package integrity checks.

### Layer 3: Plan-Level Trust

| GitHub AW Pattern | cloudless.gr Status | Gap |
|-------------------|---------------------|-----|
| SafeOutputs (buffer writes) | ❌ None | MCP tools execute write operations immediately |
| Content sanitization | ⚠️ Partial | `escapeHtml()` for emails only, no input sanitization for AI |
| Secret redaction | ❌ None | No artifact scanning before upload/logging |
| Threat detection | ❌ None | No AI-powered analysis of MCP outputs |
| Stage gating | ❌ None | No multi-stage approval workflows |

**Recommendation:** Implement artifact buffering, input sanitization pipeline, and output threat detection.

---

## Threat Model (cloudless.gr Context)

### Adversary Capabilities

1. **Compromised MCP server** - Malicious or compromised MCP server (e.g., forked `github-mcp-server`)
2. **Prompt injection** - User input containing hidden instructions to manipulate agent behavior
3. **Credential exfiltration** - Stolen env vars or SSM secrets via MCP tool outputs
4. **Lateral movement** - Using one MCP server's access to pivot to others
5. **Supply chain attack** - Malicious code in MCP server dependencies

### Assets to Protect

- GitHub repository tokens (`GITHUB_PERSONAL_ACCESS_TOKEN`)
- Cloudflare API token (`CLOUDFLARE_API_TOKEN`)
- AWS credentials (SSM Parameter Store access)
- Kubernetes cluster credentials (`kubectl` context)
- SSH keys (`OMV_SSH_KEY`)
- Customer data (EspoCRM, Stripe, Notion)
- Infrastructure state (DNS, Workers, Traefik configs)

---

## Security Implementation Plan

### Phase 1: Immediate (Week 1-2) - High-Risk Mitigations

#### 1.1 MCP Server Tool Allowlisting & Schema Validation

**Priority:** Critical  
**Effort:** Low  
**Risk:** High (GitHub MCP has destructive tools)

**Implementation:**

**Step 1: Create `mcp.schema.json` for configuration validation**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MCP Server Configuration Schema",
  "type": "object",
  "required": ["mcpServers"],
  "properties": {
    "mcpServers": {
      "type": "object",
      "patternProperties": {
        "^[a-z0-9-]+$": {
          "type": "object",
          "required": ["command", "args"],
          "properties": {
            "command": { "type": "string" },
            "args": { "type": "array", "items": { "type": "string" } },
            "env": { "type": "object", "patternProperties": { "^[A-Z_]+$": { "type": "string" } } },
            "autoStart": { "type": "boolean" },
            "cwd": { "type": "string" },
            "type": { "enum": ["stdio", "http"], "default": "stdio" },
            "url": { "type": "string", "format": "uri" }
          },
          "oneOf": [
            { "required": ["command"] },
            { "required": ["url"] }
          ]
        }
      },
      "additionalProperties": false
    }
  }
}
```

**Step 2: Add validation script (`scripts/validate-mcp-config.ts`)**

```typescript
import { readFileSync } from 'fs';

export function validateMCPConfig(configPath: string): void {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  // Basic schema validation
  if (typeof config.mcpServers !== 'object') {
    throw new Error('Invalid mcp.json: missing mcpServers');
  }
  
  // Check for required fields
  for (const [name, server] of Object.entries(config.mcpServers)) {
    if (!server.command && !server.url) {
      throw new Error(`Server ${name}: must have command or url`);
    }
    if (server.command && !Array.isArray(server.args)) {
      throw new Error(`Server ${name}: args must be array`);
    }
  }
  
  console.log(`✓ Validated ${Object.keys(config.mcpServers).length} MCP servers`);
}
```

**Step 3: Create `mcp-security.json` with tool allowlists**

```json
{
  "version": "1.0",
  "globalDefaults": {
    "denyUnlistedTools": false,
    "logAllToolCalls": true,
    "requireApprovalForWrites": true,
    "maxConcurrency": 3,
    "timeoutMs": 30000
  },
  "servers": {
    "github.com/github-mcp-server": {
      "allowedTools": [
        "issue_read", "issue_write",
        "list_commits", "search_code",
        "create_pull_request", "add_comment",
        "list_ull_requests"
      ],
      "deniedTools": [
        "delete_repository",
        "update_branch_protection",
        "remove_collaborator",
        "delete_issue"
      ],
      "requireApproval": ["create_pull_request", "issue_write"]
    },
    "cloudflare": {
      "allowedTools": [
        "list_dns_records", "create_dns_record", "update_dns_record",
        "list_workers", "deploy_worker",
        "get_kv_namespace", "put_kv_namespace"
      ],
      "deniedTools": [
        "delete_zone",
        "remove_worker"
      ]
    },
    "kubernetes": {
      "allowedTools": [
        "list_pods", "get_pod", "get_logs",
        "list_deployments", "scale_deployment",
        "describe_resource"
      ],
      "deniedTools": [
        "delete_namespace",
        "delete_pod",
        "exec_command"
      ]
    },
    "cloudless-infra": {
      "allowedTools": [
        "ssh_exec", "ssh_upload", "ssh_download"
      ],
      "deniedTools": [
        "ssh_exec_sudo",
        "ssh_exec_systemctl"
      ],
      "commandAllowlist": [
        "kubectl get *",
        "kubectl describe *",
        "kubectl logs *",
        "kubectl top *",
        "systemctl status *",
        "journalctl -u *"
      ]
    },
    "filesystem": {
      "allowedTools": ["read_file", "list_directory", "search_files"],
      "deniedTools": ["write_file", "delete_file", "move_file"],
      "pathAllowlist": ["/home/tbaltzakis/cloudless.gr"],
      "pathDenylist": [
        "/home/tbaltzakis/.ssh",
        "/home/tbaltzakis/.aws",
        "/home/tbaltzakis/.config"
      ]
    }
  }
}
```

**Enforcement mechanism:** Wrap MCP tool calls with a security interceptor.

**Code Pattern:**

```typescript
// src/lib/mcp-security.ts

interface MCPSecurityPolicy {
  allowedTools?: string[];
  deniedTools?: string[];
  requireApproval?: string[];
  commandAllowlist?: string[];
  pathAllowlist?: string[];
  pathDenylist?: string[];
}

const securityPolicies: Record<string, MCPSecurityPolicy> = {
  // Load from mcp-security.json
};

export function validateMCPToolCall(
  serverName: string,
  toolName: string,
  args: Record<string, any>
): void {
  const policy = securityPolicies[serverName];
  if (!policy) return; // No restrictions

  // Check denied tools
  if (policy.deniedTools?.includes(toolName)) {
    throw new Error(`Tool ${toolName} is denied for ${serverName}`);
  }

  // Check allowed tools (if defined)
  if (policy.allowedTools && !policy.allowedTools.includes(toolName)) {
    throw new Error(`Tool ${toolName} is not in allowlist for ${serverName}`);
  }

  // Path validation for filesystem MCP
  if (serverName === "filesystem") {
    const path = args.path || args.target;
    if (path) {
      const resolved = resolvePath(path);
      if (policy.pathDenylist?.some(p => resolved.startsWith(p))) {
        throw new Error(`Access to ${path} is denied`);
      }
    }
  }

  // Command validation for SSH MCP
  if (serverName === "cloudless-infra" && args.command) {
    const allowed = policy.commandAllowlist?.some(pattern => 
      matchGlob(pattern, args.command)
    );
    if (!allowed) {
      throw new Error(`Command not allowed: ${args.command}`);
    }
  }
}
```

#### 1.2 Content Sanitization for AI Inputs

**Priority:** Critical  
**Effort:** Medium  
**Risk:** High (prompt injection, data exfiltration)

**Implementation:**

Create `src/lib/mcp-sanitizer.ts`:

```typescript
export interface SanitizationConfig {
  maxSize: number; // bytes
  maxLines: number;
  allowedDomains: string[];
  neutralizeMentions: boolean;
  neutralizeBotTriggers: boolean;
  stripControlChars: boolean;
  normalizeUnicode: boolean;
}

const DEFAULT_CONFIG: SanitizationConfig = {
  maxSize: 500 * 1024, // 500KB
  maxLines: 65000,
  allowedDomains: [
    "github.com",
    "api.github.com",
    "raw.githubusercontent.com",
    "cloudless.gr",
    "api.cloudflare.com",
    "docs.cloudflare.com"
  ],
  neutralizeMentions: true,
  neutralizeBotTriggers: true,
  stripControlChars: true,
  normalizeUnicode: true
};

export function sanitizeForAI(input: string, config = DEFAULT_CONFIG): string {
  let output = input;

  // 1. Size limits
  if (output.length > config.maxSize) {
    output = output.slice(0, config.maxSize) + "\n...[truncated]";
  }

  // 2. Line limits
  const lines = output.split('\n');
  if (lines.length > config.maxLines) {
    output = lines.slice(0, config.maxLines).join('\n') + '\n...[truncated]';
  }

  // 3. Neutralize @mentions
  if (config.neutralizeMentions) {
    output = output.replace(/@(\w+)/g, '`@$1`');
  }

  // 4. Neutralize bot triggers
  if (config.neutralizeBotTriggers) {
    output = output.replace(/(?:close|fix|resolve|ref)\s+#(\d+)/gi, '`$1`');
  }

  // 5. Convert XML/HTML tags to safe format
  output = output.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, '($1)');

  // 6. Filter URIs
  output = output.replace(
    /https?:\/\/[^\s)]+/gi,
    (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' && 
            config.allowedDomains.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
          return url;
        }
      } catch {}
      return '(redacted)';
    }
  );

  // 7. Strip control characters
  if (config.stripControlChars) {
    output = output.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  }

  // 8. Normalize Unicode (detect homoglyphs)
  if (config.normalizeUnicode) {
    output = normalizeUnicode(output);
  }

  return output;
}

function normalizeUnicode(text: string): string {
  // Catch common homoglyph attacks
  const homoglyphs: Record<string, string> = {
    '\u0430': 'a', // Cyrillic
    '\u0435': 'e',
    '\u03BF': 'o', // Greek
    '\u03C0': 'p',
  };
  
  return text.replace(/[\u0430\u0435\u03BF\u03C0]/g, (char) => homoglyphs[char] || char);
}
```

**Usage in MCP wrapper:**

```typescript
export async function callMCPTool(
  serverName: string,
  toolName: string,
  args: any
): Promise<any> {
  // 1. Validate against policy
  validateMCPToolCall(serverName, toolName, args);

  // 2. Sanitize string inputs
  const sanitizedArgs = Object.fromEntries(
    Object.entries(args).map(([k, v]) => [
      k, 
      typeof v === 'string' ? sanitizeForAI(v) : v
    ])
  );

  // 3. Execute with sanitized inputs
  return await executeTool(serverName, toolName, sanitizedArgs);
}
```

#### 1.3 Secret Redaction Pipeline

**Priority:** High  
**Effort:** Low  
**Risk:** Medium (credential leakage in logs/artifacts)

**Implementation:**

Create `src/lib/secret-redactor.ts`:

```typescript
export function redactSecrets(content: string): string {
  const config = getIntegrations();
  const secrets: string[] = [];
  
  // Collect all secret values
  Object.entries(config).forEach(([key, value]) => {
    if (value && value.length > 3) {
      secrets.push(value);
    }
  });

  // Also check env vars
  Object.entries(process.env).forEach(([key, value]) => {
    if (key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY')) {
      if (value && value.length > 3) {
        secrets.push(value);
      }
    }
  });

  // Redact each secret (exact match, no regex to avoid injection)
  let redacted = content;
  secrets.forEach(secret => {
    const masked = secret.slice(0, 3) + '*****';
    redacted = redacted.split(secret).join(masked);
  });

  return redacted;
}

export async function redactArtifacts(dir: string): Promise<void> {
  const files = await glob('**/*.{txt,json,log,md,yml}', { cwd: dir });
  
  for (const file of files) {
    const content = await fs.readFile(path.join(dir, file), 'utf-8');
    const redacted = redactSecrets(content);
    await fs.writeFile(path.join(dir, file), redacted);
  }
}
```

**Usage in workflow (if using GitHub Actions):**

```yaml
- name: Redact secrets from artifacts
  run: npx tsx src/lib/secret-redactor.ts /tmp/gh-aw
  if: always()
```

#### 1.4 SafeOutputs: Write Operation Buffering

**Priority:** Critical  
**Effort:** Medium  
**Risk:** High (immediate writes bypass review)

**Implementation:**

Create `src/lib/mcp-safe-outputs.ts` implementing the GitHub AW SafeOutputs pattern where write operations are buffered as artifacts rather than executed immediately:

```typescript
export interface BufferedAction {
  id: string;
  serverName: string;
  toolName: string;
  args: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  approvalRequired: boolean;
}

export class SafeOutputsBuffer {
  private artifacts: Map<string, BufferedAction[]> = new Map();
  private maxActionsPerStage = 10;

  bufferAction(sessionId: string, action: Omit<BufferedAction, 'id' | 'timestamp' | 'status'>): string {
    const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const buffered: BufferedAction = {
      ...action,
      id,
      timestamp: Date.now(),
      status: action.approvalRequired ? 'pending' : 'approved'
    };

    const sessionActions = this.artifacts.get(sessionId) || [];
    
    // Enforce limits
    if (sessionActions.length >= this.maxActionsPerStage) {
      throw new Error(`Max ${this.maxActionsPerStage} buffered actions per stage`);
    }
    
    sessionActions.push(buffered);
    this.artifacts.set(sessionId, sessionActions);
    
    return id;
  }

  getSessionActions(sessionId: string): BufferedAction[] {
    return this.artifacts.get(sessionId) || [];
  }

  approveAction(sessionId: string, actionId: string): void {
    const actions = this.artifacts.get(sessionId) || [];
    const action = actions.find(a => a.id === actionId);
    if (action) {
      action.status = 'approved';
    }
  }

  async executeApproved(sessionId: string): Promise<void> {
    const actions = this.artifacts.get(sessionId) || [];
    const approved = actions.filter(a => a.status === 'approved');
    
    // Structural constraint: max writes per stage
    if (approved.length > 5) {
      throw new Error('Max 5 write operations per stage');
    }

    for (const action of approved) {
      try {
        await executeTool(action.serverName, action.toolName, action.args);
        action.status = 'executed';
      } catch (error) {
        action.status = 'rejected';
        throw error;
      }
    }
  }

  exportArtifact(sessionId: string): string {
    const actions = this.artifacts.get(sessionId) || [];
    return JSON.stringify(actions, null, 2);
  }
}

// Singleton instance
export const safeOutputs = new SafeOutputsBuffer();
```

**Integration with MCP wrapper:**

```typescript
export async function callMCPToolWithSafeOutputs(
  serverName: string,
  toolName: string,
  args: any,
  sessionId: string
): Promise<any> {
  const isWriteOperation = this.isWriteTool(toolName);
  
  if (isWriteOperation) {
    // Buffer instead of executing
    const actionId = safeOutputs.bufferAction(sessionId, {
      serverName,
      toolName,
      args,
      sessionId,
      approvalRequired: this.requiresApproval(toolName),
      userId: context.userId
    });
    
    return {
      buffered: true,
      actionId,
      message: 'Write operation buffered for approval'
    };
  }
  
  // Read operations execute immediately
  return await executeTool(serverName, toolName, args);
}

private isWriteTool(toolName: string): boolean {
  const writeTools = [
    'create_pull_request', 'create_issue', 'add_comment',
    'update_dns_record', 'deploy_worker', 'write_file'
  ];
  return writeTools.includes(toolName);
}
```

**Stage gating pattern:**

```typescript
export async function executeWorkflowStage(stage: WorkflowStage): Promise<void> {
  // 1. Execute read-only MCP operations
  for (const step of stage.readSteps) {
    await callMCPToolWithSafeOutputs(step.server, step.tool, step.args, stage.sessionId);
  }
  
  // 2. Validate buffered writes
  const pendingActions = safeOutputs.getSessionActions(stage.sessionId)
    .filter(a => a.status === 'pending');
  
  if (pendingActions.length > 0) {
    // Require human approval
    const approved = await requestHumanApproval(pendingActions);
    pendingActions.forEach(action => {
      if (approved.includes(action.id)) {
        safeOutputs.approveAction(stage.sessionId, action.id);
      }
    });
  }
  
  // 3. Execute approved writes
  await safeOutputs.executeApproved(stage.sessionId);
  
  // 4. Validate outputs before next stage
  const artifact = safeOutputs.exportArtifact(stage.sessionId);
  const validation = await validateArtifact(artifact);
  
  if (!validation.valid) {
    throw new Error(`Artifact validation failed: ${validation.errors.join(', ')}`);
  }
}
```

---

### Phase 2: Near-Term (Week 3-4) - Medium-Risk Mitigations

#### 2.1 MCP Server Containerization

**Priority:** Medium  
**Effort:** High  
**Risk:** Medium (operational complexity)

**Implementation:**

Create Docker Compose for MCP gateways:

```yaml
# docker-compose.mcp.yml
version: '3.8'

services:
  mcp-github:
    image: ghcr.io/github/github-mcp-server:latest
    container_name: mcp-github
    environment:
      - GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_PERSONAL_ACCESS_TOKEN}
    read_only: true
    tmpfs:
      - /tmp
    networks:
      - mcp-network
    security_opt:
      - no-new-privileges
    deploy:
      resources:
        limits:
          memory: 256m
          cpus: '0.5'

  mcp-cloudflare:
    image: cloudflare/cloudflare-mcp-server:latest
    container_name: mcp-cloudflare
    environment:
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
    read_only: true
    networks:
      - mcp-network
    security_opt:
      - no-new-privileges

  squid-proxy:
    image: ubuntu/squid:latest
    container_name: mcp-proxy
    volumes:
      - ./squid.conf:/etc/squid/squid.conf
    networks:
      - mcp-network
    ports:
      - "3128:3128"

networks:
  mcp-network:
    driver: bridge
    internal: true  # No external access
```

#### 2.2 Package Integrity Verification for MCP Servers

**Priority:** High  
**Effort:** Low  
**Risk:** High (supply chain attacks)

**Implementation:**

Create `scripts/verify-mcp-integrity.ts`:

```typescript
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

interface IntegrityManifest {
  version: string;
  servers: {
    [name: string]: {
      command: string;
      expectedHash: string;
      allowedPaths: string[];
      lastVerified: string;
    };
  };
}

export function verifyMCPIntegrity(
  configPath: string,
  manifestPath: string
): void {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const manifest: IntegrityManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  for (const [name, server] of Object.entries(config.mcpServers)) {
    const serverManifest = manifest.servers[name];
    if (!serverManifest) {
      console.warn(`⚠ No integrity manifest for ${name}`);
      continue;
    }
    
    // Verify command path matches manifest
    if (server.command !== serverManifest.command) {
      throw new Error(`Integrity violation: ${name} command mismatch`);
    }
    
    // For local servers, verify binary hash
    if (server.command && !server.command.includes('npx')) {
      const binaryPath = resolveBinaryPath(server.command, server.args);
      const actualHash = createHash('sha256')
        .update(readFileSync(binaryPath))
        .digest('hex');
      
      if (actualHash !== serverManifest.expectedHash) {
        throw new Error(`Integrity violation: ${name} binary hash mismatch`);
      }
    }
    
    console.log(`✓ Verified integrity for ${name}`);
  }
}
```

**Generate integrity manifest:**

```bash
# scripts/generate-mcp-manifest.ts
export function generateManifest(configPath: string): IntegrityManifest {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const manifest: IntegrityManifest = {
    version: '1.0',
    servers: {}
  };

  for (const [name, server] of Object.entries(config.mcpServers)) {
    if (server.command === 'npx') {
      const pkg = server.args[0];
      const version = getInstalledPackageVersion(pkg);
      manifest.servers[name] = {
        command: server.command,
        expectedHash: version,
        allowedPaths: [`^${version.split('.')[0]}`],
        lastVerified: new Date().toISOString()
      };
    }
  }
  
  return manifest;
}
```

#### 2.3 Secret Injection via Secure Env

**Priority:** Medium  
**Effort:** Medium  
**Risk:** Medium

**Implementation:**

Avoid plaintext env vars in `mcp.json`. Use:

1. **Docker secrets** (for containerized MCP):

```yaml
services:
  mcp-github:
    secrets:
      - github_token
    environment:
      - GITHUB_PERSONAL_ACCESS_TOKEN_FILE=/run/secrets/github_token

secrets:
  github_token:
    file: ./secrets/github_token.txt
```

2. **Kubernetes Secrets** (for k3s-hosted MCP):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-github-token
type: Opaque
stringData:
  token: ${GITHUB_PERSONAL_ACCESS_TOKEN}
```

3. **Runtime injection only** - Never write secrets to disk:

```typescript
// src/lib/mcp-runtime.ts
export function injectMCPServerSecrets(serverName: string): Record<string, string> {
  const config = getIntegrations();
  const secrets: Record<string, string> = {};

  switch (serverName) {
    case 'github.com/github-mcp-server':
      secrets['GITHUB_PERSONAL_ACCESS_TOKEN'] = config.GITHUB_PERSONAL_ACCESS_TOKEN || '';
      break;
    case 'cloudflare':
      secrets['CLOUDFLARE_API_TOKEN'] = process.env.CLOUDFLARE_API_TOKEN || '';
      break;
    case 'cloudless-infra':
      secrets['OMV_SSH_KEY'] = process.env.OMV_SSH_KEY || '';
      break;
  }

  return secrets;
}
```

---

### Phase 3: Long-Term (Month 2+) - Advanced Controls

#### 3.1 Compilation-Time Security Validation

**Priority:** Medium  
**Effort:** Medium  
**Risk:** Medium (misconfigurations)

**Implementation:**

Create `scripts/compile-mcp-security.ts` (inspired by GitHub AW's `gh aw compile`):

```typescript
import { readFileSync, writeFileSync } from 'fs';

export function compileMCPConfig(configPath: string): void {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  // 1. Schema validation
  validateSchema(config);
  
  // 2. Check for dangerous defaults
  checkDangerousDefaults(config);
  
  // 3. Verify tool allowlists are non-empty
  verifyAllowlists(config);
  
  // 4. Check credential distribution
  auditCredentialDistribution(config);
  
  // 5. Generate lock file
  const lockFile = generateLockFile(config);
  writeFileSync('mcp.lock.json', JSON.stringify(lockFile, null, 2));
  
  console.log('✓ MCP config compiled successfully');
}

interface LockFile {
  version: string;
  generatedAt: string;
  servers: {
    [name: string]: {
      tools: string[];
      deniedTools: string[];
      requiresApproval: string[];
      integrity: {
        command: string;
        hash: string;
      };
    };
  };
}

function validateSchema(config: any): void {
  // Implement JSON Schema validation using Ajv
  // Reject configs with missing required fields, invalid types, disallowed properties
}

function checkDangerousDefaults(config: any): void {
  const dangerousPatterns = [/\*/, /all/, /admin/];
  
  for (const [name, server] of Object.entries(config.mcpServers)) {
    if (server.allowedTools?.some(t => dangerousPatterns.some(p => p.test(t)))) {
      console.warn(`⚠ ${name}: Overly permissive tool allowlist`);
    }
  }
}

function verifyAllowlists(config: any): void {
  for (const [name, server] of Object.entries(config.mcpServers)) {
    const highRisk = ['github.com/github-mcp-server', 'cloudless-infra'];
    if (highRisk.includes(name)) {
      if (!server.deniedTools || server.deniedTools.length === 0) {
        throw new Error(`${name} must have deniedTools for high-risk server`);
      }
    }
  }
}

function auditCredentialDistribution(config: any): void {
  const serversWithCreds = Object.entries(config.mcpServers)
    .filter(([_, s]) => s.env)
    .map(([name, _]) => name);
  
  if (serversWithCreds.length > 5) {
    console.warn(`⚠ ${serversWithCreds.length} servers have credentials`);
  }
}

function generateLockFile(config: any): LockFile {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    servers: Object.fromEntries(
      Object.entries(config.mcpServers).map(([name, server]) => [
        name,
        {
          tools: server.allowedTools || [],
          deniedTools: server.deniedTools || [],
          requiresApproval: server.requireApproval || [],
          integrity: {
            command: server.command || server.url,
            hash: computeHash(server)
          }
        }
      ])
    )
  };
}
```

**Add security scanners:**

```typescript
export function runSecurityScanners(configPath: string): SecurityReport {
  const report: SecurityReport = {
    passed: true,
    issues: []
  };

  checkExpressionSafety(configPath);
  checkWildcardPatterns(config);
  checkCredentialExposure(config);
  checkNetworkExposure(config);
  
  return report;
}

interface SecurityReport {
  passed: boolean;
  issues: Array<{
    severity: 'error' | 'warning';
    message: string;
    server?: string;
  }>;
}
```

**CI/CD integration:**

```yaml
# .github/workflows/mcp-security.yml
name: MCP Security Scan

on:
  push:
    paths:
      - 'mcp.json'
      - 'mcp-security.json'
  pull_request:
    paths:
      - 'mcp.json'
      - 'mcp-security.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate MCP config schema
        run: npx tsx scripts/validate-mcp-config.ts mcp.json
      
      - name: Compile security config
        run: npx tsx scripts/compile-mcp-security.ts mcp.json
      
      - name: Verify package integrity
        run: npx tsx scripts/verify-mcp-integrity.ts mcp.json mcp-integrity.json
      
      - name: Run security scanners
        run: npx tsx scripts/scan-mcp-security.ts mcp.json
```

#### 3.2 Threat Detection Pipeline

**Priority:** Low (AI-assisted)  
**Effort:** High  
**Risk:** Low (detective control)

**Implementation:**

Create `src/lib/mcp-threat-detection.ts`:

```typescript
export interface ThreatReport {
  safe: boolean;
  threats: string[];
  severity: 'low' | 'medium' | 'high';
  details: string;
}

export async function analyzeMCPOutput(
  serverName: string,
  toolName: string,
  output: any,
  context: MCPContext
): Promise<ThreatReport> {
  const prompt = `You are a security analyzer for MCP tool outputs.
  
Analyze this output for threats:

Server: ${serverName}
Tool: ${toolName}
Output: ${JSON.stringify(output, null, 2)}
Context: ${JSON.stringify(context, null, 2)}

Check for:
1. Secret leakage (API keys, tokens, passwords)
2. Suspicious patterns (backdoors, obfuscated code)
3. Privilege escalation attempts
4. Data exfiltration (unexpected external URLs)
5. Policy violations (accessing denied resources)

Respond with JSON:
{
  "safe": boolean,
  "threats": string[],
  "severity": "low" | "medium" | "high",
  "details": string
}`;

  const response = await invokeSecurityModel(prompt);
  return JSON.parse(response) as ThreatReport;
}

export async function invokeSecurityModel(prompt: string): Promise<string> {
  // Use a separate, security-focused model instance
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
  
  const client = new BedrockRuntimeClient({ region: "us-east-1" });
  
  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body);
  return body.content[0].text;
}
```

**Usage:**

```typescript
export async function callMCPToolWithDetection(...) {
  const result = await callMCPTool(serverName, toolName, args);
  
  // Analyze output before returning
  const report = await analyzeMCPOutput(serverName, toolName, result, {
    userId: context.userId,
    sessionId: context.sessionId,
    timestamp: Date.now()
  });

  if (!report.safe) {
    logger.warn('MCP threat detected', { report, serverName, toolName });
    throw new Error(`MCP output blocked: ${report.threats.join(', ')}`);
  }

  return result;
}
```

#### 3.3 Integrity Filtering

**Priority:** Low  
**Effort:** Medium  
**Risk:** Low

**Implementation:**

Filter MCP content based on source trust:

```typescript
export enum IntegrityLevel {
  NONE = 'none',
  UNAPPROVED = 'unapproved',
  APPROVED = 'approved',
  MERGED = 'merged'
}

export function filterMCPContentByIntegrity(
  content: any,
  level: IntegrityLevel,
  trustedUsers: string[]
): any {
  if (level === IntegrityLevel.NONE) return content;

  if (Array.isArray(content)) {
    return content.filter(item => {
      const author = item.user?.login;
      const isApproved = item.labels?.some(l => 
        l.name === 'approved' || l.name === 'ship-it'
      );
      const isMerged = item.merged_at !== null;

      switch (level) {
        case IntegrityLevel.MERGED:
          return isMerged;
        case IntegrityLevel.APPROVED:
          return isMerged || isApproved || trustedUsers.includes(author);
        case IntegrityLevel.UNAPPROVED:
          return trustedUsers.includes(author);
        default:
          return true;
      }
    });
  }

  return content;
}
```

---

## Prioritized Action Items

### Critical (Week 1-2)

- [ ] **1.1** Implement MCP tool allowlisting & schema validation
  - Files: `mcp.schema.json`, `mcp-security.json`, `scripts/validate-mcp-config.ts`
  - Effort: 1 day
  - Impact: Prevents destructive operations and config errors

- [ ] **1.2** Deploy input sanitization for all MCP string inputs
  - File: `src/lib/mcp-sanitizer.ts`
  - Effort: 1 day
  - Impact: Mitigates prompt injection

- [ ] **1.3** Add secret redaction to logging pipeline
  - File: `src/lib/secret-redactor.ts`
  - Effort: 4 hours
  - Impact: Prevents credential leakage

- [ ] **1.4** Implement SafeOutputs buffering for write operations
  - File: `src/lib/mcp-safe-outputs.ts`
  - Effort: 2 days
  - Impact: Enables approval workflows

### High (Week 3-4)

- [ ] **2.1** Implement MCP security interceptor layer
  - File: `src/lib/mcp-security.ts`
  - Effort: 2 days
  - Impact: Centralizes all security checks

- [ ] **2.2** Add path/command allowlists for sensitive MCP servers
  - File: `mcp-security.json` extensions
  - Effort: 1 day
  - Impact: Limits SSH/K8s blast radius

- [ ] **2.3** Add MCP call audit logging
  - File: `src/lib/mcp-audit.ts`
  - Effort: 1 day
  - Impact: Forensic capability

### Medium (Month 2)

- [ ] **2.4** Containerize high-risk MCP servers (GitHub, Cloudflare)
  - File: `docker-compose.mcp.yml`
  - Effort: 3 days
  - Impact: Network isolation, resource limits

- [ ] **2.5** Migrate from env vars to runtime secret injection
  - File: `src/lib/mcp-runtime.ts`
  - Effort: 2 days
  - Impact: Secrets never written to disk

- [ ] **2.6** Implement package integrity verification
  - Files: `scripts/verify-mcp-integrity.ts`, `scripts/generate-mcp-manifest.ts`
  - Effort: 2 days
  - Impact: Supply chain attack prevention

### Low (Month 3+)

- [ ] **3.1** Deploy threat detection AI pipeline
  - File: `src/lib/mcp-threat-detection.ts`
  - Effort: 1 week
  - Impact: Real-time malicious output detection

- [ ] **3.2** Implement integrity filtering for GitHub content
  - File: `src/lib/mcp-integrity-filter.ts`
  - Effort: 3 days
  - Impact: Prevents untrusted content poisoning

- [ ] **3.3** Add MCP server health checks and circuit breakers
  - File: `src/lib/mcp-circuit-breaker.ts`
  - Effort: 2 days
  - Impact: Availability, fail-safe behavior

---

## Configuration Examples

### mcp-security.json (Complete Example)

```json
{
  "version": "1.0",
  "globalDefaults": {
    "denyUnlistedTools": false,
    "logAllToolCalls": true,
    "requireApprovalForWrites": true,
    "maxConcurrency": 3,
    "timeoutMs": 30000
  },
  "servers": {
    "github.com/github-mcp-server": {
      "enabled": true,
      "allowedTools": [
        "issue_read",
        "issue_write",
        "list_commits",
        "search_code",
        "create_pull_request",
        "add_comment",
        "list_issues",
        "get_issue",
        "list_pull_requests",
        "get_pull_request"
      ],
      "deniedTools": [
        "delete_repository",
        "update_branch_protection",
        "remove_collaborator",
        "delete_issue",
        "delete_pull_request",
        "merge_pull_request",
        "create_deployment",
        "cancel_deployment"
      ],
      "requireApproval": [
        "create_pull_request",
        "issue_write",
        "merge_pull_request"
      ],
      "credentialBinding": {
        "tool": "create_pull_request",
        "requiredScopes": ["repo"]
      }
    },
    "cloudflare": {
      "enabled": true,
      "allowedTools": [
        "list_dns_records",
        "create_dns_record",
        "update_dns_record",
        "delete_dns_record",
        "list_workers",
        "get_worker",
        "deploy_worker",
        "list_kv_namespaces",
        "get_kv_namespace",
        "get_kv_value"
      ],
      "deniedTools": [
        "delete_zone",
        "remove_worker",
        "delete_kv_namespace"
      ]
    },
    "cloudless-infra": {
      "enabled": true,
      "allowedTools": ["ssh_exec", "ssh_upload", "ssh_download"],
      "deniedTools": ["ssh_exec_sudo"],
      "commandAllowlist": [
        "kubectl get *",
        "kubectl describe *",
        "kubectl logs *",
        "kubectl top *",
        "kubectl get events -n *",
        "systemctl status *",
        "journalctl -u * --since '24 hours ago'",
        "df -h",
        "free -m",
        "ps aux",
        "docker ps",
        "docker logs *"
      ],
      "commandDenylist": [
        "rm -rf /",
        "dd if=",
        "mkfs",
        "> /dev/sda",
        "curl | bash"
      ]
    },
    "filesystem": {
      "enabled": true,
      "allowedTools": ["read_file", "list_directory", "search_files", "file_info"],
      "deniedTools": ["write_file", "delete_file", "move_file", "copy_file"],
      "pathAllowlist": ["/home/tbaltzakis/cloudless.gr"],
      "pathDenylist": [
        "/home/tbaltzakis/.ssh",
        "/home/tbaltzakis/.aws",
        "/home/tbaltzakis/.config",
        "/home/tbaltzakis/.docker",
        "/etc",
        "/var/log",
        "/root"
      ]
    },
    "playwright": {
      "enabled": true,
      "allowedTools": ["browser_navigate", "browser_screenshot", "browser_snapshot"],
      "deniedTools": ["browser_run_code_unsafe"],
      "domainAllowlist": [
        "cloudless.gr",
        "*.cloudless.gr",
        "github.com",
        "*.github.com"
      ]
    }
  }
}
```

---

## Observability & Monitoring

### Metrics to Track

1. **MCP tool call rate** - Per server, per tool
2. **Blocked tool calls** - Security policy violations
3. **Sanitization rate** - Inputs modified by sanitizer
4. **Secret redaction count** - Seats masked in logs
5. **Threat detection alerts** - AI-detected suspicious outputs
6. **MCP server latency** - Performance impact of security controls

### Alerting Rules

```yaml
# examples/monitoring/mcp-alerts.yml
alerts:
  - name: MCPBlockedToolCalls
    expr: rate(mcp_blocked_calls_total[5m]) > 0
    severity: high
    message: "MCP tool calls are being blocked"

  - name: MCPSecretRedactionRate
    expr: rate(mcp_secrets_redacted_total[1h]) > 10
    severity: medium
    message: "High secret redaction rate - possible leak attempt"

  - name: MCPThreatDetectionAlert
    expr: rate(mcp_threats_detected_total[1h]) > 0
    severity: high
    message: "AI threat detection flagged MCP output"

  - name: MCPUnusualEgress
    expr: mcp_bytes_sent_total{server!~"localhost|127.0.0.1"} > 10MB
    severity: medium
    message: "Unusual outbound data from MCP server"
```

---

## Comparison: GitHub AW vs. Proposed cloudless.gr

| Layer | GitHub AW Mechanism | cloudless.gr Proposed | Coverage |
|-------|---------------------|----------------------|----------|
| **Substrate** | Docker + iptables + Squid proxy | Docker Compose + per-server networks | 70% (no kernel lockdown) |
| **Configuration** | Schema validation + action pinning | `mcp-security.json` + tool allowlists | 80% (no SHA pinning) |
| **Plan** | SafeOutputs + threat detection + staging | Artifact buffering + AI analysis | 60% (no multi-stage gating) |
| **Runtime** | AWF + MCP Gateway | Security interceptor + sanitizer | 75% (no full proxy) |
| **Observability** | CLI tools + artifact retention | Audit logs + structured metrics | 80% (no CLI) |

**Overall Maturity:**

- GitHub AW: Production-grade (used by GitHub)
- cloudless.gr proposed: Alpha/Beta stage (~65% coverage)

---

## Next Steps

1. **Week 1:** Implement tool allowlisting (`mcp-security.json`) + input sanitization (`mcp-sanitizer.ts`)
2. **Week 2:** Add secret redaction + SafeOutputs buffering + security interceptor
3. **Week 3:** Containerize GitHub + Cloudflare MCP servers
4. **Week 4:** Runtime secret injection + audit logging + package integrity verification
5. **Month 2:** Compilation-time security validation + threat detection AI pipeline
6. **Month 3:** Integrity filtering + circuit breakers

---

## References

- [GitHub AW Security Architecture](https://docs.github.com/en/actions/security-for-github-actions)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/security)
- [OWASP Top 10 for LLMs](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Prompt Injection Defense](https://www.anthropic.com/engineering/building-effective-agents)
