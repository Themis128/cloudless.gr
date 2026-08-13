"""
Pi Alert API — FastAPI service.
Receives alerts from the ESP32, stores them in SQLite, notifies Slack.
Both Pi nodes poll /api/alerts/active for auto-remediation.

New in v2.0:
  - POST /api/esp32/heartbeat     ESP32 hardware status ping
  - POST /api/esp32/log           Verbose log push from ESP32
  - GET  /api/esp32/status        Last-known ESP32 hardware state
  - GET  /api/status              Combined system snapshot
  - WS   /ws/esp32-logs           Real-time log stream (browser)
  - POST /api/alerts/{code}/resolve  (changed from PATCH → POST for simplicity)

New in v3.0:
  - MQTT publishing via Mosquitto (homelab/alerts/* topics)
  - POST /api/alertmanager/webhook  Alertmanager webhook receiver

New in v3.3:
  - Verbose Alertmanager → Slack rendering: combines summary + description,
    surfaces the firing metric value, instance label, runbook URL, and a
    "Source" line with the alert generator URL. Replaces the previous
    one-line summary-only payload that left messages like
    "cloudless.gr probe failure rate elevated" with no diagnostic context.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import database
import flap_guard
import healthchecks_ping
import mqtt_publish
import slack_notify
import tls_check
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("main")

# ── WebSocket connection pool ──────────────────────────────────────────────────
_log_clients: set[WebSocket] = set()
_log_queue: asyncio.Queue = asyncio.Queue(maxsize=500)


async def _ws_broadcaster():
    """Background task: fan out log entries to all connected WS clients."""
    while True:
        entry = await _log_queue.get()
        dead = set()
        for ws in list(_log_clients):
            try:
                await ws.send_text(json.dumps(entry))
            except Exception:
                dead.add(ws)
        _log_clients.difference_update(dead)


async def _push_log(level: str, message: str) -> dict:
    """Insert a log line into the DB and broadcast to WS clients."""
    entry = await database.insert_log(level, message)
    try:
        _log_queue.put_nowait(entry)
    except asyncio.QueueFull:
        pass
    return entry


_background_tasks: set[asyncio.Task] = set()  # holds refs so asyncio doesn't GC the tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_db()
    for coro in (
        _ws_broadcaster(),
        tls_check.run_periodically(),
        healthchecks_ping.run_periodically(),
    ):
        task = asyncio.create_task(coro)
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    log.info("Alert API v3.3 ready (bg tasks=%d)", len(_background_tasks))
    yield


app = FastAPI(
    title="Pi Alert API",
    description="Out-of-band alert manager for the Pi K3s cluster",
    version="3.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────


class AlertIn(BaseModel):
    code: str
    host: str
    service: str
    severity: str  # critical | high | medium | low | info
    message: str
    status: str  # FIRING | ONGOING | RESOLVED | INFO
    count: int = 1
    resolved_by: str | None = None


class HeartbeatIn(BaseModel):
    ip: str | None = None
    rssi: int | None = None
    firmware_ver: str | None = None
    uptime_s: int | None = None
    free_ram_bytes: int | None = None
    device_id: str | None = None


class LogIn(BaseModel):
    level: str = "INFO"  # DEBUG | INFO | WARN | ERROR
    message: str


class ScriptIn(BaseModel):
    script: str  # name of the troubleshooting script to run


# ── Alert endpoints ───────────────────────────────────────────────────────────


@app.post("/api/alerts", status_code=201)
async def receive_alert(alert: AlertIn):
    """Receive an alert from the ESP32 or any source, persist + notify."""
    data = alert.model_dump()
    saved = await database.upsert_alert(data)
    merged = {**data, **(saved or {})}
    if not await flap_guard.should_suppress(merged):
        await slack_notify.send_alert(merged)
    else:
        await database.upsert_alert(merged)
    await _push_log(
        "ALERT",
        f"[{alert.status}] {alert.code} — {alert.message}",
    )
    # MQTT: publish event + update retained status
    active = await database.get_active_alerts()
    asyncio.create_task(mqtt_publish.publish_alert_event(merged, active))
    return {"ok": True, "alert": saved}


@app.get("/api/alerts")
async def list_alerts(status: str | None = None):
    """Return all alerts. Use ?status=active to filter."""
    if status == "active":
        return await database.get_active_alerts()
    return await database.get_alert_history(limit=500)


@app.get("/api/alerts/active")
async def active_alerts():
    """Return all non-resolved alerts (used by remediation agents)."""
    return await database.get_active_alerts()


@app.get("/api/alerts/history")
async def alert_history(limit: int = Query(default=100, ge=1, le=1000)):
    """Full alert event log, newest first."""
    return await database.get_alert_history(limit)


@app.get("/api/alerts/stats")
async def alert_stats():
    """Alert counts by status and severity."""
    return await database.get_alert_stats()


@app.patch("/api/alerts/{alert_code}/resolve")
@app.post("/api/alerts/{alert_code}/resolve")
async def resolve_alert(alert_code: str, resolved_by: str = "manual"):
    """Manually resolve an alert by code."""
    ok = await database.resolve_alert(alert_code, resolved_by)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail=f"Alert '{alert_code}' not found or already resolved",
        )
    await _push_log("INFO", f"[RESOLVED] {alert_code} — resolved by {resolved_by}")
    # MQTT: update retained status with remaining active alerts
    active = await database.get_active_alerts()
    asyncio.create_task(mqtt_publish.publish_resolved(active))
    return {"ok": True, "code": alert_code, "resolved_by": resolved_by}


# ── Alertmanager webhook ──────────────────────────────────────────────────────

# Labels we surface inline in the message body. Anything else from `labels` is
# appended as a single "Other labels:" footer so the operator gets full context
# without the section becoming a wall of text.
_PRIMARY_LABELS = {"alertname", "severity", "namespace", "node", "instance", "job", "pod"}


def _render_alertmanager_message(labels: dict, annotations: dict, am_alert: dict) -> str:
    """
    Build a verbose Slack message body from one Alertmanager alert payload.

    Format (markdown for the Slack `mrkdwn` section):
        <summary>

        <description>

        *Value:* <firing metric value>
        *Instance:* <labels.instance>
        *Probe / Target:* <labels.probe> / <labels.target>
        Other labels: k=v, k=v, ...

        Runbook: <annotations.runbook_url>
        Source:  <am_alert.generatorURL>

    Falls back gracefully when any field is missing.
    """
    summary = (annotations.get("summary") or "").strip()
    description = (annotations.get("description") or "").strip()
    runbook = (annotations.get("runbook_url") or "").strip()
    generator_url = (am_alert.get("generatorURL") or "").strip()
    value = am_alert.get("value") or annotations.get(
        "value"
    )  # AM doesn't expose `value` by default; some templates do

    parts: list[str] = []
    if summary:
        parts.append(summary)
    if description and description != summary:
        # `description` is multi-line in our rules — preserve newlines.
        parts.append(description)

    facts: list[str] = []
    if value is not None and value != "":
        facts.append(f"*Value:* `{value}`")
    instance = labels.get("instance")
    if instance:
        facts.append(f"*Instance:* `{instance}`")
    target = labels.get("target")
    probe = labels.get("probe")
    if target or probe:
        facts.append(f"*Target / Probe:* `{target or '-'}` / `{probe or '-'}`")
    pod = labels.get("pod")
    if pod:
        facts.append(f"*Pod:* `{pod}`")
    if facts:
        parts.append("\n".join(facts))

    extra_labels = {
        k: v for k, v in labels.items() if k not in _PRIMARY_LABELS and v not in (None, "")
    }
    if extra_labels:
        rendered = ", ".join(f"`{k}={v}`" for k, v in sorted(extra_labels.items()))
        parts.append(f"_Other labels:_ {rendered}")

    refs: list[str] = []
    if runbook:
        refs.append(f"📖 *Runbook:* <{runbook}|open>")
    if generator_url:
        refs.append(f"📊 *Source:* <{generator_url}|Prometheus query>")
    if refs:
        parts.append("\n".join(refs))

    if not parts:
        return f"{labels.get('alertname', 'ALERT')} fired (no annotations)."

    return "\n\n".join(parts)


@app.post("/api/alertmanager/webhook", status_code=200)
async def alertmanager_webhook(payload: dict[str, Any]):
    """
    Receives Alertmanager webhook notifications.
    Maps Prometheus alert labels to alert-api AlertIn format, then routes
    through the same receive_alert pipeline (Slack + MQTT + DB).

    Verbose message rendering (v3.3): _render_alertmanager_message() combines
    summary + description and surfaces metric value, instance, probe/target,
    runbook URL, and generator URL so the Slack message is self-contained
    diagnostic context instead of a 5-word headline.
    """
    alerts_received = payload.get("alerts", [])
    processed = 0
    for am_alert in alerts_received:
        labels = am_alert.get("labels", {})
        annotations = am_alert.get("annotations", {})
        status = am_alert.get("status", "firing")

        code = labels.get("alertname", "ALERTMANAGER_ALERT").upper().replace(" ", "_")
        severity = labels.get("severity", "warning")
        namespace = labels.get("namespace", "")
        host = labels.get("node", labels.get("instance", "k3s-cluster"))
        # Prefer the explicit `target` label (set by ESP32 watchdog rules) over
        # namespace/job — it's the human-meaningful subsystem the alert is about.
        service = labels.get("target") or namespace or labels.get("job", "prometheus")
        message = _render_alertmanager_message(labels, annotations, am_alert)

        alert_status = "RESOLVED" if status == "resolved" else "FIRING"

        alert_in = AlertIn(
            code=code,
            host=host,
            service=service,
            severity=severity,
            message=message,
            status=alert_status,
        )
        data = alert_in.model_dump()
        if alert_status == "RESOLVED":
            await database.resolve_alert(code, "alertmanager")
            active = await database.get_active_alerts()
            asyncio.create_task(mqtt_publish.publish_resolved(active))
        else:
            saved = await database.upsert_alert(data)
            merged = {**data, **(saved or {})}
            if not await flap_guard.should_suppress(merged):
                await slack_notify.send_alert(merged)
            active = await database.get_active_alerts()
            asyncio.create_task(mqtt_publish.publish_alert_event(merged, active))
        processed += 1

    return {"ok": True, "processed": processed}


# ── ESP32 endpoints ───────────────────────────────────────────────────────────


@app.post("/api/esp32/heartbeat", status_code=200)
async def esp32_heartbeat(hb: HeartbeatIn):
    """Called by ESP32 every ~60 s to report hardware state."""
    status = await database.upsert_esp32_status(hb.model_dump())
    await _push_log(
        "DEBUG",
        f"[HB] ip={hb.ip} rssi={hb.rssi}dBm uptime={hb.uptime_s}s free_ram={hb.free_ram_bytes}B",
    )
    return {"ok": True, "status": status}


@app.post("/api/esp32/log", status_code=201)
async def esp32_log(entry: LogIn):
    """Accept a verbose log line from the ESP32 firmware."""
    saved = await _push_log(entry.level, entry.message)
    return {"ok": True, "entry": saved}


@app.get("/api/esp32/status")
async def esp32_status():
    """Return last-known ESP32 hardware state + staleness flag."""
    s = await database.get_esp32_status()
    if s.get("last_heartbeat"):
        try:
            last = datetime.fromisoformat(s["last_heartbeat"])
            stale = (datetime.now(UTC) - last) > timedelta(minutes=5)
        except Exception:
            stale = True
    else:
        stale = True
    s["stale"] = stale
    return s


@app.get("/api/esp32/logs")
async def esp32_logs(
    limit: int = Query(default=200, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
):
    """Return recent ESP32 log lines (oldest first)."""
    return await database.get_logs(limit, offset)


# ── Combined system status ────────────────────────────────────────────────────


@app.get("/api/status")
async def system_status():
    """
    Snapshot of the full system:
      - Pi node health (inferred from active alerts)
      - ESP32 hardware state
      - Alert summary
    """
    active = await database.get_active_alerts()
    esp32 = await esp32_status()
    stats = await database.get_alert_stats()

    active_codes = {a["code"] for a in active}

    def _pi_status(prefix: str) -> dict:
        down_alerts = [a for a in active if a["code"].startswith(prefix)]
        if not down_alerts:
            return {"status": "up", "alerts": []}
        ssh_code = f"{prefix}SSH_DOWN"
        status = "down" if ssh_code in active_codes else "degraded"
        return {"status": status, "alerts": [a["code"] for a in down_alerts]}

    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "pis": {
            "omv-main": {"ip": "192.168.1.128", **_pi_status("OMV_MAIN_")},
            "omv-ha": {"ip": "192.168.1.130", **_pi_status("OMV_HA_")},
        },
        "esp32": esp32,
        "alerts": {
            "active_count": stats["active"],
            "resolved_count": stats["resolved"],
            "total_count": stats["total"],
            "by_severity": stats["by_severity"],
        },
    }


# ── Troubleshooting scripts ───────────────────────────────────────────────────

SCRIPTS: dict[str, dict] = {
    "restart_k3s_main": {
        "label": "Restart K3s (omv-main)",
        "description": "systemctl restart k3s on omv-main",
        "danger": False,
    },
    "restart_k3s_agent": {
        "label": "Restart K3s Agent (omv-ha)",
        "description": "systemctl restart k3s-agent on omv-ha",
        "danger": False,
    },
    "restart_cloudless_app": {
        "label": "Restart cloudless app pod",
        "description": "kubectl rollout restart deployment/cloudless-app -n cloudless",
        "danger": False,
    },
    "restart_alert_api": {
        "label": "Restart Alert API pod",
        "description": "kubectl rollout restart deployment/alert-api -n alert-manager",
        "danger": False,
    },
    "resolve_all_alerts": {
        "label": "Resolve ALL active alerts",
        "description": "Marks every active alert as resolved (manual bulk-clear)",
        "danger": True,
    },
}


@app.get("/api/scripts")
async def list_scripts():
    """List available troubleshooting scripts."""
    return [{"id": k, **v} for k, v in SCRIPTS.items()]


@app.post("/api/scripts/{script_id}/run")
async def run_script(script_id: str):
    """
    Execute a named troubleshooting script.
    The Alert API runs inside K3s — it cannot SSH to nodes directly.
    This endpoint logs the intent; actual execution is done by the
    remediation agent on the next poll, or triggered via alert injection.
    """
    if script_id not in SCRIPTS:
        raise HTTPException(status_code=404, detail=f"Script '{script_id}' not found")

    script = SCRIPTS[script_id]
    await _push_log("INFO", f"[SCRIPT] Triggered: {script_id} — {script['description']}")

    if script_id == "resolve_all_alerts":
        active = await database.get_active_alerts()
        for a in active:
            await database.resolve_alert(a["code"], "admin-script")
        active_after = await database.get_active_alerts()
        asyncio.create_task(mqtt_publish.publish_resolved(active_after))
        await _push_log("INFO", f"[SCRIPT] Resolved {len(active)} alerts")
        return {"ok": True, "script": script_id, "resolved": len(active)}

    trigger_map = {
        "restart_k3s_main": "OMV_MAIN_K3S_API_DOWN",
        "restart_k3s_agent": "OMV_HA_K3S_AGENT_DOWN",
        "restart_cloudless_app": "CLOUDLESS_ONLINE_DOWN",
        "restart_alert_api": None,
    }
    trigger_code = trigger_map.get(script_id)
    msg = "Script triggered; remediation agent will act on next poll."
    if trigger_code:
        msg += f" (via alert code: {trigger_code})"

    return {"ok": True, "script": script_id, "message": msg}


# ── WebSocket log stream ───────────────────────────────────────────────────────


@app.websocket("/ws/esp32-logs")
async def ws_logs(ws: WebSocket):
    """
    WebSocket: streams ESP32 log lines to connected browsers.
    On connect, sends the last 100 stored lines, then live entries.
    """
    await ws.accept()
    _log_clients.add(ws)
    try:
        history = await database.get_logs(limit=100)
        for entry in history:
            await ws.send_text(json.dumps({**entry, "historic": True}))

        while True:
            await asyncio.sleep(30)
            await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.debug("WS client disconnected: %s", e)
    finally:
        _log_clients.discard(ws)


# ── Health ─────────────────────────────────────────────────────────────────────


@app.get("/api/health")
@app.get("/health")
async def health():
    return {"status": "ok", "service": "pi-alert-api", "version": "3.3.0"}


# ── ESP32 command + config + OTA routes (added by deploy.sh) ─────────────────
from esp32_command_routes import router as esp32_cmd_router  # noqa: E402

app.include_router(esp32_cmd_router)
