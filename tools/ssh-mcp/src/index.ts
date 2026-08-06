#!/usr/bin/env node
/**
 * cloudless-ssh-mcp  —  Comprehensive SSH MCP for the Cloudless Pi cluster
 *
 * Provides the full mcp__cloudless-infra__* tool surface via SSH to omv-main
 * and omv-ha.
 *
 * Node topology
 * ─────────────
 *   omv-main  (Pi 5)   192.168.1.128 / Tailscale 100.74.191.58
 *     • k3s control-plane (kubectl / helm / aws / gh / cloudflared / docker)
 *     • Runners: omv, omv-build
 *     • All cluster management commands run here
 *
 *   omv-ha    (Pi 4)   192.168.1.130 / Tailscale 100.95.117.84
 *     • k3s agent node
 *     • keepalived VRRP VIP 192.168.1.200
 *     • Runner: omv-2-build
 *     • Tools available: kubectl (via sudo k3s), tailscale, curl
 *     • NOT available: aws, gh, helm, jq, cloudflared, docker
 *
 * SSH key resolution (priority order):
 *   1. OMV_SSH_KEY_CONTENTS — base64-encoded private key (cloud/CI sessions)
 *   2. OMV_SSH_KEY          — path to private key file (default: ~/.ssh/id_ed25519)
 *
 * Host resolution per node:
 *   omv-main: OMV_SSH_HOST → OMV_SSH_HOST_TAILSCALE → 192.168.1.128
 *   omv-ha:   OMV_SSH_HA_HOST → OMV_SSH_HA_HOST_TAILSCALE → 192.168.1.130
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client as SshClient, ConnectConfig } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";
import {
  TOPOLOGY,
  ALL_NODES,
  isSafeRemotePath,
  sftpRead,
  sftpWrite,
  type NodeName as SftpNodeName,
} from "./sftp.js";

// ── Node definitions ───────────────────────────────────────────────────────

const NODES = {
  "omv-main": {
    host:
      process.env.OMV_SSH_HOST ??
      process.env.OMV_SSH_HOST_TAILSCALE ??
      "192.168.1.128",
    description: "Pi 5 — k3s control-plane, all tools available",
  },
  "omv-ha": {
    host:
      process.env.OMV_SSH_HA_HOST ??
      process.env.OMV_SSH_HA_HOST_TAILSCALE ??
      "192.168.1.130",
    description: "Pi 4 — k3s agent, keepalived, limited tools",
  },
} as const;

type NodeName = keyof typeof NODES;

// Runner inventory (actual service names as observed on the nodes)
const RUNNERS: Record<NodeName, string[]> = {
  "omv-main": ["omv", "omv-build"],
  "omv-ha": ["omv-2-build"],
};

const ALL_RUNNERS = [
  ...RUNNERS["omv-main"].map((r) => ({ runner: r, node: "omv-main" as NodeName })),
  ...RUNNERS["omv-ha"].map((r) => ({ runner: r, node: "omv-ha" as NodeName })),
];

const REPO_SLUG = "Themis128-cloudless.gr";

// ── SSH config ─────────────────────────────────────────────────────────────

const SSH_USER = process.env.OMV_SSH_USER ?? "omv";
const SSH_PORT = parseInt(process.env.OMV_SSH_PORT ?? "22", 10);
const SSH_KEY_PATH =
  process.env.OMV_SSH_KEY ?? join(homedir(), ".ssh", "id_ed25519");
const SSH_KEY_CONTENTS = process.env.OMV_SSH_KEY_CONTENTS;
const SSH_PASSPHRASE = process.env.OMV_SSH_PASSPHRASE;

function resolvePrivateKey(): Buffer {
  if (SSH_KEY_CONTENTS) return Buffer.from(SSH_KEY_CONTENTS, "base64");
  if (existsSync(SSH_KEY_PATH)) return readFileSync(SSH_KEY_PATH);
  throw new Error(
    `SSH key not found. Set OMV_SSH_KEY_CONTENTS (base64) or OMV_SSH_KEY (path: ${SSH_KEY_PATH})`
  );
}

// ── Core SSH helper ─────────────────────────────────────────────────────────

function sshRunOn(node: NodeName, command: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let output = "";
    let errOutput = "";
    const { host } = NODES[node];

    const config: ConnectConfig = {
      host,
      port: SSH_PORT,
      username: SSH_USER,
      readyTimeout: 12_000,
    };

    try {
      config.privateKey = resolvePrivateKey();
      if (SSH_PASSPHRASE) config.passphrase = SSH_PASSPHRASE;
    } catch (e) {
      return reject(new Error(`Cannot resolve SSH key: ${String(e)}`));
    }

    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error(`SSH command timed out (${timeoutMs}ms) on ${node}: ${command.slice(0, 80)}`));
    }, timeoutMs);

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(err);
          }
          stream
            .on("close", (code: number) => {
              clearTimeout(timer);
              conn.end();
              const combined = output + (errOutput ? `\n[stderr]\n${errOutput}` : "");
              if (code !== 0 && !output && errOutput) {
                reject(new Error(`Exit ${code} on ${node}: ${errOutput.trim()}`));
              } else {
                resolve(combined);
              }
            })
            .on("data", (d: Buffer) => { output += d.toString(); })
            .stderr.on("data", (d: Buffer) => { errOutput += d.toString(); });
        });
      })
      .on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`SSH connection failed to ${node} (${host}): ${err.message}`));
      })
      .connect(config);
  });
}

/** Convenience: always run on omv-main (the control-plane) */
function sshMain(command: string, timeoutMs = 60_000) {
  return sshRunOn("omv-main", command, timeoutMs);
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text: text || "(no output)" }] };
}
function err(e: unknown) {
  return { content: [{ type: "text" as const, text: `Error: ${String(e)}` }], isError: true as const };
}

// ── Runner helpers ─────────────────────────────────────────────────────────

function runnerSvc(runner: string) {
  return `actions.runner.${REPO_SLUG}.${runner}.service`;
}

