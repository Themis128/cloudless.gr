"""
mqtt_publish.py — MQTT publisher for Alert API v3.0
=====================================================
Publishes alert status to Mosquitto broker in K3s.

Topics:
  homelab/alerts/status  — retained, QoS 1, aggregate worst severity + count
  homelab/alerts/events  — QoS 0, per-event JSON (non-retained)

Payload schema (homelab/alerts/status):
  {"severity": "ok|info|warning|error|high|critical", "count": N, "timestamp": <unix_epoch>}

Usage (called from main.py):
  from mqtt_publish import publish_alert_event, publish_resolved

Environment variables:
  MQTT_BROKER_HOST  (default: mosquitto.monitoring.svc.cluster.local)
  MQTT_BROKER_PORT  (default: 1883)
  MQTT_USERNAME     (optional; mosquitto runs in dual-mode `allow_anonymous true`
                    + `password_file` as of 2026-06-21, so omitting these still
                    works during the rollout. After the operator flips to
                    `allow_anonymous false`, both vars become required.)
  MQTT_PASSWORD
"""

import asyncio
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

import paho.mqtt.publish as publish

logger = logging.getLogger(__name__)

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "mosquitto.monitoring.svc.cluster.local")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None
MQTT_TOPIC_STATUS = "homelab/alerts/status"
MQTT_TOPIC_EVENTS = "homelab/alerts/events"

_AUTH = {"username": MQTT_USERNAME, "password": MQTT_PASSWORD} if MQTT_USERNAME else None

# Severity ordering worst-first — matches Notion spec
_SEVERITY_RANK: dict[str, int] = {
    "critical": 8,
    "high": 7,
    "error": 6,
    "warning": 5,
    "medium": 4,
    "low": 3,
    "info": 2,
    "debug": 1,
    "ok": 0,
}

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mqtt")


def _worst_severity(active_alerts: list[dict]) -> str:
    """Return the highest severity from the active alert list."""
    if not active_alerts:
        return "ok"
    return max(
        (a.get("severity", "info") for a in active_alerts),
        key=lambda s: _SEVERITY_RANK.get(s, 0),
    )


def _publish_sync(msgs: list[dict]) -> None:
    """Blocking paho publish — runs in the executor thread.

    Raises on failure so the async caller can surface the error rather than
    silently succeeding while the MQTT message was never delivered.
    """
    publish.multiple(
        msgs,
        hostname=MQTT_BROKER_HOST,
        port=MQTT_BROKER_PORT,
        client_id="alert-api-publisher",
        auth=_AUTH,
    )


async def _publish_async(msgs: list[dict]) -> None:
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(_executor, _publish_sync, msgs)
    except Exception as exc:
        logger.warning("MQTT publish failed (non-fatal): %s", exc)


async def publish_alert_event(alert: dict, active_alerts: list[dict]) -> None:
    """Publish a new/updated alert event and refresh the retained status topic.

    Args:
        alert: the alert that just fired or updated.
        active_alerts: full list of currently active (non-resolved) alerts.
    """
    severity = _worst_severity(active_alerts)
    count = len(active_alerts)

    status_payload = json.dumps(
        {
            "severity": severity,
            "count": count,
            "timestamp": int(time.time()),
        }
    )
    event_payload = json.dumps(alert, default=str)

    msgs = [
        {
            "topic": MQTT_TOPIC_STATUS,
            "payload": status_payload,
            "qos": 1,
            "retain": True,
        },
        {
            "topic": MQTT_TOPIC_EVENTS,
            "payload": event_payload,
            "qos": 0,
            "retain": False,
        },
    ]
    await _publish_async(msgs)
    logger.debug("MQTT published: status=%s count=%d", severity, count)


async def publish_resolved(active_alerts: list[dict]) -> None:
    """Refresh the retained status topic after an alert is resolved.

    Args:
        active_alerts: remaining active alerts after the resolution.
    """
    severity = _worst_severity(active_alerts)
    count = len(active_alerts)

    payload = json.dumps(
        {
            "severity": severity,
            "count": count,
            "timestamp": int(time.time()),
        }
    )
    msgs = [
        {
            "topic": MQTT_TOPIC_STATUS,
            "payload": payload,
            "qos": 1,
            "retain": True,
        }
    ]
    await _publish_async(msgs)
    logger.debug("MQTT resolved: status=%s count=%d remaining", severity, count)
