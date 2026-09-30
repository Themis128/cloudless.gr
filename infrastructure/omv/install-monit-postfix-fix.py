#!/usr/bin/env python3
"""install-monit-postfix-fix.py — omv: harden postfix supervision + enable at boot.

Port of install-monit-postfix-fix.sh.

Root-cause fix for the recurring "[OMV] Daily Health Check" alert
("Service postfix is NOT running!" + "High number of system errors …").

  • postfix.service is *disabled* in systemd, so it never starts on reboot.
  • While postfix is down, monit's alert handler tries to deliver its own mail
    via 127.0.0.1:25, logs errors per cycle, and retries — producing the bulk
    of the "4,755 errors". Fixing postfix collapses the error count.

This script (review before applying — run with --preview by default):
  1. Enables postfix.service at boot (idempotent).
  2. Installs a hardened postfix check into /etc/monit/conf.d/ so monit actually
     supervises postfix and restarts it within ~2 cycles.
  3. OPTIONAL (--mail-relay, off by default): points monit's alert mail at the
     external relay instead of local postfix.

Usage (run as root on omv, either from a checkout or scp'd):
  sudo python3 install-monit-postfix-fix.py            # preview (no changes)
  sudo python3 install-monit-postfix-fix.py --apply    # apply (1)+(2)
  sudo python3 install-monit-postfix-fix.py --apply --mail-relay
"""

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

APPLY = "--apply" in sys.argv
MAIL_RELAY = "--mail-relay" in sys.argv
for a in sys.argv[1:]:
    if a not in ("--apply", "--mail-relay"):
        print(f"unknown arg: {a}", file=sys.stderr)
        sys.exit(2)

POSTFIX_CONF = Path("/etc/monit/conf-available/postfix")
POSTFIX_LOADED = Path("/etc/monit/conf.d/postfix")
BACKUP_TS = datetime.now().strftime("%Y%m%d-%H%M%S")


def step(msg: str) -> None:
    print(f"\n== {msg} ==")


def doit(*args: str) -> None:
    if APPLY:
        subprocess.run(list(args), check=True)
    else:
        print(f"  [preview] would run: {' '.join(args)}")


# ---------------------------------------------------------------- 1. boot enable
step("1/2  postfix.service enabled at boot")
if subprocess.run(["systemctl", "is-enabled", "postfix"], capture_output=True, check=False).returncode == 0:
    print("  postfix already enabled at boot")
else:
    doit("systemctl", "enable", "postfix")

# ------------------------------------------------------- 2. hardened monit check
step("2/2  hardened postfix supervision in /etc/monit/conf.d")
if not POSTFIX_CONF.is_file():
    print(f"  source {POSTFIX_CONF} not found — skipping monit check (postfix still enabled at boot)", file=sys.stderr)
    sys.exit(0)

if POSTFIX_LOADED.is_file():
    print(f"  {POSTFIX_LOADED} already present — will leave as-is")
else:
    print("  installing hardened postfix check (monit currently does not supervise postfix)")
    if APPLY:
        shutil.copy2(POSTFIX_CONF, POSTFIX_LOADED)
        text = POSTFIX_LOADED.read_text()
        text = text.replace(
            'start program = "service postfix start"',
            'start program = "/usr/sbin/service postfix start"',
        ).replace(
            'stop  program = "service postfix stop"',
            'stop  program = "/usr/sbin/service postfix stop"',
        ).replace(
            "if failed host localhost port 25 with protocol smtp for 2 times within 3 cycles then restart",
            "if failed host 127.0.0.1 port 25 with protocol smtp for 2 times within 3 cycles then restart",
        ).replace(
            "if 5 restarts with 5 cycles then timeout",
            "if 5 restarts with 15 cycles then timeout",
        )
        POSTFIX_LOADED.write_text(text)
    else:
        print("  [preview] would copy + patch the postfix check")

