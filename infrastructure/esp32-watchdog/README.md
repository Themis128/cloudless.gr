# ESP32 Cluster Watchdog

**Board:** ESP32-S3-DevKitC-1 **v1.0** (RGB LED → GPIO48)  
**Port:** COM3 (VID_303A / PID_4001)
**Static IP after flash:** `192.168.1.201`

> Pin reference: v1.0 boards have the onboard RGB LED on **GPIO48**. v1.1 boards
> moved it to GPIO38. Do **not** swap the YAML pin without confirming the
> physical board revision (silkscreen).

## What it does

| Feature | How |
|---|---|
| External Pi probe | Pings `omv` (192.168.1.128) and `omv-ha` (192.168.1.130) every 30 s |
| k3s API probe | HTTPS GET `omv:6443/livez` every 30 s; triggers hardware reset after 3 min unreachable |
| RGB status LED | 4-state color matrix — cluster-only since 2026-06-21 (see table below) |
| Push alerts | Posts to ntfy at `192.168.1.130:30080/cloudless-alerts` |
| Prometheus `/metrics` | Scraped by kube-prometheus on port 9101 |
| Grafana alerts | `PrometheusRule` fires for node-down, ESP32-down, weak Wi-Fi |

> **AWS probe removed 2026-06-21** — ESP32 watches CLUSTER ONLY per the
> monitoring-scope cleanup. The `aws_up` global stays `true` so the LED
> matrix collapses naturally to the 4-state cluster matrix below.
> Re-enable by restoring the `aws_health` substitution, the `probe_aws`
> interval, the `aws_app_reachable` binary_sensor, and the AWS branch of
> `notify_alerts` in `cloudless-watchdog.yaml`.

### LED color matrix (cluster-only)

| omv | omv-ha | Color | Effect |
|-----|--------|-------|--------|
| ✅ | ✅ | 🟢 Green | Solid — both cluster nodes healthy |
| ❌ | ✅ | 🟡 Yellow | Slow blink — omv down, omv-ha up |
| ✅ | ❌ | 🟡 Yellow | Slow blink — omv-ha down, omv up |
| ❌ | ❌ | 🔴 Red | Fast blink — total cluster outage |

Blue = booting / connecting to Wi-Fi.

---

## Step 1 — Install ESPHome (one-time, WSL2)

```bash
# uv is already installed at ~/.local/bin/uv
uv tool install esphome
esphome version   # should print 2026.5.0
```

> **Why WSL2, not Windows PowerShell?**  
> The Windows project path (`D:\Nuxt Projects\...`) contains a space which crashes
> the PlatformIO/CMake compiler flag `-fdebug-prefix-map`. Running ESPHome from
> WSL2 uses `/home/tbaltzakis/code/cloudless.gr/...` — no spaces, no errors.

---

## Step 2 — Fill in secrets

`esphome/secrets.yaml` is already populated (gitignored). If starting fresh, copy
the template and fill in values:

```bash
cp esphome/secrets.yaml.template esphome/secrets.yaml
# Edit secrets.yaml with your wifi_ssid, wifi_password, ntfy_token, api_key, ota_password
```

Generate the API key:

```bash
python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())"
```

---

## Step 3 — Flash the board

The ESP32-S3 **must be in bootloader mode** for the first flash:

1. Hold the **BOOT** button on the board
2. While holding BOOT, press and release **RESET**
3. Release BOOT — the board is now in DFU mode (COM3 may disappear and reappear)
4. Run from WSL2:

```bash
cd ~/code/cloudless.gr/infrastructure/esp32-watchdog/esphome
esphome run cloudless-watchdog.yaml --device /dev/ttyS3
```

ESPHome compiles (~4 min first time), flashes over `/dev/ttyS3` (= COM3), then
opens the log console. After the first flash, OTA updates work over Wi-Fi — no
USB needed.

**OTA update (after first flash):**

```bash
cd ~/code/cloudless.gr/infrastructure/esp32-watchdog/esphome
esphome run cloudless-watchdog.yaml
# ESPHome auto-discovers the board at 192.168.1.201 via mDNS
```

**Compile only (no flash):**

```bash
esphome compile cloudless-watchdog.yaml
```

---

## Step 4 — Deploy Kubernetes manifests

```bash
# From WSL2 / a node with kubectl access
kubectl apply -f infrastructure/esp32-watchdog/k8s/ntfy-topic.yaml
kubectl apply -f infrastructure/esp32-watchdog/k8s/servicemonitor.yaml
kubectl apply -f infrastructure/esp32-watchdog/k8s/prometheusrule.yaml
```

Verify the scrape target appears in Prometheus:

```
http://192.168.1.128:10000  (Grafana, port 10000)
# or
kubectl port-forward -n monitoring svc/monitoring-prometheus 9090:9090
# → http://localhost:9090/targets  — look for "esp32-watchdog-metrics"
```

---

## Step 5 — Verify

After ~2 minutes, check:

1. **LED is green** — both Pis and cloudless.gr responding
2. **Prometheus target is UP** — Status → Targets in Prometheus UI
3. **Metrics visible** — query `esphome_binary_sensor_value` in Grafana/Prometheus
4. **ntfy alert works** — temporarily unplug one Pi and watch for a notification
5. **AWS probe works** — query `esphome_binary_sensor_value{name="cloudless.gr_(aws)_reachable"}` in Prometheus

---

## Prometheus metric label format

ESPHome lowercases sensor names, replaces spaces and dots with `_`, and replaces
parentheses (and other special chars) with `__` (double underscore).
Use the `id` label in PrometheusRule expressions — **not** the `name` label.

| Sensor name | `id` label value |
|-------------|-----------------|
| "omv (192.168.1.128) reachable" | `omv__192_168_1_128__reachable` |
| "omv-ha (192.168.1.130) reachable" | `omv-ha__192_168_1_130__reachable` |
| "cloudless.gr (AWS) reachable" | `cloudless_gr__aws__reachable` |
| "Wi-Fi Signal" | `wi-fi_signal` |
| "omv probe failures" | `omv_probe_failures` |
| "omv-ha probe failures" | `omv-ha_probe_failures` |
| "cloudless.gr probe failures" | `cloudless_gr_probe_failures` |

---

## Optional: Hardware relay

To add hard-reboot capability:

1. Buy a **5V 1-channel relay module** (e.g. SRD-05VDC-SL-C)
2. Wire: ESP32 `GPIO10` → relay `IN`, ESP32 `3.3V` → relay `VCC`, ESP32 `GND` → relay `GND`
3. Wire relay `COM`/`NO` in series with omv's USB-C 5V power line
4. Uncomment the `switch:` block at the bottom of `cloudless-watchdog.yaml`
5. Set `relay_gpio: "10"` in the substitutions
6. Re-flash

---

## File layout

```
infrastructure/esp32-watchdog/
├── esphome/
│   ├── cloudless-watchdog.yaml   ← firmware (commit this)
│   ├── secrets.yaml.template     ← secrets template (commit this)
│   └── secrets.yaml              ← credentials (DO NOT commit — gitignored)
├── k8s/
│   ├── servicemonitor.yaml       ← Prometheus scrape target
│   ├── prometheusrule.yaml       ← alert rules (Pi + AWS + Wi-Fi + failure rate)
│   └── ntfy-topic.yaml           ← NodePort for ESP32 → ntfy
├── platformio/
│   ├── platformio.ini            ← PlatformIO project (IntelliSense + direct flash)
│   └── src/main.cpp              ← Arduino stub for PlatformIO builds
└── README.md                     ← this file
```
