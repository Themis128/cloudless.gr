---
name: mqtt-auth-rollout
description: |
  No-downtime credential rollout for the cluster Mosquitto broker. Triggered
  by phrases like "add MQTT auth", "mosquitto auth", "secure MQTT broker",
  "rotate MQTT credentials", "stop allowing anonymous MQTT", "MQTT password
  file", "MQTT_USERNAME", "ESP32 MQTT credentials", or any change to
  `infrastructure/esp32-watchdog/k8s/mosquitto.yaml`.
---

# Mosquitto MQTT auth rollout (no-downtime pattern)

The cluster Mosquitto broker (`monitoring/mosquitto`) authenticates against
the `mosquitto-passwords` Secret as of 2026-06-21. This skill captures the
no-downtime rollout pattern so future credential changes don't require
synchronized client redeploys.

## Why dual-mode

Per the [mosquitto.conf man page §authentication](https://mosquitto.org/man/mosquitto-conf-5.html):

> If `allow_anonymous` is true and a `password_file` is set, clients that
> send a username/password must use a valid pair from the file, but clients
> that send no credentials are still accepted as anonymous.

This is what makes a rolling rollout possible — flip `password_file` on
first, redeploy clients one by one with credentials, then flip
`allow_anonymous false` once nothing anonymous remains.

## Current state (2026-06-21)

- ConfigMap `monitoring/mosquitto-config`: dual-mode (`allow_anonymous true`
  + `password_file /mosquitto/secret/passwords`).
- Secret `monitoring/mosquitto-passwords`: 1 user, `tbaltzakis`, password
  matches the unified admin password used across all self-hosted apps
  ([[project-unified-admin-creds]]).
- Secret `alert-manager/alert-api-mqtt-creds`: MQTT_USERNAME +
  MQTT_PASSWORD; mounted into the `alert-api` Deployment env (optional —
  the running `alert-api:v3.3` image ignores them; a future rebuild of the
  image will pick them up automatically via `mqtt_publish.py`).
- Display ESP32 (`homelab_alert_led.ino`): still anonymous. Needs OTA
  reflash with creds — see [[esphome-ota-flash]].

## Rollout phases

Always work top-down — never flip `allow_anonymous false` before every
client has creds, or the dependent client crashes silently (paho's
`publish.multiple` swallows the `MQTT_ERR_NOT_AUTHORIZED` and returns).

### Phase 1 — DONE — add credentials in parallel with anonymous

1. Generate password hash inside any mosquitto pod:
   ```bash
   kubectl -n monitoring exec deploy/mosquitto -- \
     mosquitto_passwd -b /tmp/pw <username> '<password>'
   kubectl -n monitoring exec deploy/mosquitto -- cat /tmp/pw
   ```
2. Apply the `mosquitto-passwords` Secret and ConfigMap update (this PR
   already did both, but for rotation: edit `stringData.passwords` in
   `infrastructure/esp32-watchdog/k8s/mosquitto.yaml` and `kubectl apply`).
3. Restart mosquitto so it reloads the password file:
   ```bash
   kubectl -n monitoring rollout restart deploy/mosquitto
   ```
4. Verify both auth and anonymous still work from inside the broker pod:
   ```bash
   kubectl -n monitoring exec deploy/mosquitto -- \
     mosquitto_pub -h localhost -u tbaltzakis -P '<password>' -t test -m ok
   kubectl -n monitoring exec deploy/mosquitto -- \
     mosquitto_pub -h localhost -t test -m anon
   ```

### Phase 2 — update clients to authenticate

**alert-api** (`alert-manager/alert-api`):

- Code: `infrastructure/pi-alert-api/mqtt_publish.py` reads
  `MQTT_USERNAME` and `MQTT_PASSWORD` from env, falls back to anonymous
  when either is unset (so the env can be set BEFORE the image is
  rebuilt).
- Deployment: env vars are wired via the `alert-api-mqtt-creds` Secret
  with `optional: true` so the spec applies cleanly even when the secret
  doesn't yet exist.
- Image rebuild needed for code change to take effect — operator runs the
  existing alert-api build on omv (`infrastructure/pi-alert-api/deploy.sh`
  or whatever the live process is).

**Display ESP32** (`homelab_alert_led.ino`):

- Add to the ESPHome / Arduino config:
  ```yaml
  mqtt:
    broker: <omv-host-or-LAN-ip>
    port: 31883     # NodePort
    username: tbaltzakis
    password: 'TH!123789th!'    # or !secret mqtt_password
  ```
- Reflash via OTA — see [[esphome-ota-flash]] for the no-USB path. The
  watchdog ESP32 firmware in `infrastructure/esp32-watchdog/esphome/`
  does NOT need this (it has no `mqtt:` block today — telemetry path was
  never wired up).

### Phase 3 — flip `allow_anonymous false`

Run **only** after Phase 2 is done and `kubectl -n monitoring logs
deploy/mosquitto | grep "anonymous"` shows no recent anonymous CONNECTs.

1. Edit `infrastructure/esp32-watchdog/k8s/mosquitto.yaml`:
   ```yaml
   data:
     mosquitto.conf: |
       listener 1883
       allow_anonymous false        # ← was: true
       password_file /mosquitto/secret/passwords
       ...
   ```
2. `kubectl apply -f infrastructure/esp32-watchdog/k8s/mosquitto.yaml`
3. `kubectl -n monitoring rollout restart deploy/mosquitto`
4. Watch logs — any client that wasn't updated will fail with
   `Bad username or password` or `Connection refused, not authorised`.
   Roll back by flipping `allow_anonymous true` if anything breaks.

## Rotation runbook

Same as Phase 1, just generate a new hash and `kubectl apply` the
updated Secret + restart the broker. Keep the unified admin password in
sync across all self-hosted apps per
[[project-unified-admin-creds]].

## Sources

- [Mosquitto authentication methods](https://mosquitto.org/documentation/authentication-methods/)
- [mosquitto.conf man page](https://mosquitto.org/man/mosquitto-conf-5.html)
- [Eclipse Mosquitto — Username/Password example (Steve's Internet Guide)](http://www.steves-internet-guide.com/mqtt-username-password-example/)

## See also

- [[esphome-ota-flash]] — companion skill for reflashing ESP32 over WiFi.
- `infrastructure/pi-alert-api/mqtt_publish.py` — the Python publisher that
  carries the env-driven auth.
- `infrastructure/esp32-watchdog/k8s/mosquitto.yaml` — broker
  source-of-truth manifest.
