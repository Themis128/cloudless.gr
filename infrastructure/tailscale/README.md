# Tailscale Operator Deployment for K3S Cluster

# Generated: 2026-07-06

## Overview

Tailscale operates as the **fabric interconnect** for the k3s cluster, providing:

- Secure mesh networking between omv-main (192.168.1.128) and omv-ha (192.168.1.130)
- MagicDNS endpoint resolution (`*.ts.cloudless.gr`)
- Cross-node service access (services on omv-ha accessible from omv-main's Cloudflare tunnel)

## Prerequisites

1. Tailscale OAuth Client ID and Secret (stored in AWS SSM or .env.local)
2. Kubernetes cluster access via kubeconfig
3. Namespace creation permissions

## Files in this directory

- `namespace.yaml` - Tailscale namespace and RBAC
- `subnet-router.yaml` - K3S subnet router for Tailscale fabric access
- `ingress-class.yaml` - Tailscale ingress class definition
- `ingresses.yaml` - Tailscale ingress rules for Grafana, Loki, Meilisearch
- `proxygroup-monitoring.yaml` - ProxyGroup for monitoring tools (Grafana, Loki)
- `deploy.sh` - Automated deployment script

## Services Accessible via Tailscale

| Service | MagicDNS Endpoint | Node |
|---------|-------------------|------|
| Grafana | grafana.ts.cloudless.gr | omv-main |
| Loki | loki.ts.cloudless.gr | omv-main |
| Meilisearch | meilisearch.ts.cloudless.gr | omv-ha |

## Deployment

```bash
# Deploy Tailscale operator
kubectl apply -f namespace.yaml
kubectl apply -f ingress-class.yaml
kubectl apply -f proxygroup-monitoring.yaml
kubectl apply -f ingresses.yaml

# Or use the automated script
./deploy.sh
