/**
 * POST /api/auth/reset-password — 500 when SESSION_SECRET is unset.
 * Separate file: the shared D1-route suite stubs the secret at module init.
 */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

delete process.env.SESSION_SECRET;

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    getAuthDbFromEnv: vi.fn(() => ({ prepare: vi.fn() })),
  };
});
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));

import { POST as resetPost } from "@/app/api/auth/reset-password/route";

describe("POST /api/auth/reset-password — missing SESSION_SECRET", () => {
  it("500s via createPasswordResetToken's error return", async () => {
    const res = await resetPost(
      new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@x.gr" }),
      })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
  });
});
