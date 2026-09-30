#!/usr/bin/env python3
"""Run the k6 baseline performance test, then the comprehensive
suite if the baseline passes."""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if not shutil.which("k6"):
    sys.exit("k6 is not installed. Please install it first.")

print("Running baseline performance test...")
r = subprocess.run(["k6", "run",
                    "__tests__/performance/baseline.test.js"],
                   cwd=ROOT)
if r.returncode != 0:
    sys.exit("Baseline test failed. Please check the test "
             "results.")

print("Baseline test passed successfully.")
print("Running comprehensive performance test...")
r = subprocess.run(["k6", "run",
                    "__tests__/performance/comprehensive.test.js"],
                   cwd=ROOT)
sys.exit(r.returncode)
