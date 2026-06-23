#!/usr/bin/env bash
set -euo pipefail

# Finalize R14: Sentry env tagging prod vs pi-standby.
# Idempotent patcher. Run from repo root:
#   bash scripts/patch_r14_sentry_env_tagging_finalize.sh

ROOT="${1:-$(pwd)}"
cd "$ROOT"
mkdir -p scripts __tests__

python - <<'PY'
from pathlib import Path

def patch_deploy_yml(path: Path):
    if not path.exists():
        print(f"⚠️  {path} not found; skipping")
        return
    text = path.read_text()
    original = text
    if "SENTRY_ENVIRONMENT: prod" not in text or "NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod" not in text:
        lines = text.splitlines()
        out = []
        inserted = False
        for line in lines:
            out.append(line)
            stripped = line.strip()
            indent = line[: len(line) - len(line.lstrip())]
            if stripped.startswith("NEXT_PUBLIC_SENTRY_DSN:") and not inserted:
                if "SENTRY_ENVIRONMENT: prod" not in text:
                    out.append(f"{indent}SENTRY_ENVIRONMENT: prod")
                if "NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod" not in text:
                    out.append(f"{indent}NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod")
                inserted = True
        if not inserted:
            out = []
            for line in lines:
                out.append(line)
                stripped = line.strip()
                indent = line[: len(line) - len(line.lstrip())]
                if stripped.startswith("SENTRY_AUTH_TOKEN:") and not inserted:
                    if "SENTRY_ENVIRONMENT: prod" not in text:
                        out.append(f"{indent}SENTRY_ENVIRONMENT: prod")
                    if "NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod" not in text:
                        out.append(f"{indent}NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod")
                    inserted = True
        if not inserted:
            raise SystemExit(f"Could not find NEXT_PUBLIC_SENTRY_DSN or SENTRY_AUTH_TOKEN in {path}; patch manually.")
        text = "\n".join(out) + "\n"
    if text != original:
        path.write_text(text)
        print(f"✅ Patched {path}: added prod Sentry env tags")
    else:
        print(f"✅ {path}: prod Sentry env tags already present")

def patch_pi_workflow(path: Path):
    if not path.exists():
        print(f"⚠️  {path} not found; skipping")
        return
    text = path.read_text()
    original = text
    if "NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby" not in text:
        lines = text.splitlines()
        out = []
        inserted = False
        for line in lines:
            out.append(line)
            if "SENTRY_ENVIRONMENT=pi-standby" in line and not inserted:
                indent = line[: len(line) - len(line.lstrip())]
                out.append(f"{indent}NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby")
                inserted = True
        if not inserted:
            raise SystemExit(f"Could not find SENTRY_ENVIRONMENT=pi-standby in {path}; patch manually.")
        text = "\n".join(out) + "\n"
    if text != original:
        path.write_text(text)
        print(f"✅ Patched {path}: added NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby")
    else:
        print(f"✅ {path}: Pi public Sentry env tag already present")

