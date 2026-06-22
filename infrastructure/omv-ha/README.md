# omv-ha host scripts

Tracked-in-git copies of the system-level scripts running on the
`omv-ha` worker node, so they're versioned + auditable instead of
"installed once and forgotten."

## `cloudless-cleanup.sh`

Daily disk-cleanup script triggered by
`/etc/systemd/system/cloudless-cleanup.timer` at 03:45 EEST.

**The systemd unit + timer are NOT in this repo** — they were created
on the host in 2026-06-16 (see CLAUDE.md "Pi Housekeeping"). Only the
shell script body lives here so the cleanup logic can be diff'd +
PR-reviewed like any other code.

### Install / refresh on the node

This is the one-shot operator command (or use a privileged k8s pod
to do it from CI without SSH — pattern below):

```bash
ssh tbaltzakis@omv-ha
sudo curl -fsSL \
  https://raw.githubusercontent.com/Themis128/cloudless.gr/main/infrastructure/omv-ha/cloudless-cleanup.sh \
  -o /usr/local/sbin/cloudless-cleanup.sh
sudo chmod +x /usr/local/sbin/cloudless-cleanup.sh
sudo systemctl daemon-reload
# Force one off-schedule run for verification:
sudo systemctl start cloudless-cleanup.service
sudo tail -30 /var/log/cloudless-cleanup.log
```

Or via k8s privileged pod (no SSH needed):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: install-cleanup-omvha
  namespace: omv-ops
spec:
  restartPolicy: Never
  nodeSelector:
    kubernetes.io/hostname: omv-ha
  containers:
    - name: install
      image: alpine:3.20
      securityContext:
        privileged: true
      command:
        - /bin/sh
        - -c
        - |
          apk add --no-cache curl >/dev/null
          curl -fsSL https://raw.githubusercontent.com/Themis128/cloudless.gr/main/infrastructure/omv-ha/cloudless-cleanup.sh \
            -o /host/usr/local/sbin/cloudless-cleanup.sh
          chmod +x /host/usr/local/sbin/cloudless-cleanup.sh
          chroot /host /bin/bash /usr/local/sbin/cloudless-cleanup.sh
          tail -20 /host/var/log/cloudless-cleanup.log
      volumeMounts:
        - name: host
          mountPath: /host
  volumes:
    - name: host
      hostPath:
        path: /
```

### Recent fixes

| Date | Fix |
|---|---|
| 2026-06-22 | crictl race: wait up to 30s for `/run/k3s/containerd/containerd.sock` before invoking `k3s crictl rmi`; pass `--runtime-endpoint` explicitly. Previously the bare invocation would fail with "connection refused" if cron beat k3s-agent's socket-bind; cleanup still "completed" because individual steps soft-fail, but the containerd image prune was silently a no-op. |

## See also

- CLAUDE.md "Pi Housekeeping" — the full overview
- `infrastructure/omv-sdb1/` — the sdb1 capacity probe (sibling daily CronJob)
- `infrastructure/omv/` — equivalent host scripts for `omv-main` (if/when extracted)
