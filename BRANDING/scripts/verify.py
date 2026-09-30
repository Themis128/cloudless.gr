#!/usr/bin/env python3
"""Verify which skills, commands, and MCP servers are wired up.

Port of verify.sh.
Usage: python3 BRANDING/scripts/verify.py
"""

import os
from pathlib import Path

SKILLS_DIR = Path.home() / ".claude" / "skills"
COMMANDS_DIR = Path.home() / ".claude" / "commands"
SUGGESTED = Path.home() / ".config" / "Claude" / "claude_desktop_config.suggested.json"


def ok(msg: str) -> None:
    print(f"  \033[1;32m✓\033[0m {msg}")


def miss(msg: str) -> None:
    print(f"  \033[1;31m✗\033[0m {msg}")


print("\n===== Cloudless BRANDING install report =====\n")

print(f"Skills installed under {SKILLS_DIR}:")
if SKILLS_DIR.is_dir():
    for s in sorted(SKILLS_DIR.iterdir()):
        if s.is_symlink():
            ok(f"{s.name} → {os.readlink(s)}")
        else:
            ok(f"{s.name} (directory)")
else:
    miss(f"{SKILLS_DIR} does not exist")

print(f"\nSlash-commands installed under {COMMANDS_DIR}:")
if COMMANDS_DIR.is_dir():
    for c in sorted(COMMANDS_DIR.glob("*.md")):
        ok(f"/{c.stem}")
else:
    miss(f"{COMMANDS_DIR} does not exist")

print("\nClaude Desktop MCP suggestion file:")
if SUGGESTED.is_file():
    ok(f"{SUGGESTED} ({len(SUGGESTED.read_text().splitlines())} lines)")
else:
    miss("Run setup.py to generate it")

print("\nEnvironment variables (for MCP servers):")
for var in ("FIGMA_API_KEY", "CANVA_CONNECT_TOKEN", "BRAND_SYSTEM_API_KEY", "POSTIZ_API_KEY"):
    if os.environ.get(var):
        ok(f"{var} is set")
    else:
        miss(f"{var} is NOT set")
print()
