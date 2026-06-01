/**
 * /api/user/profile — updates the signed-in user's Keycloak profile through a
 * same-origin server route (the browser cannot call Keycloak's Account API
 * directly due to CORS → "Failed to fetch"). These tests verify the auth gate
 * and that name → firstName/lastName + company/phone attributes are sent to
 * Keycloak's Account API, merging existing attributes rather than clobbering.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: authMock }));

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/user/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  vi.restoreAllMocks();
  // setup.ts deletes KEYCLOAK_ISSUER in its beforeEach; restore it here.
  vi.stubEnv("KEYCLOAK_ISSUER", "https://auth.test/realms/master");
});

describe("POST /api/user/profile", () => {
  it("401 when there is no session/accessToken", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(makeReq({ name: "A B" }));
    expect(res.status).toBe(401);
  });

  it("updates name + attributes and merges existing attributes", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, accessToken: "tok-abc" });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      // 1) GET current account (existing attributes to merge)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            firstName: "Old",
            lastName: "Name",
            email: "u@x.gr",
            attributes: { locale: ["en"] },
          }),
          { status: 200 }
        )
      )
      // 2) POST update
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(
      makeReq({ name: "Baltzakis Themistoklis", company: "cloudless.gr", phone: "+30123" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // Inspect the POST call (2nd fetch).
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://auth.test/realms/master/account");
    expect((init as RequestInit).method).toBe("POST");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.firstName).toBe("Baltzakis");
    expect(sent.lastName).toBe("Themistoklis");
    expect(sent.attributes).toMatchObject({
      locale: ["en"], // merged, not clobbered
      company: ["cloudless.gr"],
      phone: ["+30123"],
    });
  });

  it("surfaces Keycloak validation errors instead of an opaque failure", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, accessToken: "tok-abc" });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ attributes: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response("attribute not supported", { status: 400 }));

    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(makeReq({ company: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Failed to update profile/);
  });
});
