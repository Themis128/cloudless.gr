#!/usr/bin/env python3
"""Self-hosted runner risk audit — flags workflows that combine a
self-hosted runner with risky triggers (pull_request,
pull_request_target, issue_comment, workflow_run,
repository_dispatch)."""

import re
from pathlib import Path

WORKFLOWS = [
    ".github/workflows/cluster-status-audit.yml",
    ".github/workflows/deploy-alert-api.yml",
    ".github/workflows/etl-espocrm-to-lake.yml",
    ".github/workflows/rollout-pi-force.yml",
    ".github/workflows/sync-smtp-secrets.yml",
    ".github/workflows/wire-pi-cognito-from-pi.yml",
]

LINES_OF_INTEREST = re.compile(
    r"^(on:|  pull_request|  pull_request_target|"
    r"  issue_comment|  workflow_run|  repository_dispatch|"
    r"  workflow_dispatch|  schedule|  push|permissions:|"
    r"    permissions:|    runs-on:|      - self-hosted|"
    r"      uses: actions/checkout|        ref:)"
)

RISKY_TRIGGER = re.compile(
    r"pull_request|pull_request_target|issue_comment|"
    r"workflow_run|repository_dispatch"
)

print("=== Self-hosted runner risk audit ===\n")

for f in WORKFLOWS:
    print(f"\n===== {f} =====")
    path = Path(f)
    if not path.is_file():
        print("missing")
        continue

    text = path.read_text(errors="replace")
    for i, line in enumerate(text.splitlines(), 1):
        if LINES_OF_INTEREST.match(line):
            print(f"{i}:{line}")

    self_hosted = "runs-on:.*self-hosted" in text or bool(re.search(r"runs-on:.*self-hosted", text))
    if self_hosted and RISKY_TRIGGER.search(text):
        print("RISK: self-hosted workflow has potentially risky trigger.")
    elif self_hosted:
        print("OK: self-hosted runner used only by trusted operational trigger(s).")
    else:
        print("OK: no self-hosted runner detected in this workflow.")
