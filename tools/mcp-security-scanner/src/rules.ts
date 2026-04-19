import type { Rule } from './types';

export const rules: Rule[] = [
  {
    id: 'mcp-001-missing-authentication',
    name: 'Missing authentication guard',
    category: 'Broken Authentication',
    severity: 'critical',
    owaspMapping: 'A1: Broken Authentication',
    description: 'Server handlers appear to lack explicit authentication or authorization gates.',
    patterns: ['export async function GET', 'export async function POST', 'export async function PUT', 'export async function DELETE', 'route.ts'],
    advice: 'Ensure MCP route handlers validate auth tokens, session state, or Cognito group membership before processing requests.'
  },
  {
    id: 'mcp-002-missing-authorization',
    name: 'Missing authorization check',
    category: 'Broken Authorization',
    severity: 'high',
    owaspMapping: 'A2: Broken Access Control',
    description: 'API handler appears to process sensitive operations without verifying role or permissions.',
    patterns: ['cognito:groups', 'admin', 'authorization', 'authorize', 'isAdmin', 'hasRole'],
    advice: 'Validate user groups or roles for admin-level and sensitive MCP operations.'
  },
  {
    id: 'mcp-003-command-injection-shell',
    name: 'Command injection in shell execution',
    category: 'Injection',
    severity: 'critical',
    owaspMapping: 'A4: Injection',
    description: 'Shell execution functions are invoked with potentially dynamic input.',
    patterns: ['\\b(exec|spawn|execSync|spawnSync|system|popen|shell_exec)\\s*\\('],
    advice: 'Avoid shell execution on untrusted input or sanitize values before passing them to shell APIs.'
  },
  {
    id: 'mcp-004-command-injection-template',
    name: 'Template string command injection',
    category: 'Injection',
    severity: 'high',
    owaspMapping: 'A4: Injection',
    description: 'Interpolated strings are used to construct commands or system paths.',
    patterns: ['`.*\\$\\{.*\\}.*`', '\\+\\s*.*\\+\\s*.*'],
    advice: 'Do not interpolate user-supplied values into shell or file system commands.'
  },
  {
    id: 'mcp-005-path-traversal',
    name: 'Path traversal risk',
    category: 'Injection',
    severity: 'high',
    owaspMapping: 'A4: Injection',
    description: 'File paths are assembled from untrusted input without normalization.',
    patterns: ['\\.\\./', 'path\\.join\\(', 'path\\.resolve\\(', 'path\\.normalize\\('],
    advice: 'Normalize and validate path segments before allowing them to reach file-system APIs.'
  },
  {
    id: 'mcp-006-secrets-in-code',
    name: 'Hardcoded secret lexicon',
    category: 'Sensitive Data Exposure',
    severity: 'critical',
    owaspMapping: 'A3: Sensitive Data Exposure',
    description: 'Secret-looking tokens and credentials are present in source code literals.',
    patterns: ['AKIA[A-Z0-9]{16}', 'AIza[0-9A-Za-z\\-_]{35}', 'sk_live_[0-9a-zA-Z]{24}', 'sk_test_[0-9a-zA-Z]{24}', "password\\s*=\\s*[\"']"],
    advice: 'Do not commit credentials or API keys. Use secret stores or environment variables instead.'
  },
  {
    id: 'mcp-007-exposed-configuration',
    name: 'Exposed environment/reference keys',
    category: 'Sensitive Data Exposure',
    severity: 'high',
    owaspMapping: 'A3: Sensitive Data Exposure',
    description: 'Environment variables or config keys are referenced without protective controls in logs or client bundles.',
    patterns: ['process\\.env\\.', 'NEXT_PUBLIC_', 'SECRET', 'API_KEY', 'TOKEN', 'PASSWORD'],
    advice: 'Keep secrets server-side and avoid leaking environment references in browser-delivered bundles or logs.'
  },
  {
    id: 'mcp-008-prompt-injection-directive',
    name: 'Prompt injection directive',
    category: 'Prompt Injection',
    severity: 'high',
    owaspMapping: 'MCP-2: Prompt Injection',
    description: 'Prompt text contains explicit injection directives that can override prior instructions.',
    patterns: ['ignore previous instructions', 'forget all previous', 'override.*instructions', 'new instructions', 'do not follow.*previous', 'disregard.*prior'],
    advice: 'Do not accept prompt fragments that explicitly instruct the model to ignore earlier guidance.'
  },
  {
    id: 'mcp-009-prompt-injection-injection-pattern',
    name: 'Prompt injection suspicious pattern',
    category: 'Prompt Injection',
    severity: 'medium',
    owaspMapping: 'MCP-2: Prompt Injection',
    description: 'Prompt text contains suspicious patterns often used for injection attacks.',
    patterns: ['human:\\s*|assistant:\\s*|system:\\s*', 'instruction[s]?\\s*:', 'do not answer|bypass.*filters|ignore.*safe'],
    advice: 'Sanitize user-provided prompt segments and treat them as untrusted input.'
  },
  {
    id: 'mcp-010-rate-limit-missing',
    name: 'Missing rate limiting',
    category: 'Security Misconfiguration',
    severity: 'medium',
    owaspMapping: 'A6: Security Misconfiguration',
    description: 'No rate limiting or throttling logic appears in a server route handler.',
    patterns: ['rateLimit', 'throttle', 'limiter', 'limit:'],
    advice: 'Apply request throttling to MCP server endpoints to reduce abuse and denial-of-service risk.'
  },
  {
    id: 'mcp-011-cors-wildcard',
    name: 'Wildcard CORS policy',
    category: 'Security Misconfiguration',
    severity: 'high',
    owaspMapping: 'A6: Security Misconfiguration',
    description: 'CORS policies allow all origins or use a wildcard origin value.',
    patterns: ["Access-Control-Allow-Origin:\\s*\\*", "origin:\\s*[\"']\\*[\"']"],
    advice: 'Restrict CORS origins to trusted domains for MCP endpoints.'
  },
  {
    id: 'mcp-012-unvalidated-redirect',
    name: 'Unvalidated redirect',
    category: 'Injection',
    severity: 'medium',
    owaspMapping: 'A4: Injection',
    description: 'Redirect targets or location headers appear to be built from untrusted input.',
    patterns: ['redirect\\(', 'location\\.href', 'window\\.location', 'res\\.setHeader\\(.*Location'],
    advice: 'Validate or whitelist redirect destinations before sending clients to external URLs.'
  },
  {
    id: 'mcp-013-unsafe-logging',
    name: 'Unsafe logging of secrets or inputs',
    category: 'Sensitive Data Exposure',
    severity: 'low',
    owaspMapping: 'A3: Sensitive Data Exposure',
    description: 'Logging calls may emit raw user input or secret values without masking.',
    patterns: ['console\\.log\\(', 'logger\\.info\\(', 'logger\\.debug\\(', 'console\\.error\\(', 'request.body', 'req\\.body', 'event\\.body'],
    advice: 'Mask or remove sensitive payloads and secret values from application logs.'
  }
];

export default rules;
