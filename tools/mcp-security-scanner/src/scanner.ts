import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import rules from './rules';
import type { Finding, Rule } from './types';

export function isServerRoute(file: string): boolean {
  return /(?:src\/app\/api|src\/pages\/api|api\/|route\.ts|route\.py)$/i.test(file);
}

export function hasAuthGuard(contents: string): boolean {
  return /\b(auth|authorization|authorize|requireAuth|getServerSession|cognito:groups|protected|withAuth|session|verifySlackRequest|verifyRequest|verifySignature|verifySecret|webhookSecret|hmacDigest|stripe-signature|cronAuth)\b/i.test(contents);
}

export function hasRateLimit(contents: string): boolean {
  return /(rateLimit|throttle|limiter|limit:\s*\d|burst|windowMs|requestsPerMinute|ratelimit)/i.test(contents);
}

export function createFinding(rule: Rule, file: string, line: number, excerpt: string): Finding {
  return { rule, file, line, excerpt };
}

export function runPythonPromptAnalyzer(contents: string): Finding[] {
  const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../py/prompt_injection_analyzer.py');
  const python = spawnSync('python3', [scriptPath, '--json'], { input: contents, encoding: 'utf8' });
  if (python.error || python.status !== 0) {
    return [];
  }
  try {
    const output = JSON.parse(python.stdout) as Array<{ id: string; line: number; excerpt: string; message: string }>;
    return output
      .map((item) => {
        const rule = rules.find((ruleItem) => ruleItem.id === item.id);
        if (!rule) return null;
        return createFinding(rule, 'stdin', item.line, item.excerpt || item.message);
      })
      .filter((item): item is Finding => item !== null);
  } catch {
    return [];
  }
}

export async function scanFile(file: string, skipPython = true): Promise<Finding[]> {
  const contents = await readFile(file, 'utf8');
  return scanContents(contents, file, skipPython);
}

export function scanContents(contents: string, file: string, skipPython = true): Finding[] {
  const lines = contents.split(/\r?\n/);
  const findings: Finding[] = [];

  for (const rule of rules) {
    if (rule.id === 'mcp-001-missing-authentication') {
      if (isServerRoute(file) && !hasAuthGuard(contents)) {
        findings.push(createFinding(rule, file, 1, 'No explicit authentication or authorization check found.'));
      }
      continue;
    }

    if (rule.id === 'mcp-010-rate-limit-missing') {
      if (isServerRoute(file) && !hasRateLimit(contents)) {
        findings.push(createFinding(rule, file, 1, 'No rate limiting or throttling handlers detected.'));
      }
      continue;
    }

    const regexes = rule.patterns.map((pattern: string) => new RegExp(pattern, 'gi'));
    for (const [index, line] of lines.entries()) {
      for (const regex of regexes) {
        if (regex.test(line)) {
          findings.push(createFinding(rule, file, index + 1, line.trim()));
          break;
        }
      }
    }
  }

  if (!skipPython) {
    findings.push(...runPythonPromptAnalyzer(contents));
  }

  return findings;
}

export async function scanGlob(pattern: string, skipPython = true): Promise<Finding[]> {
  const files = await fg(pattern, { onlyFiles: true });
  const allFindings: Finding[] = [];
  for (const file of files) {
    allFindings.push(...(await scanFile(file, skipPython)));
  }
  return allFindings;
}
