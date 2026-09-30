#!/usr/bin/env python3
"""Disable CloudFront distribution for cloudless.gr.

Usage:
  AWS_SHARED_CREDENTIALS_FILE=/path/to/rootkey.csv \
      python3 scripts/disable-cloudfront.py
  CF_DISTRIBUTION_ID env (default ELGQBR8109MTM)"""

import json
import os
import subprocess
import sys

DIST_ID = os.environ.get("CF_DISTRIBUTION_ID", "ELGQBR8109MTM")


def aws(*args: str) -> dict:
    r = subprocess.run(["aws", *args, "--output", "json"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"aws {' '.join(args)} failed: {r.stderr.strip()}")
    return json.loads(r.stdout)


print("=== Disabling CloudFront Distribution for cloudless.gr ===")
print(f"Distribution ID: {DIST_ID}")

print("Fetching distribution config...")
resp = aws("cloudfront", "get-distribution-config", "--id", DIST_ID)
etag = resp["ETag"]
config = resp["DistributionConfig"]
print(f"ETag: {etag}")
print(f"Currently enabled: {config['Enabled']}")

if not config["Enabled"]:
    print("Already disabled. Exiting.")
    sys.exit(0)

config["Enabled"] = False
print("Disabling distribution...")
r = subprocess.run(
    ["aws", "cloudfront", "update-distribution", "--id", DIST_ID,
     "--if-match", etag, "--distribution-config",
     json.dumps(config), "--output", "json"],
    capture_output=True, text=True)
if r.returncode != 0:
    sys.exit(r.stderr.strip())
status = json.loads(r.stdout)["Distribution"]["Status"]
print(f"Distribution status: {status} (deletion takes effect after "
      "status = Deployed)")

print("=== CloudFront distribution disable initiated ===")
print("NOTE: After status reaches 'Deployed', you can delete the "
      "distribution with:")
print(f"aws cloudfront delete-distribution --id {DIST_ID} "
      "--if-match <final-etag>")
