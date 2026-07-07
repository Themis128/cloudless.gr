# K3s Troubleshooting Tools & Skills Reference

**Last Updated:** 2026-07-07  
**Cluster:** cloudless.gr k3s (omv-main, omv-ha - Raspberry Pi 5/4)

---

## Table of Contents
1. [Existing MCP Infrastructure Tools](#existing-mcp-infrastructure-tools)
2. [Existing Claude Skills](#existing-claude-skills)
3. [GitHub Tools & Utilities](#github-tools--utilities)
4. [K3s Native Troubleshooting Commands](#k3s-native-troubleshooting-commands)
5. [Monitoring & Observability](#monitoring--observability)
6. [Container Runtime Tools](#container-runtime-tools)
7. [Certificate & TLS Management](#certificate--tls-management)
8. [GitOps & Deployment](#gitops--deployment)
9. [Quick Command Reference](#quick-command-reference)

---

## Existing MCP Infrastructure Tools

### Cluster Management & Health

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_cluster_health_check` | Overall cluster health: nodes, pods, disk, load |
| `mcp_cloudless_infra_cluster_check_services` | Systemd services (runners, k3s, keepalived) |
| `mcp_cloudless_infra_cluster_check_omv` | Disk/memory/load snapshot for Pi nodes |
| `mcp_cloudless_infra_cluster_run_command` | Execute arbitrary shell on Pi nodes via SSH |

### Pod & Resource Management

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_k3s_get_pods` | List pods with namespace, status, restarts, age |
| `mcp_cloudless_infra_k3s_get_pod_logs` | Get logs from specific pod (namespace, selector, tail) |
| `mcp_cloudless_infra_k3s_describe_resource` | kubectl describe (pod, deployment, service, ingress) |
| `mcp_cloudless_infra_k3s_restart_deployment` | Rollout restart deployment |
| `mcp_cloudless_infra_k3s_prepull_image` | Pre-pull container image on cluster nodes |

### Helm Operations

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_helm_list` | List all Helm releases across namespaces |
| `mcp_cloudless_infra_helm_status` | Get status of specific Helm release |
| `mcp_cloudless_infra_helm_deploy_chart` | Install or upgrade Helm chart |
| `mcp_cloudless_infra_helm_uninstall` | Uninstall Helm release |

### Monitoring Stack

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_prometheus_check_targets` | Prometheus scrape targets health |
| `mcp_cloudless_infra_prometheus_check_rules` | Prometheus alerting/recording rules |
| `mcp_cloudless_infra_prometheus_check_alerts` | Active Prometheus alerting rules |
| `mcp_cloudless_infra_prometheus_query` | Execute PromQL queries |
| `mcp_cloudless_infra_grafana_check_health` | Grafana pod health & service |
| `mcp_cloudless_infra_grafana_list_dashboards` | List Grafana dashboards |
| `mcp_cloudless_infra_grafana_get_datasources` | List Grafana data sources |
| `mcp_cloudless_infra_grafana_check_alerts` | Active Grafana alerting rules |

### Service Management

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_k3s_check_ha` | HA setup: nodes, keepalived VIP, Traefik |
| `mcp_cloudless_infra_k3s_check_cloudless_app` | cloudless Next.js app deployment status |
| `mcp_cloudless_infra_metabase_check_health` | Metabase pod health |
| `mcp_cloudless_infra_metabase_get_logs` | Get Metabase pod logs |
| `mcp_cloudless_infra_ml_pipeline_status` | ML pipeline pod health |

### Cloudflare & Network

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_cloudflare_tunnel_status` | Cloudflare tunnel status |
| `mcp_cloudless_infra_cloudflare_restart_tunnel` | Restart cloudflared service |
| `mcp_cloudless_infra_cloudflare_zone_analytics` | Zone analytics (requests, bandwidth, threats) |
| `mcp_cloudless_infra_cloudflare_zone_settings` | Zone security/performance settings |

### Failover & HA

| MCP Tool | Purpose |
|----------|---------|
| `mcp_cloudless_infra_failover_check_readiness` | Tailscale Funnel readiness, Pi standby capability |
| `mcp_cloudless_infra_failover_check_secondary_app` | Verify k3s origin responds correctly |
| `mcp_cloudless_infra_failover_check_shares` | NFS/SMB share availability |
| `mcp_cloudless_infra_failover_network_check` | Network connectivity from both Pi nodes |
| `mcp_cloudless_infra_failover_check_secondary_app` | Secondary app responsiveness |

---

## Existing Claude Skills

### Pi Image & Rollout

**Skill:** `pi-image-rollout`  
**Purpose:** Manage Pi standby image rollout via `pi-origin.cloudless.gr`

**Key Procedures:**
- Confirm new image ready in ECR
- Check current pod version
- Trigger rollout restart
- Monitor rollout (~90s timeline)
- Handle rollout failures/stuck pods
- Auto-healer cronjob management

**Key Commands:**
```bash
kubectl rollout restart deployment/cloudless -n cloudless
kubectl get pods -n cloudless
curl http://localhost:3000/api/health
```

### Deploy Pipeline

**Skill:** `deploy-pipeline`  
**Purpose:** End-to-end deployment orchestration

**Key Procedures:**
- Lambda deploy with SST + CloudFront
- HA sync orchestrator dispatch
- Pi image build (if needed)
- k3s rollout with auto-healer

**SSM Parameters:**
- `cloud-sha` - Lambda deploy SHA
- `pi-sha` - Pi k3s rollout SHA (12-char)
- `ECR_LATEST_DIGEST` - Latest Pi Docker digest

### Runner Hardening

**Skill:** `runner-harden`  
**Purpose:** Systemd hardening for GitHub Actions runners

**Key Procedures:**
- Decouple from k3s dependency
- Add restart policies
- Configure fallback DNS
- Apply systemd overrides

**Service Pattern:**
```
actions.runner.Themis128-{repo}.{runner}.service
```

---

## GitHub Tools & Utilities

### Bootstrap & Installation

| Tool | GitHub | Purpose |
|------|--------|---------|
| **k3sup** | [appscode/k3sup](https://github.com/appscode/k3sup) | Bootstrap K3s over SSH |
| **k3s-upgrade-controller** | [k3s-io/k3s-upgrade-controller](https://github.com/k3s-io/k3s-upgrade-controller) | Automated K3s upgrades |
| **kube-vip** | [kube-vip/kube-vip](https://github.com/kube-vip/kube-vip) | Load balancing for bare metal |
| **MetalLB** | [metallb/metallb](https://github.com/metallb/metallb) | Bare metal load balancer |

### Troubleshooting & Diagnostics

| Tool | GitHub | Purpose |
|------|--------|---------|
| **Troubleshoot** | [preflighthq/troubleshoot](https://github.com/preflighthq/troubleshoot) | Support bundles & diagnostics |
| **k3s-monitoring** | [cablespaghetti/k3s-monitoring](https://github.com/cablespaghetti/k3s-monitoring) | Prometheus/Grafana/Loki stack |
| **k3s-troubleshooting** | [iam-veeramalla/kubernetes-troubleshooting-zero-to-hero](https://github.com/iam-veeramalla/kubernetes-troubleshooting-zero-to-hero) | Comprehensive troubleshooting guide |
| **diag-tools** | [yuraant/diag-tools](https://github.com/yuraant/diag-tools) | K3s diagnostic tools |

### GitOps & Deployment

| Tool | GitHub | Purpose |
|------|--------|---------|
| **Flux** | [fluxcd/flux2](https://github.com/fluxcd/flux2) | GitOps operator |
| **k3s-baremetal** | [davidschipfelt/k3s-baremetal](https://github.com/davidschipfelt/k3s-baremetal) | Bare metal deployment scripts |
| **ansible-k3s** | [geerlingguy/ansible-role-k3s](https://github.com/geerlingguy/ansible-role-k3s) | Ansible automation |

---

## K3s Native Troubleshooting Commands

### Cluster Status

```bash
# Check node status
kubectl get nodes

# Check cluster info
kubectl cluster-info

# Run k3s diagnostic
k3s check-config
```

### Resource Investigation

```bash
# List all resources across namespaces
kubectl get all --all-namespaces

# Describe problematic resource
kubectl describe pod <pod-name> -n <namespace>

# Get events (sorted by time)
kubectl get events --sort-by='.lastTimestamp'
```

### Container Runtime (CRICTL)

```bash
# List containers
crictl ps -a

# List images
crictl images

# Inspect container
crictl inspect <container-id>

# Get container logs
crictl logs <container-id>

# Execute in container
crictl exec -it <container-id> sh
```

### Certificate Management

```bash
# Check certificates
k3s certificate check

# Renew certificates
k3s certificate renew

# Check certificate expiry
openssl x509 -in /var/lib/rancher/k3s/server/tls/current-serving-kubelet.crt -noout -dates
```

### Service Management

```bash
# Check k3s service status
systemctl status k3s

# Check k3s service logs
journalctl -u k3s -f

# Restart k3s
systemctl restart k3s
```

---

## Monitoring & Observability

### Prometheus Queries

| Query | Purpose |
|-------|---------|
| `up` | Check all scrape targets |
| `node_cpu_seconds_total` | CPU usage |
| `node_memory_MemAvailable_bytes` | Memory availability |
| `node_filesystem_avail_bytes` | Disk space |
| `process_resident_memory_bytes` | Process memory usage |

### Grafana Dashboards

| Dashboard | Purpose |
|-----------|---------|
| Node Exporter | Node-level metrics (CPU, memory, disk, network) |
| K3s Monitoring | Cluster-specific metrics |
| Cilium | Network policies & visibility |

### Log Collection

```bash
# K3s server logs
journalctl -u k3s -n 100

# Container logs (via kubectl)
kubectl logs <pod> -n <namespace> --tail=100

# Container logs (via crictl)
crictl logs <container-id> --tail=100
```

---

## Container Runtime Tools

### CRICTL Reference

```bash
# List all containers (including stopped)
crictl ps -a

# List images
crictl images

# Inspect a container
crictl inspect <container-id>

# Get container logs
crictl logs <container-id>

# Follow logs
crictl logs -f <container-id>

# Execute in container
crictl exec -it <container-id> sh

# Stats for running containers
crictl stats

# Pod sandbox info
crictl pods
```

### kubectl Debug

```bash
# Interactive debugging session
kubectl debug -it <pod> --image=busybox --target=<container>

# Create debug pod
kubectl debug node/<node-name> --image=ubuntu

# Copy files to/from pod
kubectl cp <namespace>/<pod>:/path/to/file /local/path
kubectl cp /local/file <namespace>/<pod>:/path/to/file
```

---

## Certificate & TLS Management

### cert-manager

```bash
# Check certificate status
kubectl get certificates -A

# Check certificate requests
kubectl get certificaterequests -A

# Check issuers
kubectl get issuers -A

# Check cluster issuers
kubectl get clusterissuers

# Describe certificate
kubectl describe certificate <name> -n <namespace>

# Check ACME challenges
kubectl get challenges -A
```

### Manual Certificate Renewal

```bash
# Check all certificates
k3s certificate check

# Renew all certificates
k3s certificate renew

# Specific certificate renewal
k3s certificate renew --cert /path/to/cert
```

---

## GitOps & Deployment

### Flux Commands

```bash
# Check flux status
flux check --pre

# List all resources
flux get all -A

# Check git repository
flux get gitrepository -A

# Check kustomization
flux get kustomization -A

# Reconcile resource
flux reconcile kustomization <name> -n <namespace>
```

---

## Quick Command Reference

### Daily Health Check

```bash
# 1. Cluster status
kubectl get nodes
kubectl get pods -A

# 2. Key service status
systemctl status k3s
systemctl status actions.runner.*

# 3. Disk usage
df -h

# 4. Memory
free -h

# 5. Load average
uptime
```

### Pod Troubleshooting Flow

```bash
# 1. Check pod status
kubectl get pods -n <namespace>

# 2. Describe pod for events
kubectl describe pod <pod-name> -n <namespace>

# 3. Get logs
kubectl logs <pod-name> -n <namespace> --tail=100

# 4. Check container runtime (if needed)
crictl ps -a
crictl logs <container-id>

# 5. Exec into pod (if needed)
kubectl exec -it <pod-name> -n <namespace> -- sh
```

### Node Troubleshooting Flow

```bash
# 1. Check node status
kubectl get nodes
kubectl describe node <node-name>

# 2. Systemd services
systemctl status k3s
systemctl status cloudflared

# 3. Journal logs
journalctl -u k3s -n 100
journalctl -u cloudflared -n 100

# 4. Resources
df -h
free -h
uptime

# 5. Network
ip addr show
ip route show
```

---

## Recommended Tool Stack for cloudless.gr

### Primary Tools (Already Available)
- ✅ `mcp_cloudless_infra_*` (comprehensive infrastructure MCP)
- ✅ `pi-image-rollout` skill
- ✅ `deploy-pipeline` skill
- ✅ `runner-harden` skill

### Recommended Additions
- 📦 **Troubleshoot by Preflight** - For support bundles and diagnostics
- 📊 **k3s-monitoring** - Pre-configured Prometheus/Grafana stack
- 🔧 **CRICTL** - Container runtime troubleshooting (already available via k3s)

### Documentation to Create
- 📝 K3s Troubleshooting Runbook
- 📝 Common Error Patterns & Solutions
- 📝 Emergency Response Procedures
- 📝 Maintenance Checklist

---

## References

### Official Documentation
- [K3s Documentation](https://docs.k3s.io/)
- [Troubleshoot by Preflight](https://replicated.com/troubleshoot/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

### Community Resources
- [k3s GitHub Issues](https://github.com/k3s-io/k3s/issues)
- [CNCF K3s Community](https://k3s.io/#community)
- [rancher-users Slack](https://rancher-users.slack.com/)

### Monitoring & Observability
- [Prometheus Documentation](https://prometheus.io/docs/introduction/overview/)
- [Grafana Documentation](https://grafana.com/docs/)

### GitOps
- [Flux Documentation](https://fluxcd.io/flux/)
