# Security hardening

Four sub-layers, applied in order:

| # | What | Why |
|---|---|---|
| 1 | **NetworkPolicies** | Default-deny pod-to-pod. Only declared traffic flows are allowed. Contains a compromised pod to its blast radius. |
| 2 | **PodSecurity admission** | Enforce restricted/baseline Pod Security Standards at admission time. No more root pods, hostPath, or privileged. |
| 3 | **Sealed Secrets** | Encrypt secret YAMLs with the in-cluster controller key. Safe to commit. Unblocks 100% GitOps. |
| 4 | **RBAC audit** | Confirm no app SA has `cluster-admin`. Document and justify the few that do (ArgoCD, CNPG operator). |

## Prereqs

- K3s with Flannel + the embedded NetworkPolicy controller (default). Verify:
  ```bash
  kubectl run npctest --image=busybox --restart=Never --rm -it -- sh -c 'wget -qO- --timeout=2 http://postiz.postiz.svc 2>&1 || echo "blocked-as-expected (after applying)"'
  ```

## Install

```bash
chmod +x install-security.sh
./install-security.sh
```

The script does:
1. Installs sealed-secrets controller in `kube-system`.
2. Seals every `.yaml` secret in this folder into a `SealedSecret` CR alongside it.
3. Applies namespace PodSecurity labels.
4. Applies all NetworkPolicies.

## Repo layout

```
10-security/
├── networkpolicies/
│   ├── 00-default-deny.yaml         # default-deny ingress+egress in every app namespace
│   ├── postiz.yaml                  # postiz pod -> PG, Redis, MinIO + ingress from Traefik
│   ├── n8n.yaml                     # n8n -> Postiz API + ingress from Traefik
│   ├── monitoring.yaml              # Prometheus -> all metrics endpoints + Grafana ingress
│   ├── argocd.yaml                  # ArgoCD -> git (egress), k8s API; UI ingress from Traefik
│   ├── infra.yaml                   # cert-manager + CNPG + MinIO operators
│   └── traefik-egress.yaml          # allow kube-system Traefik -> every namespace it fronts
├── pod-security/
│   └── namespace-labels.yaml
├── sealed-secrets/
│   ├── values.yaml                  # controller helm values
│   ├── seal-all-secrets.sh          # one-shot to seal the 7 secret files
│   └── README.md
└── rbac/
    └── audit.md                     # how to audit + what each SA can do
```

## Verifying the hardening worked

After install, the following commands should fail / return the expected behaviour:

```bash
# 1. Cross-namespace pod-to-pod traffic is blocked
kubectl -n n8n run probe --image=curlimages/curl --restart=Never --rm -it -- \
  curl --max-time 3 http://postiz-pg-rw.postiz:5432  # → timeout (blocked)

# 2. Postiz can still reach its PG
kubectl -n postiz exec deploy/postiz -- sh -c \
  'nc -zv postiz-pg-rw.postiz 5432'  # → succeeded

# 3. PodSecurity blocks a root pod in postiz ns
kubectl -n postiz run rooty --image=busybox --restart=Never -- sleep 1
# → error: pods "rooty" is forbidden: violates PodSecurity "restricted:latest"

# 4. Sealed secrets decrypt
kubectl -n postiz get sealedsecret -o name
kubectl -n postiz get secret postiz-secrets -o yaml | grep -i type
# → type: Opaque (unsealed by controller)
```

## What this does NOT cover

- **Egress filtering to the public internet** — Postiz needs to talk to X/LinkedIn/etc. on tcp/443. We allow all egress to 443 from the postiz pod by default. Lock down by IP if needed (most social APIs publish ranges).
- **Image signing / Cosign verification** — add Kyverno + Cosign policies if you want only-signed-images. Not included here.
- **mTLS between services** — not needed at this scale; revisit if you ever shard workloads across nodes / clusters.
