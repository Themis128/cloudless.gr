# Tailscale Fabric Interconnect

Private mesh for the Pi k3s cluster. **Not** a public Funnel edge — public
traffic stays on Cloudflare Workers / Access / tunnels. Tailscale is for
admin fabric: nodes, ClusterIP/pod CIDRs, private GUIs, and kubectl.

Aligned with current Tailscale Kubernetes Operator docs (validated mid-2026):

- [Connector / subnet router](https://tailscale.com/docs/kubernetes-operator/connector/deploy-subnet-router)
- [ProxyGroup](https://tailscale.com/docs/kubernetes-operator/concepts/proxygroup)
- [API server over Tailscale](https://tailscale.com/docs/kubernetes-operator/api-server-access/setup-api-over-tailscale)
- [ProxyClass](https://tailscale.com/docs/kubernetes-operator/concepts/proxyclass)
- [HA overlapping routes](https://tailscale.com/docs/how-to/set-up-high-availability)
- CRD reference: [k8s-operator/api.md](https://github.com/tailscale/tailscale/blob/main/k8s-operator/api.md)

## Target architecture

```
 office (WSL) ──tailnet── github-omv (host TS) ── :6443 / SSH / NodePorts
       │                      │
       │                      ├── Connector k3s-cidrs×2  → 10.42/16 + 10.43/16
       │                      ├── ProxyGroup ingress×1   → grafana/loki/meili Serve
       │                      └── ProxyGroup kube×1      → kubectl (auth impersonation)
       └── omv-ha (host TS)
```

| Layer | Resource | Purpose | Devices on Machines |
|-------|----------|---------|---------------------|
| Host mesh | `tailscaled` on omv + omv-ha | SSH, NodePort, direct `:6443` | `github-omv`, `omv-ha` |
| Subnet | `Connector` `k3s-cidrs` | Pod + ClusterIP reachability | `k3s-subnet-router-0/1` |
| L7 GUI | `ProxyGroup` `ingress` + Ingress | MagicDNS HTTPS to apps | `ingress-0` (+ Tailscale Services) |
| API | `ProxyGroup` `kube` | `tailscale configure kubeconfig` | `kube-0` |

**Do not** create one Tailscale proxy per Service — that spawned
`monitoring-proxies-0..9` plus per-app devices. Always set
`tailscale.com/proxy-group: ingress`.

## What was wrong in the old repo manifests

| Old | Problem | Fix |
|-----|---------|-----|
| `ProxyGroup` + `routes:` | Invalid — ProxyGroup is `ingress`/`egress`/`kube-apiserver` only | `Connector.subnetRouter.advertiseRoutes` |
| Missing `spec.type` | Operator cannot reconcile | `type: ingress` / `kube-apiserver` |
| No `proxy-group` annotation | One device per Ingress | Shared ProxyGroup |
| Funnel / public `*.ts.cloudless.gr` | Wrong trust boundary | Private Serve + CF Access for public |
| AWS SSM in `deploy.sh` | Forbidden on free-tier policy | Env `TS_CLIENT_ID` / `TS_CLIENT_SECRET` |
| Operator absent on cluster | CRDs/pods gone after rebuild | Re-run `deploy.sh` |

## Deploy

1. Create an OAuth client (Devices Core + Auth Keys write) tagged **`tag:k8s-operator`**:
   https://login.tailscale.com/admin/settings/oauth

2. Merge `infrastructure/tailscale/acl-policy.example.json` into Access controls
   (`tagOwners` + `autoApprovers` for routes + `svc:*`). Workflows:
   `Tailscale admin API`, `Tailscale fix fabric ACL`.

3. **Enable HTTPS Certificates** (required for Serve / kube-apiserver):

   ```bash
   # PATCH /api/v2/tailnet/{tailnet}/settings  {"httpsEnabled":true}
   bash scripts/tailscale-enable-https.sh
   # Workflow: Tailscale enable HTTPS
   ```

4. **Approve Service hosts** (HA ProxyGroup VIPs stay dark until approved):

   ```bash
   bash scripts/tailscale-approve-service-hosts.sh
   # Workflow: Tailscale approve service hosts
   # Or: Services admin → each svc → approve ingress-0 / kube-0
   ```

   `autoApprovers.services["svc:*"]` alone may not auto-approve; the approval
   API returns `autoApproved:false` until hosts are explicitly approved.

5. For HA Ingress, set `tailscale.com/http-endpoint: enabled` so the operator
   advertises the VIP **before** Let's Encrypt fills the TLS Secret (otherwise
   CertDomains never includes the Service name and certs deadlock).

6. Install:

```bash
export TS_CLIENT_ID=…
export TS_CLIENT_SECRET=…
export KUBECONFIG=~/.kube/config-cloudless-ts   # LAN works at office
bash infrastructure/tailscale/deploy.sh
```

7. After HTTPS + host approval, force cert re-issue if Secrets are empty:

```bash
bash scripts/tailscale-refresh-tls-secrets.sh
```

8. Wait:

```bash
kubectl wait connector k3s-cidrs --for=condition=ConnectorReady=true --timeout=5m
kubectl wait proxygroup ingress --for=condition=ProxyGroupReady=true --timeout=5m
kubectl wait proxygroup kube --for=condition=ProxyGroupReady=true --timeout=5m
kubectl get ingress -A   # ADDRESS should populate
```

9. kubectl via API proxy (preferred off-LAN):

```bash
URL=$(kubectl get proxygroup kube -o jsonpath='{.status.url}')
tailscale configure kubeconfig "$URL"
kubectl get nodes
```

## k3s TLS SANs (direct `:6443` over Tailscale)

Cert today includes `192.168.1.128` but **not** `100.74.191.58`. For direct
API dialing (without the kube ProxyGroup), add SANs then restart k3s:

```yaml
# on omv /etc/rancher/k3s/config.yaml — or via scripts/configure-k3s.sh
tls-san:
  - "192.168.1.128"
  - "100.74.191.58"
  - "github-omv.tail4ecae1.ts.net"
```

```bash
sudo TLS_SAN_TS=100.74.191.58 TLS_SAN_MAGICDNS=github-omv.tail4ecae1.ts.net \
  ETCD_S3_ACCESS_KEY=… ETCD_S3_SECRET_KEY=… \
  ./scripts/configure-k3s.sh
sudo systemctl restart k3s
```

Clients accepting subnet routes:

```bash
sudo tailscale set --accept-routes   # Linux with TUN
```

WSL userspace still needs SOCKS/TUN for `100.x` TCP — prefer LAN or the
`kube` ProxyGroup URL over HTTPS Serve.

## Node reference

| Node | LAN | Tailscale | Role |
|------|-----|-----------|------|
| omv (`github-omv`) | 192.168.1.128 | 100.74.191.58 | control-plane |
| omv-ha | 192.168.1.130 | 100.95.117.84 | worker |
| office (WSL) | — | 100.98.121.44 | admin laptop |

## Files

| File | Role |
|------|------|
| `connector.yaml` | HA Connector + `pi-fabric` ProxyClass |
| `proxygroup.yaml` | ingress + kube-apiserver ProxyGroups |
| `ingresses.yaml` | Grafana / Loki / Meili → shared group |
| `acl-policy.example.json` | tagOwners / autoApprovers / grants |
| `deploy.sh` | Helm operator + apply manifests |
| `ingress-class.yaml` | `IngressClass` `tailscale` |

## Troubleshooting

```bash
kubectl get connector,proxygroup,proxyclass
kubectl get pods -n tailscale
kubectl logs -n tailscale -l app.kubernetes.io/name=operator
tailscale status
```

Offline / stale devices: delete in admin UI — see
`OFFLINE-DEVICE-TROUBLESHOOTING.md` (device IPs will differ after redeploy).

Related: `docs/kubectl-tailscale.md`, `docs/CLUSTER-MAP.md`.
