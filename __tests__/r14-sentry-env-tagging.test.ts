import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("R14 Sentry environment tagging", () => {
  it("uses per-surface SENTRY_ENVIRONMENT on server and edge", () => {
    expect(read("sentry.server.config.ts")).toContain("process.env.SENTRY_ENVIRONMENT");
    expect(read("sentry.edge.config.ts")).toContain("process.env.SENTRY_ENVIRONMENT");
  });

  it("uses NEXT_PUBLIC_SENTRY_ENVIRONMENT for browser/client events", () => {
    expect(read("sentry.client.config.ts")).toContain(
      "process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT",
    );
  });

  it("sets prod Sentry tags in the AWS/Lambda deploy workflow", () => {
    const deploy = read(".github/workflows/deploy.yml");
    expect(deploy).toContain("SENTRY_ENVIRONMENT: prod");
    expect(deploy).toContain("NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod");
  });

  it("sets pi-standby Sentry tags in Pi workflows", () => {
    for (const workflow of [
      ".github/workflows/deploy-pi.yml",
      ".github/workflows/build-pi-image.yml",
    ]) {
      const body = read(workflow);
      expect(body).toContain("SENTRY_ENVIRONMENT=pi-standby");
      expect(body).toContain("NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby");
    }
  });
});
