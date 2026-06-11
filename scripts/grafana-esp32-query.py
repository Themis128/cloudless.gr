#!/usr/bin/env python3
"""Query Grafana dashboard and ESP32 Prometheus data from inside the k3s cluster."""

import base64
import json
import os
import urllib.error
import urllib.request

GRAFANA = "http://kube-prom-grafana.monitoring.svc.cluster.local:80"
PROM = "http://monitoring-prometheus.monitoring.svc.cluster.local:9090"
PASS = os.environ["GRAFANA_PASS"]
UID = os.environ.get("DASHBOARD_UID", "esp32-watchdog")
AUTH = base64.b64encode(f"admin:{PASS}".encode()).decode()


def get(url, auth=None):
    req = urllib.request.Request(url)
    if auth:
        req.add_header("Authorization", f"Basic {auth}")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


print("=== Dashboard panels ===")
d = get(f"{GRAFANA}/api/dashboards/uid/{UID}", AUTH)
if "error" in d:
    print("ERROR:", d["error"])
else:
    dash = d.get("dashboard", {})
    meta = d.get("meta", {})
    print(f"Title:   {dash.get('title')}")
    print(f"UID:     {dash.get('uid')}")
    print(f"Updated: {meta.get('updated')}")
    panels = dash.get("panels", [])
    print(f"Panels ({len(panels)}):")
    for p in panels:
        print(f"  [{p.get('id')}] {p.get('type')} -- {p.get('title')}")

print("\n=== Firing alerts ===")
alerts = get(f"{GRAFANA}/api/alertmanager/grafana/api/v2/alerts", AUTH)
if isinstance(alerts, list):
    print("No firing alerts" if not alerts else "")
    for a in alerts:
        lbls = a.get("labels", {})
        print(
            lbls.get("alertname", "?"),
            "-",
            lbls.get("severity", "?"),
            "-",
            a.get("status", {}).get("state", "?"),
        )
else:
    print("Alerts:", alerts)

print("\n=== ESP32 Prometheus targets ===")
t = get(f"{PROM}/api/v1/targets")
targets = t.get("data", {}).get("activeTargets", [])
esp = [
    x
    for x in targets
    if any(
        k in str(x.get("labels", {})).lower()
        for k in ["esp", "sensor", "iot", "arduino", "watchdog"]
    )
]
if not esp:
    print("No ESP32/IoT targets. All jobs:")
    for x in targets[:15]:
        print(" ", x.get("labels", {}).get("job"), x.get("health"))
else:
    for x in esp:
        print(
            x.get("health"),
            x.get("labels", {}).get("job"),
            x.get("labels", {}).get("instance"),
            x.get("lastError", ""),
        )

print("\n=== ESP32 metric names ===")
m = get(f"{PROM}/api/v1/label/__name__/values")
names = m.get("data", [])
esp_metrics = [
    n
    for n in names
    if any(
        k in n.lower()
        for k in ["esp", "sensor", "temperature", "humidity", "watchdog", "heartbeat", "moisture"]
    )
]
print("ESP/sensor metrics:", esp_metrics[:30] if esp_metrics else "none found")
