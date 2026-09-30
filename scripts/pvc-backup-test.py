#!/usr/bin/env python3
"""pvc-backup-test.py — create a one-shot Job from a pvc-backup
CronJob in the correct namespace, wait for the pod, stream logs.

Avoids "No resources found in <ns>" by always pairing CronJob ↔
namespace.

Usage:
  python3 scripts/pvc-backup-test.py list
  python3 scripts/pvc-backup-test.py appflowy
  python3 scripts/pvc-backup-test.py minio
  python3 scripts/pvc-backup-test.py kuma"""

import shutil
import subprocess
import sys
import time

# target → (namespace, cronjob)
TARGETS = {
    "appflowy": ("appflowy", "pvc-backup-appflowy"),
    "espocrm": ("espocrm", "pvc-backup-espocrm"),
    "postiz": ("postiz", "pvc-backup-postiz"),
    "n8n": ("n8n", "pvc-backup-n8n"),
    "minio": ("appflowy", "pvc-backup-appflowy-minio"),
    "appflowy-minio": ("appflowy", "pvc-backup-appflowy-minio"),
    "kuma": ("uptime-kuma", "pvc-backup-uptime-kuma"),
    "uptime-kuma": ("uptime-kuma", "pvc-backup-uptime-kuma"),
}

USAGE = """\
Usage: pvc-backup-test.py <target|list>

Targets (CronJob lives in matching NS — do not guess -n):
  appflowy       → -n appflowy      pvc-backup-appflowy
  espocrm        → -n espocrm       pvc-backup-espocrm
  postiz         → -n postiz        pvc-backup-postiz
  n8n            → -n n8n           pvc-backup-n8n
  minio          → -n appflowy      pvc-backup-appflowy-minio
  kuma           → -n uptime-kuma   pvc-backup-uptime-kuma"""


def list_targets() -> None:
    print(f"{'TARGET':<14} {'NAMESPACE':<14} CRONJOB")
    seen = set()
    for t, (ns, cj) in TARGETS.items():
        if cj in seen:
            continue
        seen.add(cj)
        print(f"{t:<14} {ns:<14} {cj}")
    print("\nLive CronJobs:")
    r = subprocess.run(
        ["kubectl", "get", "cronjob", "-A", "-l",
         "app.kubernetes.io/name=pvc-backup",
         "-o", "custom-columns=NAMESPACE:.metadata.namespace,"
         "NAME:.metadata.name,SCHEDULE:.spec.schedule"],
        capture_output=True, text=True)
    print(r.stdout if r.returncode == 0 else
          subprocess.run(["kubectl", "get", "cronjob", "-A"],
                         capture_output=True,
                         text=True).stdout)


arg = sys.argv[1] if len(sys.argv) > 1 else ""
if arg in ("", "-h", "--help"):
    print(USAGE)
    sys.exit(2)
if arg == "list":
    list_targets()
    sys.exit(0)
if not shutil.which("kubectl"):
    sys.exit("kubectl not found")
if arg not in TARGETS:
    print(f"Unknown target: {arg}", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    sys.exit(2)

ns, cj = TARGETS[arg]
job = f"test-{arg}-{int(time.time())}".replace("/", "-")

print(f"→ namespace={ns} cronjob={cj} job={job}")
if subprocess.call(["kubectl", "-n", ns, "get", "cronjob", cj],
                   stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL) != 0:
    print(f"CronJob {cj} not found in namespace {ns}",
          file=sys.stderr)
    print("Hint: kubectl get cronjob -A | grep pvc-backup",
          file=sys.stderr)
    sys.exit(1)

r = subprocess.run(
    ["kubectl", "-n", ns, "create", "job",
     f"--from=cronjob/{cj}", job])
if r.returncode != 0:
    sys.exit(r.returncode)

subprocess.run(
    ["kubectl", "-n", ns, "patch", "job", job, "--type=merge",
     "-p", '{"spec":{"ttlSecondsAfterFinished":3600}}'],
    capture_output=True)

pod = ""
for _ in range(60):
    r = subprocess.run(
        ["kubectl", "-n", ns, "get", "pods",
         "-l", f"job-name={job}",
         "-o", "jsonpath={.items[0].metadata.name}"],
        capture_output=True, text=True)
    pod = r.stdout.strip()
    if pod:
        break
    time.sleep(1)

if not pod:
    print(f"No pod appeared in namespace {ns} for job-name={job}",
          file=sys.stderr)
    subprocess.run(["kubectl", "-n", ns, "describe", "job", job],
                   stderr=sys.stderr)
    sys.exit(1)

print(f"→ pod={pod} (ns={ns})")
print(f"   find later: kubectl -n {ns} get pods -l job-name={job}")
print(f"            or: kubectl -n {ns} get pods -l "
      "app.kubernetes.io/name=pvc-backup")
subprocess.run(["kubectl", "-n", ns, "wait",
                "--for=condition=Ready", f"pod/{pod}",
                "--timeout=120s"], capture_output=True)
subprocess.run(["kubectl", "-n", ns, "logs", "-f", pod])

r = subprocess.run(
    ["kubectl", "-n", ns, "wait", "--for=condition=complete",
     f"job/{job}", "--timeout=60s"], capture_output=True)
if r.returncode == 0:
    print(f"OK {job} succeeded in ns={ns}")
    subprocess.run(["kubectl", "-n", ns, "delete", "job", job,
                    "--wait=false"], capture_output=True)
    sys.exit(0)

r = subprocess.run(
    ["kubectl", "-n", ns, "get", "job", job, "-o",
     "jsonpath={.status.failed}"],
    capture_output=True, text=True)
print(f"ERROR {job} did not complete successfully "
      f"(failed={r.stdout.strip() or 0}) in ns={ns}",
      file=sys.stderr)
subprocess.run(["kubectl", "-n", ns, "get", "pod", pod,
                "-o", "wide"], stderr=sys.stderr)
sys.exit(1)
