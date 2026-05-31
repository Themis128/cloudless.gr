/**
 * gh-secrets — audit & delete GitHub Actions repository secrets via the REST API.
 *
 * Why this exists: deleting a repo secret normally means clicking through
 * Settings → Secrets and variables → Actions. Anyone without UI access to that
 * page (but holding a token that can manage secrets) can use this instead.
 *
 * It is deliberately cautious:
 *   - `delete` is DRY-RUN by default; nothing is removed without `--apply`.
 *   - Before deleting a secret it runs `git grep` for that secret name across
 *     the repo and REFUSES if anything still references it (override: `--force`).
 *   - With no names given, `delete` targets the two stale static AWS keys that
 *     OIDC replaced (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
 *
 * Auth:
 *   GITHUB_TOKEN   a token authorised to manage Actions secrets on the repo:
 *                    - classic PAT with the `repo` scope, OR
 *                    - fine-grained PAT with "Secrets" repository permission = Read & write.
 *                  (The default Actions GITHUB_TOKEN CANNOT manage secrets.)
 *
 * Usage:
 *   GITHUB_TOKEN=... pnpm exec tsx --tsconfig scripts/tsconfig.json scripts/gh-secrets.ts list
 *   GITHUB_TOKEN=... pnpm exec tsx --tsconfig scripts/tsconfig.json scripts/gh-secrets.ts delete            # dry-run, default AWS keys
 *   GITHUB_TOKEN=... pnpm exec tsx --tsconfig scripts/tsconfig.json scripts/gh-secrets.ts delete --apply     # actually delete the AWS keys
 *   GITHUB_TOKEN=... pnpm exec tsx --tsconfig scripts/tsconfig.json scripts/gh-secrets.ts delete FOO BAR --apply
 *
 * Flags:
 *   --apply              perform the deletion (default is dry-run)
 *   --force              delete even if the secret is still referenced in the repo
 *   --owner <owner>      repo owner   (default: Themis128 or $GH_OWNER)
 *   --repo  <repo>       repo name    (default: cloudless.gr or $GH_REPO)
 */
import process from "node:process";
import { execFileSync } from "node:child_process";

const API = "https://api.github.com";
const DEFAULT_TARGETS = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];

interface Options {
  command: string;
  names: string[];
  apply: boolean;
  force: boolean;
  owner: string;
  repo: string;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    command: "",
    names: [],
    apply: false,
    force: false,
    owner: process.env.GH_OWNER ?? "Themis128",
    repo: process.env.GH_REPO ?? "cloudless.gr",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--owner") opts.owner = argv[++i] ?? opts.owner;
    else if (arg === "--repo") opts.repo = argv[++i] ?? opts.repo;
    else if (!opts.command) opts.command = arg;
    else opts.names.push(arg);
  }
  return opts;
}

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) {
    throw new Error(
      "GITHUB_TOKEN is not set. Provide a PAT that can manage Actions secrets " +
        "(classic `repo` scope, or fine-grained 'Secrets: Read & write')."
    );
  }
  return t;
}

async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  return globalThis.fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

interface SecretEntry {
  name: string;
  updated_at: string;
}

async function listSecrets(o: Options): Promise<SecretEntry[]> {
  const res = await gh(`/repos/${o.owner}/${o.repo}/actions/secrets?per_page=100`);
  if (!res.ok) {
    throw new Error(`List failed: HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { secrets: SecretEntry[] };
  return body.secrets;
}

/**
 * True when any workflow under `.github` still consumes this secret as
 * `secrets.NAME`. We scope to workflow consumption deliberately: a GitHub
 * Actions secret is "in use" only if a workflow reads it. Placeholder mentions
 * in `.env.example`, docs, or script comments do not count.
 */
function isReferenced(name: string): boolean {
  try {
    // git grep exits 0 when a match is found, 1 when none. -q suppresses output.
    execFileSync("git", ["grep", "-q", "--fixed-strings", `secrets.${name}`, "--", ".github"], {
      stdio: "ignore",
    });
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 1) {
      return false;
    }
    throw err;
  }
}

async function deleteSecret(o: Options, name: string): Promise<void> {
  const res = await gh(`/repos/${o.owner}/${o.repo}/actions/secrets/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (res.status === 204) return;
  if (res.status === 404) {
    console.log(`  · ${name}: already absent (404) — nothing to do`);
    return;
  }
  throw new Error(`Delete ${name} failed: HTTP ${res.status} ${await res.text()}`);
}

async function runList(o: Options): Promise<void> {
  const secrets = await listSecrets(o);
  console.log(`Secrets on ${o.owner}/${o.repo} (${secrets.length}):`);
  for (const s of secrets) console.log(`  ${s.name}  (updated ${s.updated_at})`);
}

async function runDelete(o: Options): Promise<void> {
  const targets = o.names.length > 0 ? o.names : DEFAULT_TARGETS;
  const existing = new Set((await listSecrets(o)).map((s) => s.name));

  console.log(
    `${o.apply ? "DELETING" : "DRY-RUN (pass --apply to delete)"} on ${o.owner}/${o.repo}:`
  );

  let failures = 0;
  for (const name of targets) {
    if (!existing.has(name)) {
      console.log(`  · ${name}: not present — skipping`);
      continue;
    }
    if (!o.force && isReferenced(name)) {
      console.error(`  ✗ ${name}: still referenced in the repo — refusing (use --force to override)`);
      failures++;
      continue;
    }
    if (!o.apply) {
      console.log(`  → ${name}: would delete (safe — no references found)`);
      continue;
    }
    try {
      await deleteSecret(o, name);
      console.log(`  ✓ ${name}: deleted`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message}`);
      failures++;
    }
  }
  if (failures > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  switch (o.command) {
    case "list":
      await runList(o);
      break;
    case "delete":
      await runDelete(o);
      break;
    default:
      console.error("Usage: gh-secrets <list|delete> [names...] [--apply] [--force] [--owner X] [--repo Y]");
      process.exitCode = 2;
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
