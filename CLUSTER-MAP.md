# Cluster map

Live topology notes for the omv k3s cluster.

## Current topology (2026-08)

- **Single-node k3s:** `omv` (Pi 5) only — control-plane + workloads
- **Edge path:** `cloudless.gr` → Worker `cloudless2` (`workers/pi-origin-proxy`) → Tunnel `pi-origin.cloudless.gr` → `cloudless-app` NodePort `30300`
- **Mail host:** `omv-ha` (not in k3s) — webmail.cloudless.gr

## Canonical docs

| Topic | Doc |
|-------|-----|
| Pod atlas | [`docs/pods/`](docs/pods/) |
| Tailscale fabric | [`docs/cluster/TAILSCALE-FABRIC.md`](docs/cluster/TAILSCALE-FABRIC.md) |
| App pod | [`docs/pods/cloudless-app/README.md`](docs/pods/cloudless-app/README.md) |
| Project memory | [`CLAUDE.md`](CLAUDE.md) |

Refresh this map when topology changes; prefer linking pod READMEs over duplicating manifests here.
