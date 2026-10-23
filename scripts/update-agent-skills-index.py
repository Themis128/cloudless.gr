#!/usr/bin/env python3
"""Regenerate public/.well-known/agent-skills/index.json.

Each published skill lives at public/.well-known/agent-skills/<name>/SKILL.md.
This script recomputes sha256 digests and rewrites the discovery index —
run it after editing any SKILL.md so digests stay honest.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = ROOT / "public" / ".well-known" / "agent-skills"
BASE = "https://cloudless.gr/.well-known/agent-skills"


def field(skill_md: str, key: str) -> str:
    m = re.search(rf"^{key}:\s*(.+)$", skill_md, re.M)
    return m.group(1).strip() if m else ""


def main() -> None:
    skills = []
    for md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        body = md.read_text(encoding="utf-8")
        name = field(body, "name") or md.parent.name
        skills.append(
            {
                "name": name,
                "type": "skill-md",
                "description": field(body, "description"),
                "url": f"{BASE}/{md.parent.name}/SKILL.md",
                "digest": "sha256:" + hashlib.sha256(body.encode()).hexdigest(),
            }
        )
    index = {"$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json", "skills": skills}
    out = SKILLS_DIR / "index.json"
    out.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} with {len(skills)} skills")


if __name__ == "__main__":
    main()
