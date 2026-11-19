"""
healthchecks_ping.py — Self-ping the alert-api liveness check on Healthchecks.io.

Different failure mode from the ESP32 check: if alert-api itself crashes or
the k3s pod gets evicted, the ESP32 will still ping its own Healthchecks check
(showing the ESP32 is alive), but Slack/DB/everything-else-routed-through-
alert-api is broken. This check catches that case independently.

Pings every PING_EVERY_S. On error from active alerts (any FIRING with critical
severity), pings /fail to escalate immediately regardless of period.
"""
import asyncio
import logging
import os

import httpx

logger = logging.getLogger("healthchecks_ping")

# Configurable via env var; default is the check created 2026-05-20.
PING_URL = os.environ.get(
    "HEALTHCHECKS_API_URL",
    "https://hc-ping.com/48519bfc-608d-448a-83df-b2ed113a694e",
)
PING_EVERY_S = 60   # well inside the 5-min Healthchecks period + 3-min grace


async def _post(url: str, body: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(url, content=body.encode())
    except Exception as exc:
        logger.warning("healthchecks_ping POST %s failed: %s", url, exc)


async def _build_body() -> tuple[str, bool]:
    """Return (body, has_critical) for the current alert state."""
    try:
        import database
        active = await database.get_active_alerts()
    except Exception as exc:
        return f"err=get_active_alerts:{exc}", False
    total = len(active)
    crit = sum(1 for a in active if (a.get("severity") or "").lower() == "critical"
               and (a.get("status") or "").upper() == "FIRING")
    codes = ",".join(a.get("code", "?") for a in active[:5])
    body = f"active={total} critical={crit} codes={codes or '-'}"
    return body, crit > 0


async def run_periodically() -> None:
    if not PING_URL:
        logger.info("healthchecks_ping disabled (HEALTHCHECKS_API_URL unset)")
        return
    # Wait 5 s before first ping so the app finishes startup
    await asyncio.sleep(5)
    while True:
        try:
            body, has_critical = await _build_body()
            url = PING_URL + "/fail" if has_critical else PING_URL
            await _post(url, body)
        except Exception as exc:
            logger.warning("healthchecks_ping loop iter: %s", exc)
        await asyncio.sleep(PING_EVERY_S)
