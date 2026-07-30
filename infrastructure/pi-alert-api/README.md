# pi-alert-api — Alert pipeline for the Pi K3s cluster

FastAPI service that receives alerts from Prometheus / AlertManager / the
ESP32 watchdog, persists them in SQLite, and forwards to Slack with a
verbose, runbook-grade message body.

Lives on the omv-main Pi at `~/alert-api/`. Source-of-truth is this repo.

```
┌─────────────┐    ┌─────────────────┐    ┌───────────────┐    ┌──────────────┐
│ ESP32       │    │ Prometheus      │    │ AlertManager  │    │ alert-api    │
│ watchdog    │───▶│ PrometheusRule  │───▶│ allowlist     │───▶│ /webhook     │──▶ Slack
│ (off-cluster)│   │ (esp32-watchdog,│    │ routing       │    │ verbose body │   #alerts
│              │   │  cluster-node)  │    │ → "null" or   │    │ + SQLite DB  │
│              │   │                 │    │   alert-api   │    │ + MQTT       │
└─────────────┘    └─────────────────┘    └───────────────┘    └──────────────┘
```

## File map

| File | Purpose |
|---|---|
| `main.py` | FastAPI app. `/api/alertmanager/webhook` is the entry point; `_render_alertmanager_message()` builds the verbose Slack body. |
| `slack_notify.py` | Block Kit payload builder. Per-code proposed-solution mapping for every ESP32 watchdog alert. |
| `database.py` | SQLite persistence (alerts, history, ESP32 status, logs). |
| `flap_guard.py` | Suppresses re-alerts within a debounce window so a flapping target doesn't spam Slack. |
| `mqtt_publish.py` | Publishes alert events + retained status to Mosquitto (`homelab/alerts/*`). |
| `tls_check.py` | Background task: checks TLS cert expiry, fires `CERT_EXPIRING_*` alerts. |
| `healthchecks_ping.py` | Background task: pings healthchecks.io to prove the service is alive. |
| `esp32_command_routes.py` | LED / OTA / config endpoints for the ESP32 board. |
| `deploy.sh` | scp's the Python files to the Pi and rebuilds the container. |
| `tests/` | Unit tests + live smoke test. |

## How the pipeline works

### 1. Rules fire in Prometheus

Two `PrometheusRule` resources we own:

- **`monitoring/esp32-watchdog-alerts`** ([yaml](../esp32-watchdog/k8s/prometheusrule.yaml)) — what the ESP32 sees from off-cluster.
- **`monitoring/cluster-node-alerts`** ([yaml](../../k8s/cluster-protection/prometheus-rule-tuning.yaml)) — node-exporter signals (disk, memory, swap, etcd).

Every rule:

- Has a multi-line `description` annotation with **impact**, **ranked causes**, and a **triage checklist**.
- Uses `{{ $value | printf "%.0f" }}` in `summary` so the triggering number shows up at-a-glance in Slack.
- Carries explicit `target:` and `probe:` labels (e.g. `target: cloudless.gr`, `probe: esp32-https`) — the alert-api uses `target` as the Slack "Service" field.

### 2. AlertManager filters with an allowlist

`apply-prometheus-rule-tuning.sh` patches the AlertManager secret to enforce:

- **Default route → `"null"` receiver** (alert is evaluated but NOT Slacked).
- **Severity = `critical` → `alert-api` receiver** (always Slacked).
- **Severity = `warning` AND alertname in a curated list → `alert-api`**:
  `AWSProbeFailuresElevated`, `OmvProbeFailuresElevated`, `OmvHaProbeFailuresElevated`,
  `ESP32WatchdogDown`, `ESP32WifiWeak`, `NodeDiskUsageHigh`, `NodeDiskUsageOmvMain`,
  `NodeMemoryPressure`, `NodeHighSwapUsage`.

Marker `# tuned-by: apply-prometheus-rule-tuning.sh v2` makes the patch idempotent.

### 3. alert-api renders the Slack message

`/api/alertmanager/webhook` calls `_render_alertmanager_message(labels, annotations, am_alert)`. The output is the body of the section block:

```
<summary>

<description — multi-line, preserved>

*Value:* `7`
*Instance:* `192.168.1.130:9100`
*Target / Probe:* `omv-ha` / `esp32-http`
*Pod:* `node-exporter-xyz`

_Other labels:_ `component=etcd`, `cluster=homelab`

📖 *Runbook:* <https://wiki/runbook|open>
📊 *Source:* <http://prom/graph|Prometheus query>
```

Then `slack_notify.send_alert()` wraps that body in a 4-block Slack message:

- **Header block** — `:severity-emoji: SEVERITY - CODE`
- **Section block** — the rendered body above + a Host / Severity / Code / Count / Time prefix + a per-code proposed-solution hint
- **Context block** — small grey text: `Alert #N · dedupe count: N · severity: ... · status: ...`
- **Divider**

## Testing

### Unit tests (no network, no cluster)

```bash
cd infrastructure/pi-alert-api
python3 -m unittest discover tests
```

Covers:

- `_render_alertmanager_message()` — every field shape, ordering, edge cases (18 tests)
- `slack_notify.send_alert()` — Block Kit payload structure, severity emoji, proposed-solution mapping for all ESP32 codes (12 tests)

