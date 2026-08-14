#!/usr/bin/env python3
"""Serve Tailscale client metrics for Prometheus on :9102/metrics.

Refreshes via `tailscale metrics print` every REFRESH_SECS (default 15).
Bind: 0.0.0.0 so kube-prometheus can scrape via LAN Endpoints.
"""
from __future__ import annotations

import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TAILSCALE_METRICS_PORT", "9102"))
REFRESH = int(os.environ.get("TAILSCALE_METRICS_REFRESH", "15"))
BIN = os.environ.get("TAILSCALE_BIN", "tailscale")

_lock = threading.Lock()
_body = b"# HELP tailscale_exporter_up 1 if last refresh succeeded\ntailscale_exporter_up 0\n"
_ok = False


def refresh_loop() -> None:
    global _body, _ok
    while True:
        try:
            out = subprocess.check_output(
                [BIN, "metrics", "print"],
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
            footer = (
                b"\n# HELP tailscale_exporter_up 1 if last refresh succeeded\n"
                b"# TYPE tailscale_exporter_up gauge\n"
                b"tailscale_exporter_up 1\n"
            )
            with _lock:
                _body = out + footer
                _ok = True
        except Exception:
            with _lock:
                _ok = False
                _body = (
                    b"# HELP tailscale_exporter_up 1 if last refresh succeeded\n"
                    b"# TYPE tailscale_exporter_up gauge\n"
                    b"tailscale_exporter_up 0\n"
                )
        time.sleep(REFRESH)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path not in ("/metrics", "/"):
            self.send_response(404)
            self.end_headers()
            return
        with _lock:
            payload = _body
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> None:
    threading.Thread(target=refresh_loop, daemon=True).start()
    # Warm first sample
    time.sleep(1)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
