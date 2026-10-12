/**
 * .well-known/* discovery routes — static machine-readable documents.
 * Smoke tests pin the served shape + content types.
 */
import { describe, it, expect } from "vitest";
import { GET as apiCatalog } from "@/app/api/.well-known/api-catalog/route";
import { GET as oauthResource } from "@/app/api/.well-known/oauth-protected-resource/route";
import { GET as oidcConfig } from "@/app/api/.well-known/openid-configuration/route";
import { GET as serverCard } from "@/app/api/.well-known/mcp/server-card.json/route";
import { GET as skillsIndex } from "@/app/api/.well-known/agent-skills/index.json/route";

describe(".well-known discovery routes", () => {
  it("api-catalog serves linkset+json with the 3 anchors", async () => {
    const res = await apiCatalog();
    expect(res.headers.get("content-type")).toContain("application/linkset+json");
    const body = await res.json();
    expect(body.linkset).toHaveLength(3);
    expect(body.linkset[0].anchor).toBe("https://cloudless.gr/api/chat");
  });

  it("oauth-protected-resource advertises cloudless.gr + scopes", async () => {
    const body = await (await oauthResource()).json();
    expect(body.resource).toBe("https://cloudless.gr");
    expect(body.scopes_supported).toContain("admin");
  });

  it("openid-configuration has all required endpoints", async () => {
    const body = await (await oidcConfig()).json();
    for (const k of ["issuer", "authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri"]) {
      expect(body[k]).toMatch(/^https:\/\/cloudless\.gr/);
    }
  });

  it("mcp server-card declares sse transport + capabilities", async () => {
    const body = await (await serverCard()).json();
    expect(body.transport.type).toBe("sse");
    expect(body.capabilities.tools).toBe(true);
  });

  it("agent-skills index lists the 3 published skills", async () => {
    const body = await (await skillsIndex()).json();
    expect(body.skills).toHaveLength(3);
    expect(body.skills[0].url).toBe("https://cloudless.gr/api/chat");
  });
});
