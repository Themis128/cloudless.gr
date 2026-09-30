#!/usr/bin/env python3
"""Removes the symlinks/commands placed by setup.py.

Port of uninstall.sh. Leaves repos/ and cloudless-brand/ in place.

Usage: python3 BRANDING/scripts/uninstall.py
"""

from pathlib import Path

BRANDING_DIR = Path(__file__).resolve().parent.parent
SKILLS_DIR = Path.home() / ".claude" / "skills"
COMMANDS_DIR = Path.home() / ".claude" / "commands"

removed = 0

print(f"Removing symlinks pointing into {BRANDING_DIR} ...")
if SKILLS_DIR.is_dir():
    for s in sorted(SKILLS_DIR.iterdir()):
        if not s.is_symlink():
            continue
        try:
            if str(s.resolve()).startswith(str(BRANDING_DIR)):
                s.unlink()
                print(f"  removed {s}")
                removed += 1
        except OSError:
            continue

print("Removing slash-commands copied by setup.py ...")
src = BRANDING_DIR / "repos" / "brand-design-skill" / ".claude" / "commands"
if COMMANDS_DIR.is_dir() and src.is_dir():
    for f in sorted(src.glob("*.md")):
        target = COMMANDS_DIR / f.name
        if target.is_file():
            target.unlink()
            print(f"  removed {target}")
            removed += 1

print(f"Done. {removed} item(s) removed. Re-run setup.py to re-install.")
