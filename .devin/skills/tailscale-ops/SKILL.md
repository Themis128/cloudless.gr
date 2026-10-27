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
- uses: tailscale/github-action@<sha>  # v4.2.0
  with:
    oauth-client-id: ${{ secrets.TS_CLIENT_ID }}
    oauth-secret: ${{ secrets.TS_CLIENT_SECRET }}
    tags: tag:ci          # required — OAuth nodes must be tagged
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
