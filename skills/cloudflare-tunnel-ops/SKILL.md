---
name: cloudflare-tunnel-ops
description: |
  Add, remove, or audit Cloudflare tunnel ingress routes + DNS records for
  cloudless.gr's single shared tunnel (UUID e977a490-58c5-4fdb-9155-86832e3e636a).
  Triggered by phrases like "expose <subdomain>.cloudless.gr", "add a
  cloudflare tunnel route", "rotate the cloudflare token", "DNS record for
  <name>.cloudless.gr", "cloudflared not picking up new ingress", "tunnel
  showing 502", "remove a tunnel route", "check what's behind <subdomain>",
  "list cloudflare tunnel routes", "Cloudflare API 401".
---

# Cloudflare tunnel operator toolkit

cloudless.gr exposes every internal service (Postiz, EspoCRM, AppFlowy,
Logs, the main site, Grafana, Manage) through **one shared cloudflared
tunnel**. There is no per-service tunnel — adding a new public
hostname is "append-and-reload, never re-architect".

## CRITICAL: cloudflared runs on BOTH Pis (HA pattern)

There are **two** cloudflared daemons connected to the same tunnel UUID
— one on omv, one on omv-ha. Cloudflare's edge round-robins requests
between them. Both nodes MUST hold an identical `/etc/cloudflared/config.yml`
or you get ~50% 404s on any hostname missing from one node's config (the
2026-06-21 incident that drove this skill rewrite — espocrm + appflowy
were added to omv's config but not omv-ha's, so Sofia PoP requests
returned 404 about half the time while my US-based web-fetch tool
saw 200).

**Rule:** any edit to `/etc/cloudflared/config.yml` on omv MUST be
mirrored to omv-ha and BOTH services restarted. The "Add a new public
route" runbook below now does this automatically. There is also a
6-hourly drift watchdog CronJob at `monitoring/cloudflared-config-drift.yaml`
that Slack-alerts if the hostname counts diverge.

## Identity facts (memorise these)

| Field | Value |
| --- | --- |
| Tunnel UUID | `e977a490-58c5-4fdb-9155-86832e3e636a` |
| CNAME target | `<UUID>.cfargotunnel.com` |
| Zone | `cloudless.gr` |
| Zone ID | `7025298073d6a5c645a6ad9add0cbf0e` |
| Account ID (base64-decode in cluster) | `cloudless-cloudflare` secret |
| API token | k8s secret `cloudless/cloudless-cloudflare` key `CLOUDFLARE_API_TOKEN` (verified active 2026-06-21) |
| cloudflared config | `/etc/cloudflared/config.yml` on omv |
| cloudflared service | `systemctl status cloudflared` on omv |

The Cloudflare token in CLAUDE.md is listed as `NEEDS ROTATION` for the
**cloud-session secret half**. The **cluster Secret half is active** —
that's what these runbooks use.

## When to use this skill vs the cloudless-infra MCP

- **This skill** when the `cloudless-infra` MCP is unavailable (no
  `OMV_SSH_KEY_CONTENTS`) AND you have `Kubernetes_MCP_Server` access.
  The pattern: privileged pod with `nsenter --target 1` to reach the host
  filesystem + systemd, and a separate pod for Cloudflare API calls.
- **`mcp__cloudless-infra__cloudflare_*` tools** if/when the cloud-session
  Cloudflare token is rotated and those return 200 again. They're faster
  and don't require pod cleanup.

## Tool selection — pick the most specific that fits

1. **Public DNS query?** No cluster access needed:

   ```bash
   dig +short <name>.cloudless.gr @1.1.1.1
   ```

   Empty result = either no record, or proxied (Cloudflare returns
   Cloudflare IPs for proxied records, not the origin).

2. **Check whether cloudflared has a route?** Privileged pod + nsenter:

   ```yaml
   # nodeSelector: omv; hostPID + hostNetwork; alpine + util-linux.
   nsenter --target 1 --mount --uts --ipc --net --pid -- \
     grep -c <hostname> /etc/cloudflared/config.yml
   ```

   Returns 0 = not present; 1+ = appended.

