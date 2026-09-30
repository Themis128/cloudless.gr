#!/usr/bin/env python3
"""cloudless.gr app completion basics — aggregates the R-check
suite plus file/code evidence for R13/R18/R21/R22."""

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

c = Check()
print("== cloudless.gr app completion basics ==\n")


def run_check(name: str) -> bool:
    for ext, runner in ((".py", [sys.executable]), (".sh", ["bash"])):
        script = Path(f"scripts/{name}{ext}")
        if script.exists():
            return (
                subprocess.call(
                    [*runner, str(script)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
                == 0
            )
    return False


c.expect(run_check("check_r14_sentry_env_tagging"), "R14 Sentry environment tagging")
c.expect(run_check("check_r21_search_baseline"), "R21 search baseline")
c.expect(run_check("check_r21_meilisearch_k3s_storage"), "R21 Meilisearch k3s storage contract")

c.expect(c.exists("src/lib/product-recommendations.ts"), "R21 product recommendations helper")
c.expect(
    c.exists("src/app/api/products/recommendations/route.ts"), "R21 product recommendations API"
)
c.expect(
    c.contains("src/app/[locale]/store/[id]/page.tsx", "recommendProductsForProduct"),
    "R21 product page recommendations",
)
c.expect(c.exists("src/lib/product-recommendation-signals.ts"), "R21 co-purchase signal helper")


def grep_re(pattern: str, paths: list[str]) -> bool:
    rx = re.compile(pattern)
    for base in paths:
        p = Path(base)
        files = [p] if p.is_file() else list(p.rglob("*")) if p.is_dir() else []
        for f in files:
            if f.is_file() and rx.search(f.read_text(errors="replace") or ""):
                return True
    return False


c.expect(
    grep_re(
        r"coPurchaseScore|ProductOrderSignal",
        ["src/lib/product-recommendations.ts", "__tests__/product-recommendations.test.ts"],
    ),
    "R21 co-purchase recommendation boost",
)
c.expect(
    grep_re(r"event\.id|idempot|dedup", ["src/app/api/webhooks/stripe", "src/lib", "__tests__"]),
    "R22 Stripe idempotency evidence",
)
c.expect(
    grep_re(r"espo|mariadb|mysql", [])
    or any(
        f
        for g in (Path(d).rglob("*") for d in ("k8s", "infrastructure", "scripts"))
        for f in g
        if f.is_file()
        and re.search(r"espo|mariadb|mysql", f.name, re.I)
        and re.search(r"backup|s3", f.name, re.I)
    ),
    "R13 EspoCRM backup evidence",
)
c.expect(
    grep_re(
        r"SSM_PREFIX|aws ssm|get-parameter", ["src", "scripts", "infrastructure", "k8s", ".github"]
    ),
    "R18 SSM usage evidence",
)

print()
c.finish()