def patch_dockerfile(path: Path):
    if not path.exists():
        print("⚠️  Dockerfile not found; skipping")
        return
    text = path.read_text()
    original = text
    lines = text.splitlines()
    if "ARG SENTRY_ENVIRONMENT" not in text or "ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT" not in text:
        out = []
        inserted = False
        for line in lines:
            out.append(line)
            if line.strip() == "ARG NEXT_PUBLIC_SENTRY_DSN" and not inserted:
                if "ARG SENTRY_ENVIRONMENT" not in text:
                    out.append("ARG SENTRY_ENVIRONMENT=prod")
                if "ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT" not in text:
                    out.append("ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=prod")
                inserted = True
        if not inserted:
            out = []
            last_arg_idx = max((i for i, line in enumerate(lines) if line.strip().startswith("ARG ")), default=-1)
            if last_arg_idx >= 0:
                for i, line in enumerate(lines):
                    out.append(line)
                    if i == last_arg_idx:
                        if "ARG SENTRY_ENVIRONMENT" not in text:
                            out.append("ARG SENTRY_ENVIRONMENT=prod")
                        if "ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT" not in text:
                            out.append("ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=prod")
            else:
                out = ["ARG SENTRY_ENVIRONMENT=prod", "ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=prod", *lines]
        text = "\n".join(out) + "\n"
    if "SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}" not in text or "NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}" not in text:
        lines = text.splitlines()
        out = []
        inserted = False
        for line in lines:
            out.append(line)
            if "NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}" in line and not inserted:
                indent = line[: len(line) - len(line.lstrip())]
                if line.rstrip().endswith("\\"):
                    if "SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}" not in text:
                        out.append(f"{indent}SENTRY_ENVIRONMENT=${{SENTRY_ENVIRONMENT}} \\")
                    if "NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}" not in text:
                        out.append(f"{indent}NEXT_PUBLIC_SENTRY_ENVIRONMENT=${{NEXT_PUBLIC_SENTRY_ENVIRONMENT}} \\")
                else:
                    if "SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}" not in text:
                        out.append("ENV SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}")
                    if "NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}" not in text:
                        out.append("ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}")
                inserted = True
        if inserted:
            text = "\n".join(out) + "\n"
        else:
            text += "\nENV SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}\nENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}\n"
    if text != original:
        path.write_text(text)
        print(f"✅ Patched {path}: added Sentry env build args/exports")
    else:
        print(f"✅ {path}: Sentry env args/exports already present")

def patch_env_example(path: Path):
    if not path.exists():
        print("⚠️  .env.example not found; skipping")
        return
    text = path.read_text()
    original = text
    additions = []
    if "SENTRY_ENVIRONMENT=" not in text:
        additions.append("SENTRY_ENVIRONMENT=prod")
    if "NEXT_PUBLIC_SENTRY_ENVIRONMENT=" not in text:
        additions.append("NEXT_PUBLIC_SENTRY_ENVIRONMENT=prod")
    if additions:
        text = text.rstrip() + "\n\n# R14: Sentry surface tagging\n" + "\n".join(additions) + "\n"
    if text != original:
        path.write_text(text)
        print("✅ Patched .env.example: documented R14 env vars")
    else:
        print("✅ .env.example: R14 env vars already documented")

def write_static_test(path: Path):
    content = '''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("R14 Sentry environment tagging", () => {
  it("uses per-surface SENTRY_ENVIRONMENT on server and edge", () => {
    expect(read("sentry.server.config.ts")).toContain("process.env.SENTRY_ENVIRONMENT");
    expect(read("sentry.edge.config.ts")).toContain("process.env.SENTRY_ENVIRONMENT");
  });

  it("uses NEXT_PUBLIC_SENTRY_ENVIRONMENT for browser/client events", () => {
    expect(read("sentry.client.config.ts")).toContain(
      "process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT",
    );
  });

  it("sets prod Sentry tags in the AWS/Lambda deploy workflow", () => {
    const deploy = read(".github/workflows/deploy.yml");
    expect(deploy).toContain("SENTRY_ENVIRONMENT: prod");
    expect(deploy).toContain("NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod");
  });

  it("sets pi-standby Sentry tags in Pi workflows", () => {
    for (const workflow of [
      ".github/workflows/deploy-pi.yml",
      ".github/workflows/build-pi-image.yml",
    ]) {
      const body = read(workflow);
      expect(body).toContain("SENTRY_ENVIRONMENT=pi-standby");
      expect(body).toContain("NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby");
    }
  });
});
'''
    if not path.exists() or path.read_text() != content:
        path.write_text(content)
        print(f"✅ Wrote {path}")
    else:
        print(f"✅ {path}: already up to date")

patch_deploy_yml(Path(".github/workflows/deploy.yml"))
patch_pi_workflow(Path(".github/workflows/deploy-pi.yml"))
patch_pi_workflow(Path(".github/workflows/build-pi-image.yml"))
patch_dockerfile(Path("Dockerfile"))
patch_env_example(Path(".env.example"))
write_static_test(Path("__tests__/r14-sentry-env-tagging.test.ts"))
PY

