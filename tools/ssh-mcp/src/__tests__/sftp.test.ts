/**
 * Pure unit tests for the path-safety logic and topology constants in
 * `sftp.ts`. The actual SFTP I/O is integration-only — we don't spin up
 * a local SSH server in the unit suite.
 */
import { describe, it, expect } from "vitest";
import { isSafeRemotePath, TOPOLOGY, ALL_NODES } from "../sftp.js";

describe("isSafeRemotePath", () => {
  describe("read policy", () => {
    it("accepts ordinary log/config paths", () => {
      expect(isSafeRemotePath("/var/log/syslog", "read")).toBe(true);
      expect(isSafeRemotePath("/etc/k3s/config.yaml", "read")).toBe(true);
      expect(isSafeRemotePath("/home/omv/notes.md", "read")).toBe(true);
    });

    it("refuses non-absolute paths", () => {
      expect(isSafeRemotePath("relative/path", "read")).toBe(false);
      expect(isSafeRemotePath("~/notes.md", "read")).toBe(false);
      expect(isSafeRemotePath("", "read")).toBe(false);
    });

    it("refuses traversal segments", () => {
      expect(isSafeRemotePath("/var/log/../../etc/shadow", "read")).toBe(false);
      expect(isSafeRemotePath("/var/log/..", "read")).toBe(false);
    });

    it("refuses null bytes", () => {
      expect(isSafeRemotePath("/var/log\0/syslog", "read")).toBe(false);
    });
  });

  describe("write policy", () => {
    it("accepts paths outside protected dirs", () => {
      expect(isSafeRemotePath("/home/omv/script.sh", "write")).toBe(true);
      expect(isSafeRemotePath("/tmp/payload.json", "write")).toBe(true);
      expect(isSafeRemotePath("/var/log/myapp.log", "write")).toBe(true);
      expect(isSafeRemotePath("/opt/cloudless/config.toml", "write")).toBe(true);
    });

    it("refuses /etc /boot /sys /proc /dev", () => {
      for (const p of [
        "/etc/passwd",
        "/etc/sudoers",
        "/boot/cmdline.txt",
        "/sys/fs/cgroup/init",
        "/proc/1/status",
        "/dev/sda1",
      ]) {
        expect(isSafeRemotePath(p, "write")).toBe(false);
      }
    });

    it("refuses the bare directory names too", () => {
      for (const p of ["/etc", "/boot", "/sys", "/proc", "/dev"]) {
        expect(isSafeRemotePath(p, "write")).toBe(false);
      }
    });

    it("refuses traversal that lands back in a banned dir", () => {
      expect(isSafeRemotePath("/home/../etc/shadow", "write")).toBe(false);
    });

    it("does not refuse paths that merely contain a banned dir name as a subpath component", () => {
      // /opt/etc-mirror/foo is fine — it's not /etc/*.
      expect(isSafeRemotePath("/opt/etc-mirror/foo", "write")).toBe(true);
      expect(isSafeRemotePath("/var/sys-snapshot/file", "write")).toBe(true);
    });
  });
});

describe("TOPOLOGY", () => {
  it("declares the two known cluster nodes", () => {
    expect(ALL_NODES).toEqual(expect.arrayContaining(["omv-main", "omv-ha"]));
  });

  it("each node has a non-empty host and tailscaleIp and at least one role", () => {
    for (const node of ALL_NODES) {
      const info = TOPOLOGY[node];
      expect(info.host).toMatch(/\S/);
      expect(info.tailscaleIp).toMatch(/^100\./);
      expect(info.roles.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
  });

  it("omv-main is the control plane", () => {
    expect(TOPOLOGY["omv-main"].roles).toContain("control-plane");
    expect(TOPOLOGY["omv-main"].roles).toContain("k3s-server");
  });

  it("omv-ha is an agent with the keepalived VIP", () => {
    expect(TOPOLOGY["omv-ha"].roles).toContain("k3s-agent");
    expect(TOPOLOGY["omv-ha"].roles).toContain("keepalived-vip");
  });
});
