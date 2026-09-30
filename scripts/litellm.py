#!/usr/bin/env python3
"""Manage the LiteLLM proxy for Postiz AI (routes to Ollama).
Usage: python3 scripts/litellm.py {start|stop|restart|status|logs}"""

import subprocess
import sys
import time

NAMESPACE = "postiz"
DEPLOYMENT = "postiz-litellm"
MANIFEST = "infrastructure/appflowy/evicted-deployments/postiz-litellm.yaml"


def bold(*a):
    print(f"\033[1m{' '.join(a)}\033[0m")


def warn(*a):
    print(f"\033[33mWARN: {' '.join(a)}\033[0m", file=sys.stderr)


def kube(*args: str, quiet: bool = False) -> int:
    return subprocess.call(
        ["kubectl", *args],
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.DEVNULL if quiet else None,
    )


def start() -> None:
    bold("==> Starting LiteLLM")
    if kube("-n", NAMESPACE, "get", "deploy", DEPLOYMENT, quiet=True) == 0:
        print("    already exists — skipping apply")
    else:
        kube("apply", "-f", MANIFEST)
    kube("-n", NAMESPACE, "rollout", "status", f"deploy/{DEPLOYMENT}", "--timeout=120s")
    kube("-n", NAMESPACE, "get", "pods", "-l", f"app={DEPLOYMENT}")


def stop() -> None:
    bold("==> Stopping LiteLLM")
    kube("-n", NAMESPACE, "delete", "deploy", DEPLOYMENT)
    kube("-n", NAMESPACE, "get", "pods", "-l", f"app={DEPLOYMENT}")


cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "start":
    start()
elif cmd == "stop":
    stop()
elif cmd == "restart":
    stop()
    time.sleep(2)
    start()
elif cmd == "status":
    kube("-n", NAMESPACE, "get", "pods", "-l", f"app={DEPLOYMENT}")
elif cmd == "logs":
    kube("-n", NAMESPACE, "logs", f"deploy/{DEPLOYMENT}", "--tail=50", "-f")
else:
    sys.exit(f"Usage: {sys.argv[0]} {{start|stop|restart|status|logs}}")
