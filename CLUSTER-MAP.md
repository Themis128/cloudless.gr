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
│  ├─ rancher-5756d7477-4c8sw                   ● Running   omv           │
│  ├─ rancher-webhook-74b7bb7f8-6c28j             ● Running   omv           │
│  └─ system-upgrade-controller-54c465b8cb-kdvs9   ● Running   omv           │
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
│  ├─ cert-manager-cainjector-7d9dd746d7-dsdbc  ● Running   omv           │
│  └─ cert-manager-webhook-9956fc797-mkpk8       ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  KUBE-CLEANUP-OPERATOR                                                     │
│  └─ kube-cleanup-operator-788cb5d968-jlcqc   ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  FLEET (cattle-fleet-*)                                                    │
│  ├─ fleet-controller-ccb9f59d-72mwb           ● Running   omv           │
│  ├─ gitjob-5c7c654564-zrg28                    ● Running   omv           │
│  ├─ fleet-agent-569cb6b598-gwhdv              ● Running   omv           │
│  ├─ helmops-775ffb756c-gpssb                   ● Running   omv           │
│  └─ capi-controller-manager-7654f98879-qf6zk    ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAILSCALE SYSTEM                                                          │
│  ├─ operator-7887cb5b7f-v4mfn                  ● Running   omv           │
│  ├─ monitoring-proxies-0                       ● Running   omv           │
│  │   └─ Tailscale IP: 100.125.175.60            (Grafana, Loki, Prometheus ingress) │
│  └─ ts-n8n-vg4zh-0                            ● Running   omv           │
├─────────────────────────────────────────────────────────────────────────────┤
│  METORO OTEL                                                                 │
│  ├─ metoro-exporter (2/2)                       ● Running   omv           │
│  ├─ metoro-exporter-sm-scraper (2/2)            ● Running   omv           │
│  ├─ metoro-exporter-sm-scraper-targetallocator (2/2)● Running   omv           │
│  ├─ metoro-redis-master                         ● Running   omv           │
│  └─ metoro-node-agent                           ● Error     omv-ha        │
│    Note: Node agent requires BTF (kernel 6.18.34) - eBPF not supported on Pi│
├─────────────────────────────────────────────────────────────────────────────┤
│  MONITORING STACK                                                          │
│  ├─ kube-prom-grafana                           ● Running   omv           │
│  ├─ loki                                        ● Running   omv           │
│  ├─ mosquitto                                    ● Running   omv           │
│  ├─ prometheus                                  ● Pending   (no node selector) │
│  ├─ alertmanager                                 ● Pending   (no node selector) │
│  ├─ cloudwatch-exporter                           ● Pending                   │
│  ├─ kube-state-metrics                            ● Pending                   │
│  └─ cloudflare-geo-exporter (4/4)                ● Terminating/Pending       │
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
| `192.168.1.128:30850` | Grafana | 80 | NodePort |
| `192.168.1.128:31883` | Mosquitto (MQTT) | - | NodePort 1883 |

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
| monitoring | blackbox-exporter | 1/1 ready | Running |
| monitoring | cloudflared-drift-count-omv-ha | 0/1 ready | Pending (scheduled for omv-ha) |
| monitoring | cloudless-cloudwatch-exporter | 0/1 ready | Pending |
| monitoring | kube-prom-grafana | 3/3 ready | Running - NodePort 30850 |
| monitoring | kube-prom-kube-state-metrics | 0/1 ready | Pending |
| monitoring | cloudflare-geo-exporter (4/4) | Mixed | Terminating/Pending - scaling issue |
| monitoring | prometheus-node-exporter (DS) | 1/1 ready | Running on omv |
| monitoring | promtail (DS) | 1/1 ready | Running on omv |

## Summary

| Metric | Value |
|--------|-------|
| **Nodes** | 2 (omv, omv-ha) |
| **Running Pods** | 40 (all on omv, except metoro-node-agent error) |
| **Pending Pods** | 6 (monitoring stack) |
| **Error Pods** | 2 (metoro-node-agent on omv-ha, helm-install-traefik-crd pending) |
| **Namespaces** | 24 total (12 with workloads, 12 Rancher/system namespaces) |
| **Helm Releases** | 12 (see below) |

## Helm Releases

| Name | Namespace | Status |
|------|-----------|--------|
| cert-manager | cert-manager | deployed |
| kube-prom | monitoring | deployed |
| loki | monitoring | deployed |
| metoro-exporter | metoro | deployed |
| promtail | monitoring | deployed |
| rancher | cattle-system | deployed |
| rancher-turtles | cattle-turtles-system | deployed |
| tailscale-operator | tailscale-system | failed |
| traefik | kube-system | deployed |
| traefik-crd | kube-system | deployed |
| fleet | cattle-fleet-system | deployed |
| fleet-crd | cattle-fleet-system | deployed |
| fleet-agent-local | cattle-fleet-local-system | deployed |
| system-upgrade-controller | cattle-system | deployed |

## Changes Made

1. **Node IP updates:** omv changed from 192.168.1.28 to 192.168.1.128
2. **Rancher migrated:** Moved from omv-ha to omv (now running on control-plane node)
3. **Monitoring stack:** Partial recovery - Grafana, Loki, Mosquitto now running; Prometheus/Alertmanager still pending
4. **Tailscale operator:** Helm release shows `failed` status (operator pod still running)
5. **Metoro node-agent:** CrashLoopBackOff on omv-ha (BTF/eBPF not supported on Pi kernel)
6. **Cloudflare geo-exporter:** Scaling issues with 4 pods in terminating/pending state
7. **Helm release count:** Increased to 12 with addition of fleet-related releases

## Fix Applied (pending verification)
 
 - **monitoring-node-selector-fix.yml:** Created standalone workflow to patch Prometheus, Alertmanager, kube-state-metrics, and cloudwatch-exporter StatefulSets/Deployments with `nodeSelector: kubernetes.io/hostname: omv` (omv-ha has `node-type=standby:NoSchedule` taint). Replaces failed gh-aw agent compile.
 - **kube-prom-stack-values.yaml:** Updated with nodeSelector and `global.nodeSelector` for Prometheus, Alertmanager, kube-state-metrics, and prometheusOperator to persist through future Helm upgrades
 
 **Generated:** `kubectl get pods -A -o wide` + `kubectl get svc -A` + `helm list -A`

## Tailscale Funnel Failover

omv-ha serves as a Tailscale Funnel gateway for HA failover:
- **Funnel endpoint:** `omv-ha.tail8eb71.ts.net` (HTTPS 443)
- **Proxies to:** omv's Traefik (192.168.1.128:80) when primary is down
- **Configuration:** See `infrastructure/omv-ha/tailscale-funnel-setup.md`
- **Current state:** Funnel not yet configured on omv-ha - needs manual setup

**Failover flow:**
1. Primary: Cloudflare Worker (`cloudless.gr`) - always serves if healthy
2. Worker failure: HA watchdog detects unhealthy `/api/health` on primary
3. DNS switch: Cloudflare DNS records point to `omv-ha.tail8eb71.ts.net`
4. Traffic: Requests → omv-ha Funnel → omv Traefik → cloudless app (if omv is up)
