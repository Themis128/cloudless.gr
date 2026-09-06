/**
 * Tests for src/lib/cloudflare-access.ts
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  verifyAccessToken,
  isAccessConfigured,
  getConfiguredAccessApps,
  getServiceToken,
  ADMIN_APPS,
} from "@/lib/cloudflare-access";

function makeJwt(header: object, payload: object, sig = "fake-sig"): string {
  const h = Buffer.from(JSON.stringify(header)).toString("base64");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${h}.${p}.${sig}`;
}

const NOW_S = Math.floor(Date.now() / 1000);

describe("ADMIN_APPS", () => {
  it("contains grafana, kuma, appflowy, n8n", () => {
    expect(ADMIN_APPS).toContain("grafana");
    expect(ADMIN_APPS).toContain("kuma");
    expect(ADMIN_APPS).toContain("appflowy");
    expect(ADMIN_APPS).toContain("n8n");
  });
});

describe("verifyAccessToken", () => {
  it("returns null for a token with wrong number of parts", async () => {
    expect(await verifyAccessToken("only.two")).toBeNull();
    expect(await verifyAccessToken("a.b.c.d")).toBeNull();
  });

  it("returns null when payload has no email or identity_provider", async () => {
    const jwt = makeJwt({ kid: "k1" }, { exp: NOW_S + 3600, iat: NOW_S });
    expect(await verifyAccessToken(jwt)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const jwt = makeJwt(
      { kid: "k1" },
      { email: "user@test.com", exp: NOW_S - 10, iat: NOW_S - 100 }
    );
    expect(await verifyAccessToken(jwt)).toBeNull();
  });

  it("returns null when nbf is in the future", async () => {
    const jwt = makeJwt(
      { kid: "k1" },
      { email: "user@test.com", exp: NOW_S + 3600, iat: NOW_S, nbf: NOW_S + 600 }
    );
    expect(await verifyAccessToken(jwt)).toBeNull();
  });

  it("returns verified payload for a valid token", async () => {
    const jwt = makeJwt(
      { kid: "k1" },
      { email: "admin@cloudless.gr", name: "Admin", exp: NOW_S + 3600, iat: NOW_S }
    );
    const result = await verifyAccessToken(jwt);
    expect(result).not.toBeNull();
    expect(result!.email).toBe("admin@cloudless.gr");
    expect(result!.name).toBe("Admin");
    expect(result!.valid).toBe(true);
  });

  it("handles malformed base64 gracefully (returns null)", async () => {
    const result = await verifyAccessToken("!!.!!.!!");
    expect(result).toBeNull();
  });
});

describe("isAccessConfigured", () => {
  beforeEach(() => {
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID_TESTAPP;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_TESTAPP;
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID_TESTAPP;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_TESTAPP;
  });

  it("returns false when both vars missing", () => {
    expect(isAccessConfigured("testapp")).toBe(false);
  });

  it("returns false when only id is set", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID_TESTAPP = "id-x";
    expect(isAccessConfigured("testapp")).toBe(false);
  });

  it("returns false when only secret is set", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_TESTAPP = "sec-x";
    expect(isAccessConfigured("testapp")).toBe(false);
  });

  it("returns true when both are set", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID_TESTAPP = "id-x";
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_TESTAPP = "sec-x";
    expect(isAccessConfigured("testapp")).toBe(true);
  });

  it("upcases the app name for lookup", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID_TESTAPP = "id-x";
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_TESTAPP = "sec-x";
    expect(isAccessConfigured("TESTAPP")).toBe(true);
  });
});

describe("getConfiguredAccessApps", () => {
  beforeEach(() => {
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID_CFTESTAPP;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_CFTESTAPP;
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID_CFTESTAPP;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_CFTESTAPP;
  });

  it("excludes apps with only id set", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID_CFTESTAPP = "id-x";
    const apps = getConfiguredAccessApps();
    expect(apps).not.toContain("cftestapp");
  });

  it("includes app when both vars are set", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID_CFTESTAPP = "id-x";
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_CFTESTAPP = "sec-x";
    const apps = getConfiguredAccessApps();
    expect(apps).toContain("cftestapp");
  });
});

describe("getServiceToken", () => {
  beforeEach(() => {
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID_GRAFANA;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_GRAFANA;
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID_GRAFANA;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_GRAFANA;
  });

  it("returns null when env vars are not set", () => {
    expect(getServiceToken("grafana")).toBeNull();
  });

  it("returns formatted CF_ACCESS_CERT token when configured", () => {
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID_GRAFANA = "id-abc";
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET_GRAFANA = "sec-xyz";
    expect(getServiceToken("grafana")).toBe("CF_ACCESS_CERT.id-abc.sec-xyz");
  });
});
