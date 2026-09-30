#!/usr/bin/env python3
"""R14 Sentry env tagging check — AWS/prod vs Pi standby builds
must tag distinct SENTRY_ENVIRONMENT values.

Usage: python3 scripts/check_r14_sentry_env_tagging.py [ROOT]"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else os.getcwd())
os.chdir(ROOT)

c = Check()
print("== R14 Sentry env tagging check ==")
print(f"Repo: {ROOT}\n")

c.expect(
    c.contains("sentry.server.config.ts", "process.env.SENTRY_ENVIRONMENT"),
    "server config uses SENTRY_ENVIRONMENT",
    "server config missing SENTRY_ENVIRONMENT",
)
c.expect(
    c.contains("sentry.edge.config.ts", "process.env.SENTRY_ENVIRONMENT"),
    "edge config uses SENTRY_ENVIRONMENT",
    "edge config missing SENTRY_ENVIRONMENT",
)
c.expect(
    c.contains("sentry.client.config.ts", "process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT"),
    "client config uses NEXT_PUBLIC_SENTRY_ENVIRONMENT",
    "client config missing NEXT_PUBLIC_SENTRY_ENVIRONMENT",
)

print()
for f in (".github/workflows/deploy-pi.yml", ".github/workflows/build-pi-image.yml"):
    if not Path(f).is_file():
        c.warning(f"{f} not found")
        continue
    c.expect(
        c.contains(f, "SENTRY_ENVIRONMENT=pi-standby"),
        f"{f} sets SENTRY_ENVIRONMENT=pi-standby",
        f"{f} missing SENTRY_ENVIRONMENT=pi-standby",
    )
    c.expect(
        c.contains(f, "NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby"),
        f"{f} sets NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby",
        f"{f} missing NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby",
    )

print()
if Path("Dockerfile").is_file():
    for text, good, bad in (
        (
            "ARG SENTRY_ENVIRONMENT",
            "Dockerfile declares ARG SENTRY_ENVIRONMENT",
            "Dockerfile missing ARG SENTRY_ENVIRONMENT",
        ),
        (
            "ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT",
            "Dockerfile declares ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT",
            "Dockerfile missing ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT",
        ),
        (
            "SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}",
            "Dockerfile exports SENTRY_ENVIRONMENT",
            "Dockerfile may not export SENTRY_ENVIRONMENT",
        ),
        (
            "NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}",
            "Dockerfile exports NEXT_PUBLIC_SENTRY_ENVIRONMENT",
            "Dockerfile may not export NEXT_PUBLIC_SENTRY_ENVIRONMENT",
        ),
    ):
        c.expect(c.contains("Dockerfile", text), good, bad, kind="warn")
else:
    c.warning("Dockerfile not found")

print()
c.expect(
    c.exists("__tests__/r14-sentry-env-tagging.test.ts"),
    "R14 static test exists",
    "R14 static test missing",
    kind="warn",
)

c.finish()
