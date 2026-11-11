#!/usr/bin/env python3
"""publish-doc.py — HTML -> PDF (headless Chrome) -> scp to omv -> verify token URL.

usage:
  publish-doc.py SOURCE.html --out NAME.pdf [--case CASE] [--no-upload] [--token TOKEN]

Defaults target the mpaltzakis-house-2026-11 evidence case.
"""

import argparse
import os
import subprocess
import sys
import urllib.request

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SRC_DIR = r"C:\Users\tbaltzakis\Documents\mpaltzakis-correspondence"
BASE = "https://evidence.cloudless.gr/t/8827d83d8c003907a5818f4c142987d52630e94a38d4fd7a/{case}/"
OMV_DIR = "/home/tbaltzakis/evidence/{case}"
R2_BUCKET = "evidence-mpaltzakis"
R2_TOKEN = "8827d83d8c003907a5818f4c142987d52630e94a38d4fd7a"


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit("FAIL {}\n{}{}".format(" ".join(map(str, cmd)), r.stdout, r.stderr))
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("source")
    ap.add_argument("--out", required=True, help="output PDF filename (underscores, no dashes)")
    ap.add_argument("--case", default="mpaltzakis-house-2026-11")
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--no-r2", action="store_true", help="skip the R2 sync step")
    a = ap.parse_args()

    src = a.source if os.path.isabs(a.source) else os.path.join(SRC_DIR, a.source)
    pdf = os.path.join(SRC_DIR, a.out)
    url = "file:///" + src.replace("\\", "/")

    run(
        [
            CHROME,
            "--headless",
            "--disable-gpu",
            "--print-to-pdf=" + pdf,
            "--no-pdf-header-footer",
            url,
        ]
    )
    if not os.path.exists(pdf) or os.path.getsize(pdf) < 1000:
        sys.exit(f"FAIL: pdf missing or too small: {pdf}")
    print("pdf:", pdf, os.path.getsize(pdf), "bytes")

    if a.no_upload:
        return
    remote_dir = OMV_DIR.format(case=a.case)
    # scp to /tmp first so a locked local name never matters; remote keeps canonical name
    tmp = "/tmp/" + a.out
    run(["scp", "-o", "BatchMode=yes", pdf, "omv:" + tmp])
    run(["ssh", "-o", "BatchMode=yes", "omv", f"mv {tmp} {remote_dir}/{a.out}"])

    link = BASE.format(case=a.case) + a.out
    req = urllib.request.Request(
        link, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    try:
        code = urllib.request.urlopen(req, timeout=30).status
    except urllib.error.HTTPError as e:
        code = e.code
    print("verify:", code, link)
    if code != 200:
        sys.exit(f"FAIL: remote returned {code}")

    if a.no_r2:
        return
    key = f"t/{R2_TOKEN}/{a.case}/{a.out}"
    run(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "omv",
            f"rclone copyto {remote_dir}/{a.out} r2ev:{R2_BUCKET}/{key}",
        ]
    )
    print("r2 synced:", key)

    # read-back verify: evidence.cloudless.gr is Worker->R2, so a HEAD there
    # proves the police-facing path serves the NEW object (size + etag)
    import hashlib

    local_size = os.path.getsize(pdf)
    local_md5 = hashlib.md5(open(pdf, "rb").read()).hexdigest()
    r2link = link  # same token path, now backed by R2
    req = urllib.request.Request(r2link, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        rsize = int(resp.headers.get("Content-Length", -1))
        retag = (resp.headers.get("ETag") or "").strip('"')
    except Exception as e:
        sys.exit(f"FAIL: R2 read-back unreachable: {e}")
    if rsize != local_size:
        sys.exit(f"FAIL: R2 read-back size {rsize} != local {local_size} (stale object?)")
    if retag == local_md5:
        print(f"r2 verified: size+etag match ({local_size} bytes)")
    else:
        print(f"r2 verified: size match ({local_size} bytes, etag {retag[:12]} — multipart?)")


if __name__ == "__main__":
    main()
