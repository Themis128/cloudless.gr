# Tailscale CI ops — the reliable-join patterns

## The flakiness root cause (upstream-confirmed)

`tailscale/github-action`'s `ping` param requires ALL hosts to respond.
Subnet routers are bad targets, and new-node netmap propagation is
eventually-consistent — a healthy target can fail ping for ~30s after
join. That's the "Ping host 100.74.191.58 did not respond" failure mode.

**Fix applied:** `ping:` removed from all 44 workflows — the step joins
without a pre-check, then `tailscale-wait.py` (retry loop) confirms the
target is actually reachable before work proceeds.

## The join pattern

```yaml
- uses: tailscale/github-action@<sha> # v4.2.0
  with:
    oauth-client-id: ${{ secrets.TS_CLIENT_ID }}
    oauth-secret: ${{ secrets.TS_CLIENT_SECRET }}
    tags: tag:ci # required — OAuth nodes must be tagged
    # NO ping: — flaky (see above)
- run: python3 scripts/ci/tailscale-wait.py 100.74.191.58 22
```

- `tags: tag:ci` (or `tag:k8s`) — OAuth clients need a tag, nodes are
  ephemeral + auto-removed post-run
- New nodes are preapproved on tailnets with device approval

## kubectl via SSH shim

CI doesn't get a kubeconfig — `scripts/ci/kubectl-via-omv-ssh.sh`
installs a `kubectl` shim that SSHes to omv (`tbaltzakis@100.74.191.58`,
`OMV_SSH_KEY`, `sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml`).
Args are `%q`-quoted so jsonpath/patch payloads survive SSH.

## Tools

- `ts-diagnose.sh <ip> <port>` — ping + port-probe + tailscale status
  snapshot for a target node

## Operator outage pattern (learned 2026-10-30 disk event)

All `*.ts.net` VIPs dark while host `tailscaled` is healthy = the **k3s
Tailscale operator** is down, not the host daemon — bouncing `tailscaled`
/`cloudflared` does nothing. Failure cascade seen:

1. disk-full evicts the operator → `kubectl get pods -n tailscale` empty or
   `ContainerCreating`/`CrashLoopBackOff`;
2. hosted-runner deploys can't help: `100.74.191.58:6443` is proxied by the
   operator itself, so `tailscale-deploy.yml` runs on the omv runner;
3. adopted-release deploys leave `secret/operator-oauth` missing → pod
   `FailedMount` (the workflow now creates it);
4. `kube-0` crashloops on missing `kube-apiserver-auth-proxy` SA until the
   operator first runs (the operator creates it);
5. release lives in ns **`tailscale`**, not `tailscale-operator` (empty by
   design — the healer + workflow warnings watch `tailscale`).

Recovery: `gh workflow run tailscale-deploy.yml` (on-box helm + secret +
pod restart), then `omv-disk-prune.yml` `pods_restart=true` for dead app
deployments. Verify with `kubectl get pods -n tailscale` or by curling the
`svc:*` VIP IPs — `*.ts.net` names don't resolve on the omv host's resolver.
