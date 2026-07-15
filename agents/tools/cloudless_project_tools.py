from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List


REPO_ROOT = Path(__file__).resolve().parents[2]

SAFE_TEXT_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".toml",
    ".sh",
    ".css",
    ".scss",
    ".txt",
}

DENY_PATH_PARTS = {
    ".git",
    ".venv",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".deepagents",
}

SECRET_MARKERS = {
    "SECRET",
    "TOKEN",
    "API_KEY",
    "PRIVATE_KEY",
    "PASSWORD",
    "CLIENT_SECRET",
    "AUTH_SECRET",
    "CLOUDFLARE_API_TOKEN",
    "STRIPE_SECRET",
    "COGNITO_CLIENT_SECRET",
}


def _relative(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def _is_denied(path: Path) -> bool:
    parts = set(path.parts)
    return bool(parts & DENY_PATH_PARTS)


def _is_safe_text_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in SAFE_TEXT_SUFFIXES and not _is_denied(path)


def _redact_line(line: str) -> str:
    upper = line.upper()

    if "=" in line and any(marker in upper for marker in SECRET_MARKERS):
        key = line.split("=", 1)[0]
        return f"{key}=<REDACTED>"

    if ":" in line and any(marker in upper for marker in SECRET_MARKERS):
        key = line.split(":", 1)[0]
        return f"{key}: <REDACTED>"

    return line


def list_project_files(max_files: int = 500) -> str:
    """List safe project files from the cloudless.gr repository."""
    files: List[str] = []

    for path in sorted(REPO_ROOT.rglob("*")):
        if len(files) >= max_files:
            break

        if _is_safe_text_file(path):
            files.append(_relative(path))

    return json.dumps(files, indent=2)


def read_project_file(path: str, max_chars: int = 12000) -> str:
    """Read a safe text file from the project with secret-like values redacted."""
    target = (REPO_ROOT / path).resolve()

    if not str(target).startswith(str(REPO_ROOT)):
        return "Denied: path escapes repository root."

    if not _is_safe_text_file(target):
        return "Denied or unsupported file type."

    text = target.read_text(encoding="utf-8", errors="ignore")
    redacted = "\n".join(_redact_line(line) for line in text.splitlines())

    return redacted[:max_chars]


def project_tree_summary() -> str:
    """Return a high-level summary of important cloudless.gr directories."""
    important = [
        "src",
        "app",
        "agents",
        "scripts",
        "tools",
        "docs",
        "infrastructure",
        "k8s",
        "skills",
        ".github/workflows",
    ]

    result: Dict[str, Any] = {}

    for name in important:
        path = REPO_ROOT / name
        if not path.exists():
            continue

        files = []
        for item in sorted(path.rglob("*")):
            if item.is_file() and not _is_denied(item):
                files.append(_relative(item))
            if len(files) >= 80:
                break

        result[name] = files

    return json.dumps(result, indent=2)


def package_scripts() -> str:
    """Return package.json scripts."""
    package_path = REPO_ROOT / "package.json"

    if not package_path.exists():
        return "package.json not found."

    data = json.loads(package_path.read_text(encoding="utf-8"))
    return json.dumps(data.get("scripts", {}), indent=2)


def cloudless_constraints() -> str:
    """Return project-specific architectural constraints for cloudless.gr."""
    return """
cloudless.gr constraints:
- AWS Lambda/SST is the primary web app runtime.
- Pi k3s is warm-standby for the web app and primary host for self-hosted apps.
- Self-hosted apps live only on Pi: AppFlowy, EspoCRM, Postiz, n8n, Mosquitto, Grafana, Uptime Kuma, ntfy.
- Do not assume Pi-hosted apps have AWS replicas.
- Persistent k3s workloads must use the dedicated 120GB SSD on OMV-MAIN.
- Do not commit .env.local, generated Chroma DBs, .deepagents data, or secrets.
- Prefer patch proposal + human approval before file writes.
"""
