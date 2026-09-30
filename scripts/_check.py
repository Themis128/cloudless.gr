"""Shared pass/warn/fail check harness used by the scripts/check_*
family. Mirrors the bash counter + ✓/❌/⚠ output contract and the
exit-nonzero-on-failure convention."""

import re
import sys
from pathlib import Path


class Check:
    def __init__(self) -> None:
        self.ok = 0
        self.warn_count = 0
        self.fail_count = 0

    def passed(self, msg: str) -> None:
        print(f"✅ {msg}")
        self.ok += 1

    def missing(self, msg: str) -> None:
        print(f"❌ {msg}")
        self.fail_count += 1

    def warning(self, msg: str) -> None:
        print(f"⚠️  {msg}")
        self.warn_count += 1

    def expect(self, cond: bool, msg: str,
               kind: str = "fail") -> bool:
        """cond → passed(msg); else missing/warning(msg)."""
        if cond:
            self.passed(msg)
        elif kind == "warn":
            self.warning(msg)
        else:
            self.missing(msg)
        return cond

    @staticmethod
    def contains(file: str | Path, text: str) -> bool:
        p = Path(file)
        return p.is_file() and text in p.read_text(
            errors="replace")

    @staticmethod
    def contains_re(file: str | Path, pattern: str) -> bool:
        p = Path(file)
        return p.is_file() and bool(
            re.search(pattern, p.read_text(errors="replace")))

    @staticmethod
    def exists(path: str | Path) -> bool:
        return Path(path).exists()

    def summary(self) -> int:
        print(f"\nSummary: {self.ok} passed, "
              f"{self.warn_count} warnings, "
              f"{self.fail_count} failures")
        return 0 if self.fail_count == 0 else 1

    def finish(self) -> None:
        sys.exit(self.summary())