Each test file stubs `httpx`/`fastapi`/`pydantic`/etc. so it runs in any clean Python — no need for `pip install`.

### Live smoke test (hits the cluster + Slack)

```bash
bash infrastructure/pi-alert-api/tests/smoke_test_live.sh
```

Sends a synthetic `SMOKETEST_<unixtime>` alert to the live alert-api webhook, polls `/api/alerts?status=active` to confirm the verbose body was persisted, then resolves the alert. Exits non-zero if any of the expected fields (`*Instance:*`, `*Target / Probe:*`, `📖 *Runbook:*`, `📊 *Source:*`) are missing.

You should also see the test message land in `#alerts` — visually verify the formatting, then it auto-resolves.

Override URL when running off-cluster:

```bash
ALERT_API_URL=http://192.168.1.128:30820 \
  bash infrastructure/pi-alert-api/tests/smoke_test_live.sh
```

## Operator runbook

### Adding a new alert that should reach Slack

1. **Write the PrometheusRule** in `infrastructure/esp32-watchdog/k8s/prometheusrule.yaml` (ESP32-sourced) or `k8s/cluster-protection/prometheus-rule-tuning.yaml` (node-exporter). Every new rule needs:
   - `summary:` with `{{ $value | printf "%.0f" }}` if a numeric threshold trips it.
   - `description: |` (multi-line) with **impact / causes / triage checklist**.
   - Labels: `severity:`, plus `target:` + `probe:` for the Slack Service field.

2. **Decide if it should Slack:**
   - `severity: critical` → automatically Slacks. No further action.
   - `severity: warning` → must be added to the AlertManager allowlist. Edit `apply-prometheus-rule-tuning.sh`, append the alertname to the `alertname =~ "..."` regex in the route block. Bump the marker version (`v2` → `v3`) so the script re-applies the AM secret.

3. **Apply** (idempotent):

   ```bash
   bash k8s/cluster-protection/apply-prometheus-rule-tuning.sh
   ```

4. **Add a proposed-solution string** for the new code in `slack_notify.py::_proposed_solution()` — operators get one-line remediation in the Slack message itself. The unit test `test_all_esp32_watchdog_codes_have_solutions` enforces this for the ESP32 family; extend the required-codes list if needed.

5. **Verify** by re-running the smoke test or by triggering the alert deliberately.

### Silencing a noisy alert

Two options depending on permanence:

- **Strip the alert rule entirely** (permanent) — add the alertname to one of the `strip_alerts_from_rule` calls in `apply-prometheus-rule-tuning.sh`, re-apply. Rule won't fire at all anymore.
- **Route to `"null"` but keep evaluating** — remove from the AM allowlist regex (warnings) or downgrade `severity:` from `critical` to `warning` and don't allowlist it. Prometheus still records it, alert-api DB still tracks it, but no Slack.

The chatty kube-prometheus-stack rule groups (`monitoring-prometheus`, `monitoring-prometheus-operator`, `monitoring-alertmanager.rules`, `monitoring-kubernetes-system-apiserver`, `monitoring-config-reloaders`, `monitoring-node-network`) are deleted outright by the apply script — they regenerate on every `helm upgrade` and need re-deleting after.

### Debugging a missing Slack message

```bash
# 1. Is the rule firing in Prometheus?
curl -sS http://10.43.154.40:9090/api/v1/alerts \
  | jq '.data.alerts[] | select(.labels.alertname=="MyAlert")'

# 2. Did AM accept it?
sudo kubectl -n monitoring exec alertmanager-monitoring-alertmanager-0 \
  -c alertmanager -- wget -qO- http://127.0.0.1:9093/api/v2/alerts \
  | jq '.[] | select(.labels.alertname=="MyAlert")'

# 3. Did AM route it to alert-api? (look at the receiver hint)
# 4. Did alert-api receive + render it?
sudo kubectl -n alert-manager logs -l app=alert-api --tail=50 | grep MyAlert
# 5. Did Slack accept?
sudo kubectl -n alert-manager logs -l app=alert-api --tail=50 | grep 'Slack alert sent\|webhook'
```

If the chain breaks at step 2 → AM routing dropped it (check the allowlist).
If step 3-4 → see alert-api app logs for the rendering exception.
If step 5 → check Slack webhook URL secret (`alert-api-secrets/SLACK_WEBHOOK_URL`).

### Re-deploying the alert-api

```bash
bash infrastructure/pi-alert-api/deploy.sh
```

scp's `main.py` + `slack_notify.py` + `mqtt_publish.py` + `tls_check.py` + `esp32_command_routes.py` to the Pi (with `.bak.<ts>` safety copies), then `docker build` + `k3s ctr images import` + `kubectl rollout`. Takes ~30-60s.

After redeploy, always run the smoke test:

```bash
bash infrastructure/pi-alert-api/tests/smoke_test_live.sh
```

## See also

- [`PR #304`](https://github.com/Themis128/cloudless.gr/pull/304) — the alert-cleanup PR that introduced this tracked source + verbose rendering.
- [`infrastructure/esp32-watchdog/`](../esp32-watchdog/) — ESP32 firmware (ESPHome) that produces the off-cluster probe metrics.
- [`k8s/cluster-protection/`](../../k8s/cluster-protection/) — the rule-tuning + AM-patch apply script.