# validate + reload (only when applying)
if APPLY:
    if subprocess.run(["monit", "-t"], capture_output=True, check=False).returncode == 0:
        subprocess.run(["monit", "reload"], check=False)
        print("  monit: config OK, reloaded")
    else:
        print("  monit -t FAILED — restoring previous config", file=sys.stderr)
        if POSTFIX_LOADED.is_file():
            shutil.copy2(POSTFIX_LOADED, f"{POSTFIX_LOADED}.bad-{BACKUP_TS}")
            POSTFIX_LOADED.unlink()
        sys.exit(1)
else:
    print("  [preview] would run: monit -t && monit reload")

# ------------------------------------------- 3. OPTIONAL: mail loop alternative
if MAIL_RELAY:
    step("3/3  (optional) point monit alert mail at external relay")
    MONITRC = Path("/etc/monit/monitrc")
    MAIN_CF = Path("/etc/postfix/main.cf")
    SASL = Path("/etc/postfix/sasl_passwd")
    if not MONITRC.is_file():
        print(f"  {MONITRC} not found", file=sys.stderr)
        sys.exit(1)

    # --- resolve relay endpoint from postfix main.cf: 'relayhost = [host]:port'
    relay = ""
    for line in MAIN_CF.read_text().splitlines():
        m = re.match(r"^relayhost\s*=\s*(.+)", line)
        if m:
            relay = re.sub(r"\s", "", m.group(1))
            break
    if not relay:
        print(f"  no relayhost in {MAIN_CF} — cannot compute external relay", file=sys.stderr)
        sys.exit(1)
    host = relay.strip("[]").split("]")[0].lstrip("[")
    port = relay.rsplit(":", 1)[-1].rstrip("]")
    if not host or port == relay:
        print(f"  could not parse relay '{relay}'", file=sys.stderr)
        sys.exit(1)

    # --- resolve SMTP auth from postfix sasl_passwd: '<[host]:port>  user:pass'
    authkey = f"[{host}]:{port}"
    cred = ""
    if SASL.is_file():
        for line in SASL.read_text().splitlines():
            parts = line.split()
            if parts and parts[0] == authkey and len(parts) > 1:
                cred = parts[1]
                break
    if not cred:
        print(f"  WARN: no sasl_passwd line for {authkey} — using relay without auth", file=sys.stderr)
        username = password = ""
    else:
        username, _, password = cred.partition(":")

    mserver = f"set mailserver {host} port {port}"
    if username:
        mserver += f' username "{username}" password "{password}"'
    mserver += " using tls"

    monitrc_text = MONITRC.read_text()
    if re.search(r"^set mailserver 127\.0\.0\.1", monitrc_text, re.MULTILINE):
        print(f"  replacing 'set mailserver 127.0.0.1' with: {mserver}")
        if APPLY:
            shutil.copy2(MONITRC, f"{MONITRC}.bak-{BACKUP_TS}")
            new_lines = [
                mserver if re.match(r"^set mailserver 127\.0\.0\.1", line) else line
                for line in monitrc_text.splitlines()
            ]
            new_text = "\n".join(new_lines) + "\n"
            new_path = Path(f"{MONITRC}.new")
            new_path.write_text(new_text)
            if subprocess.run(["monit", "-t", "-c", str(new_path)], capture_output=True, check=False).returncode == 0:
                new_path.replace(MONITRC)
                subprocess.run(["monit", "reload"], check=False)
                print(f"  monitrc updated + reloaded (backup: {MONITRC}.bak-{BACKUP_TS})")
            else:
                print("  monit -t FAILED on new config — rolling back, no change made", file=sys.stderr)
                new_path.unlink(missing_ok=True)
                sys.exit(1)
        else:
            print("  [preview] would update monitrc (backup kept) + monit reload")
    else:
        print("  monitrc 'set mailserver' already customized — leaving as-is")

print()
print("review / apply:")
print(f"  sudo python3 {Path(sys.argv[0]).name} --apply              # applies (1) boot-enable + (2) monit watchdog")
print(f"  sudo python3 {Path(sys.argv[0]).name} --apply --mail-relay # also (3) point monit alerts at external relay")
print("  tail -40 /var/log/nas-daily-health.log          # confirm 'postfix is NOT running' is gone")
