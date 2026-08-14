import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldBindRemoteAuthDb } from "@/instrumentation";

const ROOT_INSTRUMENTATION = resolve(__dirname, "../instrumentation.ts");
const SRC_INSTRUMENTATION = resolve(__dirname, "../src/instrumentation.ts");
const DOCKERFILE = resolve(__dirname, "../Dockerfile");
const HOSTPATH = resolve(__dirname, "../k8s/cloudless-app-hostpath.yaml");

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubInteractiveDev(): void {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CI", "false");
  vi.stubEnv("NEXT_PUBLIC_E2E", "");
  vi.stubEnv("AUTH_DB_PREFER_LOCAL", "");
  vi.stubEnv("AUTH_DB_USE_HTTP", "");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
}

describe("Next.js instrumentation file location", () => {
  it("lives under src/ (Next src/ layout) and not at the repo root", () => {
    expect(existsSync(SRC_INSTRUMENTATION), "src/instrumentation.ts must exist").toBe(true);
    expect(
      existsSync(ROOT_INSTRUMENTATION),
      "root instrumentation.ts would shadow or split hooks"
    ).toBe(false);
  });

  it("loads Sentry in production and times out the remote D1 bind", () => {
    const source = readFileSync(SRC_INSTRUMENTATION, "utf-8");
    const nodeD1 = readFileSync(resolve(__dirname, "../src/instrumentation-node-d1.ts"), "utf-8");
    expect(source).toContain("sentry.server.config");
    expect(source).toContain("sentry.edge.config");
    expect(source).toContain("getCloudflareContext timed out");
    expect(source).toContain("instrumentation-node-d1");
    expect(source).toContain("slackDeployNotify");
    expect(nodeD1).toContain("AUTH_DB bound (local D1)");
    expect(nodeD1).toContain("pnpm d1:migrate:local");
  });
});

describe("shouldBindRemoteAuthDb", () => {
  it("is true for interactive local next-dev with a Cloudflare token", () => {
    stubInteractiveDev();
    expect(shouldBindRemoteAuthDb()).toBe(true);
  });

  it("skips CI so Playwright webServer can become ready", () => {
    stubInteractiveDev();
    vi.stubEnv("CI", "true");
    expect(shouldBindRemoteAuthDb()).toBe(false);
  });

  it("skips E2E (local sqlite fallback)", () => {
    stubInteractiveDev();
    vi.stubEnv("NEXT_PUBLIC_E2E", "1");
    expect(shouldBindRemoteAuthDb()).toBe(false);
  });

  it("skips when AUTH_DB_USE_HTTP=1 (REST client, not OpenNext remote)", () => {
    stubInteractiveDev();
    vi.stubEnv("AUTH_DB_USE_HTTP", "1");
    expect(shouldBindRemoteAuthDb()).toBe(false);
  });

  it("skips when CLOUDFLARE_API_TOKEN is unset", () => {
    stubInteractiveDev();
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    expect(shouldBindRemoteAuthDb()).toBe(false);
  });
});

describe("Pi D1 HTTP auth bundling", () => {
  it("auth-d1 loads d1-http with a bundler-visible require (no webpackIgnore)", () => {
    const authD1 = resolve(__dirname, "../src/lib/auth-d1.ts");
    const source = readFileSync(authD1, "utf-8");
    // webpackIgnore on ./d1-http strips it from standalone → dbConnected:false on Pi.
    expect(source).toMatch(/require\(\s*["']\.\/d1-http["']\s*\)/);
    expect(source).not.toMatch(/webpackIgnore:[\s\S]{0,80}\.\/d1-http/);
    expect(source).toMatch(/webpackIgnore:[\s\S]{0,80}\.\/auth-db-local/);
  });
});

describe("Next.js listen-bind HOSTNAME leak", () => {
  it("Dockerfile runner does not assign ENV HOSTNAME", () => {
    const dockerfile = readFileSync(DOCKERFILE, "utf-8");
    const runner = dockerfile.match(/FROM[^\n]+AS runner[\s\S]*$/)?.[0] ?? "";
    expect(runner).not.toMatch(/^\s*HOSTNAME=/m);
    expect(runner).not.toMatch(/^ENV[^\n]*HOSTNAME=/m);
  });

  it("Pi ConfigMap does not set HOSTNAME", () => {
    expect(readFileSync(HOSTPATH, "utf-8")).not.toMatch(/^\s*HOSTNAME:/m);
  });
});
