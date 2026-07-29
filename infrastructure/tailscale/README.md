# Tailscale Operator (fabric interconnect)

Canonical guide: [`docs/TAILSCALE-FABRIC.md`](../../docs/TAILSCALE-FABRIC.md)

## Quick deploy

```bash
export TS_CLIENT_ID=…          # OAuth client, tag:k8s-operator
export TS_CLIENT_SECRET=…
export KUBECONFIG=~/.kube/config-cloudless-ts
bash infrastructure/tailscale/deploy.sh
```

Then merge `acl-policy.example.json` into Tailscale Access controls and delete
stale `tag:k8s` Machines from the Jul rebuild.

## Layout

| File | Purpose |
|------|---------|
| `connector.yaml` | `Connector` advertises `10.42/16` + `10.43/16` (HA replicas: 2) |
| `proxygroup.yaml` | Shared `ingress` ProxyGroup + `kube-apiserver` ProxyGroup |
| `ingresses.yaml` | Grafana / Loki / Meili with `tailscale.com/proxy-group: ingress` |
| `acl-policy.example.json` | tagOwners + autoApprovers |
| `deploy.sh` | Helm install (no AWS SSM) |
| `subnet-router.yaml` / `proxygroup-monitoring.yaml` | Deprecated stubs |

## Design rules (from Tailscale docs)

1. **Subnet routes → Connector**, never ProxyGroup.
2. **Many services → one ingress ProxyGroup** (annotate `proxy-group`).
3. **HA subnet routers** advertise identical CIDR strings.
4. **kubectl remotely → kube-apiserver ProxyGroup** (`tailscale configure kubeconfig`).
5. **No Funnel** for these GUIs — Cloudflare Access covers public admin HTTP.
