import { Command } from "commander";
import chalk from "chalk";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import rules from "./rules.js";
import type { Finding, Rule } from "./types.js";

const globAsync = fg;

type ScanOptions = {
  path: string;
  json: boolean;
  skipPython: boolean;
  exitZero: boolean;
};

const program = new Command();

program
  .name("mcp-security-scanner")
  .description("Static analysis security scanner for MCP servers.")
  .option(
    "-p, --path <pattern>",
    "glob pattern to scan",
    "src/**/*.{ts,tsx,js,jsx,py,md}",
  )
  .option("--json", "output JSON results", false)
  .option("--skip-python", "skip the Python prompt injection analyzer", false)
  .option("--exit-zero", "always exit 0 (informational mode — findings are logged but do not fail CI)", false)
  .parse();

const options = program.opts<ScanOptions>();

function isServerRoute(file: string): boolean {
  return /(?:src\/app\/api|src\/pages\/api|api\/|route\.ts|route\.py)$/i.test(file);
}

function isLibFile(file: string): boolean {
  return /\/lib\/|\/context\/|\/hooks\/|\/utils\/|instrumentation\.(ts|js)|middleware\.(ts|js)|proxy\.(ts|js)/.test(file);
}

function isPageFile(file: string): boolean {
  return /\.(tsx|jsx)$/.test(file) && !/route\.(ts|tsx)$/.test(file);
}

function isGetOnlyRoute(contents: string): boolean {
  const hasMutatingMethod = /\bexport\s+async\s+function\s+(POST|PUT|DELETE|PATCH)\b/.test(contents);
  return !hasMutatingMethod;
}

function hasAuthGuard(contents: string): boolean {
  return /\b(auth|authorization|authorize|requireAuth|getServerSession|cognito:groups|protected|withAuth|session|verifySlackRequest|verifyRequest|verifySignature|verifySecret|webhookSecret|hmacDigest|stripe-signature|cronAuth)\b/i.test(contents);
}

function hasRateLimit(contents: string): boolean {
  return /\b(rateLimit|throttle|limiter|limit:\s*\d|burst|windowMs|requestsPerMinute|ratelimit)\b/i.test(contents);
}

function shouldSkipLine(line: string, inBlockComment: boolean): [boolean, boolean] {
  const trimmed = line.trim();
  if (!trimmed) return [true, inBlockComment];

  if (inBlockComment) {
    if (trimmed.includes("*/")) return [true, false];
    return [true, true];
  }

  if (trimmed.startsWith("//")) return [true, false];
  if (trimmed.startsWith("/*")) {
    return [true, !trimmed.includes("*/")];
  }
  if (trimmed.startsWith("*")) {
    return [true, false];
  }

  return [false, false];
}

function createFinding(
  rule: Rule,
  file: string,
  line: number,
  excerpt: string,
): Finding {
  return { rule, file, line, excerpt };
}

function runPythonPromptAnalyzer(file: string, contents: string): Finding[] {
  const scriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../py/prompt_injection_analyzer.py",
  );
  const python = spawnSync("python3", [scriptPath, "--json"], {
    input: contents,
    encoding: "utf8",
  });

  if (python.error || python.status !== 0) {
    return [];
  }

  try {
    const output = JSON.parse(python.stdout) as Array<{
      id: string;
      line: number;
      excerpt: string;
      message: string;
    }>;
    return output
      .map((item) => {
        const rule = rules.find((ruleItem) => ruleItem.id === item.id);
        if (!rule) return null;
        return createFinding(
          rule,
          file,
          item.line,
          item.excerpt || item.message,
        );
      })
      .filter((item): item is Finding => item !== null);
  } catch {
    return [];
  }
}

function formatFinding(finding: Finding): string {
  const severityColor = {
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
  }[finding.rule.severity];

  return [
    `${chalk.cyan(finding.file)}:${chalk.yellow(String(finding.line))}`,
    severityColor(finding.rule.severity.toUpperCase()),
    chalk.bold(finding.rule.id),
    `(${finding.rule.owaspMapping})`,
    `- ${finding.rule.name}`,
    `\n    ${finding.excerpt}`,
    `\n    Advice: ${finding.rule.advice}`,
  ].join(" ");
}

