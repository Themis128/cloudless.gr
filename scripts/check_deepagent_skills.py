from pathlib import Path

required = [
    "skills/cloudless-architecture/SKILL.md",
    "skills/cloudless-langsmith/SKILL.md",
    "skills/cloudless-vibe-coding/SKILL.md",
    "skills/cloudless-k3s-storage/SKILL.md",
    "skills/cloudless-roadmap/SKILL.md",
    "agents/tools/cloudless_project_tools.py",
    "agents/tools/langsmith_registry_tools.py",
    "docs/cloudless-agent-profile.md",
    "docs/agentic-migration/mcp-config-template.json",
    "docs/agentic-migration/claude-desktop-inventory.md",
]

failed = False

print("cloudless.gr Deep Agent tools/skills check")
print("=" * 48)

for item in required:
    exists = Path(item).exists()
    print(f"{'✅' if exists else '❌'} {item}")
    failed = failed or not exists

if failed:
    raise SystemExit(1)

print("\nAll required tools and skills exist.")
