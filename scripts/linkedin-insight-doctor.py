#!/usr/bin/env python3
"""linkedin-insight-doctor.py — diagnose why the LinkedIn Insight Tag
is not firing on cloudless.gr. Walks through the four failure modes
documented in skills/linkedin-insight-doctor/SKILL.md and prints a
structured verdict.

Exit: 0 = healthy; 1 = misconfigured; 9 = preconditions failed.

Usage:
  python3 scripts/linkedin-insight-doctor.py
  python3 scripts/linkedin-insight-doctor.py --slug shop-online \
      --locale el --no-color"""

import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

SLUG, LOCALE = "shop-online", "el"
SITE_URL = "https://cloudless.gr"
SSM_PREFIX = "/cloudless/production"
REPO = os.environ.get("GH_REPO", "Themis128/cloudless.gr")
COLOR = True

i = 1
while i < len(sys.argv):
    a = sys.argv[i]
    if a == "--slug":
        SLUG = sys.argv[i + 1]; i += 2
    elif a == "--locale":
        LOCALE = sys.argv[i + 1]; i += 2
    elif a == "--site":
        SITE_URL = sys.argv[i + 1]; i += 2
    elif a == "--no-color":
        COLOR = False; i += 1
    elif a in ("-h", "--help"):
        print(__doc__); sys.exit(0)
    else:
        print(f"unknown arg: {a}", file=sys.stderr); sys.exit(9)

C_RED, C_GRN, C_YEL, C_DIM, C_RST = (
    ("\033[31m", "\033[32m", "\033[33m", "\033[2m", "\033[0m")
    if COLOR else ("", "", "", "", ""))


def ok(msg): print(f"  {C_GRN}✓{C_RST}  {msg}")
def warn(msg): print(f"  {C_YEL}!{C_RST}  {msg}")
def fail(msg): print(f"  {C_RED}✗{C_RST}  {msg}")
def note(msg): print(f"    {C_DIM}{msg}{C_RST}")
def hdr(msg): print(f"\n{C_DIM}──── {msg} ────{C_RST}")


errors = warnings = 0
partner_id_literal = ""

hdr("preconditions")
if not shutil.which("curl"):
    fail("missing tool: curl")
    sys.exit(9)
ok("core tooling present")

has_aws = shutil.which("aws") is not None
has_gh = shutil.which("gh") is not None
if not has_aws:
    warn("aws CLI not installed — SSM check will be skipped")
if not has_gh:
    warn("gh CLI not installed — GitHub secret check will be skipped")

hdr("1. SSM Parameter Store")
if has_aws:
    for name, missing_msg, note_msg, is_error in (
            ("NEXT_PUBLIC_LINKEDIN_PARTNER_ID",
             "NOT in SSM",
             "SSM is informational — deploy-pi.yml reads from GitHub "
             "secrets, not SSM. But missing SSM AND missing GH secret "
             "is the common failure pattern.", False),
            ("LINKEDIN_CAPI_ACCESS_TOKEN",
             "NOT in SSM (server-side CAPI mirror disabled)",
             "Browser fire still works; only the dual-fire CAPI "
             "mirror is skipped.", False)):
        r = subprocess.run(
            ["aws", "ssm", "get-parameter", "--name",
             f"{SSM_PREFIX}/{name}", "--region", "us-east-1"],
            capture_output=True)
        if r.returncode == 0:
            extra = " (server-side CAPI mirror enabled)" \
                if "CAPI" in name else ""
            ok(f"{name} present in SSM{extra}")
        else:
            warn(f"{name} {missing_msg}")
            note(note_msg)
            warnings += 1
else:
    warn("skipped — install aws CLI to enable")

hdr("2. GitHub Actions secrets")
if has_gh:
    r = subprocess.run(["gh", "secret", "list", "--repo", REPO],
                       capture_output=True, text=True)
    secrets = r.stdout
    if "NEXT_PUBLIC_LINKEDIN_PARTNER_ID" in secrets:
        ok(f"NEXT_PUBLIC_LINKEDIN_PARTNER_ID secret exists in {REPO}")
    else:
        fail("NEXT_PUBLIC_LINKEDIN_PARTNER_ID secret missing — "
             "THIS IS THE LIKELY CAUSE")
        note(f"Set via: gh secret set NEXT_PUBLIC_LINKEDIN_PARTNER_ID "
             f"--repo {REPO} --body '<numeric_id>'")
        note("Get the ID from Campaign Manager → Account Assets → "
             "Insight Tag.")
        errors += 1
    if "LINKEDIN_CAPI_ACCESS_TOKEN" in secrets:
        ok("LINKEDIN_CAPI_ACCESS_TOKEN secret exists")
    else:
        warn("LINKEDIN_CAPI_ACCESS_TOKEN secret missing (CAPI mirror "
             "disabled)")
        note("Generate via Campaign Manager → Data → Signals Manager "
             "→ Direct API.")
        warnings += 1
