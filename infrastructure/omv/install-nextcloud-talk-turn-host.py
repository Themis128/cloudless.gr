#!/usr/bin/env python3
"""install-nextcloud-talk-turn-host.py — omv: advertise a LAN-reachable TURN/STUN host for Nextcloud Talk.

Root-cause fix for Talk calls failing to negotiate media (no relay candidates):

  • The nextcloud/aio-talk HPB container advertises TALK_HOST to Talk clients
    as the TURN/STUN server address (eturnal inside the container, port 3478).
  • It was set to `signal.cloudless.gr`, which resolves to Cloudflare's edge —
    the tunnel only carries HTTP(S)/WebSocket, never UDP, so clients could not
    reach the TURN/STUN listener at all (even on the LAN).
  • The signaling URL (https://signal.cloudless.gr) is correct and stays as is;
    only the *media* address must be reachable at UDP/TCP level.
  • Fix: TALK_HOST=192.168.1.200 (the keepalived VIP — ports 3478/udp+tcp are
    published there) and recreate the talk-hpb container.
  • Also removes the stale Talk-app TURN entry that advertised a `turns`
    (TLS) scheme on 3478, which the HPB does not serve.

Caveat: 192.168.1.200 is LAN-only. Guests joining from outside need a router
port-forward of 3478/udp+tcp plus a public TURN hostname (or a hosted TURN,
e.g. Cloudflare Calls) — that is intentionally NOT covered here.

Usage (run as root on omv):
  sudo python3 install-nextcloud-talk-turn-host.py            # preview
  sudo python3 install-nextcloud-talk-turn-host.py --apply    # apply + verify

Applied live on omv 2026-10-10 (backup kept at /root/workspace.yml.bak-talkhost).
"""

import glob
import os
import re
import shutil
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

APPLY = "--apply" in sys.argv
for a in sys.argv[1:]:
    if a != "--apply":
        print(f"unknown arg: {a}", file=sys.stderr)
        sys.exit(2)

BACKUP_TS = datetime.now().strftime("%Y%m%d-%H%M%S")
GOOD_HOST = "192.168.1.200"
BAD_HOST = "signal.cloudless.gr"
NEXTCLOUD_CONTAINER = "nextcloud"
TALK_CONTAINER = "nextcloud-talk-hpb"


def step(msg: str) -> None:
    print(f"\n== {msg} ==")


def find_compose_file() -> str | None:
    hits = glob.glob("/srv/dev-disk-by-uuid-*/compose-files/workspace/workspace.yml")
    return hits[0] if hits else None


def main() -> int:
    step("locate workspace compose file")
    compose = find_compose_file()
    if not compose:
        print("  workspace.yml not found under /srv/dev-disk-by-uuid-*/compose-files/")
        return 1
    print(f"  {compose}")

    step("check TALK_HOST")
    text = Path(compose).read_text()
    if f"TALK_HOST={GOOD_HOST}" in text:
        print(f"  already {GOOD_HOST} — compose part nothing to do")
    elif f"TALK_HOST={BAD_HOST}" in text:
        backup = Path(f"/root/workspace.yml.bak-talkhost-{BACKUP_TS}")
        new = text.replace(f"TALK_HOST={BAD_HOST}", f"TALK_HOST={GOOD_HOST}")
        if APPLY:
            shutil.copy2(compose, backup)
            Path(compose).write_text(new)
            print(f"  rewrote TALK_HOST={BAD_HOST} -> {GOOD_HOST} (backup: {backup})")
            subprocess.run(
                ["docker", "compose", "-f", compose, "up", "-d", "talk-hpb"], check=True
            )
        else:
            print(f"  [preview] would rewrite TALK_HOST={BAD_HOST} -> {GOOD_HOST}")
            print("  [preview] would run: docker compose -f <file> up -d talk-hpb")
    else:
        print("  TALK_HOST not found in expected form — inspect manually")
        return 1

    step("verify TURN reachable on VIP :3478")
    try:
        with socket.create_connection((GOOD_HOST, 3478), timeout=4):
            print(f"  TCP {GOOD_HOST}:3478 reachable")
    except OSError as exc:
        print(f"  TCP {GOOD_HOST}:3478 NOT reachable: {exc}")
        if APPLY:
            return 1

    step("clean stale Talk-app TURN entry (turns scheme on 3478)")
    occ = ["docker", "exec", "-u", "www-data", NEXTCLOUD_CONTAINER, "php", "occ"]
    lst = subprocess.run(occ + ["talk:turn:list"], capture_output=True, text=True)
    if "turn,turns" in lst.stdout:
        print("  removing 'turn,turns' 192.168.1.200:3478 entry")
        subprocess.run(
            occ + ["talk:turn:delete", "turn,turns", "192.168.1.200:3478", "udp,tcp"],
            check=False,
        )
        secret = subprocess.run(
            ["docker", "exec", TALK_CONTAINER, "sh", "-c", "echo $TURN_SECRET"],
            capture_output=True,
            text=True,
        ).stdout.strip()
        subprocess.run(
            occ
            + [
                "talk:turn:add",
                "turn",
                "192.168.1.200:3478",
                "udp,tcp",
                f"--secret={secret}",
            ],
            check=True,
        )
    elif f"schemes: turn" in lst.stdout and GOOD_HOST in lst.stdout:
        print("  turn-only entry already present — nothing to do")
    else:
        print("  unexpected talk:turn:list output — inspect manually:")
        print(lst.stdout[:400])

    step("done")
    if not APPLY:
        print("  preview run — rerun with --apply to make changes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
