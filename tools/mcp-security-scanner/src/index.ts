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
  .parse();

const options = program.opts<ScanOptions>();

function isServerRoute(file: string): boolean {
  return /(?:src\/app\/api|src\/pages\/api|api\/|route\.ts|route\.py)$/i.test(file);
}

function hasAuthGuard(contents: string): boolean {
  return /\b(auth|authorization|authorize|requireAuth|getServerSession|cognito:groups|protected|withAuth|session)\b/i.test(contents);
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
        findings.push(
          createFinding(
            rule,
            file,
            1,
            "No rate limiting or throttling handlers detected.",
          ),
        );
      }
      continue;
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
    process.exit(allFindings.length > 0 ? 1 : 0);
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
  process.exit(1);
}

run().catch((error) => {
  console.error(chalk.red("Scanner failed:"), error);
  process.exit(2);
});
