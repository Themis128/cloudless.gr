#!/usr/bin/env node
/**
 * cloudless-ssh-mcp
 *
 * MCP server that provides SSH-based infrastructure tools for omv-main.
 * Mirrors the mcp__cloudless-infra__* interface so skills work identically
 * whether the full cloudless-infra server or this lightweight SSH shim is
 * available.
 *
 * Required env vars:
 *   OMV_SSH_HOST           — LAN IP or hostname (default: 192.168.1.128)
 *   OMV_SSH_HOST_TAILSCALE — Tailscale hostname/IP; used instead of OMV_SSH_HOST when set
 *   OMV_SSH_USER           — SSH user (default: omv)
 *   OMV_SSH_KEY            — Path to private key file (default: ~/.ssh/id_ed25519)
 *   OMV_SSH_KEY_CONTENTS   — Base64-encoded private key (overrides OMV_SSH_KEY; use in cloud envs)
 *   OMV_SSH_PORT           — SSH port (default: 22)
 *
 * Optional:
 *   OMV_SSH_PASSPHRASE — Passphrase for encrypted private keys
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client as SshClient, ConnectConfig } from "ssh2";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";

// ── SSH config from env ────────────────────────────────────────────────────────

// Tailscale host takes priority when set (allows cloud sessions to reach the Pi)
const SSH_HOST = process.env.OMV_SSH_HOST_TAILSCALE ?? process.env.OMV_SSH_HOST ?? "192.168.1.128";
const SSH_USER = process.env.OMV_SSH_USER ?? "omv";
const SSH_PORT = parseInt(process.env.OMV_SSH_PORT ?? "22", 10);
const SSH_KEY_PATH = process.env.OMV_SSH_KEY ?? join(homedir(), ".ssh", "id_ed25519");
const SSH_PASSPHRASE = process.env.OMV_SSH_PASSPHRASE;
// Base64-encoded key content — set this in cloud envs instead of a file path
const SSH_KEY_CONTENTS = process.env.OMV_SSH_KEY_CONTENTS
  ? Buffer.from(process.env.OMV_SSH_KEY_CONTENTS, "base64")
  : null;

const RUNNER_REPO_SLUG = "Themis128-cloudless.gr";

// ── SSH helper ─────────────────────────────────────────────────────────────────

function sshRun(command: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let output = "";
    let errOutput = "";

    const config: ConnectConfig = {
      host: SSH_HOST,
      port: SSH_PORT,
      username: SSH_USER,
      readyTimeout: 10_000,
    };

    if (SSH_KEY_CONTENTS) {
      config.privateKey = SSH_KEY_CONTENTS;
      if (SSH_PASSPHRASE) config.passphrase = SSH_PASSPHRASE;
    } else {
      try {
        config.privateKey = readFileSync(SSH_KEY_PATH);
        if (SSH_PASSPHRASE) config.passphrase = SSH_PASSPHRASE;
      } catch {
        return reject(
          new Error(
            `Cannot read SSH key at ${SSH_KEY_PATH}. ` +
            `Set OMV_SSH_KEY to the file path or OMV_SSH_KEY_CONTENTS to a base64-encoded key.`
          )
        );
      }
    }

    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error(`SSH command timed out after ${timeoutMs}ms: ${command}`));
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
              if (code !== 0 && !output && errOutput) {
                reject(new Error(`Exit ${code}: ${errOutput.trim()}`));
              } else {
                resolve(output + (errOutput ? `\n[stderr]\n${errOutput}` : ""));
              }
            })
            .on("data", (data: Buffer) => { output += data.toString(); })
            .stderr.on("data", (data: Buffer) => { errOutput += data.toString(); });
        });
      })
      .on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`SSH connection failed: ${err.message}`));
      })
      .connect(config);
  });
}

// ── High-level infra helpers ───────────────────────────────────────────────────

function runnerSvcName(runner: string) {
  return `actions.runner.${RUNNER_REPO_SLUG}.${runner}.service`;
}

async function runnerHealth(repo: string): Promise<string> {
  const runners = ["omv", "omv-2", "omv-3"];
  const lines: string[] = [`Runner fleet health — ${repo}`, ""];
  for (const r of runners) {
    const svc = runnerSvcName(r);
    try {
      const status = await sshRun(
        `systemctl is-active ${svc} 2>/dev/null && ` +
        `systemctl show ${svc} --property=SubState --value 2>/dev/null`
      );
      lines.push(`✓ ${r}: ${status.trim()}`);
    } catch {
      lines.push(`✗ ${r}: offline / not found`);
    }
  }
  return lines.join("\n");
}

async function runnerFixService(runner: string): Promise<string> {
  const svc = runnerSvcName(runner);
  const overrideDir = `/etc/systemd/system/${svc}.d`;
  const cmd = [
    `sudo mkdir -p ${overrideDir}`,
    `sudo tee ${overrideDir}/override.conf > /dev/null << 'EOF'\n` +
    `[Unit]\nAfter=network-online.target\nWants=network-online.target\n\n` +
    `[Service]\nRestart=on-failure\nRestartSec=10s\nStartLimitIntervalSec=0\n` +
    `Environment="RUNNER_RETRY_RENEW_SECONDS=300"\n` +
    `Environment="DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1"\nEOF`,
    `sudo mkdir -p /etc/systemd/resolved.conf.d`,
    `sudo tee /etc/systemd/resolved.conf.d/retry.conf > /dev/null << 'EOF'\n[Resolve]\nDNS=8.8.8.8 8.8.4.4 1.1.1.1\nFallbackDNS=9.9.9.9\nEOF`,
    `sudo systemctl daemon-reload`,
    `sudo systemctl restart ${svc}`,
    `sleep 3 && systemctl is-active ${svc}`,
  ].join(" && ");
  const result = await sshRun(cmd, 30_000);
  return `Runner ${runner} hardened.\n${result}`;
}

async function runnerRestart(runner: string): Promise<string> {
  const svc = runnerSvcName(runner);
  const result = await sshRun(`sudo systemctl restart ${svc} && sleep 3 && systemctl is-active ${svc}`);
  return `Runner ${runner} restarted: ${result.trim()}`;
}

// ── MCP server ─────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "cloudless-ssh-mcp",
  version: "0.1.0",
});

// cluster_run_command — run any shell command on a cluster node via SSH
server.tool(
  "cluster_run_command",
  "Run a shell command on a cluster node (omv-main) via SSH. Returns combined stdout+stderr.",
  {
    node: z.string().describe("Target node name (currently only 'omv-main' is supported)"),
    command: z.string().describe("Shell command to run (executed via bash -c)"),
    timeout_seconds: z.number().optional().describe("Command timeout in seconds (default: 60)"),
  },
  async ({ node: _node, command, timeout_seconds }) => {
    try {
      const output = await sshRun(command, (timeout_seconds ?? 60) * 1_000);
      return { content: [{ type: "text", text: output || "(no output)" }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// gh_runner_health — check status of all Pi runners
server.tool(
  "gh_runner_health",
  "Check the health and active state of all Pi self-hosted GitHub Actions runners (omv, omv-2, omv-3).",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
  },
  async ({ repo }) => {
    try {
      const result = await runnerHealth(repo);
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// gh_runner_fix_service — apply systemd hardening drop-in to a runner
server.tool(
  "gh_runner_fix_service",
  "Apply systemd hardening to a Pi runner service: removes k3s dependency, adds Restart=on-failure, configures fallback DNS. Idempotent.",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
    runner: z.string().describe("Runner name: omv, omv-2, or omv-3"),
  },
  async ({ runner }) => {
    try {
      const result = await runnerFixService(runner);
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// gh_runner_restart — restart a runner service
server.tool(
  "gh_runner_restart",
  "Restart a Pi GitHub Actions runner systemd service.",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
    runner: z.string().describe("Runner name: omv, omv-2, or omv-3"),
  },
  async ({ runner }) => {
    try {
      const result = await runnerRestart(runner);
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// gh_runner_logs — fetch recent journal logs for a runner
server.tool(
  "gh_runner_logs",
  "Fetch recent systemd journal logs for a Pi GitHub Actions runner.",
  {
    repo: z.string().describe("Repository name (e.g. cloudless.gr)"),
    runner: z.string().describe("Runner name: omv, omv-2, or omv-3"),
    lines: z.number().optional().describe("Number of log lines (default: 50)"),
    since: z.string().optional().describe("Time filter e.g. '30 minutes ago'"),
  },
  async ({ runner, lines, since }) => {
    const svc = runnerSvcName(runner);
    const sinceFlag = since ? `--since="${since}"` : "";
    const cmd = `sudo journalctl -u ${svc} -n ${lines ?? 50} ${sinceFlag} --no-pager 2>&1`;
    try {
      const output = await sshRun(cmd, 15_000);
      return { content: [{ type: "text", text: output || "(no logs)" }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// k3s_get_pods — list pods in a namespace
server.tool(
  "k3s_get_pods",
  "List Kubernetes pods in a namespace via k3s kubectl on omv-main.",
  {
    namespace: z.string().optional().describe("Kubernetes namespace (default: cloudless)"),
  },
  async ({ namespace }) => {
    const ns = namespace ?? "cloudless";
    try {
      const output = await sshRun(`sudo k3s kubectl get pods -n ${ns} -o wide 2>&1`);
      return { content: [{ type: "text", text: output || "(no pods)" }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// k3s_get_pod_logs — get logs from a pod
server.tool(
  "k3s_get_pod_logs",
  "Get logs from a Kubernetes pod via k3s kubectl on omv-main.",
  {
    namespace: z.string().optional().describe("Kubernetes namespace (default: cloudless)"),
    selector: z.string().optional().describe("Label selector e.g. app=cloudless"),
    pod: z.string().optional().describe("Exact pod name (alternative to selector)"),
    tail: z.number().optional().describe("Number of log lines (default: 50)"),
  },
  async ({ namespace, selector, pod, tail }) => {
    const ns = namespace ?? "cloudless";
    const target = pod ? pod : selector ? `$(sudo k3s kubectl get pod -n ${ns} -l ${selector} -o name | head -1)` : "";
    if (!target) return { content: [{ type: "text", text: "Provide pod name or selector" }], isError: true };
    const cmd = `sudo k3s kubectl logs -n ${ns} ${target} --tail=${tail ?? 50} 2>&1`;
    try {
      const output = await sshRun(cmd, 15_000);
      return { content: [{ type: "text", text: output || "(no logs)" }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// aws_get_ssm_parameters — read SSM parameter via AWS CLI on omv-main
server.tool(
  "aws_get_ssm_parameters",
  "Read an SSM parameter from AWS (runs aws ssm get-parameter on omv-main using its IAM role).",
  {
    parameter_name: z.string().describe("SSM parameter short name (e.g. current-image-sha) or full path"),
  },
  async ({ parameter_name }) => {
    const name = parameter_name.startsWith("/")
      ? parameter_name
      : `/cloudless/production/${parameter_name}`;
    const cmd = `aws ssm get-parameter --name "${name}" --query "Parameter.Value" --output text 2>&1`;
    try {
      const output = await sshRun(cmd, 15_000);
      return { content: [{ type: "text", text: output.trim() }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  }
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
