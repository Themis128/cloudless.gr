---
name: omv-ha-memory-doctor
description: |
  Diagnose and address memory pressure on the omv-ha k3s node. The omv-ha
  node is a tiny device (~955MB total RAM, ~656MB allocatable) that runs
  critical infrastructure pods (Tailscale, Traefik, CoreDNS, metrics-server,
  node-exporter, appflowy-worker, postiz-redis). At 97% memory request
  capacity, it's at risk of OOMKills and pod eviction. Use when omv-ha shows
  high memory usage, pods are OOMKilled on omv-ha, or the node enters
  MemoryPressure condition.
---

# omv-ha Memory Doctor

The omv-ha node is the smallest node in the cluster — a device with only
~955MB total RAM (~656MB allocatable after system/kubelet reservations).
It runs critical infrastructure that can't be easily moved:

- Tailscale operator + kube proxy + ingress + CIDR controllers
- Traefik ingress controller
- CoreDNS
- metrics-server
- node-exporter
- appflowy-worker
- postiz-redis

At 97% memory request capacity (636Mi requested out of 670Mi allocatable),
the node is essentially full. Any new pod scheduling will fail, and memory
spikes risk OOMKills.

## When to invoke this skill

- `kubectl top nodes` shows omv-ha at >85% memory
- `kubectl describe node omv-ha` shows MemoryPressure=True
- Pods on omv-ha are OOMKilled
- `tailscale/kube-0` has high restart count (27+)
- New pods fail to schedule on omv-ha with `Insufficient memory`
- After adding a new service or increasing replicas

## Diagnosis

### 1. Check current memory state

```bash
# Node resource usage
kubectl top node omv-ha

# Node allocatable vs requested
kubectl describe node omv-ha | grep -A10 "Allocated resources"

# Node conditions (look for MemoryPressure)
kubectl describe node omv-ha | grep -A5 "Conditions:"

# Total capacity
kubectl describe node omv-ha | grep -E "Capacity|Allocatable" | head -4
```

### 2. Identify pods consuming memory on omv-ha

```bash
# All pods on omv-ha with their memory usage
kubectl top pods --all-namespaces --field-selector spec.nodeName=omv-ha

# All pods on omv-ha with their resource requests/limits
kubectl get pods --all-namespaces --field-selector spec.nodeName=omv-ha \
  -o json | jq '.items[] | {
    ns: .metadata.namespace,
    name: .metadata.name,
    containers: [.spec.containers[] | {
      name: .name,
      requests: .resources.requests,
      limits: .resources.limits
    }]
  }'
```

### 3. Check for OOMKilled pods

```bash
# Pods on omv-ha that were OOMKilled
kubectl get pods --all-namespaces --field-selector spec.nodeName=omv-ha \
  -o json | jq '.items[] | select(.status.containerStatuses != null) |
  . as $pod | .status.containerStatuses[] |
  select(.lastState.terminated.reason == "OOMKilled") |
  "\($pod.metadata.namespace)/\($pod.metadata.name) OOMKilled"'

# Check tailscale/kube-0 restart reason
kubectl get pod -n tailscale kube-0 \
  -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
```

### 4. Check what's schedulable on omv-ha

```bash
# Node selectors and tolerations
kubectl describe node omv-ha | grep -A5 "Taints:"
kubectl get pods --all-namespaces --field-selector spec.nodeName=omv-ha \
  -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}{"  nodeSelector="}{.spec.nodeSelector}{"\n"}{end}'
```

## omv-ha pod inventory (as of 2026-07-31)

| Pod | Namespace | Memory (actual) | Memory (request) | Notes |
|-----|-----------|-----------------|-------------------|-------|
| coredns | kube-system | 30Mi | (system) | DNS resolver |
| local-path-provisioner | kube-system | 11Mi | (system) | Storage |
| metrics-server | kube-system | 31Mi | (system) | HPA metrics |
| svclb-traefik | kube-system | 0Mi | (system) | Load balancer |
| traefik | kube-system | 32Mi | (system) | Ingress |
| appflowy-worker | appflowy | 17Mi | (Burstable) | CMS worker |
| postiz-redis | postiz | 9Mi | (Burstable) | Redis cache |
| ingress-0 | tailscale | 32Mi | 128Mi limit | Tailscale ingress |
| kube-0 | tailscale | 22Mi | 256Mi limit | Tailscale kube proxy |
| operator | tailscale | 40Mi | (system) | Tailscale operator |
| ts-k3s-cidrs-0 | tailscale | 31Mi | (system) | CIDR controller |
| ts-k3s-cidrs-1 | tailscale | 38Mi | (system) | CIDR controller |
| node-exporter | monitoring | 16Mi | (BestEffort) | Metrics |

**Total actual usage**: ~545Mi (83% of allocatable)
**Total requests**: ~636Mi (97% of allocatable)

## Remediation options

### Option A: Reduce memory requests on omv-ha pods (quick fix)

Lower the memory requests (not limits) on pods that are over-requested:

```bash
# Check current requests for tailscale pods
kubectl get deploy -n tailscale -o json | jq '.items[].spec.template.spec.containers[].resources'

# The tailscale/kube-0 pod has a 256Mi memory limit but only uses 22Mi
# Reduce the request from 128Mi to 64Mi:
kubectl patch deploy -n tailscale operator --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/resources/requests/memory","value":"64Mi"}]'
```

### Option B: Move workloads off omv-ha (medium effort)

Move non-critical pods to omv (the 8GB node):

```bash
# Check if appflowy-worker can be moved
kubectl get deploy -n appflowy appflowy-worker -o jsonpath='{.spec.template.spec.nodeSelector}'
# If nodeSelector is omv-ha, consider changing to omv or removing the selector

# Check if postiz-redis can be moved
kubectl get deploy -n postiz postiz-redis -o jsonpath='{.spec.template.spec.nodeSelector}'
```

### Option C: Add resource limits to prevent runaway (preventive)

Add LimitRange to the tailscale namespace:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: tailscale-limits
  namespace: tailscale
spec:
  limits:
  - type: Container
    max:
      memory: 256Mi
    default:
      memory: 128Mi
    defaultRequest:
      memory: 64Mi
```

### Option D: Upgrade omv-ha hardware (long-term)

The omv-ha node has only ~955MB total RAM. If this is a Pi Zero 2 W or
similar, consider upgrading to a Pi 4/5 with 2-4GB RAM for the HA node.

## Monitoring the fix

After applying any remediation:

```bash
# Watch memory usage
watch -n 5 'kubectl top node omv-ha && echo "---" && kubectl top pods --all-namespaces --field-selector spec.nodeName=omv-ha'

# Check if MemoryPressure clears
kubectl get node omv-ha -o jsonpath='{.status.conditions[?(@.type=="MemoryPressure")].status}'
# Should be "False"

# Verify no new OOMKills
kubectl get pods --all-namespaces --field-selector spec.nodeName=omv-ha \
  -o json | jq '[.items[] | select(.status.containerStatuses != null) | . as $pod | .status.containerStatuses[] | select(.lastState.terminated.reason == "OOMKilled") | "\($pod.metadata.namespace)/\($pod.metadata.name)"] | length'
# Should be 0
```

## Related

- `docs/cluster/cluster-overload-runbook.md` — Full cluster overload recovery
- `docs/cluster/hw-list.md` — Hardware list
- `docs/cluster/cluster-capacity-audit-2026-06-21.md` — Capacity audit
- `skills/cluster-health.skill` — Quick health snapshot
- `tools/cluster-health-audit.sh` — One-shot audit tool
- `tools/pod-restart-investigator.sh` — Pod restart investigation
