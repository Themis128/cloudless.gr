#!/usr/bin/env python3
"""Tear down the Postiz release.

Port of uninstall.sh. Keeps PVCs by default so accidental runs
don't nuke the database — pass --delete-pvcs to wipe state.

Usage: python3 uninstall.py [--delete-pvcs] [--delete-ns]
"""

import argparse
import os
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument(
    "--delete-pvcs",
    action="store_true",
    help="Delete all 3 PVCs (postgres, redis, uploads). DESTROYS DATA.",
)
parser.add_argument(
    "--delete-ns",
    action="store_true",
    help="Delete the postiz namespace entirely (includes secrets).",
)
args = parser.parse_args()

NAMESPACE = os.environ.get("NAMESPACE", "postiz")
RELEASE = os.environ.get("RELEASE", "postiz")


def run(*cmd: str) -> None:
    subprocess.run(list(cmd), check=False)


print(f"==> helm uninstall {RELEASE} -n {NAMESPACE}")
run("helm", "uninstall", RELEASE, "-n", NAMESPACE)

if args.delete_pvcs:
    print("==> deleting PVCs")
    run(
        "kubectl",
        "-n",
        NAMESPACE,
        "delete",
        "pvc",
        "postiz-postgres-data",
        "postiz-redis-data",
        "postiz-uploads",
        "--ignore-not-found",
    )

if args.delete_ns:
    print("==> deleting namespace")
    run("kubectl", "delete", "namespace", NAMESPACE, "--ignore-not-found")

print("done.")
