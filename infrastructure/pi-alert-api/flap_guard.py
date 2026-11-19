"""
flap_guard.py — Server-side verification gate for alert-api.

When the ESP32 reports certain alert codes as DOWN, this module performs an
independent check from inside the cluster before letting the alert propagate
to Slack. If the cluster sees the target as healthy, the alert is suppressed
(stored in DB with status FLAP_SUPPRESSED) and no Slack notification fires.

This prevents false positives caused by ESP32 transient TLS/connectivity
issues from waking up the team. Real outages (cluster also sees DOWN) still
notify normally.

Wired in from main.py.receive_alert() BEFORE slack_notify.send_alert(...).
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger("flap_guard")

# code -> (url, accepted_status_min, accepted_status_max, timeout_s)
# Only FIRING events with these codes go through verification.
VERIFY_MAP = {
    "CLOUDLESS_ONLINE_DOWN": ("https://cloudless.online", 200, 399, 8.0),
    "CLOUDLESS_ONLINE_SLOW": ("https://cloudless.online", 200, 399, 8.0),
}


async def cluster_verifies_down(code: str) -> Optional[bool]:
    """
    Return:
      True  -> cluster ALSO sees it as down (alert is real)
      False -> cluster sees it as UP (alert is a flap, suppress)
      None  -> code not in verify map, no opinion (let it pass)
    """
    entry = VERIFY_MAP.get(code.upper())
    if not entry:
        return None
    url, ok_min, ok_max, timeout = entry
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as c:
            r = await c.get(url)
            up = ok_min <= r.status_code <= ok_max
            logger.info(
                "flap-guard %s: cluster check %s -> HTTP %d (up=%s)",
                code, url, r.status_code, up,
            )
            return not up
    except Exception as exc:
        logger.warning("flap-guard %s: cluster check %s failed: %s", code, url, exc)
        # If the cluster itself can't reach the target either, the alert is real.
        return True


async def should_suppress(data: dict) -> bool:
    """
    Returns True if the alert should be suppressed (not sent to Slack).
    Mutates `data["status"]` to FLAP_SUPPRESSED + appends a note to message.
    Only acts on FIRING events for codes in VERIFY_MAP.
    """
    if data.get("status", "").upper() != "FIRING":
        return False
    verdict = await cluster_verifies_down(data.get("code", ""))
    if verdict is False:  # cluster says UP
        original = data.get("message", "")
        data["status"] = "FLAP_SUPPRESSED"
        data["message"] = (
            f"{original} [flap-guard: cluster verified target healthy, "
            f"suppressing Slack notify]"
        )
        return True
    return False