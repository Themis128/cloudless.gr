#!/usr/bin/env python3
"""app-auth-doctor — read-only: how is the Pi `cloudless` app
wired for auth?

Shows the deployment's env var NAMES + sources (never values),
envFrom, secrets/configmaps in the namespace and their KEY names,
and whether auth-critical vars (AUTH_SECRET, COGNITO_*) are
present."""

import os
import re
import shutil
import subprocess
import sys
from datetime import UTC, datetime

NS = os.environ.get("NS", "cloudless")
DEP = os.environ.get("DEP", "cloudless")

if not shutil.which("kubectl"):
    sys.exit("kubectl not found")


def kubectl(*args: str) -> str:
    r = subprocess.run(["kubectl", "-n", NS, *args], capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


now = datetime.now(UTC).strftime("%F %T")
print(f"== app-auth-doctor {now}Z  (ns={NS} deploy={DEP}) ==\n")

print("## deployment env (name <- value? / secretRef / configMapRef):")
out = kubectl(
    "get",
    "deploy",
    DEP,
    "-o",
    "jsonpath={range "
    ".spec.template.spec.containers[0].env[*]}"
    '{.name}{" <- value:"}{.value}{" sec:"}'
    '{.valueFrom.secretKeyRef.name}{"/"}'
    '{.valueFrom.secretKeyRef.key}{" cm:"}'
    '{.valueFrom.configMapKeyRef.name}{"/"}'
    '{.valueFrom.configMapKeyRef.key}{"\\n"}{end}',
)
print(out)

print("\n## envFrom (whole secret/configmap imports):")
print(
    kubectl(
        "get",
        "deploy",
        DEP,
        "-o",
        "jsonpath={range .spec.template.spec.containers"
        '[0].envFrom[*]}{"secretRef:"}{.secretRef.name}'
        '{" configMapRef:"}{.configMapRef.name}'
        '{"\\n"}{end}',
    )
)

env_names = set(
    kubectl(
        "get", "deploy", DEP, "-o", "jsonpath={.spec.template.spec.containers[0].env[*].name}"
    ).split()
)

print("\n## auth-critical env present in the deployment?")
for v in (
    "AUTH_SECRET",
    "AUTH_TRUST_HOST",
    "AUTH_URL",
    "COGNITO_ISSUER",
    "COGNITO_CLIENT_ID",
    "COGNITO_CLIENT_SECRET",
    "COGNITO_DOMAIN",
    "NEXT_PUBLIC_AUTH_PROVIDER",
    "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
):
    print(f"  {v:<30} {'PRESENT' if v in env_names else 'MISSING'}")

print(f"\n## secrets in ns/{NS}:")
secrets = kubectl("get", "secret", "-o", "name").splitlines()
for s in secrets:
    print(f"  {s}")
print(f"## configmaps in ns/{NS}:")
configmaps = kubectl("get", "configmap", "-o", "name").splitlines()
for c in configmaps:
    print(f"  {c}")

PAT = re.compile(
    r"auth|cognito|app|env|config|cloudless"
    r"|integration|ssm",
    re.I,
)
print("\n## key NAMES (not values) of auth-ish secrets/configmaps:")
for s in secrets:
    name = s.removeprefix("secret/")
    if not PAT.search(name):
        continue
    out = kubectl("get", "secret", name, "-o", "jsonpath={.data}")
    keys = re.findall(r'"([^"]+)":', out)
    if keys:
        print(f"  secret/{name}:")
        for k in keys:
            print(f"      {k}")
for c in configmaps:
    name = c.removeprefix("configmap/")
    if not PAT.search(name):
        continue
    out = kubectl("get", "configmap", name, "-o", "jsonpath={.data}")
    keys = re.findall(r'"([^"]+)":', out)
    if keys:
        print(f"  configmap/{name}:")
        for k in keys:
            print(f"      {k}")

print("\n## AWS/SSM wiring (how the app reaches SSM at runtime):")
aws = [n for n in env_names if re.search(r"AWS|SSM|REGION|ROLE", n, re.I)]
print("\n".join(f"  {n}" for n in aws) if aws else "  (no AWS_* env names)")

print("## pi-standby-aws-creds secret present?")
print("  " + kubectl("get", "secret", "pi-standby-aws-creds", "-o", "jsonpath={.metadata.name}"))

print("\n_End app-auth-doctor._")