cat > scripts/check_r14_sentry_env_tagging.sh <<'CHECK'
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT"
ok=0; fail=0; warn=0
pass() { printf '✅ %s\n' "$*"; ok=$((ok+1)); }
missing() { printf '❌ %s\n' "$*"; fail=$((fail+1)); }
warning() { printf '⚠️  %s\n' "$*"; warn=$((warn+1)); }
literal_contains() { local file="$1"; local text="$2"; [[ -f "$file" ]] && grep -qF "$text" "$file"; }
echo "== R14 Sentry env tagging check =="
echo "Repo: $ROOT"; echo
literal_contains sentry.server.config.ts 'process.env.SENTRY_ENVIRONMENT' && pass 'server config uses SENTRY_ENVIRONMENT' || missing 'server config missing SENTRY_ENVIRONMENT'
literal_contains sentry.edge.config.ts 'process.env.SENTRY_ENVIRONMENT' && pass 'edge config uses SENTRY_ENVIRONMENT' || missing 'edge config missing SENTRY_ENVIRONMENT'
literal_contains sentry.client.config.ts 'process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT' && pass 'client config uses NEXT_PUBLIC_SENTRY_ENVIRONMENT' || missing 'client config missing NEXT_PUBLIC_SENTRY_ENVIRONMENT'
echo
literal_contains .github/workflows/deploy.yml 'SENTRY_ENVIRONMENT: prod' && pass 'AWS deploy sets SENTRY_ENVIRONMENT: prod' || missing 'AWS deploy missing SENTRY_ENVIRONMENT: prod'
literal_contains .github/workflows/deploy.yml 'NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod' && pass 'AWS deploy sets NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod' || missing 'AWS deploy missing NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod'
echo
for f in .github/workflows/deploy-pi.yml .github/workflows/build-pi-image.yml; do
  if [[ -f "$f" ]]; then
    literal_contains "$f" 'SENTRY_ENVIRONMENT=pi-standby' && pass "$f sets SENTRY_ENVIRONMENT=pi-standby" || missing "$f missing SENTRY_ENVIRONMENT=pi-standby"
    literal_contains "$f" 'NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby' && pass "$f sets NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby" || missing "$f missing NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby"
  else
    warning "$f not found"
  fi
done
echo
if [[ -f Dockerfile ]]; then
  literal_contains Dockerfile 'ARG SENTRY_ENVIRONMENT' && pass 'Dockerfile declares ARG SENTRY_ENVIRONMENT' || warning 'Dockerfile missing ARG SENTRY_ENVIRONMENT'
  literal_contains Dockerfile 'ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT' && pass 'Dockerfile declares ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT' || warning 'Dockerfile missing ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT'
  literal_contains Dockerfile 'SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}' && pass 'Dockerfile exports SENTRY_ENVIRONMENT' || warning 'Dockerfile may not export SENTRY_ENVIRONMENT'
  literal_contains Dockerfile 'NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}' && pass 'Dockerfile exports NEXT_PUBLIC_SENTRY_ENVIRONMENT' || warning 'Dockerfile may not export NEXT_PUBLIC_SENTRY_ENVIRONMENT'
else
  warning 'Dockerfile not found'
fi
echo
[[ -f __tests__/r14-sentry-env-tagging.test.ts ]] && pass 'R14 static test exists' || warning 'R14 static test missing'
echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"
[[ "$fail" -eq 0 ]]
CHECK
chmod +x scripts/check_r14_sentry_env_tagging.sh

echo
bash scripts/check_r14_sentry_env_tagging.sh || true

echo
echo "Next validation commands:"
echo "  pnpm vitest run __tests__/r14-sentry-env-tagging.test.ts __tests__/sentry.test.ts __tests__/sentry-scrub.test.ts"
echo "  git diff -- .github/workflows/deploy.yml .github/workflows/deploy-pi.yml .github/workflows/build-pi-image.yml Dockerfile .env.example __tests__/r14-sentry-env-tagging.test.ts scripts/check_r14_sentry_env_tagging.sh"
