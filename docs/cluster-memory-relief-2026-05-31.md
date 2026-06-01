# Cluster memory relief — 2026-05-31

## Why this exists

On 2026-05-31, omv (Pi 5, 8 GiB RAM) entered an iowait death-spiral:

| Metric | Value |
|---|---|
| Load avg (1/5/15m) | 12.99 / 18.23 / 16.58 |
| CPU iowait | 95-97% |
| Memory used | 6.1 GiB / 7.9 GiB (93%) |
| Swap used | 654 MiB (active kswapd) |
| Free | 271 MiB |
| Pods on omv | 33 |
| Pods on omv-ha | 5 |

Result: k3s API server intermittently returned 503 / "apiserver not ready",
kubectl commands timed out, and the cluster was effectively unmanageable.

## Root cause

Two compounding issues:

1. **Too many uncapped workloads on omv.** Several Deployments had no
   `resources.limits.memory`, letting Loki / Metabase / Keycloak grow until
   the kernel was forced to swap to the SD card — and SD card swap is so
   slow it pushes iowait to ~100%.

2. **Heavy single-replica apps that aren't actually used.**
   - Oncall stack (engine + celery + mariadb + redis) — 900 MiB combined.
     We already have Slack notifier + Grafana IRM for alerting.
   - Home Assistant — 314 MiB. 0 API calls in last 24h.

## Plan applied (in this PR)

All changes are in code under `k8s/cluster-protection/`:

| File | Effect |
|---|---|
| `memory-relief-2026-05-31.yaml` | LimitRange defaults for keycloak/analytics/n8n/ntfy/alert-manager; hard memory caps on metabase/keycloak/n8n/ntfy |
| `scale-down-unused.yaml` | Scale Home Assistant + oncall stack to 0 replicas |
| `prometheus-slim.yaml` | ServiceMonitorSelector restricted to `cluster-protection.io/health=true` label — drops all app-specific scraping |
| `apply-memory-relief.sh` | Single safe-order apply script with API-readiness check |

Plus Grafana dashboards:

| File | Purpose |
|---|---|
| `k8s/grafana-dashboards/cluster-overview.json` | Nodes ready, pods running, pod restarts, CPU/mem/disk/load/iowait per node |
| `k8s/grafana-dashboards/pod-health.json` | Pods pending/crashlooping, restart rate, OOM kills |
| `k8s/grafana-dashboards/per-node-detail.json` | CPU mode breakdown, memory breakdown, swap, disk I/O, network |
| `k8s/grafana-dashboards/apply.sh` | Deletes dashboards whose queries reference dropped metrics, imports the 3 new ones |

Plus ESP32 hardware reset:

| File | Change |
|---|---|
| `infrastructure/esp32-watchdog/esphome/cloudless-watchdog.yaml` | Added k3s API probe (port 6443 `/livez`), uncommented GPIO10 power relay, added `maybe_hard_reset` script that pulses the relay LOW for 5 s when k3s has been unreachable for ≥3 min (6 consecutive 30 s failures). 5 min lockout prevents reset-loops. |

## Expected memory reclaim on omv

| Workload | Before | After | Δ |
|---|---|---|---|
| Metabase | 927 MiB | ≤ 400 MiB | -527 MiB |
| Keycloak | 494 MiB | ≤ 768 MiB ceiling (~500 MiB actual) | 0 MiB |
| Home Assistant | 314 MiB | 0 (scaled to 0) | -314 MiB |
| Oncall (engine+celery+db+redis) | ~900 MiB | 0 (scaled to 0) | -900 MiB |
| **Total** | | | **≈ -1.75 GiB** |

That should drop omv from ~93% → ~70% memory, kill kswapd, drop iowait to
single digits, and bring k3s API back to fully responsive.

## Correction (2026-06-01): Keycloak OOM crash-loop

The 384 MiB cap took Keycloak — and therefore login, registration, and
password-reset — offline for ~8 hours (`auth.cloudless.gr` → `503 "no available
server"`) while the rest of the cluster stayed healthy.

