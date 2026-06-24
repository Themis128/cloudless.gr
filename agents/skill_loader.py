from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

CORE_SKILL_FILES = [
    "docs/cloudless-agent-profile.md",
    "skills/cloudless-architecture/SKILL.md",
    "skills/cloudless-vibe-coding/SKILL.md",
    "skills/cloudless-langsmith/SKILL.md",
    "skills/cloudless-roadmap/SKILL.md",
]

TOPIC_SKILL_FILES = {
    "k3s": ["skills/cloudless-k3s-storage/SKILL.md", "skills/cluster-bash/SKILL.md"],
    "pvc": ["skills/cloudless-k3s-storage/SKILL.md", "skills/cluster-bash/SKILL.md"],
    "storage": ["skills/cloudless-k3s-storage/SKILL.md"],
    "omv": ["skills/cloudless-k3s-storage/SKILL.md"],
    "terraform": ["skills/terraform-doctor/SKILL.md"],
    "cloudflare": ["skills/cloudflare-tunnel-ops/SKILL.md", "skills/cloudflare-token-doctor/SKILL.md"],
    "espocrm": ["skills/espocrm-operator/SKILL.md"],
    "appflowy": ["skills/appflowy-operator/SKILL.md"],
    "postiz": ["skills/postiz/SKILL.md", "skills/postiz-doctor/SKILL.md"],
    "github": ["skills/gh-actions-pitfalls/SKILL.md"],
    "actions": ["skills/gh-actions-pitfalls/SKILL.md"],
    "linkedin": ["skills/linkedin-insight-doctor/SKILL.md", "skills/linkedin-campaigns/SKILL.md"],
    "mqtt": ["skills/mqtt-auth-rollout/SKILL.md"],
    "alert": ["skills/alertmanager-slack/SKILL.md"],
    "slack": ["skills/alertmanager-slack/SKILL.md"],
}


def select_skill_files(question: str) -> list[str]:
    """Select core skills plus topic-specific skills for the current question."""
    selected = list(CORE_SKILL_FILES)
    question_lc = question.lower()

    for keyword, files in TOPIC_SKILL_FILES.items():
        if keyword in question_lc:
            selected.extend(files)

    deduped = []
    seen = set()

    for skill_path in selected:
        if skill_path not in seen:
            deduped.append(skill_path)
            seen.add(skill_path)

    return deduped


def load_skill_context(question: str = "", max_chars: int = 4000) -> str:
    """Load selected cloudless.gr Deep Agent skills as prompt context."""
    parts = []

    for skill_path in select_skill_files(question):
        skill_file = REPO_ROOT / skill_path

        if not skill_file.exists():
            continue

        content = skill_file.read_text(encoding="utf-8", errors="ignore").strip()

        if not content:
            continue

        parts.append(
            "[SKILL]\n"
            f"File: {skill_path}\n\n"
            f"{content}"
        )

    return "\n\n---\n\n".join(parts)[:max_chars]