3. **Add a DNS record?** Use the Cloudflare API from a one-off pod in the
   `cloudless` namespace (the secret lives there):

   ```yaml
   # See full manifest below in "Add a new public route"
   env:
     - name: CLOUDFLARE_API_TOKEN
       valueFrom: { secretKeyRef: { name: cloudless-cloudflare, key: CLOUDFLARE_API_TOKEN } }
   ```

4. **Append ingress + restart cloudflared?** Privileged pod + nsenter + a
   small Python script that mutates the YAML (do NOT use `yq` from
   alpine — package is older than the actual yq binary and silently
   reorders maps). See "Add a new public route" below.

## Add a new public route (end-to-end)

For service `<svc>` listening on NodePort `30NNN` on omv at LAN IP
`192.168.1.128`, exposed as `<sub>.cloudless.gr`:

### Step 1 — append cloudflared ingress on **BOTH** nodes

You must run this twice — once for each node in the `nodeSelector` —
or write a single pod that fans out via SSH. The cleanest pattern is
two pods with `kubernetes.io/hostname: omv` and `omv-ha`, or use the
ConfigMap-fan-out pattern below (see "Sync omv-ha to match omv").

```yaml
---
apiVersion: v1
kind: Pod
metadata: { name: cf-ingress-add, namespace: monitoring }
spec:
  nodeSelector: { kubernetes.io/hostname: omv }
  hostPID: true
  hostNetwork: true
  restartPolicy: Never
  containers:
    - name: edit
      image: alpine:3
      securityContext: { privileged: true }
      command:
        - sh
        - -c
        - |
          apk add --no-cache util-linux >/dev/null 2>&1
          nsenter --target 1 --mount --uts --ipc --net --pid -- sh -c '
            set -e
            CFG=/etc/cloudflared/config.yml
            HOST=<sub>.cloudless.gr
            PORT=30NNN
            if grep -q "$HOST" "$CFG"; then echo ALREADY_PRESENT; exit 0; fi
            cp "$CFG" "$CFG.bak.$(date +%s)"
            python3 - "$CFG" "$HOST" "$PORT" <<EOF
          import sys, yaml
          p, host, port = sys.argv[1], sys.argv[2], sys.argv[3]
          with open(p) as f: cfg = yaml.safe_load(f)
          ing = cfg.get("ingress", [])
          rule = {
            "hostname": host,
            "service":  f"http://192.168.1.128:{port}",
            "originRequest": {
              "connectTimeout": "15s",
              "tcpKeepAlive":   "30s",
              "noTLSVerify":    False,
              "httpHostHeader": host,
            },
          }
          idx = len(ing) - 1
          for i, r in enumerate(ing):
            if "http_status" in str(r.get("service", "")):
              idx = i; break
          ing.insert(idx, rule)
          cfg["ingress"] = ing
          with open(p, "w") as f: yaml.safe_dump(cfg, f, sort_keys=False)
          print("INSERTED at idx", idx, "; total rules:", len(ing))
          EOF
            systemctl restart cloudflared
            sleep 3
            systemctl is-active cloudflared
          '
          sleep 3
```

**CRITICAL**: `systemctl restart`, **not** `reload` / `SIGHUP`. cloudflared
SIGHUP is known to silently skip new ingress rules; only restart picks
them up.

### Step 2 — create the DNS CNAME (in-cluster)

```yaml
---
apiVersion: v1
kind: Pod
metadata: { name: cf-dns-add, namespace: cloudless }   # MUST be cloudless ns
spec:
  restartPolicy: Never
  containers:
    - name: cf
      image: alpine:3
      env:
        - name: CLOUDFLARE_API_TOKEN
          valueFrom: { secretKeyRef: { name: cloudless-cloudflare, key: CLOUDFLARE_API_TOKEN } }
      command:
        - sh
        - -c
        - |
          apk add --no-cache curl jq >/dev/null 2>&1
          ZONE=7025298073d6a5c645a6ad9add0cbf0e
          SUB=<sub>   # e.g. "appflowy" → appflowy.cloudless.gr
          # Idempotent check
          EXISTING=$(curl -fsS "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?name=$SUB.cloudless.gr" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r ".result | length")
          if [ "$EXISTING" != "0" ]; then echo "Already exists; skipping"; exit 0; fi
          curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"CNAME\",\"name\":\"$SUB\",\"content\":\"e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com\",\"proxied\":true,\"ttl\":1,\"comment\":\"<service> via cloudflare tunnel\"}" \
            | jq -c '{success, errors, id: .result.id, name: .result.name, proxied: .result.proxied}'
          sleep 3
```

