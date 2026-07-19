# k3s Cluster Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         omv-ha (192.168.1.130)                              │
│                         Pi 5 • 4 CPU • RAM                                   │
│                         ARM64 • Debian 13 • k3s v1.35.5                    │
│                         [STANDBY - No pods scheduled]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  STATUS: Standby node (`node-type=standby:NoSchedule`)                         │
│  Note: Tailscale FTP/TFTP proxies removed - using OMV native services         │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         omv (192.168.1.128)                            │
│                         Pi 5 • 4 CPU • 8255888Ki RAM                       │
│                         ARM64 • Debian 13 • k3s v1.35.4 (control-plane)    │
│                         120GB SSD • Labeled: storage-type=ssd                │
├─────────────────────────────────────────────────────────────────────────────┤
│  CLOUDLESS (main app)                                                        │
│  ├─ cloudless-pi-origin                           -         -            │
│  ├─ cloudless-manager                             ● Running   omv           │
│  └─ sync-webhook                                  ● Running   omv           │
│     Note: Main app served via Cloudflare Worker, no k3s pods running         │
├─────────────────────────────────────────────────────────────────────────────┤
│  RANCHERER                                                                   │
│  ├─ rancher-5756d7477-4c8sw                     ● Running   omv           │
│  ├─ rancher-webhook-74b7bb7f8-6c28j               ● Running   omv           │
│  └─ system-upgrade-controller-54c465b8cb-kdvs9   ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  KUBE-SYSTEM                                                                 │
│  ├─ traefik-858d646468-4dntn                   ● Running   omv           │
│  ├─ coredns-6db6d4bf89-bgwnc                     ● Running   omv           │
│  ├─ metrics-server-678bbcf6b7-8nwws              ● Running   omv           │
│  ├─ local-path-provisioner-7bf8c67cd9-7wqjz      ● Running   omv           │
│  └─ svclb-traefik-239feff3-wnkbl                ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  CERT-MANAGER                                                               │
│  ├─ cert-manager-cb6698f64-8mp4x                 ● Running   omv           │
│  ├─ cert-manager-cainjector-7d9dd746d7-dsdbc                          ● Running   omv           │
│  └─ cert-manager-webhook-9956fc797-mkpk8         ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  KUBE-CLEANUP-OPERATOR                                                    │
│  └─ kube-cleanup-operator-788cb5d968-jlcqc   ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  FLEET (cattle-fleet-*)                                                    │
│  ├─ fleet-controller-ccb9f59d-72mwb             ● Running   omv           │
│  ├─ gitjob-5c7c654564-zrg28                      ● Running   omv           │
│  ├─ fleet-agent-569cb6b598-gwhdv              ● Running   omv           │
│  ├─ helmops-775ffb756c-gpssb                     ● Running   omv           │
│  └─ capi-controller-manager-7654f98879-qf6zk    ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAILSCALE SYSTEM                                                           │
│  ├─ operator-7887cb5b7f-v4mfn                    ● Running   omv           │
│  ├─ monitoring-proxies-0                         ● Running   omv           │
│  │   └─ Tailscale IP: 100.125.175.60              (Monitoring ingress)   │
│  └─ ts-n8n-vg4zh-0                            ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ANALYTICS                                                                  │
│  └─ metabase-67cb8fd54                           ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  MONITORING STACK (DEPLOYED)                                                │
│  ├─ prometheus-kube-prom-kube-prometheus-prometheus-0         ● Running   omv        │
│  ├─ alertmanager-kube-prom-kube-prometheus-alertmanager-0     ● Running   omv        │
│  ├─ kube-prom-grafana-5956c787b-bssd5                           ● Running   omv        │
│  ├─ kube-prom-kube-state-metrics-fbf9fb7b6-589zk                ● Running   omv        │
│  ├─ kube-prom-prometheus-node-exporter-4ks5z                     ● Running   omv        │
│  ├─ kube-prom-prometheus-node-exporter-jjsng                      ● Running   omv-ha     │
│  └─ kube-prom-kube-prometheus-operator-76d64cb674-wwn5n          ● Running   omv        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Exposed Ports (Browser Access)

| Hostname / Path | Service | Port | Access Method |
|-----------------|---------|------|---------------|
| `cloudless.gr` | cloudless Worker | 80 | Cloudflare Worker (Edge) |
| `manage.cloudless.gr` | cloudless Worker | 80 | Cloudflare Worker |
| `*.cloudless.gr` | cloudless Worker | 80 | Cloudflare Worker |
| `n8n.cloudless.gr` | n8n | 80, 443 | Traefik LB |
| `grafana.cloudless.gr` | Grafana | 80 | Traefik IngressRoute |
| `grafana.ts.cloudless.gr` | Grafana | 80 | Tailscale Ingress |
| `loki.ts.cloudless.gr` | Loki | 80 | Tailscale Ingress |
| `192.168.1.128:18080` | Traefik Dashboard | - | Direct (LAN) |
| `192.168.1.128:18443` | Traefik HTTPS | - | Direct (LAN) |
| `192.168.1.128:30850` | Grafana | 80 | NodePort |

### Monitoring Endpoints

- **Prometheus:** Port 9090 (ClusterIP - accessible via Traefik)
- **Grafana:** `grafana.cloudless.gr` (Traefik) or `192.168.1.128:30850` (NodePort)
- **Alertmanager:** Port 9093 (ClusterIP)

## Scheduling Policies

### Node Labels

- `omv`: `node-type=primary`, `storage-type=ssd`
- `omv-ha`: No special labels

### Node Taints

- `omv-ha`: `node-type=standby:NoSchedule`

### Workload Scheduling

- Traefik deployment: Uses `nodeSelector: kubernetes.io/hostname=omv`
- All monitoring workloads: Pinned to `omv` node (avoiding omv-ha taint)

## Monitoring Stack Status

| Namespace | Workload | Status | Notes |
|-----------|----------|--------|-------|
| monitoring | prometheus | 2/2 ready | Running on omv |
| monitoring | alertmanager | 2/2 ready | Running on omv |
| monitoring | kube-prom-grafana | 2/2 ready | Running on omv |
| monitoring | kube-prom-kube-state-metrics | 1/1 ready | Running on omv |
| monitoring | kube-prom-operator | 1/1 ready | Running on omv |
| monitoring | kube-prom-node-exporter | 2/2 ready | Running on both nodes |

## Summary

| Metric | Value |
|--------|-------|
| **Nodes** | 2 (omv, omv-ha) |
| **Running Pods** | 28 (in monitoring, appflowy, espocrm, n8n, analytics, database namespaces) |
| **Helm Releases** | kube-prom (monitoring: deployed) |

## Changes Made

1. **Node IP updates:** omv changed from 192.168.1.28 to 192.168.1.128
2. **Monitoring stack deployed:** kube-prometheus-stack installed with nodeSelector pinned to omv
3. **Created:** `infrastructure/monitoring/namespace.yaml` - monitoring namespace
4. **Created:** `.github/workflows/deploy-monitoring-stack.yml` - automated deployment workflow
5. **Created:** `infrastructure/monitoring/kube-prom-stack-values-minimal.yaml` - minimal values for Pi ARM64

## Deploy Monitoring Stack

```bash
# From Pi runner (omv)
helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values infrastructure/monitoring/kube-prom-stack-values-minimal.yaml \
  --create-namespace \
  --timeout 15m

# Deploy blackbox exporter
kubectl apply -f infrastructure/monitoring/blackbox-exporter.yaml
```

**Generated:** `kubectl get pods -A -o wide` + `helm list -A`