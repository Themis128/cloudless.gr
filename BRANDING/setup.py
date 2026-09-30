#!/usr/bin/env python3
"""BRANDING — one-shot installer.

Port of setup.sh. Idempotent: safe to re-run. Tested on Ubuntu 24.04 / WSL2.

Usage: python3 BRANDING/setup.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

BRANDING_DIR = Path(__file__).resolve().parent
SKILLS_DIR = Path.home() / ".claude" / "skills"
COMMANDS_DIR = Path.home() / ".claude" / "commands"
SUGGESTED_MCP = (
    Path.home() / ".config" / "Claude" / "claude_desktop_config.suggested.json"
)

# <local-dir>|<git-url>|<install-strategy>
#   skills-dir — symlink every directory under repos/<name>/skills/ into SKILLS_DIR
#   commands   — copy .md files under repos/<name>/.claude/commands/ into COMMANDS_DIR
#   reference  — clone only; don't install
REPOS = [
    ("social-media-skills", "https://github.com/charlie947/social-media-skills.git", "skills-dir"),
    ("social-ai-team", "https://github.com/stevenflanagan1/social-ai-team.git", "skills-dir"),
    ("brand-design-skill", "https://github.com/VicUgochukwu/brand-design-skill.git", "commands"),
    ("awesome-claude-skills", "https://github.com/ComposioHQ/awesome-claude-skills.git", "reference"),
    ("awesome-agent-skills", "https://github.com/VoltAgent/awesome-agent-skills.git", "reference"),
    ("awesome-mcp-servers", "https://github.com/punkpeye/awesome-mcp-servers.git", "reference"),
]


def step(*args: str) -> None:
    print(f"\n\033[1;36m▸ {' '.join(args)}\033[0m")


def ok(msg: str) -> None:
    print(f"  \033[1;32m✓\033[0m {msg}")


def warn(msg: str) -> None:
    print(f"  \033[1;33m!\033[0m {msg}")


def err(msg: str) -> None:
    print(f"  \033[1;31m✗\033[0m {msg}", file=sys.stderr)


step("Preflight")
if not shutil.which("git"):
    err("git not installed")
    sys.exit(1)
for d in (SKILLS_DIR, COMMANDS_DIR, BRANDING_DIR / "repos", SUGGESTED_MCP.parent):
    d.mkdir(parents=True, exist_ok=True)
git_version = subprocess.run(["git", "--version"], capture_output=True, text=True, check=False).stdout.split()[-1]
ok(f"git: {git_version}")
ok(f"skills dir: {SKILLS_DIR}")
ok(f"commands dir: {COMMANDS_DIR}")

step("Clone external repos")
repos_dir = BRANDING_DIR / "repos"
for name, url, _strategy in REPOS:
    dest = repos_dir / name
    if (dest / ".git").is_dir():
        r = subprocess.run(["git", "pull", "--ff-only", "--quiet"], cwd=dest, check=False)
        if r.returncode != 0:
            warn(f"pull failed for {name} (continuing)")
        ok(f"{name} (updated)")
    else:
        subprocess.run(["git", "clone", "--depth", "1", "--quiet", url, name], cwd=repos_dir, check=True)
        ok(f"{name} (cloned)")

step("Wire Cloudless brand pack into ~/.claude/skills/")
link = SKILLS_DIR / "cloudless-brand"
link.unlink(missing_ok=True)
link.symlink_to(BRANDING_DIR / "cloudless-brand")
ok(f"~/.claude/skills/cloudless-brand → {BRANDING_DIR}/cloudless-brand")

step("Install Claude Code skills globally (symlinks under ~/.claude/skills/)")
for name, _url, strategy in REPOS:
    if strategy != "skills-dir":
        continue
    src = repos_dir / name / "skills"
    if not src.is_dir():
        warn(f"{name} has no skills/ folder — skipping")
        continue
    for skill_path in sorted(src.iterdir()):
        if not skill_path.is_dir():
            continue
        link = SKILLS_DIR / skill_path.name
        link.unlink(missing_ok=True)
        link.symlink_to(skill_path)
        ok(f"~/.claude/skills/{skill_path.name} → {name}/skills/{skill_path.name}")

step("Install slash-commands globally (~/.claude/commands/)")
for name, _url, strategy in REPOS:
    if strategy != "commands":
        continue
    src = repos_dir / name / ".claude" / "commands"
    if not src.is_dir():
        warn(f"{name} has no .claude/commands/ — skipping")
        continue
    count = 0
    for f in sorted(src.iterdir()):
        if f.is_file():
            shutil.copy2(f, COMMANDS_DIR / f.name)
            count += 1
    ok(f"Copied {count} command(s) from {name} → {COMMANDS_DIR}/")

step("Write suggested Claude Desktop MCP config")
shutil.copy2(BRANDING_DIR / "claude-desktop-mcp.json", SUGGESTED_MCP)
ok(f"Wrote {SUGGESTED_MCP}")
print("""
  Next: merge the JSON in claude-desktop-mcp.json into the real config on your
  Windows host at:

      %APPDATA%\\Claude\\claude_desktop_config.json

  Open it, merge the "mcpServers" object into the existing "mcpServers"
  (don't overwrite — preserve your Adobe / Postiz entries), and RESTART
  Claude Desktop.

  Required env vars (set BEFORE restarting Claude Desktop):
    FIGMA_API_KEY        — https://www.figma.com/developers/api#access-tokens
    CANVA_CONNECT_TOKEN  — https://www.canva.dev/docs/connect/
    BRAND_SYSTEM_API_KEY — Brand System MCP key
    POSTIZ_API_KEY       — already in your cluster (see Postiz DB)
""")

step("Verify install")
subprocess.run([sys.executable, str(BRANDING_DIR / "scripts" / "verify.py")], check=False)

step("Done.")
print("  Read docs/workflow.md to see the end-to-end flow.")
