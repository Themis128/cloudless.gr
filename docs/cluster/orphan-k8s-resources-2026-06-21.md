# Orphan k8s resources sweep — 2026-06-21

Snapshot of every Service / Endpoint / PVC in the cluster cross-checked
against running pods. Each row below is a real resource consuming an
IP address, etcd row, or disk allocation **with no live consumer**.

## Services without endpoints (8)

| Namespace      | Service              | Why orphan                                          | Action          |
| -------------- | -------------------- | --------------------------------------------------- | --------------- |
| analytics      | metabase             | Pod evicted to free RAM for EspoCRM (CLAUDE.md)     | DELETE service  |
| home-assistant | home-assistant       | Pod evicted (CLAUDE.md)                             | DELETE service  |
| monitoring     | loki-chunks-cache    | memcached-chunks-cache subchart never deployed      | DELETE service  |
| oncall         | oncall-engine        | Grafana OnCall stack — no pods running              | DELETE service  |
| oncall         | oncall-mariadb       | "                                                   | DELETE service  |
| oncall         | oncall-redis         | "                                                   | DELETE service  |
| postiz         | postiz-litellm       | Pod evicted during AppFlowy Phase 1 (CLAUDE.md)     | DELETE service  |
| monitoring     | esp32-watchdog-metrics | NOT an orphan — Endpoints points to ESP32 IP 192.168.1.201 (manual ExternalName-style entry). Leave. | KEEP |

## PVCs with no consuming pod (4)

| Namespace      | PVC                                  | Size  | Status | Action                |
| -------------- | ------------------------------------ | ----- | ------ | --------------------- |
| home-assistant | ha-config-pvc                        | 5 Gi  | Bound  | KEEP — operator may redeploy HA when a 3rd Pi joins (per CLAUDE.md `infrastructure/espocrm/evicted-deployments/`) |
| home-assistant | home-assistant-config                | 5 Gi  | Bound  | KEEP — same reason     |
| oncall         | data-oncall-mariadb-0                | 8 Gi  | Bound  | DELETE — OnCall is not coming back; no manifest in repo |
| oncall         | redis-data-oncall-redis-master-0     | 8 Gi  | Bound  | DELETE — same         |

## Empty namespaces (worth dropping)

- `oncall` — no pods, no Deployments, only the 3 dead Services +
  2 dead PVCs above. After deleting those, the namespace can be removed.

## Summary

- Reclaimable etcd / kube-proxy IPs: 7 Services
- Reclaimable disk: **16 Gi** (oncall MariaDB + Redis PVCs)
- Reclaimable namespaces: 1

## Recovery commands (operator-side — NOT executed by this commit)

The cleanup is in a follow-on PR because deleting cluster resources is
higher-risk than the documentation; keeping read + action in separate
PRs makes any single rollback trivial. The exact commands when ready:

```bash
# 1. Delete orphan Services
kubectl -n analytics       delete svc metabase
kubectl -n home-assistant  delete svc home-assistant
kubectl -n monitoring      delete svc loki-chunks-cache
kubectl -n oncall          delete svc oncall-engine oncall-mariadb oncall-redis
kubectl -n postiz          delete svc postiz-litellm

# 2. Delete oncall PVCs (frees 16 Gi)
kubectl -n oncall delete pvc data-oncall-mariadb-0 redis-data-oncall-redis-master-0

# 3. Drop the empty namespace
kubectl delete ns oncall

# 4. Verify
kubectl get all -n oncall   # should report "No resources found"
df -h /srv/dev-disk-by-uuid-a9a5a108-...    # confirm sda1 freed 16 Gi
```

Do NOT delete the home-assistant Service or PVCs — they're a deliberate
warm-restart parking spot per the CLAUDE.md "Memory freed" note in the
EspoCRM deploy section.

## Sources

- `kubectl get svc,endpoints,pvc -A` at 2026-06-21T11:00Z.
- Cross-checked against `infrastructure/espocrm/evicted-deployments/`
  and `infrastructure/postiz/` for intent.
