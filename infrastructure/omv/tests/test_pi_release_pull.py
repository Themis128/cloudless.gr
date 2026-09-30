"""Dry-run checks for infrastructure/omv/pi-release-pull.py.

Runs the real script against a local fake orchestrator with stubbed
sudo/nice/ionice/tar/k3s/chown/logger on PATH, so nothing touches the host.
Covers the two #2023 review regressions:
  * the artifact is streamed to disk intact (no full in-memory buffer);
  * a failing tar / kubectl aborts the promote (shell `set -e` parity).

    python3 -m unittest discover -s infrastructure/omv/tests
"""

import http.server
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "pi-release-pull.py"
ARTIFACT = os.urandom(3 * 1024 * 1024 + 17)  # > 1 chunk, odd size

STUBS = {
    "sudo": 'exec "$@"',
    "nice": 'shift 2; exec "$@"',
    "ionice": 'shift 2; exec "$@"',
    "logger": "exit 0",
    "chown": "exit 0",
    "k3s": 'echo "$*" >> "$STUB_LOG"; [ "$STUB_K3S_FAIL" = "$2" ] && { echo boom >&2; exit 7; }; exit 0',
    # tar --zstd -xf TAR -C DEST
    "tar": """cp "$3" "$STUB_OUT/got.tar"
[ -n "$STUB_TAR_FAIL" ] && { echo "tar: corrupt archive" >&2; exit 2; }
mkdir -p "$5/.next"; echo bid > "$5/BUILD_ID"; echo x > "$5/server.js"
for i in 1 2 3 4 5 6 7 8 9 10 11; do echo $i > "$5/.next/f$i"; done""",
}


class _Handler(http.server.BaseHTTPRequestHandler):
    sha = ""

    def do_GET(self) -> None:
        if self.headers.get("Authorization") != "Bearer tok":
            self.send_response(401)
            self.end_headers()
            return
        if self.path == "/desired":
            body = json.dumps({"sha": self.sha, "artifactKey": "rel/x.tar.zst"}).encode()
        elif self.path.startswith("/artifact"):
            body = ARTIFACT
        else:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args: object) -> None:
        pass


class PiReleasePullDryRun(unittest.TestCase):
    def setUp(self) -> None:
        self.work = Path(tempfile.mkdtemp())
        self.sha = secrets.token_hex(20)
        _Handler.sha = self.sha
        self.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        stubs = self.work / "bin"
        stubs.mkdir()
        for name, body in STUBS.items():
            p = stubs / name
            p.write_text(f"#!/bin/sh\n{body}\n")
            p.chmod(0o755)
        self.standalone = self.work / "home" / "cloudless-standalone"
        self.standalone.parent.mkdir()
        self.env = {
            **os.environ,
            "PATH": f"{stubs}:{os.environ['PATH']}",
            "ENV_FILE": str(self.work / "none.env"),
            "DEPLOY_ORCHESTRATOR_URL": f"http://127.0.0.1:{self.srv.server_port}",
            "DEPLOY_ORCHESTRATOR_TOKEN": "tok",
            "STANDALONE_HOSTPATH": str(self.standalone),
            "LOAD1_MAX": "100000",
            "IOWAIT_MAX_PCT": "0",
            "STUB_LOG": str(self.work / "k3s.log"),
            "STUB_OUT": str(self.work),
            "STUB_TAR_FAIL": "",
            "STUB_K3S_FAIL": "",
        }

    def tearDown(self) -> None:
        self.srv.shutdown()
        self.srv.server_close()
        shutil.rmtree(self.work, ignore_errors=True)
        shutil.rmtree(f"/tmp/cloudless-pull-{self.sha[:12]}", ignore_errors=True)

    def _run(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT)],
            env=self.env,
            capture_output=True,
            text=True,
            timeout=60,
        )

    def test_tar_failure_aborts_before_promote(self) -> None:
        self.env["STUB_TAR_FAIL"] = "1"
        r = self._run()
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("reason=cmd_failed", r.stdout)
        self.assertIn("tar: corrupt archive", r.stdout)
        self.assertFalse(self.standalone.is_symlink(), "symlink must not be flipped")
        self.assertFalse(Path(self.env["STUB_LOG"]).exists(), "kubectl must not run")
        # Artifact was streamed to disk byte-for-byte.
        self.assertEqual((self.work / "got.tar").read_bytes(), ARTIFACT)

    def test_kubectl_failure_aborts(self) -> None:
        self.env["STUB_K3S_FAIL"] = "rollout"
        r = self._run()
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("reason=cmd_failed", r.stdout)
        self.assertIn("rollout restart", r.stdout)
        self.assertNotIn("promote_ok", r.stdout)
        self.assertTrue(self.standalone.is_symlink())
        calls = Path(self.env["STUB_LOG"]).read_text().splitlines()
        self.assertEqual(len(calls), 2, calls)  # set env ok, rollout restart failed, stop


if __name__ == "__main__":
    unittest.main()