**Namespace matters.** Secret refs are namespace-local in k8s; the
`cloudless-cloudflare` secret only lives in `cloudless`. A pod in
`monitoring` referencing it will sit in `CreateContainerConfigError`.

### Step 3 — verify reachability

```bash
sleep 20  # DNS propagation
curl -sI https://<sub>.cloudless.gr/<healthcheck>
```

DNS-via-Cloudflare is near-instant (proxied records always resolve to
Cloudflare IPs immediately); the 20s buffer is for cloudflared to register
the new origin route. If you still get 502/530 after that, see "Troubleshooting"
below.

## Sync omv-ha to match omv (the canonical pattern)

When you've edited omv's config and need to mirror it to omv-ha, use a
ConfigMap-staged sync pod. Reads omv-ha's current `/etc/cloudflared/config.yml`
via hostPath, writes the canonical content (also passed in via ConfigMap),
and `systemctl restart cloudflared`. Tunnel credentials file
(`/etc/cloudflared/<UUID>.json`) is checked first — both nodes must
already have the same one (it's tunnel-scoped, not node-scoped).

The Phase-1 sync executed during the 2026-06-21 incident is the canonical
template:

```yaml
---
apiVersion: v1
kind: ConfigMap
metadata: { name: cf-canonical-config, namespace: monitoring }
data:
  config.yml: |
    tunnel: e977a490-58c5-4fdb-9155-86832e3e636a
    credentials-file: /etc/cloudflared/e977a490-58c5-4fdb-9155-86832e3e636a.json
    no-autoupdate: true
    ingress:
    - hostname: cloudless.gr
      service: https://localhost:18443
      originRequest: { noTLSVerify: true, connectTimeout: 30s }
    # ... rest of the canonical ingress here ...
    - service: http_status:404
---
apiVersion: v1
kind: Pod
metadata: { name: cf-sync-ha, namespace: monitoring }
spec:
  nodeSelector: { kubernetes.io/hostname: omv-ha }
  hostPID: true
  hostNetwork: true
  restartPolicy: Never
  volumes:
    - { name: cfg, configMap: { name: cf-canonical-config } }
    - { name: hostcreds, hostPath: { path: /etc/cloudflared } }
  containers:
    - name: sync
      image: alpine:3
      securityContext: { privileged: true }
      volumeMounts:
        - { name: cfg, mountPath: /staging }
        - { name: hostcreds, mountPath: /host-creds }
      command:
        - sh
        - -c
        - |
          apk add --no-cache util-linux >/dev/null 2>&1
          [ -f /host-creds/e977a490-58c5-4fdb-9155-86832e3e636a.json ] || { echo "missing tunnel creds"; exit 1; }
          cp /host-creds/config.yml /host-creds/config.yml.bak.sync-$(date +%s)
          cp /staging/config.yml /host-creds/config.yml
          nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl restart cloudflared
          sleep 5
          nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl is-active cloudflared
```

After restart, verify with 5 round-trip curls (Cloudflare round-robins
between connectors, so a single 200 isn't conclusive):

```bash
for i in 1 2 3 4 5; do
  curl -4 -sI -o /dev/null -w '%{http_code}\n' https://<host>/<healthcheck>
done
# expect: 200 five times in a row, no 404s mixed in
```

## Remove a public route

Reverse of above. Step 1 = `python3` script does `ing = [r for r in ing if
r.get("hostname") != host]`; Step 2 = `curl -X DELETE
https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/$RECORD_ID`.

## Audit current routes (read-only)

In one privileged-pod call:

```bash
nsenter --target 1 --mount --uts --ipc --net --pid -- \
  grep -A1 'hostname:' /etc/cloudflared/config.yml
```

Known state at time of writing (2026-06-21):

- `cloudless.gr` → localhost:18443 (main site)
- `manage.cloudless.gr` → localhost:18443
- `pi-origin.cloudless.gr` → localhost:18443
- `grafana.cloudless.gr` → localhost:18443
- `postiz.cloudless.gr` → 192.168.1.128:30500
- `espocrm.cloudless.gr` → 192.168.1.128:30700
- `appflowy.cloudless.gr` → 192.168.1.128:30810

## Rotate the Cloudflare API token

The active token lives at:

- k8s: `kubectl -n cloudless get secret cloudless-cloudflare -o yaml`
- GitHub Actions secret: `CLOUDFLARE_API_TOKEN` (CI source of truth)

To rotate:

1. Cloudflare dashboard → My Profile → API Tokens → mint new token with the
   scope set from `skills/cloudflare-token-doctor/SKILL.md` Stage 1.
2. `kubectl -n cloudless edit secret cloudless-cloudflare` and replace the
   base64-encoded `CLOUDFLARE_API_TOKEN` value.
3. Mirror to CI via GitHub Secret (do **not** use `aws ssm put-parameter`):
   `gh workflow run store-cloudflare-token.yml -f cloudflare_token=<token> -f apply=false`
   (requires repo secret `GH_PAT`), or locally:
   `echo -n '<token>' | gh secret set CLOUDFLARE_API_TOKEN --repo Themis128/cloudless.gr --body -`
4. Delete the old token in the Cloudflare dashboard.
5. Verify via the cf-dns-add pod template above (token verify step at the
   top — `https://api.cloudflare.com/client/v4/user/tokens/verify`).

## Troubleshooting

| Symptom | First check |
| --- | --- |
| `dig` returns nothing | DNS not created. Run Step 2 of "Add a new public route". |
| `dig` returns Cloudflare IPs but cURL returns 530 | cloudflared can't reach origin. Run Step 3 health check from inside the cluster: `kubectl -n <ns> exec <pod> -- curl http://<svc>` to confirm the NodePort actually works. |
| `dig` returns Cloudflare IPs but cURL returns 502 | cloudflared has stale ingress. Run privileged pod from Step 1 with just the `systemctl restart cloudflared && grep -c <host> $CFG` block. |
| Cloudflare API returns `code 9106 / authorization` | Token doesn't have permission for the action. The cluster token has Zone:DNS:Edit + Account:Cloudflare Tunnel:Edit; if you're hitting a different endpoint you'll need to widen the scope. |
| Cloudflare API returns 401 globally | Token revoked or wrong. Don't retry; rotate (above). |
| `CreateContainerConfigError` on the cf-dns pod | Pod is in the wrong namespace. Move to `cloudless`. |
| cloudflared logs `connection refused: 192.168.1.128:30NNN` | NodePort isn't actually listening on omv. Check `kubectl get svc -n <ns>` — the `Service` type must be NodePort with the matching `nodePort` field. |

## Why one tunnel, not many

Each cloudflared instance holds ~80 MiB RAM + 4 outbound HTTPS connections
to Cloudflare's edge. Multiplying that per subdomain is wasteful on a
4-core Pi 5; the shared-tunnel pattern matches Cloudflare's recommended
"one tunnel, many origins" architecture (see Cloudflare docs:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/).

## See also

- `skills/cloudflare-token-doctor/SKILL.md` — minting tokens with the right scope
- `skills/cluster-bash/SKILL.md` — two-Pi command runner
- `skills/appflowy-operator/SKILL.md` — sibling skill (AppFlowy uses tunnel)
- `skills/espocrm-operator/SKILL.md` — sibling skill (EspoCRM uses tunnel)
- `infrastructure/cloudflare-tunnels/` — canonical config layout
- `infrastructure/appflowy/cloudflare-tunnel.yaml` — example fragment
- `infrastructure/espocrm/cloudflare-tunnel.yaml` — example fragment
