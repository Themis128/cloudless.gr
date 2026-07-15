# cloudless.gr k3s storage skill

Use this skill for Kubernetes, k3s, PVC, OMV, backup, and self-hosted app changes.

## Hard rule

All k3s persistent workloads must use the dedicated 120GB SSD on the OMV-MAIN node.

## Storage guidance

When suggesting Kubernetes manifests:

- identify PVCs
- identify storage class
- identify node affinity if relevant
- do not place persistent workloads on random SD-card-backed storage
- include backup implications

## Self-hosted app awareness

The following apps are Pi-resident:

- AppFlowy
- EspoCRM
- Postiz
- n8n
- Mosquitto
- Grafana
- Uptime Kuma
- ntfy

Do not assume these apps fail over to AWS.
