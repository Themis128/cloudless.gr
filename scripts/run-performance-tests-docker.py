#!/usr/bin/env python3
"""Run k6 performance tests via the grafana/k6 Docker image —
baseline first, then comprehensive if it passes."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def k6(test: str) -> int:
    return subprocess.call(
        ["docker", "run", "-v", f"{ROOT}:/k6", "grafana/k6",
         "run", f"/k6/{test}"])


print("Running baseline performance test...")
if k6("__tests__/performance/baseline.test.js") != 0:
    sys.exit("Baseline test failed. Please check the test "
             "results.")

print("Baseline test passed successfully.")
print("Running comprehensive performance test...")
sys.exit(k6("__tests__/performance/comprehensive.test.js"))
