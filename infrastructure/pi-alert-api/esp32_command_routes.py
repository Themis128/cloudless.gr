"""
ESP32 command + config routes for alert-api/main.py
====================================================
Drop these routes into the FastAPI app in main.py.

Bridges admin-panel commands (POST /api/esp32/{device_id}/command)
to the ESPHome REST API running on the ESP32 at ESPHOME_HOST:ESPHOME_PORT.

No MQTT broker required — ESPHome exposes a plain HTTP API on port 9101.

LED control endpoints (ESPHome web_server component):
  GET  /light/{entity_id}          → current state JSON
  POST /light/{entity_id}/turn_on  → turn on (with optional params)
  POST /light/{entity_id}/turn_off → turn off

Command → ESPHome mapping:
  led_mode "SOLID_GREEN"           → turn_on r=0 g=1 b=0 effect=None brightness=0.4
  led_mode "blink_orange"          → turn_on effect=blink_orange brightness=0.8
  led_mute  true                   → turn_off
  led_mute  false                  → turn_on (restores prior effect via update_led script)
  led_test                         → turn_on r=1 g=1 b=1 brightness=0.8 for 2 s then restore
  set_brightness <0-100>           → turn_on brightness=<value/100>

Usage
-----
1. Copy this file to ~/alert-api/ on the Pi:
     scp infrastructure/pi-alert-api/esp32_command_routes.py tbaltzakis@192.168.1.128:~/alert-api/

2. At the bottom of ~/alert-api/main.py add:
     from esp32_command_routes import router as esp32_cmd_router
     app.include_router(esp32_cmd_router)

3. Rebuild and rollout:
     cd ~/alert-api && \\
     docker build -t alert-api:v3.1 -t alert-api:v3 . && \\
     docker save alert-api:v3.1 | sudo k3s ctr images import - && \\
     kubectl -n alert-manager rollout restart deployment/alert-api && \\
     kubectl -n alert-manager rollout status deployment/alert-api --timeout=120s

4. Verify (from WSL or any LAN host):
     curl -s -X POST http://192.168.1.128:30800/api/esp32/esp32-leds/command \\
       -H 'Content-Type: application/json' \\
       -d '{"action":"led_test"}'
     # → {"ok": true, "action": "led_test"}
"""

import asyncio
import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ESPHOME_BASE = os.getenv(
    "ESPHOME_URL", "http://192.168.1.201:9101"
)
LED_ENTITY = "status_led"
CMD_TIMEOUT = 5.0  # seconds

# In-memory device config store (survives pod restarts via k8s ConfigMap if needed,
# but ephemeral is fine for now — the admin page re-reads on each tab open).
_device_configs: dict[str, dict] = {}

_DEFAULT_CONFIG = {
    "device_id": "esp32-leds",
    "brightness": 80,
    "heartbeat_interval_s": 60,
    "mqtt_qos": 1,
}


# ── Pydantic models ────────────────────────────────────────────────────────────

class CommandIn(BaseModel):
    action: str
    value: Optional[Any] = None


class ConfigIn(BaseModel):
    device_id: Optional[str] = None
    brightness: Optional[int] = None
    heartbeat_interval_s: Optional[int] = None
    mqtt_qos: Optional[int] = None


# ── ESPHome helpers ────────────────────────────────────────────────────────────

async def _esphome_post(path: str, params: dict | None = None) -> bool:
    """POST to ESPHome REST API. Returns True on success."""
    url = f"{ESPHOME_BASE}{path}"
    try:
        async with httpx.AsyncClient(timeout=CMD_TIMEOUT) as client:
            # ESPHome requires Content-Length even for empty body.
            if params:
                r = await client.post(url, data=params)
            else:
                r = await client.post(url, content=b"", headers={"Content-Length": "0"})
        return r.status_code == 200
    except Exception:
        return False


async def _esphome_get(path: str) -> dict | None:
    """GET from ESPHome REST API. Returns parsed JSON or None."""
    url = f"{ESPHOME_BASE}{path}"
    try:
        async with httpx.AsyncClient(timeout=CMD_TIMEOUT) as client:
            r = await client.get(url)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


# ── Command dispatch ───────────────────────────────────────────────────────────