else:
    warn("skipped — install + auth gh CLI to enable")


def fetch(url: str, timeout: int = 15) -> str:
    try:
        return urllib.request.urlopen(url, timeout=timeout).read()\
            .decode("utf-8", errors="replace")
    except Exception:
        return ""


hdr("3. Live JS bundle")
campaign_url = f"{SITE_URL}/{LOCALE}/campaigns/{SLUG}"
html = fetch(campaign_url)
if not html:
    fail(f"could not fetch {campaign_url}")
    errors += 1
else:
    ok(f"fetched {campaign_url}")
    chunks = sorted(set(re.findall(
        r"/_next/static/chunks/[a-zA-Z0-9_-]+\.js", html)))
    if not chunks:
        warn("no JS chunks discovered in HTML (Next.js render "
             "unusual)")
        warnings += 1
    else:
        note(f"scanning {len(chunks)} chunks for Partner ID "
             "literal…")
        found = ""
        for chunk in chunks:
            body = fetch(f"{SITE_URL}{chunk}", timeout=10)
            if not body:
                continue
            # Insight-tag loader markers (verified on prod bundle
            # chunk 2zllz81i5lj6d.js 2026-06-19):
            if not re.search(
                    r"snap\.licdn\.com/li\.lms-analytics/"
                    r"insight\.min\.js|_linkedin_partner_id|lintrk",
                    body):
                continue
            # (a) inline literal
            m = re.search(
                r'_linkedin_(?:data_)?partner_id[s]?[^"]{0,40}'
                r'"([0-9]{6,9})"', body)
            # (b) minified var assigned before the loader
            if not m:
                m = re.search(
                    r'[A-Za-z_$][A-Za-z0-9_$]{0,2}="([0-9]{6,9})"'
                    r'[^"]{0,400}(?:lintrk|_linkedin_partner_id)',
                    body)
            if m:
                found = m.group(1)
                ok(f"Partner ID literal found in bundle: {found}  "
                   f"({chunk})")
                partner_id_literal = found
                break
        if not found:
            fail(f"no Partner ID literal found in any of "
                 f"{len(chunks)} chunks")
            note("→ Stale build, OR secret was empty at build time.")
            note("→ Set the secret, then trigger: gh workflow run "
                 "deploy-pi.yml --ref main")
            errors += 1

hdr("4. Conversion definition in code")
campaigns_file = Path("src/data/campaigns.ts")
if campaigns_file.is_file():
    ids = re.findall(r"linkedinConversionId:\s*([0-9]+)",
                     campaigns_file.read_text())
    if ids:
        for cid in ids:
            ok(f"campaign declares linkedinConversionId={cid}")
        note("Verify each is 'Active' in Campaign Manager → "
             "Conversions.")
    else:
        warn(f"no linkedinConversionId set in {campaigns_file}")
        warnings += 1
else:
    warn(f"{campaigns_file} not found — run from repo root")

hdr("verdict")
if errors:
    print(f"  {C_RED}✗ NOT HEALTHY{C_RST}  {errors} error(s), "
          f"{warnings} warning(s)\n")
    print("  Next action:")
    if not partner_id_literal:
        print(f"""    1. Get Partner ID from LinkedIn Campaign Manager → Account Assets → Insight Tag.
    2. gh secret set NEXT_PUBLIC_LINKEDIN_PARTNER_ID --repo {REPO} --body '<ID>'
    3. gh workflow run deploy-pi.yml --ref main
    4. Wait ~5-7 min for build + rollout, then re-run this script.""")
    else:
        print("    Bundle is correctly built. Issues elsewhere "
              "(consent, conversion definition).")
    sys.exit(1)
elif warnings:
    print(f"  {C_YEL}! DEGRADED{C_RST}  bundle looks correct but "
          f"{warnings} warning(s) present")
    sys.exit(0)
else:
    print(f"  {C_GRN}✓ HEALTHY{C_RST}  Insight Tag is configured "
          "and bundled.")
    sys.exit(0)