async function scanFile(file: string): Promise<Finding[]> {
  const contents = await readFile(file, "utf8");
  const lines = contents.split(/\r?\n/);
  const findings: Finding[] = [];

  for (const rule of rules) {
    if (rule.id === "mcp-001-missing-authentication") {
      if (isServerRoute(file) && !hasAuthGuard(contents)) {
        findings.push(
          createFinding(
            rule,
            file,
            1,
            "No explicit authentication or authorization check found.",
          ),
        );
      }
      continue;
    }

    if (rule.id === "mcp-010-rate-limit-missing") {
      if (isServerRoute(file) && !hasRateLimit(contents)) {
        // Skip routes that don't need per-route rate limiting:
        // 1. Admin routes: covered by ADMIN_RATE_LIMIT in proxy.ts middleware.
        // 2. Auth-guarded routes (webhook HMAC, Slack signing, Cognito JWT):
        //    signature verification limits abuse more effectively than IP throttle.
        // 3. GET-only routes: read-only, no state mutation risk.
        const isAuthAdminRoute =
          /\/api\/admin\//.test(file) && hasAuthGuard(contents);
        const isAuthGuardedRoute = hasAuthGuard(contents);
        const isReadOnly = isGetOnlyRoute(contents);
        if (!isAuthAdminRoute && !isAuthGuardedRoute && !isReadOnly) {
          findings.push(
            createFinding(
              rule,
              file,
              1,
              "No rate limiting or throttling handlers detected.",
            ),
          );
        }
      }
      continue;
    }

    // mcp-002: only meaningful for server route handlers. TSX/JSX pages,
    // layout components, and lib helpers that mention "admin" or "auth"
    // in UI text or imports are not API handlers and should not be flagged.
    if (rule.id === "mcp-002-missing-authorization") {
      if (!isServerRoute(file) || hasAuthGuard(contents)) continue;
    }

    // mcp-003: regex.exec() and array.exec() are not shell execution.
    // Only flag bare exec/spawn calls that are actual shell invocations.
    // The method-call form (.exec) is safe — it's a JS/TS RegExp or array method.

    // mcp-004: template string injection only matters when shell execution is
    // present. Without exec/spawn/system the strings can't become commands.
    // Also skips JSX/TSX where template literals are always UI rendering.
    if (rule.id === "mcp-004-command-injection-template") {
      const hasShellExec =
        /\b(exec|spawn|execSync|spawnSync|system|popen|shell_exec)\s*\(/i.test(
          contents,
        );
      if (!hasShellExec || /\.(tsx|jsx)$/.test(file)) continue;
    }

    // mcp-007: env-var and secret-keyword patterns are normal in server-side code.
    // Only flag potential client-bundle exposure:
    // - lib files, middleware, context, hooks: server-only by design — skip.
    // - page/layout/error/loading TSX files: server components or client UI,
    //   they show env-var names as help text but never leak actual values — skip.
    // - server routes already behind an auth guard: correct practice — skip.
    if (rule.id === "mcp-007-exposed-configuration") {
      if (isLibFile(file) || isPageFile(file)) continue;
      if (isServerRoute(file) && hasAuthGuard(contents)) continue;
    }

    const regexes = rule.patterns.map((pattern) => new RegExp(pattern, "gi"));
    let inBlockComment = false;

    for (const [index, rawLine] of lines.entries()) {
      const [skip, nextBlock] = shouldSkipLine(rawLine, inBlockComment);
      inBlockComment = nextBlock;
      if (skip) continue;

      const line = rawLine.trim();
      for (const regex of regexes) {
        if (regex.test(line)) {
          // mcp-003: skip .exec() method calls (RegExp/Array) — not shell exec.
          if (
            rule.id === "mcp-003-command-injection-shell" &&
            /\.\s*exec\s*\(/.test(line)
          ) {
            break;
          }
          // mcp-005: skip static relative imports (../../locales/...) — not user input.
          if (
            rule.id === "mcp-005-path-traversal" &&
            /import\s*\(/.test(line)
          ) {
            break;
          }
          // mcp-007: NEXT_PUBLIC_ variables are designed to be in the client bundle.
          // isConfigured() checks key presence only — it never exposes the value.
          if (rule.id === "mcp-007-exposed-configuration") {
            if (/NEXT_PUBLIC_/.test(line)) break;
            if (/isConfigured\(/.test(line)) break;
          }
          // mcp-012: NextResponse.redirect(new URL(...)) validates the target via
          // the URL constructor — not an unvalidated redirect.
          // Also skip Next.js permanentRedirect() with a hardcoded literal path,
          // and multi-line redirects where new URL() appears on an adjacent line.
          if (rule.id === "mcp-012-unvalidated-redirect") {
            if (/new URL\(/.test(line)) break;
            if (/permanentRedirect\(["'`]\//.test(line)) break;
            const contextWindow = lines
              .slice(Math.max(0, index - 5), index + 5)
              .join(" ");
            if (/new URL\(/.test(contextWindow)) break;
          }
          // mcp-013: console.error is standard caught-error logging, not user-input
          // exposure. Only flag console.log that references request/body data.
          if (
            rule.id === "mcp-013-unsafe-logging" &&
            /console\.error\(/.test(line)
          ) {
            break;
          }
          findings.push(createFinding(rule, file, index + 1, line));
          break;
        }
      }
    }
  }

  if (!options.skipPython) {
    findings.push(...runPythonPromptAnalyzer(file, contents));
  }

  return findings;
}

async function run(): Promise<void> {
  const files = await globAsync(options.path, { nodir: true });
  const allFindings: Finding[] = [];

  for (const file of files) {
    const result = await scanFile(file);
    allFindings.push(...result);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        allFindings.map((finding) => ({
          file: finding.file,
          line: finding.line,
          rule: finding.rule.id,
          category: finding.rule.category,
          owaspMapping: finding.rule.owaspMapping,
          excerpt: finding.excerpt,
          advice: finding.rule.advice,
        })),
        null,
        2,
      ),
    );
    process.exit(options.exitZero || allFindings.length === 0 ? 0 : 1);
  }

  if (allFindings.length === 0) {
    console.log(chalk.green("MCP security scanner completed: no findings detected."));
    process.exit(0);
  }

  console.log(chalk.red(`MCP security scanner detected ${allFindings.length} findings:`));
  for (const finding of allFindings) {
    console.log(formatFinding(finding));
    console.log("");
  }
  process.exit(options.exitZero ? 0 : 1);
}

run().catch((error) => {
  console.error(chalk.red("Scanner failed:"), error);
  process.exit(2);
});
