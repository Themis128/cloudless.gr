# k3s config overlay — hardened kubelet eviction

Patch instructions for `/etc/rancher/k3s/config.yaml` on `omv` (192.168.1.128).
This file is **not** auto-applied by CI — the k3s config is host-local. Apply
it manually after reviewing this PR.

## Why

The current eviction config is far too permissive for an 8 GiB host:

```yaml
kubelet-arg:
  - eviction-hard=memory.available<200Mi
  - system-reserved=cpu=200m,memory=200Mi
  - kube-reserved=cpu=200m,memory=300Mi
```

By the time available memory drops to 200 MiB on this box, the kernel is
already swap-storming — see the 2026-05-28 incident in
`docs/cluster-overload-runbook.md`. Reserving only 500 MiB for the host +
k3s ignores that the host also runs MariaDB, HomeAssistant, n8n, MQTT
broker, Promtail, etc. outside the cluster.

## Patch

Edit `/etc/rancher/k3s/config.yaml`, replace the existing `kubelet-arg:`
block with:

```yaml
kubelet-arg:
  - max-pods=110
  - image-gc-high-threshold=80
  - image-gc-low-threshold=70

  # Reserve host capacity first. The host runs MariaDB, HomeAssistant, n8n,
  # MQTT, promtail, and VSCode Server outside k3s — they cumulatively need
  # at least 1 GiB. k3s itself + containerd need another 500 MiB.
  - system-reserved=cpu=500m,memory=1Gi
  - kube-reserved=cpu=500m,memory=500Mi

  # Hard eviction at 600 MiB — gives the kubelet headroom to terminate
  # pods *before* the host has to start paging. Below 600 MiB free on this
  # box, fsync latency on the data SSD spikes from a few ms to >300ms and
  # etcd starts losing leases.
  - eviction-hard=memory.available<600Mi,nodefs.available<10%

  # Soft eviction starts the gentler termination path at 1 GiB free with a
  # 30s grace period — pods that are about to be killed get a SIGTERM and
  # a chance to drain.
  - eviction-soft=memory.available<1Gi,nodefs.available<15%
  - eviction-soft-grace-period=memory.available=30s,nodefs.available=2m
  - eviction-max-pod-grace-period=60
```

The `etcd-arg`, `kube-apiserver-arg`, and other top-level keys above the
`kubelet-arg:` block stay as they are.

## Apply

```bash
ssh 192.168.1.128

# Back up the live config before editing.
sudo cp /etc/rancher/k3s/config.yaml /etc/rancher/k3s/config.yaml.bak

# Edit per the patch above.
sudoedit /etc/rancher/k3s/config.yaml

# k3s reloads its kubelet args on restart only — there is no SIGHUP path.
sudo systemctl restart k3s

# Wait for the apiserver to come back. Lambda is PRIMARY in Route 53, so
# this restart only affects the SECONDARY origin — no end-user impact.
for i in $(seq 1 30); do
  curl -sk --max-time 3 -o /dev/null -w "%{http_code}\n" \
    https://127.0.0.1:6443/livez | grep -qE '^(200|401)$' && break
  sleep 5
done

# Verify the new kubelet args landed.
sudo k3s kubectl describe node omv | grep -A2 -i 'evict\|reserved'
```

## Rollback

```bash
sudo mv /etc/rancher/k3s/config.yaml.bak /etc/rancher/k3s/config.yaml
sudo systemctl restart k3s
```

## Expected behavior change

- During a memory spike, the kubelet starts SIGTERM-ing pods at 1 GiB free
  (was: kernel OOM-kills random processes at ~150 MiB free).
- A namespace that breaches its `ResourceQuota` (see `limit-ranges.yaml`)
  gets new pods rejected at admission instead of contributing to the spike.
- The host retains a 1 GiB working set for non-k8s services, so MariaDB /
  HomeAssistant / n8n do not get squeezed by an in-cluster runaway.
