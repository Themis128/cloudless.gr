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
│                         omv (192.168.1.128)                               │
│                         Pi 5 • 4 CPU • 8255888Ki RAM                       │
│                         ARM64 • Debian 13 • k3s v1.35.4 (control-plane)    │
│                         120GB SSD • Labeled: storage-type=ssd                │
├─────────────────────────────────────────────────────────────────────────────┤
│  CLOUDLESS (main app)                                                         │
│  ├─ cloudless-app-cbcfd6594-69sjt              ● Running   omv           │
│  ├─ cloudless-app-cbcfd6594-9t9ql              ● Running   omv           │
│  ├─ cloudless-app-cbcfd6594-lxq5k              ● Running   omv           │
│  ├─ cloudless-app-cbcfd6594-m5rxn              ● Running   omv           │
│  ├─ cloudless-app-cbcfd6594-ndqtf              ● Running   omv           │
│  ├─ cloudless-manager-d54cdb486-g5t2g          ● Running   omv           │
│  └─ sync-webhook-7bdcf54b97-h4wnq             ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  RANCHERER                                                                    │
│  └─ rancher-5756d7477-htvf6                   ● Running   omv-ha        │
├─────────────────────────────────────────────────────────────────────────────┤
│  KUBE-SYSTEM                                                                 │
│  ├─ traefik-858d646468-4dntn                 ● Running   omv           │
│  ├─ coredns-6db6d4bf89-bgwnc                   ● Running   omv           │
│  ├─ metrics-server-678bbcf6b7-8nwws            ● Running   omv           │
│  ├─ local-path-provisioner-7bf8c67cd9-7wqjz    ● Running   omv           │
│  └─ svclb-traefik-239feff3-wnkbl              ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  CERT-MANAGER                                                               │
│  ├─ cert-manager-cb6698f64-8mp4x               ● Running   omv           │
│  ├─ cert-manager-cainjector-...dsdbc            ● Running   omv           │
│  └─ cert-manager-webhook-9956fc797-mkpk8       ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  KUBE-CLEANUP-OPERATOR                                                     │
│  └─ kube-cleanup-operator-788cb5d968-jlcqc   ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAILSCALE SYSTEM                                                            │
│  ├─ operator-7887cb5b7f-cnccc                  ● Running   omv           │
│  ├─ ts-n8n-vg4zh-0                            ● Running   omv           │
│  └─ ts-tftp-ingress-service-gtw6x-0             ● Running   omv           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Exposed Ports (Browser Access)

| Hostname / Path | Service | Port | Access Method |
|-----------------|---------|------|---------------|
| `cloudless.gr` | cloudless-app | 80 | Traefik LB (192.168.1.128) |
| `manage.cloudless.gr` | cloudless-app | 80 | Traefik LB |
| `*.cloudless.gr` | cloudless-app | 80 | Traefik LB |
| `n8n.cloudless.gr` | n8n | 80, 443 | Traefik LB |
| `grafana.cloudless.gr` | Grafana | 80 | Traefik IngressRoute (`infrastructure/monitoring/grafana-ingressroute.yaml`) |
| `grafana.ts.cloudless.gr` | Grafana | 80 | Tailscale Ingress (`infrastructure/tailscale/ingresses.yaml`) |
| `loki.ts.cloudless.gr` | Loki | 80 | Tailscale Ingress (`infrastructure/tailscale/ingresses.yaml`) |
| `192.168.1.128:18080` | Traefik Dashboard | - | Direct (LAN) |
| `192.168.1.128:18443` | Traefik HTTPS | - | Direct (LAN) |
| `192.168.1.128:30850` | Grafana | 80 | NodePort (when pods ready) |
| `192.168.1.128:31883` | Mosquitto (MQTT) | - | NodePort 1883 (when pods ready) |

### Monitoring Endpoints (NodePort/Tailscale - pending pods)
- **Prometheus:** Port 9090 (ClusterIP - accessible via Traefik when pods ready)
- **Grafana:** `grafana.cloudless.gr` (Traefik) or `192.168.1.128:30850` (NodePort)
- **Loki:** `loki.ts.cloudless.gr` (Tailscale Funnel) or port 3100 (ClusterIP)
- **Alertmanager:** Port 9093 (ClusterIP - accessible via Traefik when pods ready)

## Scheduling Policies

### Node Labels
- `omv`: `node-type=primary`, `storage-type=ssd`
- `omv-ha`: No special labels

### Node Taints
- `omv-ha`: `node-type=standby:NoSchedule`

### Workload Scheduling
- Traefik deployment: Uses `nodeSelector: kubernetes.io/hostname=omv`
- All DaemonSets: Have `nodeSelector` pointing to omv
- Monitoring stack: Expected to run on omv (via node selector)

## Monitoring Stack Status

| Namespace | Workload | Status | Notes |
|-----------|----------|--------|-------|
| monitoring | prometheus-monitoring-prometheus | 0/1 ready | StatefulSet - waiting for node selector |
| monitoring | alertmanager-monitoring-alertmanager | 0/1 ready | StatefulSet - waiting for node selector |
| monitoring | blackbox-exporter | 0/1 ready | Pending |
| monitoring | cloudless-cloudwatch-exporter | 0/1 ready | Pending |
| monitoring | kube-prom-grafana | 0/1 ready | Pending - NodePort 30850 |
| monitoring | kube-prom-kube-state-metrics | 0/1 ready | Pending |
| monitoring | cloudflare-geo-exporter | 0/1 ready | Pending |
| monitoring | mosquitto | 0/1 ready | Pending - NodePort 31883 |
| monitoring | prometheus-node-exporter (DS) | 0/1 ready | DaemonSet waiting |
| monitoring | promtail (DS) | 0/1 ready | DaemonSet waiting |

## Summary

| Metric | Value |
|--------|-------|
| **Nodes** | 2 (omv, omv-ha) |
| **Running Pods** | 19 (18 on omv, 1 on omv-ha) |
| **Pending Pods** | 10 (monitoring stack) |
| **Namespaces** | 7 active (cloudless, cattle-system, cert-manager, kube-cleanup-operator, kube-system, monitoring, tailscale-system) |
| **Helm Releases** | 7 (see below) |

## Helm Releases

| Name | Namespace | Status |
|------|-----------|--------|
| cert-manager | cert-manager | deployed |
| kube-prom | monitoring | deployed |
| loki | monitoring | deployed |
| promtail | monitoring | deployed |
| rancher | cattle-system | deployed |
| tailscale-operator | tailscale-system | deployed |
| traefik | kube-system | deployed |
| traefik-crd | kube-system | deployed |

## Changes Made

1. **Added Rancher:** Deployed Rancher management in `cattle-system` namespace on omv-ha
2. **Re-applied taint to omv-ha:** `node-type=standby:NoSchedule` (prevents regular workloads from scheduling)
3. **Monitoring stack:** All monitoring workloads currently pending (0/1 ready) - require node selector adjustment on omv
4. **Labeled omv as primary SSD:** `node-type=primary`, `storage-type=ssd`

**Generated:** `kubectl get pods -A -o wide` + `kubectl get svc -A` + `helm list -A`