Root cause, verified against the live cluster via `cluster-doctor` (issue #382):

- The keycloak pod was `OOMKilled` (exit 137), 79 restarts over ~8 h.
- Its heap is set by **`JAVA_OPTS_APPEND="-Xms192m -Xmx512m …"`**, **not**
  `JAVA_OPTS_KC_HEAP`. The memory-relief change capped the container at 384 MiB
  but never touched that 512 MiB heap, so the JVM could not fit → instant OOM.
- A first remediation that patched `JAVA_OPTS_KC_HEAP` (→ `-Xmx256m`, limit
  480 MiB) was a **no-op**: that variable is not what this deployment uses, and
  480 MiB still cannot hold a 512 MiB heap.

Real fix (this change): set the operative variable `JAVA_OPTS_APPEND` explicitly
and size the container to hold the 512 MiB heap plus ~200 MiB of JVM non-heap:
`requests 384 MiB`, `limits 768 MiB`, and raise the namespace `LimitRange` max
768 MiB → 1 GiB. The pod's actual RSS is ~500 MiB regardless of the ceiling and
the node has no memory pressure, so the higher limit does not increase real
usage — it only stops the kernel OOMKill. Net: Keycloak's footprint is unchanged
from before the incident; the lesson is **never cap a JVM container below its
`-Xmx` + non-heap working set.**

Apply with `pnpm keycloak:restore` (or, on omv-main with a live k3s API):

```bash
kubectl apply -f k8s/cluster-protection/memory-relief-2026-05-31.yaml
kubectl -n keycloak rollout restart deploy/keycloak
kubectl -n keycloak rollout status  deploy/keycloak --timeout=240s
# Verify: pnpm keycloak:smoke   (or curl the OIDC discovery endpoint)
```

## How to apply

**Prerequisite:** k3s API must be responding. If it isn't, the cluster is too
sick to admit changes — wait for it to recover (or hard-reset via the ESP32
once that's flashed), then run:

```bash
# 1. On omv-main:
cd /path/to/repo/k8s/cluster-protection
bash apply-memory-relief.sh

# 2. Once Prometheus has restarted with the slim config, refresh dashboards:
cd ../grafana-dashboards
bash apply.sh

# 3. Flash the updated ESP32 firmware (when at the bench):
cd ../../infrastructure/esp32-watchdog/esphome
esphome run cloudless-watchdog.yaml --device cloudless-watchdog.local
```

## ESP32 hardware reset wiring

The relay GPIO is `GPIO10` on the ESP32-S3-DevKitC-1.

```
ESP32 GPIO10  ─┬─[10 kΩ]─→ NPN base (2N2222 or similar)
               │
               └─── (optional debug LED)

Relay coil   ─→ NPN collector  (active-LOW: LOW = closed)
5 V          ─→ NPN emitter via flyback diode (1N4148 across coil)

Relay NC contact in series with Pi USB-C 5 V power line.
```

`inverted: true` on the GPIO platform means `pi_power_relay.turn_off()` sets
GPIO10 HIGH → NPN off → coil de-energizes → NC contact closes (Pi has power).
The 5-second pulse during reset goes LOW → coil energizes → contact opens →
Pi loses power → on release, NC closes again → Pi boots.

## Reverse / rollback

Each change is reversible:

```bash
# Bring Home Assistant back:
kubectl scale deploy/home-assistant -n home-assistant --replicas=1

# Bring oncall back:
kubectl scale deploy/oncall-engine deploy/oncall-celery deploy/oncall-redis -n oncall --replicas=1
kubectl scale statefulset/oncall-mariadb -n oncall --replicas=1

# Restore broad Prometheus scraping (re-label any ServiceMonitor):
kubectl label servicemonitor -n <ns> <name> cluster-protection.io/health=true --overwrite

# Disable hardware reset (ESP32):
# Edit cloudless-watchdog.yaml, set `relay_gpio: "none"`, re-flash.
```
