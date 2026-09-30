#!/usr/bin/env python3
"""DDNS update auth check — verifies the tracked script/env
example exist, and the remote node's install/cron state.

Usage: python3 scripts/check_ddns_update_auth.py [node]
(default omv)"""

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

node = sys.argv[1] if len(sys.argv) > 1 else "omv"

c = Check()
print("== DDNS update auth check ==")
print(f"Node: {node}\n")

c.expect(c.exists(
    "infrastructure/omv/ddns-update-auth.sh"),
    "tracked DDNS script exists",
    "tracked DDNS script missing: "
    "infrastructure/omv/ddns-update-auth.sh")
c.expect(c.exists(
    "infrastructure/omv/ddns-update-auth.env.example"),
    "tracked DDNS env example exists",
    "tracked DDNS env example missing: "
    "infrastructure/omv/ddns-update-auth.env.example",
    kind="warn")


def ssh(cmd: str) -> bool:
    return subprocess.call(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
         node, cmd],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL) == 0


def ssh_out(cmd: str) -> tuple[bool, str]:
    r = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
         node, cmd], capture_output=True, text=True)
    return r.returncode == 0, r.stdout + r.stderr


c.expect(ssh("test -x /usr/local/bin/ddns-update-auth.sh"),
         f"{node} has executable "
         "/usr/local/bin/ddns-update-auth.sh",
         f"{node} missing executable "
         "/usr/local/bin/ddns-update-auth.sh")

if ssh("sudo test -f /etc/cloudless/ddns-update-auth.env"):
    c.passed(f"{node} has /etc/cloudless/ddns-update-auth.env")
    if ssh("sudo grep -q '^DDNS_ENABLED=true' "
           "/etc/cloudless/ddns-update-auth.env"):
        c.passed(f"{node} DDNS is enabled")
    else:
        c.warning(f"{node} DDNS is installed but disabled; this "
                  "is OK while auth.cloudless.gr is "
                  "legacy/inactive")
else:
    c.warning(f"{node} missing /etc/cloudless/"
              "ddns-update-auth.env; script should still exit "
              "quietly if implemented that way")

c.expect(ssh("crontab -l 2>/dev/null | grep -q "
             "'/usr/local/bin/ddns-update-auth.sh'"),
         f"{node} crontab references ddns-update-auth.sh",
         f"{node} crontab does not reference "
         "ddns-update-auth.sh")
c.expect(ssh("crontab -l 2>/dev/null | grep "
             "'/usr/local/bin/ddns-update-auth.sh' | grep -q "
             "'ddns-update-auth.log'"),
         f"{node} DDNS cron output is redirected to log",
         f"{node} DDNS cron output may still generate mail if "
         "the script writes output", kind="warn")
c.expect(ssh("test -w /var/log/ddns-update-auth.log"),
         f"{node} cron user can write "
         "/var/log/ddns-update-auth.log",
         f"{node} cron user cannot write "
         "/var/log/ddns-update-auth.log")

ok_, out = ssh_out("sudo /usr/local/bin/ddns-update-auth.sh "
                   ">/tmp/ddns-check.out 2>&1; code=$?; "
                   "cat /tmp/ddns-check.out; exit $code")
print(out, end="")
c.expect(ok_, f"{node} DDNS script exits successfully",
         f"{node} DDNS script failed")

c.finish()
