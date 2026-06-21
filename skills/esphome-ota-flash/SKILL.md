---
name: esphome-ota-flash
description: |
  Reflash an ESP32 over WiFi using the ESPHome OTA flow — no USB cable
  required. Triggered by phrases like "reflash ESP32", "update ESP32
  firmware", "OTA flash", "esphome run", "ESP32 over-the-air", "ESP32
  remote update", "push firmware to ESP32", or any time the operator
  would otherwise have to physically connect the ESP32 to USB.
---

# ESPHome OTA flash (no USB)

The cloudless.gr cluster has two ESP32 devices:

- **Cluster watchdog** — `infrastructure/esp32-watchdog/esphome/cloudless-watchdog.yaml`
- **Display alert LED** — `homelab_alert_led.ino` (Arduino-side, separate codebase)

Both can be reflashed over WiFi without any USB cable, using the standard
ESPHome OTA flow. Per [ESPHome OTA docs](https://esphome.io/components/ota/esphome/),
the OTA platform allows remotely installing modified/updated firmware
binaries onto ESPHome devices over their network interface (WiFi /
Ethernet / Thread).

## Prerequisites

1. ESPHome installed somewhere on the operator's LAN — either WSL on the
   laptop or a pod on the cluster. The cluster path is preferable for
   automation; the laptop path is faster for one-off changes.
2. The ESP32 reachable on its LAN IP (mDNS hostname like
   `cloudless-watchdog.local` also works for ESPHome ≥ 2022.7).
3. The `ota_password` secret in `secrets.yaml` matches what was baked
   into the device firmware (CLAUDE.md "Pending One-Time Setup" lists
   the secret manager).

## One-off flash from WSL (simplest path)

```bash
cd ~/code/cloudless.gr/infrastructure/esp32-watchdog/esphome

# Edit cloudless-watchdog.yaml (or use a separate substitutions block)
# to add new behavior — e.g. adding an mqtt: block per
# [[mqtt-auth-rollout]]:
#
#   mqtt:
#     broker: 192.168.1.128        # omv LAN IP
#     port: 31883                  # mosquitto NodePort
#     username: tbaltzakis
#     password: !secret mqtt_password
#     topic_prefix: homelab/watchdog

# Verify the YAML compiles before flashing:
esphome compile cloudless-watchdog.yaml

# OTA flash to the device by hostname (mDNS) or IP:
esphome run cloudless-watchdog.yaml --device cloudless-watchdog.local
# or
esphome run cloudless-watchdog.yaml --device 192.168.1.157

# `esphome run` auto-detects whether USB is connected and falls back to
# OTA over WiFi if not — same command works in both contexts.
```

ESPHome streams compile → upload → reboot → log-tail in one command. If
the device drops off the network during reboot, just re-run; ESPHome
discovers it again via mDNS.

## Repeatable flash from cluster (no operator hands)

For credentials rollouts where the operator wants to avoid touching the
laptop:

1. Run ESPHome inside a one-off Job on the cluster (omv-main has LAN
   access to every ESP32):

   ```yaml
   apiVersion: batch/v1
   kind: Job
   metadata:
     name: esphome-flash-watchdog
     namespace: monitoring
     annotations:
       kube-cleanup-operator.io/ignore: "true"   # don't auto-delete
   spec:
     template:
       spec:
         nodeSelector: { kubernetes.io/hostname: omv }
         restartPolicy: Never
         containers:
           - name: esphome
             image: ghcr.io/esphome/esphome:latest
             command: ["esphome"]
             args: ["run", "/cfg/cloudless-watchdog.yaml",
                    "--device", "cloudless-watchdog.local",
                    "--no-logs"]
             volumeMounts:
               - { name: cfg, mountPath: /cfg, readOnly: true }
         volumes:
           - name: cfg
             configMap: { name: watchdog-firmware-cfg }
   ```

2. Stage the YAML + secrets in a ConfigMap and Secret beforehand.
3. Watch `kubectl logs job/esphome-flash-watchdog -n monitoring`.

The first OTA flash from cluster needs the device on the same L2 (omv
sits on `192.168.1.0/24` along with the ESP32s — confirmed). For devices
on isolated VLANs, mDNS won't traverse; use a fixed IP instead.

## Initial-flash gotcha

OTA only works AFTER the device has been flashed at least once via USB
with the `ota:` block enabled. New ESP32s are always USB-first. The
firmware shipped to both cluster devices today has OTA enabled — confirmed
via `grep -A2 "ota:" infrastructure/esp32-watchdog/esphome/cloudless-watchdog.yaml`.

## Rollback path

ESPHome stores the previous firmware in the inactive partition. If a
flash bricks the device's connectivity (wrong WiFi creds, broken mqtt
block, etc.):

1. **Soft recovery**: power-cycle the device. The bootloader auto-rolls
   back if the new firmware never connects to WiFi within ~30s.
2. **Hard recovery**: USB-flash a known-good build.

Per [ESPHome 2026.5 changelog](https://esphome.io/changelog/2026.5.0/),
**signed OTA verification** is now available without hardware Secure
Boot — enable `ota.platform: esphome` + `ota_password` and the device
verifies the firmware signature before swapping partitions, making
remote bricking from a corrupt download essentially impossible.

## Sources

- [ESPHome OTA Updates](https://esphome.io/components/ota/esphome/)
- [ESPHome 2026.5.0 changelog (signed OTA verification)](https://esphome.io/changelog/2026.5.0/)
- [Over-the-Air Updates overview](https://esphome.io/components/ota/)

## See also

- [[mqtt-auth-rollout]] — when to use this skill (e.g. ESP32 needs new
  MQTT credentials).
- `infrastructure/esp32-watchdog/esphome/cloudless-watchdog.yaml` —
  current watchdog firmware source.
