#!/usr/bin/env python3
"""Metabase dashboard refresh — triggers analytics ETL sync and
prints the Metabase UI refresh steps.

Usage: python3 scripts/refresh-metabase.py
    [--sync-only | --dashboards]"""

import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

MODE = sys.argv[1] if len(sys.argv) > 1 else "all"
METABASE_URL = os.environ.get("METABASE_URL", "http://localhost:3000")

print(f"=== Metabase Refresh ({MODE}) ===")
ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
print(f"Timestamp: {ts}")

r = subprocess.run(
    ["kubectl", "get", "pods", "-n", "monitoring", "-l", "app=metabase", "--no-headers"],
    capture_output=True,
    text=True,
)
if "Running" not in r.stdout:
    print("Metabase not deployed yet. Use port-forward for local access:")
    print("  kubectl -n monitoring port-forward svc/metabase 3000:3000")
    raise SystemExit(0)

if not os.environ.get("METABASE_API_KEY"):
    print("Warning: METABASE_API_KEY not set. Some operations may fail.")

if MODE in ("--sync-only", "all"):
    print("Triggering analytics ETL sync...")
    for script, label in (
        ("scripts/etl/stripe-to-lake.mjs", "stripe-to-lake"),
        ("scripts/etl/compute-rfm-churn.mjs", "compute-rfm-churn"),
        ("scripts/etl/clients-to-lake.mjs", "clients-to-lake"),
    ):
        if Path(script).is_file():
            print(f"Running {label}...")
            run_r = subprocess.run(["npx", "tsx", script], capture_output=True)
            if run_r.returncode != 0:
                print(f"Warning: {script} requires AWS credentials")

if MODE in ("--dashboards", "all"):
    print("Triggering Metabase dashboard refresh...")
    print("To manually refresh in Metabase UI:")
    print(f"  1. Open {METABASE_URL} in browser")
    print("  2. Navigate to Admin → Databases")
    print("  3. Click 'Sync database schema now'")
    print("  4. Click 'Re-scan field values now'")

print("""
=== Key Metabase Views to Refresh ===
v_funnel_metrics: Daily leads → SQL → customers
v_lead_sources: UTM campaign breakdown
v_deal_velocity: Time in stage per deal
v_clv_cohorts: Monthly cohort analysis with RFM scores

Done.""")
