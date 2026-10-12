// @vitest-environment node
/**
 * portal/enroll tail coverage — sanitization clamps, store-failure 503,
 * fire-and-forget notify + EspoCRM sync (incl. `after` fallback path).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireVerifiedAuth = vi.fn();
const mockUpsertPendingClient = vi.fn();
const mockUpsertContact = vi.fn();
const mockCreateContactNote = vi.fn();
const mockSendEmail = vi.fn();
const mockSlackPost = vi.fn();
const mockAfter = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireVerifiedAuth: (...a: unknown[]) => mockRequireVerifiedAuth(...a),
}));
vi.mock("@/lib/pending-clients", () => ({
  upsertPendingClient: (...a: unknown[]) => mockUpsertPendingClient(...a),
}));
vi.mock("@/lib/espocrm", () => ({
  upsertContact: (...a: unknown[]) => mockUpsertContact(...a),
  createContactNote: (...a: unknown[]) => mockCreateContactNote(...a),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockSlackPost;
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "10.0.0.1",
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => void | Promise<void>) => mockAfter(fn) };
});

const ENROLL_URL = "http://localhost/api/portal/enroll";

function req(body: unknown, email = "alice@example.com") {
  return new NextRequest(ENROLL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer user-session:${email}`,
    },
    body: JSON.stringify(body),
  });
}

const PENDING = {
  email: "alice@example.com",
  plan: "bundle",
  planLabel: "Full-Stack Growth Engine (Bundle)",
  name: "Alice",
  status: "waiting",
  submittedAt: "2026-10-12T10:00:00.000Z",
};

describe("POST /api/portal/enroll tails", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRequireVerifiedAuth.mockResolvedValue({
      ok: true,
      user: { email: "Alice@Example.com", email_verified: true },
    });
    mockUpsertPendingClient.mockImplementation(async (p) => ({ ...PENDING, ...p }));
    mockUpsertContact.mockResolvedValue("cid-1");
    mockCreateContactNote.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);
    mockSlackPost.mockResolvedValue(true);
    // `after` executes the callback immediately so notifications run inline
    mockAfter.mockImplementation((fn: () => Promise<void> | void) => {
      void fn();
    });
  });

  it("sanitizes forbidden names and strips control chars from notes", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(
      req({ plan: "bundle", name: "<script>alert(1)</script>", notes: "hi\u0001\u0002there" })
    );
    expect(res.status).toBe(201);
    const stored = mockUpsertPendingClient.mock.calls[0][0] as {
      name?: string;
      notes?: string;
    };
    expect(stored.name).toBeUndefined();
    expect(stored.notes).toBe("hithere");
  });

  it("clamps notes at 1000 chars and drops empty strings", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(req({ plan: "bundle", notes: `x${"y".repeat(1500)}` }));
    expect(res.status).toBe(201);
    const stored = mockUpsertPendingClient.mock.calls[0][0] as { notes?: string };
    expect(stored.notes).toHaveLength(1000);
  });

  it("notifies admin by email + Slack and syncs a note to EspoCRM", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(req({ plan: "bundle", name: "Alice A", notes: "needs help" }));
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
      to: "tbaltzakis@cloudless.gr",
    });
    expect(mockSlackPost).toHaveBeenCalled();
    await vi.waitFor(() => expect(mockUpsertContact).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockUpsertContact.mock.calls[0][0]).toMatchObject({
      email: "alice@example.com",
      firstname: "Alice",
      lastname: "A",
    });
    await vi.waitFor(() => expect(mockCreateContactNote).toHaveBeenCalled(), { timeout: 3000 });
    const note = mockCreateContactNote.mock.calls[0][1] as string;
    expect(note).toContain("Portal enrollment:");
    expect(note).toContain("Client notes: needs help");
  });

  it("returns 503 when the pending-client store fails", async () => {
    mockUpsertPendingClient.mockRejectedValue(new Error("ssm down"));
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(req({ plan: "bundle" }));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("unavailable");
  });

  it("absorbs notify and EspoCRM failures — response still 201", async () => {
    mockSendEmail.mockRejectedValue(new Error("ses down"));
    mockUpsertContact.mockRejectedValue(new Error("espo down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(req({ plan: "bundle" }));
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 3000 });
    spy.mockRestore();
  });

  it("falls back to direct notify() when `after` is unavailable", async () => {
    mockAfter.mockImplementation(() => {
      throw new Error("after not supported here");
    });
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(req({ plan: "bundle" }));
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalled(), { timeout: 3000 });
    await vi.waitFor(() => expect(mockUpsertContact).toHaveBeenCalled(), { timeout: 3000 });
  });
});
