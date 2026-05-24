"""
mqtt_publish.py — MQTT publisher for Alert API v3.0
=====================================================
Publishes alert status to Mosquitto broker on K3s.

Topics:
  homelab/alerts/status  — retained, QoS 1, aggregate severity + count
  homelab/alerts/events  — QoS 0, per-event JSON (non-retained)

Payload schema (homelab/alerts/status):
  {"severity": "info|warning|critical", "count": N, "timestamp": <unix_epoch>}

Usage (import into main.py):
  from mqtt_publish import publish_alert_status, publish_alert_event

Environment variables:
  MQTT_HOST  (default: 192.168.1.128)
  MQTT_PORT  (default: 31883)
"""

import json
import logging
import os
import time

import paho.mqtt.client as mqtt
import paho.mqtt.publish as publish

logger = logging.getLogger(__name__)

MQTT_HOST = os.getenv("MQTT_HOST", "192.168.1.128")
MQTT_PORT = int(os.getenv("MQTT_PORT", "31883"))
MQTT_TOPIC_STATUS = "homelab/alerts/status"
MQTT_TOPIC_EVENTS = "homelab/alerts/events"

# Severity ordering — highest wins for aggregate status
_SEVERITY_RANK = {"info": 1, "warning": 2, "critical": 3}


def _highest_severity(severities: list[str]) -> str:
    """Return the highest severity from a list."""
    if not severities:
        return "info"
    return max(severities, key=lambda s: _SEVERITY_RANK.get(s, 0))


def publish_alert_status(active_alerts: list[dict]) -> bool:
    """Publish aggregate alert status as a retained message.

    Args:
        active_alerts: list of active alert dicts with at least a "severity" key.

    Returns:
        True on success, False on failure.
    """
    count = len(active_alerts)
    severity = _highest_severity([a.get("severity", "info") for a in active_alerts]) if count else "info"

    payload = json.dumps({
        "severity": severity,
        "count": count,
        "timestamp": int(time.time()),
    })

    try:
        publish.single(
            topic=MQTT_TOPIC_STATUS,
            payload=payload,
            qos=1,
            retain=True,
            hostname=MQTT_HOST,
            port=MQTT_PORT,
            client_id="alert-api-status",
        )
        logger.debug("MQTT status published: %s", payload)
        return True
    except Exception as exc:
        logger.warning("MQTT publish_status failed: %s", exc)
        return False


def publish_alert_event(alert: dict) -> bool:
    """Publish a single alert event (non-retained, QoS 0).

    Args:
        alert: alert dict to serialize and publish.

    Returns:
        True on success, False on failure.
    """
    payload = json.dumps(alert, default=str)
    try:
        publish.single(
            topic=MQTT_TOPIC_EVENTS,
            payload=payload,
            qos=0,
            retain=False,
            hostname=MQTT_HOST,
            port=MQTT_PORT,
            client_id="alert-api-events",
        )
        logger.debug("MQTT event published: %s", payload)
        return True
    except Exception as exc:
        logger.warning("MQTT publish_event failed: %s", exc)
        return False