async def _dispatch_command(action: str, value: Any) -> dict:
    """Translate admin-panel command → ESPHome REST call."""

    if action == "set_brightness":
        brightness = max(0.0, min(1.0, int(value or 80) / 100.0))
        ok = await _esphome_post(
            f"/light/{LED_ENTITY}/turn_on",
            {"brightness": str(brightness)},
        )
        return {"ok": ok, "action": action, "brightness": brightness}

    if action == "led_mute":
        muted = bool(value)
        if muted:
            ok = await _esphome_post(f"/light/{LED_ENTITY}/turn_off", None)
        else:
            # Restore — turn on at previous brightness with no effect (green/solid).
            # The ESPHome update_led script will correct the color on its next cycle.
            ok = await _esphome_post(
                f"/light/{LED_ENTITY}/turn_on",
                {"brightness": "0.4", "r": "0", "g": "1", "b": "0"},
            )
        return {"ok": ok, "action": action, "muted": muted}

    if action == "led_test":
        # White flash for 2 s then restore green.
        ok = await _esphome_post(
            f"/light/{LED_ENTITY}/turn_on",
            {"brightness": "0.8", "r": "1", "g": "1", "b": "0.8"},
        )
        if ok:
            await asyncio.sleep(2)
            await _esphome_post(
                f"/light/{LED_ENTITY}/turn_on",
                {"brightness": "0.4", "r": "0", "g": "1", "b": "0"},
            )
        return {"ok": ok, "action": action}

    if action == "led_mode":
        # Named effect or solid color shorthand.
        mode = str(value or "").strip()
        # Map human-readable modes to ESPHome effect names (must match YAML effects).
        EFFECT_MAP = {
            "SOLID_GREEN":     None,            # no effect = solid
            "blink_orange":    "blink_orange",
            "blink_yellow":    "blink_yellow",
            "blink_red_fast":  "blink_red_fast",
            "blink_deep_orange_fast": "blink_deep_orange_fast",
            "blink_magenta":   "blink_magenta",
        }
        COLOR_MAP = {
            "SOLID_GREEN": {"r": "0", "g": "1", "b": "0", "brightness": "0.4"},
        }
        if mode in EFFECT_MAP:
            effect = EFFECT_MAP[mode]
            params: dict = {}
            if effect:
                params["effect"] = effect
            else:
                params.update(COLOR_MAP.get(mode, {}))
            ok = await _esphome_post(f"/light/{LED_ENTITY}/turn_on", params or None)
        else:
            # Unknown mode — try passing it as an effect name directly.
            ok = await _esphome_post(
                f"/light/{LED_ENTITY}/turn_on", {"effect": mode}
            )
        return {"ok": ok, "action": action, "mode": mode}

    raise HTTPException(status_code=400, detail=f"Unknown command action: {action!r}")


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/api/esp32/{device_id}/command")
async def esp32_command(device_id: str, body: CommandIn):
    """Send a command to the ESP32 via the ESPHome REST API."""
    result = await _dispatch_command(body.action, body.value)
    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=f"ESPHome did not acknowledge command '{body.action}'",
        )
    return result


@router.get("/api/esp32/{device_id}/config")
async def get_esp32_config(device_id: str):
    """Return the stored device config (defaults if never set)."""
    config = _device_configs.get(device_id, _DEFAULT_CONFIG.copy())
    config["device_id"] = device_id
    # Augment with live brightness from ESPHome if reachable.
    state = await _esphome_get(f"/light/{LED_ENTITY}")
    if state and "brightness" in state:
        config["brightness"] = round(state["brightness"] / 255 * 100)
    return config


@router.put("/api/esp32/{device_id}/config")
async def put_esp32_config(device_id: str, body: ConfigIn):
    """Persist device config and apply brightness immediately."""
    existing = _device_configs.get(device_id, _DEFAULT_CONFIG.copy())
    if body.brightness is not None:
        existing["brightness"] = body.brightness
    if body.heartbeat_interval_s is not None:
        existing["heartbeat_interval_s"] = body.heartbeat_interval_s
    if body.mqtt_qos is not None:
        existing["mqtt_qos"] = body.mqtt_qos
    existing["device_id"] = device_id
    _device_configs[device_id] = existing

    # Apply brightness immediately.
    if body.brightness is not None:
        brightness = max(0.0, min(1.0, body.brightness / 100.0))
        await _esphome_post(
            f"/light/{LED_ENTITY}/turn_on",
            {"brightness": str(brightness)},
        )

    return existing
