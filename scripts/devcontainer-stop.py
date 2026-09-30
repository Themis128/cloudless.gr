#!/usr/bin/env python3
"""Stop/remove dev containers created for this workspace root."""

import os
import subprocess

workspace = os.path.realpath(os.getcwd())
label = f"devcontainer.local_folder={workspace}"

r = subprocess.run(["docker", "ps", "-aq", "--filter",
                    f"label={label}"], capture_output=True,
                   text=True)
ids = r.stdout.split()
if not ids:
    print(f"No matching devcontainer found for {workspace}.")
    raise SystemExit(0)

print("Removing devcontainer(s):")
print("\n".join(ids))
subprocess.run(["docker", "rm", "-f", *ids])
print("Devcontainer cleanup complete.")
