---
name: cluster-bash
description: |
  Run bash on the cloudless.gr Pi cluster — pick the right tool (single-node
  ssh, multi-node fanout, file read/write, k3s-aware) and the right fallback
  when the SSH MCP is unavailable. Triggered by phrases like "ssh to omv",
  "run on the cluster", "check both Pis", "what's in /var/log on omv",
  "push a config to omv-ha", "diff a file across nodes", "is the cluster
  reachable", or any cluster-bash / cluster-diagnose intent.
---

# Cluster bash toolkit

The cloudless.gr cluster is two Pis:

| Node       | Hardware            | Role                                    | LAN IP        | Tailnet IP        |
|------------|---------------------|-----------------------------------------|---------------|-------------------|
| `omv`      | Pi 5, SATA SSD      | k3s control plane, primary runner host  | 192.168.1.128 | 100.74.191.58    |
| `omv-ha`   | Pi 4 (mail + deploy proxy; not k3s) | webmail / omv-ha-deploy runner | 192.168.1.130 | 100.95.117.84    |

Both run GitHub Actions self-hosted runners
(`omv` / `omv-build` on main; `omv-ha-deploy` on ha — mail host, not a k3s
node). Reach over Tailscale from cloud sessions and over LAN from Office.

## Tool selection — pick the most specific that fits

The order below is non-negotiable: each rule is more specific (and usually
faster, safer, or more diff-friendly) than the next.

1. **Have a k3s-aware question?** Use `mcp__cloudless-infra__k3s_*`
   (`k3s_get_pods`, `k3s_get_pod_logs`, `k3s_describe_resource`,
   `k3s_restart_deployment`, `k3s_check_ha`). They parse output for you and
   honor the cluster's `KUBECONFIG`.

2. **Need to check live health quickly?**
   `mcp__cloudless-infra__cluster_list_nodes` — returns topology + per-node
   reachability + `uptime`/`hostname`. Use this as the first call in any
   "is the cluster up?" investigation.

3. **Want to compare the same thing on both nodes?**
   `mcp__cloudless-infra__cluster_run_fanout` — runs one command on every
   reachable node in parallel and returns a per-node result list. Ideal for
   "are both runners healthy", "what's the disk usage on each", "is the
   image pre-pulled on both nodes".

4. **Need to read a file (config, log, journal-export)?**
   `mcp__cloudless-infra__cluster_read_file` — SFTP read, capped at 1 MiB,
   returns `{ size, truncated, content }`. No quoting headaches, no shell
   expansion, and you see the true file size even if truncated.

5. **Need to push a small file (script, config snippet, k8s manifest)?**
   `mcp__cloudless-infra__cluster_write_file` — SFTP write, 8 MiB cap,
   refuses `/etc /boot /sys /proc /dev` outright. Far safer than a `tee`
   heredoc because nothing in `content` is interpreted by a shell.

6. **One-off ad-hoc diagnostic on a known node?**
   `mcp__cloudless-infra__cluster_run_command` — the existing wide-open
   shell. Use sparingly: prefer the more specific tools above whenever they
   fit, because they're safer and parse output for you.

7. **MCP unavailable** (no `TAILSCALE_AUTH_KEY` / `OMV_SSH_KEY_CONTENTS`
   in session secrets)? Fall back to the GitHub Actions pattern documented
   in `CLAUDE.md > Cluster Incident Response`: edit a workflow whose
   `on.push.paths` triggers itself, merge to main, the job runs on
   `ubuntu-latest`, connects via the `tailscale/github-action` step, uses
   `KUBECONFIG_B64`, and comments the result on issue #382.

## Safety rules

- **Never paste a destructive command without a dry-run first.** `rm -rf`,
  `kubectl delete --all`, `helm uninstall`, `wipefs`, `mkfs.*`, `truncate`,
  `> /dev/sd*` — all of these need an explicit user-confirmed prompt.
  The MCP server does not enforce a dry-run gate; you do.
- **No `sudo` without `-n`.** Interactive sudo will hang the SSH session
  for 60s until the timeout fires. Always use `sudo -n` (or pre-grant
  passwordless sudo for the specific command).
- **Read before write.** If you're about to overwrite a config file, read
  the current copy with `cluster_read_file` first and diff it in your
  head before calling `cluster_write_file`.
- **Fanout is not a transaction.** `cluster_run_fanout` runs nodes in
  parallel — there is no rollback if one succeeds and the other fails.
  Use it for queries; for stateful writes touch one node at a time.
- **Tailnet IPs change rarely.** The IPs in this skill are baked into the
  MCP `TOPOLOGY` map. If you swap a node's machine, update
  `tools/ssh-mcp/src/sftp.ts` AND `tools/ssh-mcp/src/index.ts`'s `NODES`.

## Common one-liners

```bash
# Disk pressure check — both nodes
cluster_run_fanout("df -h / /var/lib/rancher/k3s 2>/dev/null | tail -n +2")

# Are both runners listening?
cluster_run_fanout("systemctl --no-pager status 'actions.runner.*' | grep -E 'Active:|Loaded:' | head -8")

# Read the active k3s server token (sensitive — admin only)
cluster_read_file("omv", "/var/lib/rancher/k3s/server/token")

# What pods crashed in the last hour?
mcp__cloudless-infra__k3s_get_pods({ namespace: "default" })  # then filter Status

# Pre-pull the new app image on both nodes BEFORE bumping the deployment
cluster_run_fanout("sudo -n /usr/local/bin/k3s crictl pull 278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:<sha>")
```

## When NOT to use these tools

- **You only need GitHub or AWS APIs** — use `mcp__cloudless-infra__gh_*`
  and `mcp__cloudless-infra__aws_*`. They don't go through SSH and have
  no key-rotation footprint.
- **You're editing app source code** — use Edit/Read against the repo,
  push via the standard `claude/<name>` branch + `gh pr create` flow.
- **The user is on Office (WSL2)** and can run the command themselves —
  prefer guiding them in chat over silently SSHing. SSH automation is for
  cloud sessions where the user isn't at a keyboard.

## How the underlying SSH MCP authenticates

Session-start hook reads three secrets from the Claude session config:

| Secret                  | Used for                                                                |
|-------------------------|-------------------------------------------------------------------------|
| `TAILSCALE_AUTH_KEY`    | Joins the sandbox to the tailnet so it can reach `100.74.191.58`       |
| `OMV_SSH_KEY_CONTENTS`  | base64'd `~/.ssh/id_ed25519` for `tbaltzakis@omv` and `@omv-ha`         |
| `GITHUB_PAT`            | Unrelated to SSH but the same hook sets it; needed by `gh_*` tools     |

If any of these are missing, every `mcp__cloudless-infra__*` tool fails
fast with an auth error. The fix is in
`CLAUDE.md > Cloud Session Secrets (one-time setup)`. Do not try to write
the missing secret into a script — point the user at the docs.
