# kubectl via Tailscale / office LAN

Use the office LAN or Tailscale mesh so WSL can run `kubectl` against the Pi
k3s API **without** SSH ProxyJump for every apply.

## Current status (office WSL)

| Piece | State |
|-------|--------|
| WSL device `office` | Connected (`100.98.121.44`) |
| `github-omv` | Connected (`100.74.191.58`) |
| `kubectl get nodes` | Works via **LAN** `https://192.168.1.128:6443` |
| Userspace Tailscale TCP to `100.x:6443` | Unreliable (ping works; SOCKS TCP often fails) |

**At home/office:** prefer the LAN kubeconfig (cert SAN already includes `192.168.1.128`).

**Away from LAN:** install system Tailscale with a real TUN (or Windows Tailscale + mirrored networking), **and** add the Tailscale IP / MagicDNS name to k3s `tls-san` (cert today has LAN + ClusterIP only — **not** `100.74.191.58`).

## One-time setup

```bash
bash scripts/ts-wsl.sh status          # starts userspace daemon + SOCKS :1055
bash scripts/ts-wsl.sh login           # if not already approved in admin console
bash scripts/setup-kubectl-tailscale.sh
```

Persist:

```bash
export PATH="$HOME/bin:$PATH"
export KUBECONFIG=~/.kube/config-cloudless-ts
export TS_SOCKET=~/.local/tailscale/tailscaled.sock
```

## Daily use

```bash
kubectl get nodes
kubectl get pods -n monitoring
```

## Endpoints

| Role | LAN | Tailscale | MagicDNS |
|------|-----|-----------|----------|
| omv (API) | **192.168.1.128** | 100.74.191.58 | `github-omv.tail4ecae1.ts.net` |
| omv-ha | 192.168.1.130 | 100.95.117.84 | `omv-ha.…` |

## Tailscale admin: what the 27 machines mean

**Keep (live):**

| Machine | Role |
|---------|------|
| `office` | This WSL laptop |
| `github-omv` | Pi 5 control-plane + API |
| `omv-ha` | Pi 3 worker (ephemeral OK) |

**Optional / often offline:**

| Machine | Notes |
|---------|--------|
| `k3s-subnet-router`, `k3s-subnet-router-1` | Advertise pod/service CIDRs — only needed to hit ClusterIPs from laptop |
| `tailscale-operator-1` | Operator on ha path — offline until operator redeployed |
| `cloudless-k3s-operator` | Old WSL operator client — can remove if unused |

**Stale `tag:k8s` devices (safe to delete in admin):**  
`appflowy`, `cloudless-app`, `cloudless-manager`, `grafana`, `meilisearch`, `n8n`, `postgres`, `redis`, `sync-webhook`, `monitoring-proxies-0..9`, `monitoring-proxy-0` — last seen ~Jul 11; leftovers from a previous operator ProxyGroup. Deleting them cleans the UI; they are not required for kubectl.

## Off-LAN (preferred): kube-apiserver ProxyGroup

After `infrastructure/tailscale/deploy.sh`:

```bash
URL=$(kubectl get proxygroup kube -o jsonpath='{.status.url}')
tailscale configure kubeconfig "$URL"
```

See `docs/TAILSCALE-FABRIC.md`. Alternative: add Tailscale SANs via
`scripts/configure-k3s.sh` (`TLS_SAN_TS`, `TLS_SAN_MAGICDNS`) and dial
`https://100.74.191.58:6443` on a client with a real TUN + `--accept-routes`.

## Fallback (SSH)

```bash
ssh -J tbaltzakis@192.168.1.130 tbaltzakis@192.168.1.128 \
  'KUBECONFIG=~/.kube/config kubectl get nodes'
```

## Notes

- Do **not** commit `~/.kube/config-cloudless-ts`.
- Subnet routes (`10.42.0.0/16`, `10.43.0.0/16`) are optional — only for direct ClusterIP access from the laptop.