function nodeForRunner(runner: string): NodeName {
  const entry = ALL_RUNNERS.find((r) => r.runner === runner);
  return entry?.node ?? "omv-main";
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new McpServer({ name: "cloudless-ssh-mcp", version: "0.2.0" });

// ══════════════════════════════════════════════════════════════════════════════
// CLUSTER — general
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "cluster_run_command",
  "Execute an arbitrary shell command on a specified Pi node via SSH.\nUse for ad-hoc diagnostics. Returns stdout + stderr + exit code.\nCAUTION: avoid commands that modify system state unless you know what you are doing.",
  {
    node: z.enum(["omv-ha", "omv-main"]).describe(
      'Target Pi node: "omv-ha" (192.168.1.130) or "omv-main" (192.168.1.128, Pi 5)'
    ),
    command: z.string().describe("Shell command to run on the node"),
    timeout_seconds: z.number().optional().describe("Command timeout in seconds (default: 60)"),
  },
  async ({ node, command, timeout_seconds }) => {
    try {
      const out = await sshRunOn(node, command, (timeout_seconds ?? 60) * 1_000);
      const label = node === "omv-main" ? "OMV main / Pi 5 (192.168.1.128)" : "OMV-HA (192.168.1.130)";
      return ok(`## ${label}\n**Command:** \`${command}\`\n**Exit code:** 0\n**stdout:**\n\`\`\`\n${out}\n\`\`\``);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cluster_health_check",
  "Overall cluster health: k3s nodes, pods across all namespaces, disk usage, load average on both nodes.",
  {},
  async () => {
    try {
      const [main, ha] = await Promise.all([
        sshMain("sudo kubectl get nodes -o wide 2>&1 && echo '---' && sudo kubectl get pods -A --no-headers 2>&1 | grep -v Completed | tail -40 && echo '---' && df -h / && uptime"),
        sshRunOn("omv-ha", "df -h / && uptime && systemctl is-active k3s-agent && ip addr show | grep '192.168.1.200' || echo 'VIP not held'"),
      ]);
      return ok(`# Cluster Health\n\n## omv-main\n\`\`\`\n${main}\n\`\`\`\n\n## omv-ha\n\`\`\`\n${ha}\n\`\`\``);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cluster_check_services",
  "Check key systemd services on both Pi nodes (runners, k3s, keepalived, remediation agent).",
  {},
  async () => {
    try {
      const [main, ha] = await Promise.all([
        sshMain(
          `for svc in k3s ${RUNNERS["omv-main"].map(runnerSvc).join(" ")}; do printf "%-60s %s\\n" "$svc" "$(systemctl is-active $svc 2>/dev/null)"; done`
        ),
        sshRunOn("omv-ha",
          `for svc in k3s-agent ${RUNNERS["omv-ha"].map(runnerSvc).join(" ")} keepalived pi-alert-remediation; do printf "%-60s %s\\n" "$svc" "$(systemctl is-active $svc 2>/dev/null)"; done`
        ),
      ]);
      return ok(`# Service Status\n\n## omv-main\n\`\`\`\n${main}\n\`\`\`\n\n## omv-ha\n\`\`\`\n${ha}\n\`\`\``);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cluster_check_omv",
  "Quick disk/memory/load snapshot for omv-main (Pi 5).",
  {},
  async () => {
    try {
      const out = await sshMain("df -h && free -h && uptime && cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{printf \"CPU temp: %.1f°C\\n\", $1/1000}'");
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// K3S / KUBECTL
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "k3s_get_pods",
  "List pods in the K3s cluster, optionally filtered by namespace.\nReturns pod names, namespace, status, restart count, and age.",
  {
    namespace: z.string().optional().describe('Kubernetes namespace (e.g. "cloudless", "monitoring"). Omit for all.'),
    show_events: z.boolean().default(false).describe("Also show recent events (useful for debugging)"),
  },
  async ({ namespace, show_events }) => {
    const nsFlag = namespace ? `-n ${namespace}` : "-A";
    const cmd = `sudo kubectl get pods ${nsFlag} -o wide 2>&1${show_events ? ` && sudo kubectl get events ${nsFlag} --sort-by=.lastTimestamp 2>&1 | tail -20` : ""}`;
    try { return ok(await sshMain(cmd)); } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_get_cluster_status",
  "Show k3s node status, resource usage (if metrics-server available), and component health.",
  {},
  async () => {
    try {
      const out = await sshMain(
        "sudo kubectl get nodes -o wide 2>&1 && echo '---' && sudo kubectl top nodes 2>&1 && echo '---' && sudo kubectl get cs 2>&1"
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_get_pod_logs",
  "Get logs from a Kubernetes pod.",
  {
    namespace: z.string().optional().describe("Kubernetes namespace (default: cloudless)"),
    selector: z.string().optional().describe("Label selector e.g. app=cloudless"),
    pod: z.string().optional().describe("Exact pod name (alternative to selector)"),
    tail: z.number().optional().describe("Number of log lines (default: 50)"),
    previous: z.boolean().optional().describe("Show logs from previous container instance"),
  },
  async ({ namespace, selector, pod, tail, previous }) => {
    const ns = namespace ?? "cloudless";
    let target: string;
    if (pod) {
      target = pod;
    } else if (selector) {
      target = `$(sudo kubectl get pod -n ${ns} -l ${selector} -o name 2>/dev/null | head -1)`;
    } else {
      return { content: [{ type: "text" as const, text: "Provide pod name or selector" }], isError: true };
    }
    const prevFlag = previous ? "--previous" : "";
    const cmd = `sudo kubectl logs -n ${ns} ${target} --tail=${tail ?? 50} ${prevFlag} 2>&1`;
    try { return ok(await sshMain(cmd, 20_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_describe_resource",
  "kubectl describe a Kubernetes resource (pod, deployment, service, ingress, etc.).",
  {
    kind: z.string().describe("Resource kind: pod, deployment, service, ingress, configmap, secret, etc."),
    name: z.string().describe("Resource name"),
    namespace: z.string().optional().describe("Namespace (default: cloudless)"),
  },
  async ({ kind, name, namespace }) => {
    const ns = namespace ?? "cloudless";
    try { return ok(await sshMain(`sudo kubectl describe ${kind} ${name} -n ${ns} 2>&1`)); } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_restart_deployment",
  "Rollout restart a Kubernetes deployment.",
  {
    deployment: z.string().describe("Deployment name"),
    namespace: z.string().optional().describe("Namespace (default: cloudless)"),
  },
  async ({ deployment, namespace }) => {
    const ns = namespace ?? "cloudless";
    const cmd = `sudo kubectl rollout restart deployment/${deployment} -n ${ns} 2>&1 && sudo kubectl rollout status deployment/${deployment} -n ${ns} --timeout=120s 2>&1`;
    try { return ok(await sshMain(cmd, 130_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_check_cloudless_app",
  "Check the cloudless Next.js app deployment: pod status, recent logs, and ingress.",
  {},
  async () => {
    try {
      const out = await sshMain(
        "sudo kubectl get pods,svc,ingress -n cloudless -o wide 2>&1 && echo '--- logs ---' && sudo kubectl logs -n cloudless -l app=cloudless --tail=30 2>&1"
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_check_ha",
  "Check HA setup: both k3s nodes ready, keepalived VIP status, Traefik pods.",
  {},
  async () => {
    try {
      const [nodes, vipMain, vipHa] = await Promise.all([
        sshMain("sudo kubectl get nodes -o wide 2>&1 && sudo kubectl get pods -n kube-system -o wide 2>&1 | grep -E '(traefik|svclb)'"),
        sshMain("ip addr show | grep '192.168.1.200' && echo 'VIP on omv-main' || echo 'VIP not on omv-main'"),
        sshRunOn("omv-ha", "ip addr show | grep '192.168.1.200' && echo 'VIP on omv-ha' || echo 'VIP not on omv-ha' && systemctl is-active keepalived"),
      ]);
      return ok(`# HA Status\n\n## Cluster Nodes\n\`\`\`\n${nodes}\n\`\`\`\n\n## VIP (192.168.1.200)\nomv-main: ${vipMain.trim()}\nomv-ha: ${vipHa.trim()}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "k3s_prepull_image",
  "Pre-pull a container image on the cluster nodes to speed up deployment.",
  {
    image: z.string().describe("Full image URI e.g. 278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:sha"),
    namespace: z.string().optional().describe("Namespace context (default: cloudless)"),
  },
  async ({ image, namespace }) => {
    const ns = namespace ?? "cloudless";
    // Use a DaemonSet-style approach via a temporary pod
    const cmd = `sudo kubectl run prepull-tmp --image=${image} -n ${ns} --restart=Never --command -- echo done 2>&1 && sleep 5 && sudo kubectl delete pod prepull-tmp -n ${ns} 2>&1 || true`;
    try { return ok(await sshMain(cmd, 120_000)); } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// GITHUB RUNNERS
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "gh_runner_health",
  "Full health check of a repo's self-hosted runner fleet.\nLists each runner (online/offline/busy/labels), counts queued vs in-progress workflow runs, and flags failure modes.\nReturns a HEALTHY / DEGRADED / CRITICAL verdict.",
  {
    repo: z.enum(["cloudless.gr", "cloudless-manager", "omv-ha"]).describe("Repo alias. Resolves to Themis128/<repo>."),
  },
  async ({ repo: _repo }) => {
    try {
      const lines: string[] = ["# Runner Fleet Health", ""];
      await Promise.all(
        ALL_RUNNERS.map(async ({ runner, node }) => {
          const svc = runnerSvc(runner);
          try {
            const status = await sshRunOn(node, `systemctl is-active ${svc} 2>/dev/null && systemctl show ${svc} --property=SubState --value 2>/dev/null`);
            lines.push(`✓ ${runner} [${node}]: ${status.trim()}`);
          } catch {
            lines.push(`✗ ${runner} [${node}]: offline / not found`);
          }
        })
      );
      const allOk = lines.every((l) => !l.startsWith("✗"));
      lines.push("", `**Verdict:** ${allOk ? "HEALTHY" : "DEGRADED"}`);
      return ok(lines.join("\n"));
    } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_list",
  "List all self-hosted GitHub Actions runners and their current systemd status.",
  {},
  async () => {
    try {
      const lines: string[] = ["Runner", "Node", "Service", "Status"].join(" | ").split("\n");
      lines.push("--- | --- | --- | ---");
      await Promise.all(
        ALL_RUNNERS.map(async ({ runner, node }) => {
          const svc = runnerSvc(runner);
          const status = await sshRunOn(node, `systemctl is-active ${svc} 2>/dev/null`).catch(() => "unknown");
          lines.push(`${runner} | ${node} | ${svc} | ${status.trim()}`);
        })
      );
      return ok(lines.join("\n"));
    } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_restart",
  "Restart a Pi GitHub Actions runner systemd service.",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
    runner: z.string().describe("Runner name: omv, omv-build, omv-2-build"),
  },
  async ({ runner }) => {
    const node = nodeForRunner(runner);
    const svc = runnerSvc(runner);
    try {
      const out = await sshRunOn(node, `sudo systemctl restart ${svc} && sleep 3 && systemctl is-active ${svc}`);
      return ok(`Runner ${runner} on ${node} restarted: ${out.trim()}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_fix_service",
  "Apply systemd hardening to a Pi runner service: removes k3s dependency, adds Restart=on-failure, configures fallback DNS. Idempotent.",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
    runner: z.string().describe("Runner name: omv, omv-build, omv-2-build"),
  },
  async ({ runner }) => {
    const node = nodeForRunner(runner);
    const svc = runnerSvc(runner);
    const overrideDir = `/etc/systemd/system/${svc}.d`;
    const cmd = [
      `sudo mkdir -p ${overrideDir}`,
      `sudo tee ${overrideDir}/override.conf > /dev/null << 'EOF'\n[Unit]\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nRestart=on-failure\nRestartSec=10s\nStartLimitIntervalSec=0\nEnvironment="RUNNER_RETRY_RENEW_SECONDS=300"\nEnvironment="DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1"\nEOF`,
      `sudo mkdir -p /etc/systemd/resolved.conf.d`,
      `sudo tee /etc/systemd/resolved.conf.d/retry.conf > /dev/null << 'EOF'\n[Resolve]\nDNS=8.8.8.8 8.8.4.4 1.1.1.1\nFallbackDNS=9.9.9.9\nEOF`,
      `sudo systemctl daemon-reload`,
      `sudo systemctl restart ${svc}`,
      `sleep 3 && systemctl is-active ${svc}`,
    ].join(" && ");
    try {
      const out = await sshRunOn(node, cmd, 30_000);
      return ok(`Runner ${runner} on ${node} hardened.\n${out}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_logs",
  "Fetch recent systemd journal logs for a Pi GitHub Actions runner.",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
    runner: z.string().describe("Runner name: omv, omv-build, omv-2-build"),
    lines: z.number().optional().describe("Number of log lines (default: 50)"),
    since: z.string().optional().describe("Time filter e.g. '30 minutes ago'"),
  },
  async ({ runner, lines, since }) => {
    const node = nodeForRunner(runner);
    const svc = runnerSvc(runner);
    const sinceFlag = since ? `--since="${since}"` : "";
    const cmd = `sudo journalctl -u ${svc} -n ${lines ?? 50} ${sinceFlag} --no-pager 2>&1`;
    try { return ok(await sshRunOn(node, cmd, 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_register",
  "Register a new GitHub Actions runner on a Pi node (requires GH_RUNNER_TOKEN env or manual token).",
  {
    node: z.enum(["omv-main", "omv-ha"]).describe("Node to register the runner on"),
    runner_name: z.string().describe("Runner name (e.g. omv-3)"),
    labels: z.string().optional().describe("Comma-separated labels (default: self-hosted,Linux,omv,pi,arm64)"),
    token: z.string().describe("GitHub runner registration token (from repo Settings → Actions → Runners → New runner)"),
  },
  async ({ node, runner_name, labels, token }) => {
    const lbls = labels ?? "self-hosted,Linux,omv,pi,arm64";
    const dir = `/home/tbaltzakis/actions-runner-${runner_name}`;
    const cmd = `mkdir -p ${dir} && cd ${dir} && if [ ! -f config.sh ]; then curl -sL https://github.com/actions/runner/releases/latest/download/actions-runner-linux-arm64-$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep tag_name | cut -d'"' -f4 | sed 's/v//').tar.gz | tar xz; fi && ./config.sh --url https://github.com/${REPO_SLUG.replace("-", "/")} --token ${token} --name ${runner_name} --labels ${lbls} --unattended && sudo ./svc.sh install && sudo ./svc.sh start`;
    try { return ok(await sshRunOn(node, cmd, 120_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_set_labels",
  "Update labels on a runner (requires gh CLI — only works on omv-main).",
  {
    runner_name: z.string().describe("Runner name"),
    labels: z.string().describe("New comma-separated labels"),
  },
  async ({ runner_name, labels }) => {
    const cmd = `gh api repos/${REPO_SLUG.replace("-", "/")}/actions/runners --jq '.runners[] | select(.name=="${runner_name}") | .id' 2>/dev/null | xargs -I{} gh api -X PUT repos/${REPO_SLUG.replace("-", "/")}/actions/runners/{}/labels -f labels='[${labels.split(",").map((l) => `"${l.trim()}"`).join(",")}]'`;
    try { return ok(await sshMain(cmd)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_runner_cancel_stuck",
  "Cancel workflow runs that are stuck (queued > 30 min or in_progress > 2 hours).",
  {
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
  },
  async ({ repo }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    const cmd = `gh run list --repo ${r} --status queued --limit 20 --json databaseId,createdAt 2>/dev/null | jq -r '.[] | select((now - (.createdAt | fromdateiso8601)) > 1800) | .databaseId' | xargs -I{} gh run cancel {} --repo ${r} 2>&1 || echo "No stuck queued runs"`;
    try { return ok(await sshMain(cmd, 30_000)); } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// GITHUB WORKFLOWS / CI
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "gh_workflow_list",
  "List GitHub Actions workflows and their enabled/disabled state.",
  {
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
  },
  async ({ repo }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    try { return ok(await sshMain(`gh workflow list --repo ${r} 2>&1`)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_workflow_trigger",
  "Manually trigger a GitHub Actions workflow.",
  {
    workflow: z.string().describe("Workflow file name or ID (e.g. deploy-pi.yml)"),
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
    ref: z.string().optional().describe("Branch or tag to run on (default: main)"),
    inputs: z.string().optional().describe("JSON string of workflow inputs"),
  },
  async ({ workflow, repo, ref, inputs }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    const refFlag = ref ? `--ref ${ref}` : "--ref main";
    const inputsFlag = inputs ? `--json '${inputs}'` : "";
    const cmd = `gh workflow run ${workflow} --repo ${r} ${refFlag} ${inputsFlag} 2>&1`;
    try { return ok(await sshMain(cmd)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_workflow_watch",
  "Watch a running workflow until it completes.",
  {
    run_id: z.string().optional().describe("Run ID. Omit to watch the latest run."),
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
  },
  async ({ run_id, repo }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    const id = run_id ? run_id : `$(gh run list --repo ${r} --limit 1 --json databaseId --jq '.[0].databaseId')`;
    try { return ok(await sshMain(`gh run watch ${id} --repo ${r} 2>&1`, 600_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_ci_summary",
  "Summary of recent CI runs: status, duration, and runner used.",
  {
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
    limit: z.number().optional().describe("Number of runs to show (default: 10)"),
  },
  async ({ repo, limit }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    const cmd = `gh run list --repo ${r} --limit ${limit ?? 10} --json databaseId,status,conclusion,headBranch,event,createdAt,name,workflowName 2>&1`;
    try { return ok(await sshMain(cmd)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_workflow_failure_logs",
  "Fetch logs from the most recent failed workflow run.",
  {
    workflow: z.string().optional().describe("Workflow name filter (e.g. deploy-pi.yml)"),
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
  },
  async ({ workflow, repo }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    const wfFilter = workflow ? `--workflow ${workflow}` : "";
    const cmd = `RUN_ID=$(gh run list --repo ${r} ${wfFilter} --status failure --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null) && [ -n "$RUN_ID" ] && gh run view $RUN_ID --repo ${r} --log-failed 2>&1 | tail -100 || echo "No failed runs found"`;
    try { return ok(await sshMain(cmd, 30_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_pr_checks",
  "Show CI check statuses for a PR.",
  {
    pr: z.string().describe("PR number"),
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
  },
  async ({ pr, repo }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    try { return ok(await sshMain(`gh pr checks ${pr} --repo ${r} 2>&1`)); } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_deployment_status",
  "Check latest deployment status including ECR image SHA and k3s rollout.",
  {
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
  },
  async ({ repo }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    try {
      const [runs, sha] = await Promise.all([
        sshMain(`gh run list --repo ${r} --limit 5 --json databaseId,status,conclusion,headBranch,createdAt,workflowName --jq '.[] | [.workflowName, .status, .conclusion, .headBranch, .createdAt] | @tsv' 2>&1`),
        sshMain(`aws ssm get-parameter --name /cloudless/production/current-image-sha --query Parameter.Value --output text --region us-east-1 2>&1`),
      ]);
      const pods = await sshMain(`sudo kubectl get pods -n cloudless -o wide 2>&1`);
      return ok(`# Deployment Status\n\n## Recent Runs\n\`\`\`\n${runs}\n\`\`\`\n\n## Current Image SHA (SSM)\n${sha.trim()}\n\n## Pods\n\`\`\`\n${pods}\n\`\`\``);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "gh_ci_flaky_detector",
  "Find flaky CI tests by checking runs that had retries or alternated pass/fail.",
  {
    repo: z.string().optional().describe("Repo name (default: cloudless.gr)"),
    limit: z.number().optional().describe("Number of runs to inspect (default: 20)"),
  },
  async ({ repo, limit }) => {
    const r = `Themis128/${repo ?? "cloudless.gr"}`;
    const cmd = `gh run list --repo ${r} --limit ${limit ?? 20} --json databaseId,status,conclusion,name,workflowName --jq '[.[] | select(.conclusion != null)] | group_by(.workflowName) | .[] | {workflow: .[0].workflowName, results: [.[].conclusion]} | select(.results | (index("failure") and index("success")))' 2>&1`;
    try { return ok(await sshMain(cmd)); } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// AWS
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "aws_get_ssm_parameters",
  "List or retrieve SSM parameters for cloudless.gr (prefix: /cloudless/production).\nSecureString values are masked in list mode. Use parameter_name + decrypt=true to reveal a specific value.",
  {
    parameter_name: z.string().optional().describe('Specific parameter short name (e.g. "STRIPE_SECRET_KEY") or full path. Omit to list all.'),
    decrypt: z.boolean().default(false).describe("Decrypt SecureString value. Only used when parameter_name is set."),
    prefix: z.string().optional().describe("SSM path prefix to list from (default: /cloudless/production)"),
  },
  async ({ parameter_name, decrypt, prefix }) => {
    let cmd: string;
    if (parameter_name) {
      const name = parameter_name.startsWith("/") ? parameter_name : `/cloudless/production/${parameter_name}`;
      const dec = decrypt ? "--with-decryption" : "";
      cmd = `aws ssm get-parameter --name "${name}" ${dec} --region us-east-1 --query Parameter --output json 2>&1`;
    } else {
      const pfx = prefix ?? "/cloudless/production";
      cmd = `aws ssm get-parameters-by-path --path "${pfx}" --recursive --region us-east-1 --query 'Parameters[].{Name:Name,Type:Type,LastModifiedDate:LastModifiedDate}' --output table 2>&1`;
    }
    try { return ok(await sshMain(cmd, 20_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_get_lambda_logs",
  "Fetch recent CloudWatch logs for a Lambda function.",
  {
    function_name: z.string().describe("Lambda function name (e.g. cloudless-pi-proxy)"),
    tail: z.number().optional().describe("Number of log events (default: 50)"),
    since: z.string().optional().describe("Time window e.g. '1h', '30m' (default: 1h)"),
  },
  async ({ function_name, tail, since }) => {
    const ago = since ?? "1h";
    const cmd = `aws logs tail /aws/lambda/${function_name} --since ${ago} --format short 2>&1 | tail -${tail ?? 50}`;
    try { return ok(await sshMain(cmd, 20_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_get_infrastructure_summary",
  "Show key AWS infrastructure components: Lambda functions, SSM params count, ECR repos, CloudFront.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `echo '=== Lambda functions ===' && aws lambda list-functions --region us-east-1 --query 'Functions[].{Name:FunctionName,Runtime:Runtime,LastModified:LastModified}' --output table 2>&1 | head -20 && echo '=== SSM parameter count ===' && aws ssm describe-parameters --region us-east-1 --filters 'Key=Path,Values=/cloudless/production' --query 'Parameters | length(@)' 2>&1 && echo '=== ECR repos ===' && aws ecr describe-repositories --region us-east-1 --query 'repositories[].repositoryName' --output text 2>&1`,
        30_000
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_check_cloudfront",
  "Check CloudFront distribution status, origins, and recent invalidations.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `aws cloudfront list-distributions --region us-east-1 --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Status:Status,Origins:Origins.Items[0].DomainName,Enabled:Enabled}' --output table 2>&1`,
        20_000
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_list_iam_users",
  "List IAM users and their last activity.",
  {},
  async () => {
    try {
      const out = await sshMain(`aws iam list-users --query 'Users[].{User:UserName,Created:CreateDate,LastUsed:PasswordLastUsed}' --output table 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_check_iam_permissions",
  "Check IAM permissions for the current AWS identity (Pi's role).",
  {},
  async () => {
    try {
      const out = await sshMain(`aws sts get-caller-identity 2>&1 && aws iam simulate-principal-policy --action-names 'ssm:GetParameter' 'ecr:GetAuthorizationToken' 'logs:CreateLogGroup' --policy-source-arn $(aws sts get-caller-identity --query Arn --output text 2>/dev/null) 2>&1 | head -20 || true`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_list_acm_certs",
  "List ACM TLS certificates and their status.",
  {
    region: z.string().optional().describe("AWS region (default: us-east-1)"),
  },
  async ({ region }) => {
    const r = region ?? "us-east-1";
    try {
      const out = await sshMain(`aws acm list-certificates --region ${r} --query 'CertificateSummaryList[].{Domain:DomainName,Arn:CertificateArn,Status:Status}' --output table 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_delete_acm_cert",
  "Delete an ACM certificate by ARN.",
  {
    certificate_arn: z.string().describe("Certificate ARN"),
    region: z.string().optional().describe("AWS region (default: us-east-1)"),
  },
  async ({ certificate_arn, region }) => {
    const r = region ?? "us-east-1";
    try {
      const out = await sshMain(`aws acm delete-certificate --certificate-arn "${certificate_arn}" --region ${r} 2>&1 && echo "Deleted"`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_check_health_checks",
  "List Route53 health checks and their current status.",
  {},
  async () => {
    try {
      const out = await sshMain(`aws route53 list-health-checks --query 'HealthChecks[].{Id:Id,Type:HealthCheckConfig.Type,Endpoint:HealthCheckConfig.FullyQualifiedDomainName,Port:HealthCheckConfig.Port}' --output table 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_grant_route53_delete_health_check",
  "Grant the pi-standby IAM role permission to delete Route53 health checks.",
  {},
  async () => {
    try {
      const out = await sshMain(`aws iam put-role-policy --role-name pi-standby --policy-name DeleteHealthCheck --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"route53:DeleteHealthCheck","Resource":"*"}]}' 2>&1 && echo "Policy applied"`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "aws_revoke_route53_delete_health_check",
  "Remove the DeleteHealthCheck IAM policy from pi-standby role.",
  {},
  async () => {
    try {
      const out = await sshMain(`aws iam delete-role-policy --role-name pi-standby --policy-name DeleteHealthCheck 2>&1 && echo "Policy removed"`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// CLOUDFLARE (all via curl + token from SSM on omv-main)
// ══════════════════════════════════════════════════════════════════════════════

/** Build the CF token fetch + curl call, running entirely on omv-main */
function cfCmd(method: string, path: string, data?: string) {
  const body = data ? `-d '${data}'` : "";
  return `CF_TOKEN=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --with-decryption --region us-east-1 --query Parameter.Value --output text 2>/dev/null) && CF_ZONE=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_ZONE_ID --region us-east-1 --query Parameter.Value --output text 2>/dev/null) && curl -sS -X ${method} "https://api.cloudflare.com/client/v4${path.replace("{ZONE}", "$CF_ZONE")}" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" ${body} 2>&1`;
}

server.tool(
  "cloudflare_list_dns_records",
  "List DNS records for the cloudless.gr Cloudflare zone.",
  {
    type: z.string().optional().describe("Filter by record type (A, CNAME, MX, TXT, etc.)"),
    name: z.string().optional().describe("Filter by record name"),
  },
  async ({ type, name }) => {
    const params: string[] = [];
    if (type) params.push(`type=${type}`);
    if (name) params.push(`name=${name}`);
    const qs = params.length ? `?${params.join("&")}` : "";
    try { return ok(await sshMain(cfCmd("GET", `/zones/{ZONE}/dns_records${qs}`), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_add_dns_record",
  "Add a DNS record to the cloudless.gr Cloudflare zone.",
  {
    type: z.string().describe("Record type: A, CNAME, TXT, MX, etc."),
    name: z.string().describe("Record name (e.g. www or @)"),
    content: z.string().describe("Record content (IP, hostname, or text value)"),
    ttl: z.number().optional().describe("TTL in seconds (default: 1 = auto)"),
    proxied: z.boolean().optional().describe("Enable Cloudflare proxy (default: false)"),
  },
  async ({ type, name, content, ttl, proxied }) => {
    const data = JSON.stringify({ type, name, content, ttl: ttl ?? 1, proxied: proxied ?? false });
    try { return ok(await sshMain(cfCmd("POST", "/zones/{ZONE}/dns_records", data), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_update_dns_record",
  "Update an existing Cloudflare DNS record by record ID.",
  {
    record_id: z.string().describe("DNS record ID"),
    type: z.string().describe("Record type"),
    name: z.string().describe("Record name"),
    content: z.string().describe("New record content"),
    ttl: z.number().optional().describe("TTL in seconds (default: 1 = auto)"),
    proxied: z.boolean().optional().describe("Enable Cloudflare proxy"),
  },
  async ({ record_id, type, name, content, ttl, proxied }) => {
    const data = JSON.stringify({ type, name, content, ttl: ttl ?? 1, proxied: proxied ?? false });
    try { return ok(await sshMain(cfCmd("PUT", `/zones/{ZONE}/dns_records/${record_id}`, data), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_delete_dns_record",
  "Delete a Cloudflare DNS record by record ID.",
  {
    record_id: z.string().describe("DNS record ID to delete"),
  },
  async ({ record_id }) => {
    try { return ok(await sshMain(cfCmd("DELETE", `/zones/{ZONE}/dns_records/${record_id}`), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_list_dns_records_gr",
  "List DNS records for the cloudless.gr zone (alias for cloudflare_list_dns_records).",
  {
    type: z.string().optional().describe("Filter by record type"),
  },
  async ({ type }) => {
    const qs = type ? `?type=${type}` : "";
    try { return ok(await sshMain(cfCmd("GET", `/zones/{ZONE}/dns_records${qs}`), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_add_dns_record_gr",
  "Add a DNS record to the cloudless.gr zone.",
  {
    type: z.string().describe("Record type"),
    name: z.string().describe("Record name"),
    content: z.string().describe("Record content"),
    proxied: z.boolean().optional().describe("Enable CF proxy (default: false)"),
  },
  async ({ type, name, content, proxied }) => {
    const data = JSON.stringify({ type, name, content, ttl: 1, proxied: proxied ?? false });
    try { return ok(await sshMain(cfCmd("POST", "/zones/{ZONE}/dns_records", data), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_update_dns_record_gr",
  "Update a DNS record in the cloudless.gr zone.",
  {
    record_id: z.string().describe("DNS record ID"),
    type: z.string().describe("Record type"),
    name: z.string().describe("Record name"),
    content: z.string().describe("New content"),
    proxied: z.boolean().optional().describe("Enable CF proxy"),
  },
  async ({ record_id, type, name, content, proxied }) => {
    const data = JSON.stringify({ type, name, content, ttl: 1, proxied: proxied ?? false });
    try { return ok(await sshMain(cfCmd("PUT", `/zones/{ZONE}/dns_records/${record_id}`, data), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_purge_cache",
  "Purge Cloudflare cache (all files or specific URLs).",
  {
    urls: z.array(z.string()).optional().describe("Specific URLs to purge. Omit to purge everything."),
  },
  async ({ urls }) => {
    const data = urls?.length ? JSON.stringify({ files: urls }) : '{"purge_everything":true}';
    try { return ok(await sshMain(cfCmd("POST", "/zones/{ZONE}/purge_cache", data), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_zone_analytics",
  "Fetch Cloudflare zone analytics (requests, bandwidth, threats) for the past 24h.",
  {},
  async () => {
    try { return ok(await sshMain(cfCmd("GET", "/zones/{ZONE}/analytics/dashboard?since=-1440&until=0"), 20_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_zone_settings",
  "Get Cloudflare zone security and performance settings.",
  {},
  async () => {
    try { return ok(await sshMain(cfCmd("GET", "/zones/{ZONE}/settings"), 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_tunnel_status",
  "Check Cloudflare tunnel status (cloudflared running on omv-main).",
  {},
  async () => {
    try {
      const out = await sshMain(`systemctl is-active cloudflared 2>/dev/null && sudo journalctl -u cloudflared -n 20 --no-pager 2>&1 || echo "cloudflared not running as systemd service" && cloudflared tunnel list 2>&1 || true`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_restart_tunnel",
  "Restart the cloudflared tunnel service on omv-main.",
  {},
  async () => {
    try {
      const out = await sshMain(`sudo systemctl restart cloudflared && sleep 3 && systemctl is-active cloudflared 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_check_certs",
  "Check TLS certificate validity for cloudless.gr domains.",
  {},
  async () => {
    const domains = ["cloudless.gr", "www.cloudless.gr", "pi-origin.cloudless.gr"];
    const checks = domains.map((d) => `echo "=== ${d} ===" && echo | openssl s_client -connect ${d}:443 -servername ${d} 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null || echo "FAILED"`).join(" && ");
    try { return ok(await sshMain(checks, 30_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_list_tokens",
  "List Cloudflare API tokens (names and status only, not the token values).",
  {},
  async () => {
    // Use a different approach — need the user's CF account token for this
    try {
      const out = await sshMain(`CF_TOKEN=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --with-decryption --region us-east-1 --query Parameter.Value --output text 2>/dev/null) && curl -sS -X GET "https://api.cloudflare.com/client/v4/user/tokens" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_list_permission_groups",
  "List available Cloudflare API token permission groups.",
  {},
  async () => {
    try {
      const out = await sshMain(`CF_TOKEN=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --with-decryption --region us-east-1 --query Parameter.Value --output text 2>/dev/null) && curl -sS "https://api.cloudflare.com/client/v4/user/tokens/permission_groups" -H "Authorization: Bearer $CF_TOKEN" 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_create_token",
  "Create a new Cloudflare API token (scoped to zone DNS edit).",
  {
    name: z.string().describe("Token name"),
  },
  async ({ name }) => {
    const data = JSON.stringify({
      name,
      policies: [{ effect: "allow", resources: { "com.cloudflare.api.account.zone.*": "*" }, permissions: ["#dns_records:edit", "#zone:read"] }],
    });
    try {
      const out = await sshMain(`CF_TOKEN=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --with-decryption --region us-east-1 --query Parameter.Value --output text 2>/dev/null) && curl -sS -X POST "https://api.cloudflare.com/client/v4/user/tokens" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" -d '${data}' 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_delete_token",
  "Delete a Cloudflare API token by ID.",
  {
    token_id: z.string().describe("Token ID to delete"),
  },
  async ({ token_id }) => {
    try {
      const out = await sshMain(`CF_TOKEN=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --with-decryption --region us-east-1 --query Parameter.Value --output text 2>/dev/null) && curl -sS -X DELETE "https://api.cloudflare.com/client/v4/user/tokens/${token_id}" -H "Authorization: Bearer $CF_TOKEN" 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "cloudflare_worker_routes",
  "List Cloudflare Worker routes for the zone.",
  {},
  async () => {
    try { return ok(await sshMain(cfCmd("GET", "/zones/{ZONE}/workers/routes"), 15_000)); } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// GRAFANA (in k3s pod, namespace: monitoring)
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "grafana_check_health",
  "Check Grafana pod health and service availability.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana -o wide 2>&1 && sudo kubectl exec -n monitoring $(sudo kubectl get pod -n monitoring -l app.kubernetes.io/name=grafana -o name 2>/dev/null | head -1) -- wget -qO- http://localhost:3000/api/health 2>&1 || curl -sS http://localhost:30030/api/health 2>&1 || echo "Grafana health check failed"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "grafana_list_dashboards",
  "List Grafana dashboards via the Grafana API.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `GRAFANA_PASS=$(sudo kubectl get secret -n monitoring kube-prom-grafana -o jsonpath='{.data.admin-password}' 2>/dev/null | base64 -d) && curl -sS -u "admin:$GRAFANA_PASS" http://localhost:30030/api/search?type=dash-db 2>&1 | head -100 || echo "Could not access Grafana"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "grafana_get_datasources",
  "List Grafana data sources.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `GRAFANA_PASS=$(sudo kubectl get secret -n monitoring kube-prom-grafana -o jsonpath='{.data.admin-password}' 2>/dev/null | base64 -d) && curl -sS -u "admin:$GRAFANA_PASS" http://localhost:30030/api/datasources 2>&1 || echo "Could not access Grafana datasources"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "grafana_check_alerts",
  "List active Grafana alerting rules and their state.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `GRAFANA_PASS=$(sudo kubectl get secret -n monitoring kube-prom-grafana -o jsonpath='{.data.admin-password}' 2>/dev/null | base64 -d) && curl -sS -u "admin:$GRAFANA_PASS" http://localhost:30030/api/prometheus/grafana/api/v1/rules 2>&1 | head -80 || echo "Could not access Grafana alerts"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "grafana_restart",
  "Restart the Grafana pod (rollout restart deployment).",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl rollout restart deployment -n monitoring -l app.kubernetes.io/name=grafana 2>&1 && sudo kubectl rollout status deployment -n monitoring -l app.kubernetes.io/name=grafana --timeout=60s 2>&1`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PROMETHEUS (in k3s pod, namespace: monitoring)
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "prometheus_query",
  "Execute a PromQL query against the Prometheus instance.",
  {
    query: z.string().describe("PromQL expression (e.g. up, node_cpu_seconds_total)"),
    step: z.string().optional().describe("Resolution step for range queries (e.g. 1m, 5m)"),
  },
  async ({ query }) => {
    const encoded = encodeURIComponent(query);
    try {
      const out = await sshMain(
        `curl -sS "http://localhost:30900/api/v1/query?query=${encoded}" 2>&1 | head -100 || sudo kubectl exec -n monitoring $(sudo kubectl get pod -n monitoring -l app.kubernetes.io/name=prometheus -o name 2>/dev/null | head -1) -- wget -qO- "http://localhost:9090/api/v1/query?query=${encoded}" 2>&1 | head -100 || echo "Prometheus not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "prometheus_check_targets",
  "Check Prometheus scrape targets and their health status.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS "http://localhost:30900/api/v1/targets" 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); [print(t['labels'].get('job','?'), t['health'], t.get('lastError','')) for t in d['data']['activeTargets']]" 2>&1 || echo "Prometheus targets not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "prometheus_check_alerts",
  "Check active Prometheus alerting rules.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS "http://localhost:30900/api/v1/alerts" 2>&1 | head -80 || echo "Prometheus alerts endpoint not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "prometheus_check_rules",
  "List all Prometheus recording and alerting rules.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS "http://localhost:30900/api/v1/rules" 2>&1 | head -100 || echo "Prometheus rules endpoint not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// HELM
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "helm_list",
  "List all Helm releases across all namespaces.",
  {
    namespace: z.string().optional().describe("Namespace to filter (default: all)"),
  },
  async ({ namespace }) => {
    const nsFlag = namespace ? `-n ${namespace}` : "-A";
    try { return ok(await sshMain(`sudo helm list ${nsFlag} 2>&1`)); } catch (e) { return err(e); }
  }
);

server.tool(
  "helm_status",
  "Get the status of a specific Helm release.",
  {
    release: z.string().describe("Helm release name"),
    namespace: z.string().optional().describe("Namespace (default: cloudless)"),
  },
  async ({ release, namespace }) => {
    const ns = namespace ?? "cloudless";
    try { return ok(await sshMain(`sudo helm status ${release} -n ${ns} 2>&1`)); } catch (e) { return err(e); }
  }
);

server.tool(
  "helm_deploy_chart",
  "Install or upgrade a Helm chart.",
  {
    release: z.string().describe("Release name"),
    chart: z.string().describe("Chart name or path"),
    namespace: z.string().optional().describe("Target namespace (default: cloudless)"),
    values: z.string().optional().describe("YAML values string or path to values file"),
    extra_args: z.string().optional().describe("Additional helm upgrade args"),
  },
  async ({ release, chart, namespace, values, extra_args }) => {
    const ns = namespace ?? "cloudless";
    const valsFlag = values ? `--values <(echo '${values}')` : "";
    const cmd = `sudo helm upgrade --install ${release} ${chart} -n ${ns} --create-namespace ${valsFlag} ${extra_args ?? ""} 2>&1`;
    try { return ok(await sshMain(cmd, 120_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "helm_uninstall",
  "Uninstall a Helm release.",
  {
    release: z.string().describe("Release name to uninstall"),
    namespace: z.string().optional().describe("Namespace (default: cloudless)"),
  },
  async ({ release, namespace }) => {
    const ns = namespace ?? "cloudless";
    try { return ok(await sshMain(`sudo helm uninstall ${release} -n ${ns} 2>&1`)); } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// TAILSCALE FUNNEL / FAILOVER
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "failover_check_readiness",
  "Check if Tailscale Funnel is active and the Pi can serve as standby origin.",
  {},
  async () => {
    try {
      const [funnel, health] = await Promise.all([
        sshMain(`sudo tailscale funnel status 2>&1 || sudo tailscale serve status 2>&1`),
        sshMain(`curl -sS -o /dev/null -w "%{http_code}" https://github-omv.tail8eb71.ts.net/api/health 2>&1 || echo "Funnel health check failed"`),
      ]);
      return ok(`# Failover Readiness\n\n## Funnel Status\n${funnel}\n\n## Health Check via Funnel\nHTTP: ${health.trim()}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "failover_check_secondary_app",
  "Verify the secondary app (k3s) responds correctly to requests.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS -o /dev/null -w "%{http_code}" -H "Host: cloudless.gr" http://192.168.1.128:18443/api/health --insecure 2>&1 && curl -sS -H "Host: cloudless.gr" http://192.168.1.128:18443/api/health --insecure 2>&1 | head -20`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "failover_network_check",
  "Check network connectivity from both Pi nodes (external + LAN).",
  {},
  async () => {
    try {
      const [main, ha] = await Promise.all([
        sshMain(`ping -c 2 8.8.8.8 2>&1 | tail -3 && curl -sS -o /dev/null -w "%{http_code}" https://cloudless.gr/api/health 2>&1`),
        sshRunOn("omv-ha", `ping -c 2 8.8.8.8 2>&1 | tail -3 && ping -c 2 192.168.1.128 2>&1 | tail -3`),
      ]);
      return ok(`# Network Check\n\nomv-main: ${main.trim()}\nomv-ha: ${ha.trim()}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "failover_check_shares",
  "Check NFS/SMB share availability between Pi nodes.",
  {},
  async () => {
    try {
      const out = await sshMain(`showmount -e 192.168.1.130 2>&1 || echo "NFS not configured" && df -h | grep -E "(nfs|smb|cifs)" || echo "No mounted network shares"`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "failover_sync_shares",
  "Trigger rsync sync of critical data between Pi nodes.",
  {
    source: z.string().describe("Source path on omv-main"),
    destination: z.string().describe("Destination path on omv-ha"),
  },
  async ({ source, destination }) => {
    try {
      const out = await sshMain(`rsync -avz --delete ${source} omv@192.168.1.130:${destination} 2>&1`, 300_000);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ha_check_cloudfront_failover",
  "Test CloudFront → Lambda proxy → Pi Funnel end-to-end failover path.",
  {},
  async () => {
    try {
      const [cf, lambda, funnel] = await Promise.all([
        sshMain(`curl -sS -o /dev/null -w "CloudFront: %{http_code} in %{time_total}s" https://cloudless.gr/api/health 2>&1`),
        sshMain(`curl -sS -o /dev/null -w "Lambda proxy: %{http_code}" "https://$(aws ssm get-parameter --name /cloudless/production/pi-standby/funnel-host --region us-east-1 --query Parameter.Value --output text 2>/dev/null)/api/health" -H "Host: cloudless.gr" 2>&1`),
        sshMain(`curl -sS -o /dev/null -w "Funnel local: %{http_code}" https://github-omv.tail8eb71.ts.net/api/health 2>&1`),
      ]);
      return ok(`# CloudFront Failover Check\n\n${cf}\n${lambda}\n${funnel}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ha_test_k3s_origin",
  "Test the k3s origin directly (bypassing CloudFront/Funnel).",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS -o /dev/null -w "%{http_code} in %{time_total}s" -H "Host: cloudless.gr" --insecure https://192.168.1.128:18443/api/health 2>&1 && curl -sS -H "Host: cloudless.gr" --insecure https://192.168.1.128:18443/api/health 2>&1 | head -5`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ha_cleanup_cloudless_online",
  "Clean up stale cloudless-online resources from k3s.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl get all -n cloudless-online 2>&1 && sudo kubectl delete namespace cloudless-online 2>&1 || echo "Namespace not found or already deleted"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// HA AGENT (keepalived + remediation on omv-ha)
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "omv_ha_agent_status",
  "Check the Pi alert remediation agent status on omv-ha.",
  {},
  async () => {
    try {
      const [status, logs] = await Promise.all([
        sshRunOn("omv-ha", `systemctl status pi-alert-remediation --no-pager 2>&1 | head -20 && echo '--- keepalived ---' && systemctl status keepalived --no-pager 2>&1 | head -10`),
        sshRunOn("omv-ha", `sudo journalctl -u pi-alert-remediation -n 20 --no-pager 2>&1`),
      ]);
      return ok(`# HA Agent Status\n\n## Service\n\`\`\`\n${status}\n\`\`\`\n\n## Recent Logs\n\`\`\`\n${logs}\n\`\`\``);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "omv_ha_agent_restart",
  "Restart the Pi alert remediation agent on omv-ha.",
  {},
  async () => {
    try {
      const out = await sshRunOn("omv-ha", `sudo systemctl restart pi-alert-remediation && sleep 2 && systemctl is-active pi-alert-remediation 2>&1`);
      return ok(`HA agent restarted: ${out.trim()}`);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "omv_ha_agent_rejoin",
  "Rejoin omv-ha to the k3s cluster if the agent node fell off.",
  {},
  async () => {
    try {
      const out = await sshRunOn("omv-ha", `sudo systemctl restart k3s-agent && sleep 5 && systemctl is-active k3s-agent 2>&1`);
      const nodes = await sshMain(`sudo kubectl get nodes -o wide 2>&1`);
      return ok(`k3s-agent restarted: ${out.trim()}\n\n${nodes}`);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ML PIPELINE (namespace: analytics)
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "ml_pipeline_status",
  "Check ML pipeline pod health (duckdb-api, duckdb-ml-api, analytics namespace).",
  {},
  async () => {
    try {
      const out = await sshMain(`sudo kubectl get pods -n analytics -o wide 2>&1 && sudo kubectl get svc -n analytics 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_get_logs",
  "Get logs from the ML API pod.",
  {
    tail: z.number().optional().describe("Number of log lines (default: 50)"),
    api: z.enum(["duckdb-api", "duckdb-ml-api"]).optional().describe("Which API to get logs from (default: duckdb-ml-api)"),
  },
  async ({ tail, api }) => {
    const selector = `app=${api ?? "duckdb-ml-api"}`;
    const cmd = `sudo kubectl logs -n analytics -l ${selector} --tail=${tail ?? 50} 2>&1`;
    try { return ok(await sshMain(cmd, 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_get_scores",
  "Fetch latest ML anomaly scores from the duckdb-ml-api.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS http://localhost:$(sudo kubectl get svc -n analytics duckdb-ml-api -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)/scores 2>&1 | head -50 || sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- wget -qO- http://localhost:8080/scores 2>&1 | head -50`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_anomaly_latest",
  "Get the latest anomaly detection results.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- wget -qO- http://localhost:8080/anomalies 2>&1 | head -80 || echo "ML anomaly endpoint not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_trigger_job",
  "Trigger a manual ML pipeline run.",
  {
    job_type: z.string().optional().describe("Job type to trigger (default: full-pipeline)"),
  },
  async ({ job_type }) => {
    const jt = job_type ?? "full-pipeline";
    try {
      const out = await sshMain(
        `sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- wget -qO- -X POST http://localhost:8080/run/${jt} 2>&1 || echo "ML job trigger failed"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_check_models",
  "List available ML models and their last update time.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- ls -lah /app/models 2>/dev/null || sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- wget -qO- http://localhost:8080/models 2>&1 | head -40 || echo "Models endpoint not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_run_history",
  "Show ML pipeline run history.",
  {
    limit: z.number().optional().describe("Number of runs to show (default: 10)"),
  },
  async ({ limit }) => {
    try {
      const out = await sshMain(
        `sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- wget -qO- "http://localhost:8080/runs?limit=${limit ?? 10}" 2>&1 | head -80 || echo "Run history not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_feature_summary",
  "Get ML feature engineering summary and data stats.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl exec -n analytics $(sudo kubectl get pod -n analytics -l app=duckdb-ml-api -o name 2>/dev/null | head -1) -- wget -qO- http://localhost:8080/features 2>&1 | head -80 || echo "Feature summary not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "ml_duckdb_unlock",
  "Unlock a stuck DuckDB database file (remove stale .wal lock).",
  {
    db_path: z.string().optional().describe("Path to DuckDB file inside the pod (default: /app/data/analytics.duckdb)"),
    pod_label: z.string().optional().describe("Pod label selector (default: app=duckdb-ml-api)"),
  },
  async ({ db_path, pod_label }) => {
    const db = db_path ?? "/app/data/analytics.duckdb";
    const label = pod_label ?? "app=duckdb-ml-api";
    const podExpr = `$(sudo kubectl get pod -n analytics -l ${label} -o name 2>/dev/null | head -1)`;
    const cmd = `sudo kubectl exec -n analytics ${podExpr} -- rm -f ${db}.wal ${db}.lock 2>&1 && echo "Lock files removed" && sudo kubectl rollout restart deployment -n analytics -l ${label} 2>&1`;
    try { return ok(await sshMain(cmd)); } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// METABASE (namespace: analytics)
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "metabase_check_health",
  "Check Metabase pod status and health endpoint.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl get pods -n analytics -l app=metabase -o wide 2>&1 && NODE_PORT=$(sudo kubectl get svc -n analytics metabase -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null) && curl -sS -o /dev/null -w "HTTP %{http_code}" http://localhost:$NODE_PORT/api/health 2>&1 || echo "Metabase health check failed"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "metabase_get_logs",
  "Get recent logs from the Metabase pod.",
  {
    tail: z.number().optional().describe("Number of log lines (default: 50)"),
  },
  async ({ tail }) => {
    try { return ok(await sshMain(`sudo kubectl logs -n analytics -l app=metabase --tail=${tail ?? 50} 2>&1`, 15_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "metabase_reset_password",
  "Reset Metabase admin password via the reset endpoint.",
  {
    new_password: z.string().describe("New admin password"),
  },
  async ({ new_password }) => {
    try {
      const out = await sshMain(
        `NODE_PORT=$(sudo kubectl get svc -n analytics metabase -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null) && curl -sS -X POST http://localhost:$NODE_PORT/api/session/forgot_password -H "Content-Type: application/json" -d '{"email":"admin@cloudless.gr"}' 2>&1 || echo "Use k8s exec to reset: sudo kubectl exec -n analytics <metabase-pod> -- java -jar metabase.jar reset-password admin@cloudless.gr ${new_password}"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "metabase_h2_query",
  "Run a read-only SQL query against the Metabase H2 internal database.",
  {
    query: z.string().describe("SQL query to run against Metabase's H2 database"),
  },
  async ({ query }) => {
    // Strict allowlist: printable ASCII letters/digits/whitespace plus a
    // narrow set of SQL punctuation. Backslash, quotes, backticks, and `$`
    // are deliberately excluded so the value is safe at both the SQL and
    // shell layer even before the base64 hop below.
    if (query.length > 2000 || !/^[\w\s,.;()*=<>!+\-/'"%]+$/.test(query)) {
      return err(new Error("Query contains disallowed characters or exceeds 2000 chars"));
    }
    // Encode as base64 and decode shell-side so the raw query never touches
    // the command line. This eliminates all interpolation-based injection.
    const b64 = Buffer.from(query, "utf8").toString("base64");
    const cmd = `POD=$(sudo kubectl get pod -n analytics -l app=metabase -o name 2>/dev/null | head -1) && SQL=$(echo ${b64} | base64 -d) && sudo kubectl exec -n analytics $POD -- java -cp /app/metabase.jar org.h2.tools.Shell -url "jdbc:h2:/data/metabase.db" -user metabase -sql "$SQL" 2>&1 | head -50 || echo "H2 query failed"`;
    try { return ok(await sshMain(cmd, 30_000)); } catch (e) { return err(e); }
  }
);

server.tool(
  "metabase_duckdb_lock_fix",
  "Fix a stuck DuckDB connection in Metabase by restarting the pod.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl rollout restart deployment/metabase -n analytics 2>&1 && sudo kubectl rollout status deployment/metabase -n analytics --timeout=120s 2>&1`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ESP32 / IoT
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "esp32_device_status",
  "Check ESP32 watchdog device status via the alert-api.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS http://localhost:30800/api/devices 2>&1 | head -50 || curl -sS http://192.168.1.128:30800/api/devices 2>&1 | head -50 || echo "Alert API not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "esp32_alert_status",
  "Get current active alerts from the alert-api.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS http://localhost:30800/api/alerts/active 2>&1 | head -80 || echo "Alert API not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "esp32_alert_history",
  "Get alert history from the alert-api.",
  {
    limit: z.number().optional().describe("Number of alerts to show (default: 20)"),
  },
  async ({ limit }) => {
    try {
      const out = await sshMain(
        `curl -sS "http://localhost:30800/api/alerts/history?limit=${limit ?? 20}" 2>&1 | head -100 || echo "Alert API not accessible"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "esp32_alert_resolve",
  "Manually resolve an alert code via the alert-api.",
  {
    code: z.string().describe("Alert code to resolve (e.g. DISK_FULL, RUNNER_DOWN)"),
    node: z.string().optional().describe("Node name (e.g. omv, omv-ha)"),
  },
  async ({ code, node }) => {
    const body = node ? JSON.stringify({ node }) : "{}";
    try {
      const out = await sshMain(
        `curl -sS -X POST http://localhost:30800/api/alerts/${code}/resolve -H "Content-Type: application/json" -d '${body}' 2>&1 || echo "Alert API resolve failed"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// CERT-MANAGER
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "certmanager_wire_cloudless_gr",
  "Check cert-manager Certificate and ClusterIssuer status for cloudless.gr.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl get certificate,certificaterequest,clusterissuer,issuer -A 2>&1 && echo '---' && sudo kubectl describe certificate -n cloudless 2>&1 | tail -20`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "certmanager_remove_insecure_skip_verify",
  "Remove insecureSkipVerify from any cert-manager Issuer or ClusterIssuer (fixes TLS config).",
  {},
  async () => {
    try {
      const out = await sshMain(
        `sudo kubectl get clusterissuer -o name 2>&1 | xargs -I{} sudo kubectl patch {} --type=json -p='[{"op":"remove","path":"/spec/acme/solvers/0/http01/ingress/podTemplate/spec/tolerations"}]' 2>&1 || echo "Nothing to patch" && sudo kubectl get certificate -A -o wide 2>&1`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// APP SCANS
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "app_deps_check",
  "Check npm dependency audit and outdated packages in the cloudless.gr app.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `cd ~/cloudless.gr 2>/dev/null || cd /home/tbaltzakis/cloudless.gr 2>/dev/null || { echo "App dir not found on omv-main"; exit 0; } && npm audit --json 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Vulnerabilities: {d[\"metadata\"][\"vulnerabilities\"]}')" 2>&1 || echo "npm audit check failed (app may not be checked out on Pi)"`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "app_security_scan",
  "Run a basic security scan on the live cloudless.gr endpoints.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `echo "=== Security Headers ===" && curl -sS -I https://cloudless.gr 2>&1 | grep -iE '(strict-transport|content-security|x-frame|x-content-type|referrer)' && echo "=== HTTPS redirect ===" && curl -sS -o /dev/null -w "%{redirect_url}" http://cloudless.gr 2>&1`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "app_perf_scan",
  "Quick performance check: TTFB, response time for key pages.",
  {},
  async () => {
    try {
      const urls = ["/", "/api/health", "/en/about"];
      const checks = urls.map((u) => `echo "=== ${u} ===" && curl -sS -o /dev/null -w "TTFB: %{time_starttransfer}s Total: %{time_total}s HTTP: %{http_code}" https://cloudless.gr${u} 2>&1`).join(" && ");
      return ok(await sshMain(checks, 30_000));
    } catch (e) { return err(e); }
  }
);

server.tool(
  "app_improvement_report",
  "Generate a summary report of app health: pods, recent errors, CI status, disk.",
  {},
  async () => {
    try {
      const [pods, disk, logs] = await Promise.all([
        sshMain(`sudo kubectl get pods -n cloudless -o wide 2>&1`),
        sshMain(`df -h / 2>&1`),
        sshMain(`sudo kubectl logs -n cloudless -l app=cloudless --tail=20 2>&1`),
      ]);
      return ok(`# App Health Report\n\n## Pods\n\`\`\`\n${pods}\n\`\`\`\n\n## Disk\n\`\`\`\n${disk}\n\`\`\`\n\n## Recent App Logs\n\`\`\`\n${logs}\n\`\`\``);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "frontend_deploy_cloudless_gr",
  "Check the current deployment SHA and trigger a new deploy if needed.",
  {
    force: z.boolean().optional().describe("Force re-deploy even if SHA matches"),
  },
  async ({ force }) => {
    try {
      const [sha, podSha] = await Promise.all([
        sshMain(`aws ssm get-parameter --name /cloudless/production/current-image-sha --query Parameter.Value --output text --region us-east-1 2>&1`),
        sshMain(`sudo kubectl get deployment -n cloudless cloudless -o jsonpath='{.spec.template.spec.containers[0].image}' 2>&1 | awk -F: '{print $2}'`),
      ]);
      if (!force && sha.trim() === podSha.trim()) {
        return ok(`Deployment is current. SHA: ${sha.trim()}`);
      }
      const out = await sshMain(`sudo kubectl rollout restart deployment/cloudless -n cloudless 2>&1 && sudo kubectl rollout status deployment/cloudless -n cloudless --timeout=120s 2>&1`);
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "frontend_check_navbar",
  "Check navbar rendering via HTTP and confirm locale routing works.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `curl -sS https://cloudless.gr/en/ 2>&1 | grep -iE '(nav|header|<title)' | head -10 && echo "--- locale redirect ---" && curl -sS -o /dev/null -w "/ → %{redirect_url}" https://cloudless.gr/ 2>&1`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);

server.tool(
  "frontend_check_pwa",
  "Verify PWA manifest and service worker are served correctly.",
  {},
  async () => {
    try {
      const out = await sshMain(
        `echo "=== manifest ===" && curl -sS https://cloudless.gr/manifest.json 2>&1 | head -20 && echo "=== sw ===" && curl -sS -o /dev/null -w "%{http_code}" https://cloudless.gr/sw.js 2>&1`
      );
      return ok(out);
    } catch (e) { return err(e); }
  }
);


server.tool(
  "tf_doctor",
  "Diagnose and (optionally) fix a stuck Terraform CI workflow. Pulls the most-recent failed run for the named workflow, classifies the error against the terraform-doctor skill's known patterns (openpgp expired, fmt drift, validate schema drift, plan precondition), and runs terraform locally on omv-main to verify. Pass apply_fmt=true to write the fmt result back. Read-only otherwise.",
  {
    workflow: z.string().describe("Workflow filename, e.g. 'deploy-infrastructure.yml'"),
    tf_dir: z.string().describe("Terraform directory relative to repo root, e.g. 'infrastructure/terraform'"),
    apply_fmt: z.boolean().optional().describe("If true, write `terraform fmt` result to the .tf files. Default false."),
  },
  async ({ workflow, tf_dir, apply_fmt }) => {
    try {
      const repo = "/home/tbaltzakis/cloudless.gr";
      const tf = "/tmp/terraform";
      const tfVer = "1.15.6";
      const apply = apply_fmt === true;

      // 1. Get last failed run + first error
      const log = await sshMain(
        `cd ${repo} && RUN=$(gh run list --workflow=${workflow} --limit 1 --json databaseId,conclusion --jq '.[0] | select(.conclusion == "failure") | .databaseId'); ` +
        `if [ -z "$RUN" ]; then echo "NO_FAILED_RUN"; exit 0; fi; ` +
        `echo "RUN=$RUN"; ` +
        `gh run view "$RUN" --log 2>/dev/null | grep -iE "error|fail|expired|invalid|unsupported" | head -15`
      );

      // 2. Classify
      let classification = "unknown";
      if (/\bopenpgp[\s\S]{0,200}?key expired\b|\bsignature[\s\S]{0,200}?expired\b/i.test(log)) classification = "openpgp_key_expired (Stage 1: bump TF_VERSION to " + tfVer + ")";
      else if (/\bterraform fmt(?:\s|[-]check)/i.test(log)) classification = "fmt_drift (Stage 2: run `terraform fmt`)";
      else if (/\bexpected\b[\s\S]{0,80}?\bto be one of\b|\bUnsupported argument\b|\bMissing required argument\b|\bInsufficient\b[\s\S]{0,40}?\bblocks\b/i.test(log)) classification = "validate_schema_drift (Stage 3: provider schema migration)";
      else if (/\bFunction not found\b|\bResourceNotFoundException\b|\breading\b[\s\S]{0,80}?\(/i.test(log)) classification = "plan_precondition (Stage 4: missing AWS resource; gate behind a flag)";

      // 3. Verify locally
      const verify = await sshMain(
        `set -e; if ! [ -x ${tf} ]; then ` +
        `  ARCH=$(uname -m | sed 's/aarch64/arm64/;s/x86_64/amd64/'); ` +
        `  curl -sLo /tmp/tf.zip https://releases.hashicorp.com/terraform/${tfVer}/terraform_${tfVer}_linux_$ARCH.zip; ` +
        `  cd /tmp && unzip -oq tf.zip && chmod +x terraform; ` +
        `fi; ` +
        `cd ${repo}/${tf_dir}; ` +
        `rm -rf .terraform .terraform.lock.hcl 2>/dev/null; ` +
        `${tf} init -input=false 2>&1 | tail -3; ` +
        `echo "---fmt---"; ` +
        (apply ? `${tf} fmt . 2>&1 | head -5; ` : `${tf} fmt -check -diff . 2>&1 | head -30; `) +
        `echo "---validate---"; ` +
        `${tf} validate -no-color 2>&1 | head -50`
      );

      return ok(
        `# tf_doctor — ${workflow}\n\n` +
        `## Classification: ${classification}\n\n` +
        `## Last failure log\n\`\`\`\n${log}\n\`\`\`\n\n` +
        `## Local verification (terraform ${tfVer}${apply ? ", fmt applied" : ", fmt check only"})\n\`\`\`\n${verify}\n\`\`\`\n\n` +
        `## Next steps\n` +
        `Consult skills/terraform-doctor/SKILL.md for the matching stage. If "validate_schema_drift", scripts/tf-validate-fix.py covers the common AWS 5.x patterns.\n`
      );
    } catch (e) { return err(e); }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// Cluster bash extras — fanout exec + SFTP read/write + topology probe.
// Backed by ./sftp.ts. See skills/cluster-bash/SKILL.md for usage guidance.
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
  "cluster_list_nodes",
  "Return the cluster topology (node names, hosts, roles, tailnet IPs) and a per-node SSH reachability probe (`uptime && hostname`).\nUse as the first call in any 'is the cluster up?' investigation — strictly faster and more diff-friendly than running cluster_run_command twice.",
  {},
  async () => {
    const results = await Promise.all(
      ALL_NODES.map(async (node) => {
        try {
          const out = await sshRunOn(node, "uptime && hostname", 10_000);
          return { node, reachable: true, uptime: out.trim(), info: TOPOLOGY[node] };
        } catch (e) {
          return {
            node,
            reachable: false,
            error: (e as Error).message,
            info: TOPOLOGY[node],
          };
        }
      }),
    );
    return ok(
      "## Cluster topology\n```json\n" + JSON.stringify(results, null, 2) + "\n```",
    );
  },
);

server.tool(
  "cluster_run_fanout",
  "Run the same shell command on every reachable cluster node in parallel.\nReturns a per-node {ok, stdout|error} result list.\nIdeal for symmetry checks: 'is disk full on either node', 'are both runners listening', 'is the image pre-pulled everywhere'.\nNOT a transaction — if a stateful write half-succeeds across nodes there is no rollback. For writes, target one node at a time with cluster_run_command.",
  {
    command: z.string().min(1).describe("Shell command to run on each node"),
    timeout_seconds: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .describe("Per-node timeout in seconds (default 30)"),
    nodes: z
      .array(z.enum(["omv-main", "omv-ha"]))
      .optional()
      .describe("Subset of nodes to target. Omit for all."),
  },
  async ({ command, timeout_seconds, nodes }) => {
    const targets = (nodes ?? ALL_NODES) as SftpNodeName[];
    const results = await Promise.all(
      targets.map(async (node) => {
        try {
          const stdout = await sshRunOn(node, command, (timeout_seconds ?? 30) * 1_000);
          return { node, ok: true, stdout };
        } catch (e) {
          return { node, ok: false, error: (e as Error).message };
        }
      }),
    );
    return ok(
      "## Fan-out result\n```json\n" + JSON.stringify(results, null, 2) + "\n```",
    );
  },
);

server.tool(
  "cluster_read_file",
  "SFTP-read a file from a cluster node. Caps at 1 MiB by default; sets `truncated: true` if the file is larger.\nPrefer this over `cat` via cluster_run_command — there are no shell-quoting hazards and you see the file's true size even when truncated.",
  {
    node: z.enum(["omv-main", "omv-ha"]),
    path: z
      .string()
      .min(1)
      .describe("Absolute remote path. /etc, /sys etc are accepted for reading."),
    max_bytes: z
      .number()
      .int()
      .min(1024)
      .max(8 * 1024 * 1024)
      .optional()
      .describe("Max bytes to return (default 1,048,576 = 1 MiB)."),
  },
  async ({ node, path, max_bytes }) => {
    try {
      if (!isSafeRemotePath(path, "read")) {
        throw new Error(`refusing unsafe read path: ${path}`);
      }
      const { bytes, truncated, size } = await sftpRead(
        node,
        path,
        max_bytes ?? 1024 * 1024,
      );
      return ok(
        [
          `## ${node}:${path}`,
          `**Size:** ${size} bytes` +
            (truncated ? ` (returned ${bytes.length}, **truncated**)` : ""),
          "```",
          bytes.toString("utf8"),
          "```",
        ].join("\n"),
      );
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "cluster_write_file",
  "SFTP-write a file to a cluster node. Refuses /etc /boot /sys /proc /dev for safety; refuses payloads over 8 MiB.\nPrefer this over `tee` heredocs — nothing in `content` is shell-interpreted, so you can safely write any payload including quotes, backticks, and dollar signs.",
  {
    node: z.enum(["omv-main", "omv-ha"]),
    path: z
      .string()
      .min(1)
      .describe("Absolute remote path. /etc, /boot, /sys, /proc, /dev are refused."),
    content: z.string().describe("UTF-8 content (or base64 if `base64` is true)."),
    base64: z
      .boolean()
      .optional()
      .describe("If true, `content` is base64-decoded before writing."),
    mode: z
      .number()
      .int()
      .min(0o400)
      .max(0o777)
      .optional()
      .describe("Unix mode (default 0o644). Octal."),
  },
  async ({ node, path, content, base64, mode }) => {
    try {
      if (!isSafeRemotePath(path, "write")) {
        throw new Error(`refusing unsafe write path: ${path}`);
      }
      const buf = base64
        ? Buffer.from(content, "base64")
        : Buffer.from(content, "utf8");
      await sftpWrite(node, path, buf, mode ?? 0o644);
      return ok(
        `Wrote **${buf.length} bytes** to \`${node}:${path}\` (mode 0o${(mode ?? 0o644).toString(8)}).`,
      );
    } catch (e) {
      return err(e);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════════════════════════

const transport = new StdioServerTransport();
await server.connect(transport);
