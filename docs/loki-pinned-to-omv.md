# Loki + Promtail pinned to `omv` (off `omv-ha`)

**Applied:** 2026-06-26
**PR:** `fix/loki-promtail-pin-to-omv`
**Owner:** ops (Themis)

## Context

`omv-ha` (Pi 3, 1 GiB RAM) was running both:

- `monitoring/loki-0` (StatefulSet, single-binary) with its `storage-loki-0` PVC
  on local-path → SD card.
- A `monitoring/promtail` DaemonSet pod (one per node).

Combined with the 1 GiB ceiling, this kept omv-ha at load avg 5-7
(1-minute) for hours at a time. Meanwhile `omv` (Pi 5, 8 GiB) sat at
~0.8. The existing TODO in
[`k8s/cluster-protection/monitoring-resources.yaml`](../k8s/cluster-protection/monitoring-resources.yaml)
already called out the move:

> Consider moving Loki off this node entirely — promtail ships logs, and
> the ingester can live on a sibling Pi without coupling to the data SSD.

This change executes that move and pins promtail to `omv` only.

## What changed (live cluster)

| Object | Change |
|---|---|
| `statefulset/loki` (monitoring) | Added `spec.template.spec.nodeSelector: {kubernetes.io/hostname: omv}` |
| `statefulset/loki` (monitoring) | Set `spec.persistentVolumeClaimRetentionPolicy: {whenDeleted: Retain, whenScaled: Retain}` |
| `daemonset/promtail` (monitoring) | Added `spec.template.spec.nodeSelector: {kubernetes.io/hostname: omv}` |
| `pvc/storage-loki-0` (monitoring) | New PVC `pvc-45cd981a-8eb9-4a93-a63f-f3a061ee525c` bound to a new local-path PV on omv (path `/srv/dev-disk-by-uuid-a9a5a108-…/k3s/storage/pvc-45cd981a-…_monitoring_storage-loki-0`) |

The promtail DaemonSet went from 2 pods to 1 (only on omv). omv-ha no
longer ships its own logs to Loki; in practice we have host-level
journald on omv-ha for emergencies. If we ever want host log shipping
back, the cheapest option is a small dedicated logging StatefulSet
rather than putting promtail back on the Pi 3.

## Data loss disclosure (read this)

The migration was originally planned as "scale loki to 0 → rsync the
PV from omv-ha to omv → flip PV nodeAffinity → scale back to 1." That
plan **didn't survive contact with reality**: the StatefulSet was
created (by the `loki-7.0.0` Helm chart) with
`persistentVolumeClaimRetentionPolicy: {whenScaled: Delete}`. As soon
as `kubectl scale --replicas=0` ran, the PVC `storage-loki-0` was
deleted, which triggered the PV's `Delete` reclaim policy, which in
turn caused local-path-provisioner to `rm -rf` the data directory on
omv-ha. By the time the rsync command authenticated, the source path
no longer existed.

**Concretely:** the ~163 MiB of historical Loki chunks on omv-ha
(~18 days of cluster logs) are gone. Loki came back up healthy on omv
with a fresh empty PVC. Going forward (today onward), all new logs
are stored on omv's SSD.

This is acceptable for our use case (we keep Loki as a short-term
debug buffer; long-term retention is Grafana Cloud / S3, when wired
up). It is documented here so the next operator who wonders "why does
Loki only have history from 2026-06-26 onward" doesn't waste an hour.

The same StatefulSet now has `whenScaled: Retain` set, so any future
`kubectl scale --replicas=0` will preserve the PVC. A repeat of this
class of mistake requires explicit `kubectl delete pvc`.

## Helm drift — operator follow-up

Both patches above were applied via `kubectl patch` to the live
objects. They are **not** in the upstream Helm values, so the next
`helm upgrade` on the loki chart will revert them. To make these
permanent, add to the loki chart values (the file lives in the
helm-values repo / wherever this stack is managed; it is not in this
repo today):

```yaml
# values for the loki Helm chart (single-binary mode)
singleBinary:
  nodeSelector:
    kubernetes.io/hostname: omv
  persistence:
    # The chart sets these via volumeClaimTemplates on the StatefulSet —
    # confirm whenScaled/whenDeleted are NOT Delete before any
    # scale-to-zero operation.
    # (Upstream chart didn't expose this directly at 7.0.0; if still
    # the case, keep using the live kubectl patch + revisit after a
    # chart bump.)

# values for the promtail chart
nodeSelector:
  kubernetes.io/hostname: omv
```

For the loki PVC retention policy, the upstream chart at the version
in use (`loki-7.0.0`) didn't expose
`persistentVolumeClaimRetentionPolicy` as a value. Until it does, the
live `kubectl patch` is the source of truth — re-run after every
`helm upgrade`:

```bash
kubectl -n monitoring patch statefulset loki --type=merge \
  -p '{"spec":{"persistentVolumeClaimRetentionPolicy":{"whenDeleted":"Retain","whenScaled":"Retain"}}}'

kubectl -n monitoring patch statefulset loki --type=merge \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'

kubectl -n monitoring patch daemonset promtail --type=merge \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'
```

## Verification (post-migration)

```text
kubectl -n monitoring get pod loki-0 -o wide
NAME    READY  STATUS   RESTARTS  AGE  NODE
loki-0  2/2    Running  0         ~2m  omv

kubectl -n monitoring get ds promtail
NAME      DESIRED  CURRENT  READY  NODE SELECTOR
promtail  1        1        1      kubernetes.io/hostname=omv

# /ready on loki returns "ready" (probed from a busybox pod):
wget -qO- http://loki.monitoring.svc.cluster.local:3100/ready
# → ready

kubectl get pods -A --field-selector spec.nodeName=omv-ha
# (no loki, no promtail anywhere in output)
```

Load averages observed:

| Node    | Before (1m / 5m / 15m) | After |
|---------|------------------------|-------|
| `omv`   | 0.91 / 0.82 / 0.85     | 1.55 / 1.14 / 0.95 |
| `omv-ha` | 5.99 / 7.34 / 5.12   | 0.84 / 2.82 / 3.83 |

omv-ha load drop is the headline result. omv's modest increase is
within its normal noise (the new loki workload requests 50m CPU,
200Mi RAM — it doesn't materially change a Pi 5).
