// @vitest-environment node
/**
 * POST /api/auth/register — Cloudflare D1 via auth-d1.createUser (`user` table).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const createUserMock = vi.fn();
const getAuthDbMock = vi.fn();
const validateStrengthMock = vi.fn();
const validateSecretMock = vi.fn();

vi.mock("@/lib/auth-d1", () => ({
  createUser: (...a: unknown[]) => createUserMock(...a),
  getAuthDbFromEnv: (...a: unknown[]) => getAuthDbMock(...a),
  validatePasswordStrength: (...a: unknown[]) => validateStrengthMock(...a),
  validateSessionSecret: (...a: unknown[]) => validateSecretMock(...a),
}));

vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendActivationEmail: vi.fn().mockResolvedValue(undefined),
  notifyTeam: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/slack-notify", () => ({
  slackRegistrationNotify: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));

function req(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const strongPassword = "Str0ng!Pass";

describe("POST /api/auth/register (D1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    validateSecretMock.mockReturnValue({ valid: true });
    validateStrengthMock.mockReturnValue({ valid: true });
    getAuthDbMock.mockReturnValue({ prepare: vi.fn() });
    createUserMock.mockResolvedValue({
      user: { id: "u1", email: "new@cloudless.gr" },
    });
  });

  it("returns 503 when AUTH_DB is not bound", async () => {
    getAuthDbMock.mockReturnValue(null);
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: strongPassword }));
    expect(res.status).toBe(503);
  });

  it("returns 400 when email/password missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is weak", async () => {
    validateStrengthMock.mockReturnValue({ valid: false, error: "too weak" });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "weak" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("too weak");
  });

  it("creates user via auth-d1.createUser and returns token", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(
      req({ email: "New@Cloudless.gr", password: strongPassword, fullName: "Ada" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.token).toBe("string");
    expect(createUserMock).toHaveBeenCalledWith(
      expect.anything(),
      "new@cloudless.gr",
      strongPassword,
      "Ada"
    );
  });

  it("returns ok without error when user already exists (anti-enumeration)", async () => {
    createUserMock.mockResolvedValue({ error: "User already exists" });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "dup@cloudless.gr", password: strongPassword }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("register-d1 alias exports the same handler", async () => {
    const a = await import("@/app/api/auth/register/route");
    const b = await import("@/app/api/auth/register-d1/route");
    expect(b.POST).toBe(a.POST);
  });
});
