/**
 * SFTP + multi-node helpers for the cloudless-ssh-mcp server.
 *
 * The existing index.ts file does everything via `ssh2.exec` and inline shell
 * (cat, tee, rsync, heredocs). That works but fights you for any payload that
 * contains shell metacharacters, and the lack of byte limits means a careless
 * `cat /var/log/syslog` can blow up the MCP transport.
 *
 * This module adds three primitives — file read, file write, and a topology
 * probe — built directly on `ssh2.sftp()`. Path-safety logic is in
 * `isSafeRemotePath` so it's unit-testable without an SSH server.
 *
 * The module reads SSH config from the same env vars as index.ts:
 *   OMV_SSH_KEY_CONTENTS  base64-encoded private key (preferred — set by
 *                         the session-start hook from the same secret used
 *                         by the cloudless-infra MCP)
 *   OMV_SSH_KEY           path to a private key file (fallback)
 *   OMV_SSH_PASSPHRASE    optional passphrase for the key
 *   OMV_SSH_USER          remote username (default "omv")
 *   OMV_SSH_PORT          remote port (default 22)
 *   OMV_SSH_HOST / OMV_SSH_HA_HOST   per-node host overrides
 */
import { Client as SshClient } from "ssh2";
import type { ConnectConfig } from "ssh2";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

export type NodeName = "omv-main" | "omv-ha";

export interface NodeInfo {
  host: string;
  tailscaleIp: string;
  roles: string[];
  description: string;
}

/**
 * Single source of truth for the cluster topology. If a third Pi joins
 * the cluster, add it here and the new tools will pick it up automatically.
 * The plain LAN IPs match the existing `NODES` map in index.ts; the
 * tailnet IPs are documented here (and used when `OMV_SSH_HOST_TAILSCALE`
 * is set via the session-start hook).
 */
export const TOPOLOGY: Record<NodeName, NodeInfo> = {
  "omv-main": {
    host:
      process.env.OMV_SSH_HOST ??
      process.env.OMV_SSH_HOST_TAILSCALE ??
      "192.168.1.128",
    tailscaleIp: "100.113.41.119",
    roles: ["control-plane", "k3s-server", "github-runner-omv", "github-runner-omv-build"],
    description: "Pi 5 — k3s control plane, dedicated SATA SSD for k3s data",
  },
  "omv-ha": {
    host:
      process.env.OMV_SSH_HA_HOST ??
      process.env.OMV_SSH_HA_HOST_TAILSCALE ??
      "192.168.1.130",
    tailscaleIp: "100.111.222.92",
    roles: ["k3s-agent", "keepalived-vip", "github-runner-omv-2-build"],
    description: "Pi 4 — k3s agent, keepalived VIP 192.168.1.200",
  },
};

export const ALL_NODES = Object.keys(TOPOLOGY) as NodeName[];

function getSshConnectConfig(node: NodeName): ConnectConfig {
  const info = TOPOLOGY[node];
  if (!info) throw new Error(`unknown node: ${node}`);
  const user = process.env.OMV_SSH_USER ?? "omv";
  const port = Number(process.env.OMV_SSH_PORT ?? "22");
  const b64 = process.env.OMV_SSH_KEY_CONTENTS;
  const privateKey: Buffer = b64
    ? Buffer.from(b64, "base64")
    : readFileSync(process.env.OMV_SSH_KEY ?? `${homedir()}/.ssh/id_ed25519`);
  const cfg: ConnectConfig = {
    host: info.host,
    port,
    username: user,
    privateKey,
    readyTimeout: 15_000,
  };
  if (process.env.OMV_SSH_PASSPHRASE) cfg.passphrase = process.env.OMV_SSH_PASSPHRASE;
  return cfg;
}

/**
 * Refuse paths that look unsafe. The "read" policy allows anywhere readable
 * because we genuinely want to grep system logs. The "write" policy refuses
 * traditional system directories because the LLM has no business writing
 * /etc/passwd or /boot/cmdline.txt without a human in the loop.
 */
export function isSafeRemotePath(path: string, kind: "read" | "write"): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.includes("\0")) return false;
  if (/(^|\/)\.\.($|\/)/.test(path)) return false;
  if (kind === "read") return true;
  const bannedPrefixes = ["/etc/", "/boot/", "/sys/", "/proc/", "/dev/"];
  const bannedExact = ["/etc", "/boot", "/sys", "/proc", "/dev"];
  if (bannedExact.includes(path)) return false;
  return !bannedPrefixes.some((p) => path.startsWith(p));
}

/**
 * SFTP-read a remote file. Caps the payload at `maxBytes` (default 1 MiB)
 * so a runaway `/var/log/journal/...` doesn't blow up the transport.
 * Returns the bytes plus a `truncated` flag and the file's true size.
 */
export async function sftpRead(
  node: NodeName,
  remotePath: string,
  maxBytes = 1024 * 1024,
): Promise<{ bytes: Buffer; truncated: boolean; size: number }> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error(`sftpRead timed out on ${node}:${remotePath}`));
    }, 30_000);
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(err);
          }
          sftp.stat(remotePath, (statErr, stats) => {
            if (statErr) {
              clearTimeout(timer);
              conn.end();
              return reject(statErr);
            }
            const size = Number(stats.size ?? 0);
            const chunks: Buffer[] = [];
            let total = 0;
            let truncated = false;
            const stream = sftp.createReadStream(remotePath, { highWaterMark: 64 * 1024 });
            stream.on("data", (chunk: Buffer) => {
              if (total + chunk.length > maxBytes) {
                truncated = true;
                const room = Math.max(0, maxBytes - total);
                if (room > 0) chunks.push(chunk.subarray(0, room));
                total = maxBytes;
                stream.destroy();
                return;
              }
              chunks.push(chunk);
              total += chunk.length;
            });
            stream.on("end", () => {
              clearTimeout(timer);
              conn.end();
              resolve({ bytes: Buffer.concat(chunks, total), truncated, size });
            });
            stream.on("close", () => {
              if (truncated) {
                clearTimeout(timer);
                conn.end();
                resolve({ bytes: Buffer.concat(chunks, total), truncated, size });
              }
            });
            stream.on("error", (e: Error) => {
              clearTimeout(timer);
              conn.end();
              reject(e);
            });
          });
        });
      })
      .on("error", (e: Error) => {
        clearTimeout(timer);
        reject(e);
      })
      .connect(getSshConnectConfig(node));
  });
}

/**
 * SFTP-write a remote file. Hard-caps payload at 8 MiB so a runaway
 * generation doesn't fill the Pi's disk. Mode defaults to 0o644.
 */
export async function sftpWrite(
  node: NodeName,
  remotePath: string,
  content: Buffer,
  mode = 0o644,
): Promise<void> {
  if (content.length > 8 * 1024 * 1024) {
    throw new Error(`payload too large: ${content.length} bytes (max 8 MiB)`);
  }
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error(`sftpWrite timed out on ${node}:${remotePath}`));
    }, 30_000);
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(err);
          }
          const stream = sftp.createWriteStream(remotePath, { mode });
          stream.on("close", () => {
            clearTimeout(timer);
            conn.end();
            resolve();
          });
          stream.on("error", (e: Error) => {
            clearTimeout(timer);
            conn.end();
            reject(e);
          });
          stream.end(content);
        });
      })
      .on("error", (e: Error) => {
        clearTimeout(timer);
        reject(e);
      })
      .connect(getSshConnectConfig(node));
  });
}
