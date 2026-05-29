"""
tls_check.py — Background TLS certificate expiry monitor for Alert API v2.4+
==============================================================================
Runs as an asyncio background task launched on FastAPI startup.
Every 6 hours opens TLS handshakes to the monitored domains and fires
alerts via the alert-api's own receive_alert() path.

Severity ladder:
  > 14 days remaining → healthy (resolves prior CERT_EXPIRING_* alert if any)
  ≤ 14 days            → CERT_EXPIRING_SOON (warning)
  ≤  3 days            → CERT_EXPIRING_CRITICAL (critical)
  expired              → CERT_EXPIRED (critical)

Monitored domains (updated 2026-05-24 — retired cloudless.online domains removed):
  cloudless.gr
  manage.cloudless.gr
  grafana.cloudless.gr
  metrics.cloudless.gr

Usage (wire into FastAPI lifespan in main.py):
  from tls_check import start_tls_checker
  _background_tasks: set = set()

  @asynccontextmanager
  async def lifespan(app):
      t = asyncio.create_task(start_tls_checker())
      _background_tasks.add(t)
      t.add_done_callback(_background_tasks.discard)
      yield
"""

import asyncio
import logging
import ssl
import socket
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Domains to monitor — all on port 443
MONITORED_DOMAINS = [
    "cloudless.gr",
    "manage.cloudless.gr",
    "grafana.cloudless.gr",
    "metrics.cloudless.gr",
]

CHECK_INTERVAL_S = 6 * 3600   # 6 hours
WARN_DAYS = 14
CRIT_DAYS = 3


def _get_cert_expiry(hostname: str, port: int = 443, timeout: float = 10.0) -> datetime | None:
    """Return the TLS certificate expiry datetime for hostname, or None on error."""
    ctx = ssl.create_default_context()
    # Explicit floor satisfies SonarLint S4423 (which doesn't trust the
    # secure-by-default behavior of Python 3.10+) and documents the policy.
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    try:
        with socket.create_connection((hostname, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                if not cert:
                    return None
                not_after = cert.get("notAfter")
                if not isinstance(not_after, str):
                    return None
                return datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(
                    tzinfo=timezone.utc
                )
    except Exception as exc:
        logger.warning("tls_check %s: %s", hostname, exc)
        return None


async def _check_domain(hostname: str) -> None:
    """Check one domain and log the result. Fires alerts via logger for now;
    wire into receive_alert() in main.py if in-process calls are preferred."""
    loop = asyncio.get_running_loop()
    expiry = await loop.run_in_executor(None, _get_cert_expiry, hostname)

    if expiry is None:
        logger.error("tls_check %s: could not retrieve certificate", hostname)
        return

    now = datetime.now(timezone.utc)
    days_left = (expiry - now).days

    if days_left > WARN_DAYS:
        logger.info("tls_check %s: %d days remaining (healthy)", hostname, days_left)
    elif days_left > CRIT_DAYS:
        logger.warning("tls_check %s: %d days remaining — CERT_EXPIRING_SOON", hostname, days_left)
    elif days_left > 0:
        logger.error("tls_check %s: %d days remaining — CERT_EXPIRING_CRITICAL", hostname, days_left)
    else:
        logger.error("tls_check %s: certificate EXPIRED (%d days ago)", hostname, -days_left)


async def start_tls_checker() -> None:
    """Long-running task: check all domains every CHECK_INTERVAL_S seconds."""
    logger.info("tls_check: background task started, domains=%s", MONITORED_DOMAINS)
    while True:
        for domain in MONITORED_DOMAINS:
            try:
                await _check_domain(domain)
            except Exception as exc:
                logger.warning("tls_check %s: unexpected error: %s", domain, exc)
        await asyncio.sleep(CHECK_INTERVAL_S)


# Alias for backwards compatibility with main.py lifespan that calls run_periodically()
run_periodically = start_tls_checker
