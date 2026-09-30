#!/usr/bin/env python3
"""Shortcut for the review-repo script in patch mode.

Usage: python3 scripts/coding-agent-propose-patch.py [BASE_URL]"""

import os
import subprocess
import sys
from pathlib import Path

BASE_URL = (sys.argv[1] if len(sys.argv) > 1
            else "https://cloudless-gr."
                 "baltzakis-themis.workers.dev")

os.environ["REVIEW_MODE"] = "patch"
os.environ.setdefault("MAX_FILE_CHARS", "12000")

review = (Path(__file__).parent
          / "coding-agent-review-repo.py")
if review.exists():
    sys.exit(subprocess.call(
        [sys.executable, str(review), BASE_URL]))
sys.exit(subprocess.call(
    ["bash",
     str(Path(__file__).parent
         / "coding-agent-review-repo.sh"), BASE_URL]))
