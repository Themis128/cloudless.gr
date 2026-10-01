#!/usr/bin/env python3
"""Smoke-test the Slack app doctor against the live Cloudless app —
pulls the Slack credentials from SSM and runs the doctor."""

import os
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
if (Path.home() / "code/cloudless.gr").is_dir():
    os.chdir(Path.home() / "code/cloudless.gr")
elif Path("/sessions/fervent-epic-darwin/mnt/cloudless.gr").is_dir():
    os.chdir("/sessions/fervent-epic-darwin/mnt/cloudless.gr")


def ssm(name: str, decrypt: bool = False) -> str:
    args = [
        "aws",
        "ssm",
        "get-parameter",
        "--region",
        "us-east-1",
        "--name",
        name,
        "--query",
        "Parameter.Value",
        "--output",
        "text",
    ]
    if decrypt:
        args += ["--with-decryption"]
    r = subprocess.run(args, capture_output=True, text=True)
    return r.stdout.strip()


token = ssm("/cloudless/production/SLACK_BOT_TOKEN", decrypt=True)
secret = ssm("/cloudless/production/SLACK_SIGNING_SECRET", decrypt=True)
channel = ssm("/cloudless/production/NEWSLETTER_SLACK_CHANNEL_ID")

print(f"token len: {len(token)}  secret len: {len(secret)}  channel: {channel}")

script = Path("scripts/slack-app-doctor.py")
cmd = [sys.executable, str(script)] if script.exists() else [sys.executable, "scripts/slack-app-doctor.py"]
r = subprocess.run(
    [
        *cmd,
        "--token",
        token,
        "--signing-secret",
        secret,
        "--channel",
        channel,
        "--commands-url",
        "https://cloudless.gr/api/slack/commands",
    ]
)
sys.exit(r.returncode)
