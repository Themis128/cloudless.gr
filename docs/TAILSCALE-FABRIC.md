# Tailscale Fabric Interconnect

## Overview

Tailscale operates as the **fabric interconnect** for the k3s cluster, providing secure mesh networking between nodes and enabling cross-node service access.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Tailscale Network                                    │
│  - MagicDNS: *.ts.cloudless.gr → Internal services                           │
│  - Mesh: omv (192.168.1.128) ↔ omv-ha (192.168.1.130)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         omv (Primary Node)                                   │
│  - Tailscale Funnel: Public endpoints                                       │
│  - Cloudflare Tunnel: cloudflared service                                   │
│  - k3s Control Plane + Worker                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         omv-ha (Standby Node)                                  │
│  - No workloads scheduled (taint: node-type=standby:NoSchedule)             │
│  - Tailscale node for cross-node access                                    │
│  - Rancher management                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Node Configuration

| Node | IP | Tailscale IP | Role | Labels |
|------|-----|-------------|------|--------|
| omv | 192.168.1.128 | 100.113.41.119 | Primary | node-type=primary, storage-type=ssd |
| omv-ha | 192.168.1.130 | - | Standby | - |

## Services Accessible via Tailscale

| Service | MagicDNS Endpoint | Node | Type |
|---------|-----------------|------|------|
| Grafana | grafana.ts.cloudless.gr | omv | Tailscale Ingress |
| Loki | loki.ts.cloudless.gr | omv | Tailscale Ingress |
| Meilisearch | meilisearch.ts.cloudless.gr | omv-ha | Tailscale Ingress |

## Tailscale Operator

### Deployment
```bash
kubectl apply -f infrastructure/tailscale/namespace.yaml
kubectl apply -f infrastructure/tailscale/ingress-class.yaml
kubectl apply -f infrastructure/tailscale/proxygroup-monitoring.yaml
kubectl apply -f infrastructure/tailscale/ingresses.yaml
```

### Configuration Files
- `infrastructure/tailscale/namespace.yaml` - Namespace and RBAC
- `infrastructure/tailscale/ingress-class.yaml` - IngressClass definition
- `infrastructure/tailscale/proxygroup-monitoring.yaml` - ProxyGroup for monitoring
- `infrastructure/tailscale/ingresses.yaml` - Tailscale ingress rules

## Tailscale Funnel

### Public Endpoints
- `grafana.ts.cloudless.gr` - Grafana monitoring
- `loki.ts.cloudless.gr` - Loki log aggregation

### Funnel Configuration
Funnel is configured via Ingress resources with the `tailscale` ingress class.

## Cross-Node Access

### From omv to omv-ha
Services on omv-ha (like Meilisearch) can be accessed from omv via Tailscale network.

### From omv-ha to omv
All services on omv are accessible via Tailscale.

## Troubleshooting

### Check Tailscale Status
```bash
# On omv
sudo systemctl status tailscaled
tailscale status
tailscale ping omv-ha
```

### Check Tailscale Operator
```bash
kubectl get pods -n tailscale-system
kubectl logs -n tailscale-system -l app=tailscale-operator
```

### Check Tailscale Ingress
```bash
kubectl get ingress -A
kubectl describe ingress <name> -n <namespace>
```

## Related Files

- `infrastructure/tailscale/README.md` - Original Tailscale documentation
- `infrastructure/tailscale/ingresses.yaml` - Tailscale ingress configuration
- `k8s/ingressroute-manage.yaml` - Traefik IngressRoute for manage.cloudless.gr
- `docs/CLOUDFLARE-ARCHITECTURE.md` - Cloudflare architecture documentation