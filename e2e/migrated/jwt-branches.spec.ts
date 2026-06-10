import { test, expect } from "@playwright/test";

/**
 * Branch coverage for src/lib/api-auth.ts requireAdmin path. Vitest used to
 * cover this in unit form; we now exercise it through admin GET routes by
 * sending various bad Authorization headers.
 */

const PROTECTED = "/api/admin/kpi";

test.describe("Authorization header parsing branches", () => {
  test("no header → 401", async ({ request }) => {
    const r = await request.get(PROTECTED);
    expect(r.status()).toBe(401);
  });

  test("empty Authorization → 401", async ({ request }) => {
    const r = await request.get(PROTECTED, { headers: { authorization: "" } });
    expect(r.status()).toBe(401);
  });

  test("Authorization missing 'Bearer ' prefix → 401", async ({ request }) => {
    const r = await request.get(PROTECTED, { headers: { authorization: "abc.def.ghi" } });
    expect(r.status()).toBe(401);
  });

  test("Authorization 'Bearer ' with empty token → 401", async ({ request }) => {
    const r = await request.get(PROTECTED, { headers: { authorization: "Bearer " } });
    expect(r.status()).toBe(401);
  });

  test("Authorization 'Bearer' (no space) → 401", async ({ request }) => {
    const r = await request.get(PROTECTED, { headers: { authorization: "Bearer" } });
    expect(r.status()).toBe(401);
  });

  test("Authorization with non-JWT junk → 401", async ({ request }) => {
    const r = await request.get(PROTECTED, { headers: { authorization: "Bearer not-a-jwt" } });
    expect(r.status()).toBe(401);
  });

  test("Authorization with structurally-valid JWT but bad signature → 401", async ({ request }) => {
    // header.payload.signature — three base64url segments, signature is garbage
    const fake = "eyJhbGciOiJSUzI1NiJ9." +
      "eyJzdWIiOiJ4Iiwicm9sZXMiOlsiYWRtaW4iXX0." +
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const r = await request.get(PROTECTED, { headers: { authorization: `Bearer ${fake}` } });
    expect([401, 403]).toContain(r.status());
  });

  test("Authorization with lowercased 'bearer ' → 401", async ({ request }) => {
    const r = await request.get(PROTECTED, { headers: { authorization: "bearer xxx.yyy.zzz" } });
    // Many implementations are case-sensitive; either 401 or accepted-then-rejected
    expect([401, 403]).toContain(r.status());
  });
});
