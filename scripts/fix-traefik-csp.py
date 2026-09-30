#!/usr/bin/env python3
"""One-shot: remove Content-Security-Policy from the Traefik
secure-headers middleware in the cloudless namespace so the
Next.js app's own full CSP (with object-src 'none', connect-src
*.sentry.io, per-request nonces) passes through to clients.

Root cause: Traefik customResponseHeaders overwrites backend
response headers; the simplified CSP was missing object-src and
sentry.io, failing the k3s standby smoke test."""

import os
import subprocess
import sys
import time
import urllib.request

NS = os.environ.get("CLOUDLESS_NS", "cloudless")
MW = "secure-headers"


def note(msg: str) -> None:
    print(f"[fix-traefik-csp] {msg}")


note(f"=== fix-traefik-csp {time.strftime('%Y-%m-%d %H:%M:%SZ', time.gmtime())} ===")
note(f"Namespace: {NS}  Middleware: {MW}")

note("Current CSP in middleware:")
r = subprocess.run(
    [
        "kubectl",
        "-n",
        NS,
        "get",
        "middleware",
        MW,
        "-o",
        "jsonpath={.spec.headers.customResponseHeaders.Content-Security-Policy}",
    ],
    capture_output=True,
    text=True,
)
print(r.stdout + r.stderr)

note("Patching: removing Content-Security-Policy from customResponseHeaders...")
r = subprocess.run(
    [
        "kubectl",
        "-n",
        NS,
        "patch",
        "middleware",
        MW,
        "--type=json",
        "-p",
        '[{"op":"remove","path":"/spec/headers/customResponseHeaders/Content-Security-Policy"}]',
    ],
    capture_output=True,
    text=True,
)
print(r.stdout + r.stderr)
if r.returncode != 0:
    sys.exit("ERROR: patch failed")

note("Patch applied. Verifying middleware spec:")
r = subprocess.run(
    ["kubectl", "-n", NS, "get", "middleware", MW, "-o", "yaml"], capture_output=True, text=True
)
lines = r.stdout.splitlines()
for i, ln in enumerate(lines):
    if "customResponseHeaders:" in ln:
        print("\n".join(lines[i : i + 21]))
        break

note("Probing pi-origin.cloudless.gr/api/health for updated CSP...")
try:
    req = urllib.request.Request("https://pi-origin.cloudless.gr/api/health", method="HEAD")
    resp = urllib.request.urlopen(req, timeout=15)
    csp = resp.headers.get("Content-Security-Policy", "")
except Exception:
    csp = ""
if csp:
    note(f"CSP header: {csp}")
    if "object-src 'none'" in csp:
        note("PASS: object-src 'none' present — Next.js CSP is now served")
    else:
        note("WARNING: object-src 'none' still missing — may need a pod restart")
else:
    note("(could not read CSP from pi-origin — check manually)")

note("=== DONE ===")
