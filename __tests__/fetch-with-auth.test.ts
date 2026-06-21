import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearSessionCache } from "@/lib/fetch-with-auth";

const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  getSession: () => mockGetSession(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: unknown }) => children,
  useSession: vi.fn().mockReturnValue({ data: null, status: "unauthenticated" }),
}));

describe("fetch-with-auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    // Reset the module-level session cache so each test starts fresh.
    clearSessionCache();
  });

  it("calls fetch without Authorization when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new globalThis.Response("{}", { status: 200 })
    );

    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    await fetchWithAuth("/api/test");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      })
    );
  });

  it("calls fetch with Authorization header when session has idToken", async () => {
    mockGetSession.mockResolvedValueOnce({ idToken: "test-token-abc" });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new globalThis.Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    const res = await fetchWithAuth("/api/admin/data");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/data",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token-abc" }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("merges existing headers with the Authorization header", async () => {
    mockGetSession.mockResolvedValueOnce({ idToken: "tok" });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new globalThis.Response("{}", { status: 200 })
    );

    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    await fetchWithAuth("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer tok",
        }),
      })
    );
  });

  it("still calls fetch when getSession returns session without idToken", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { email: "a@b.com" } });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new globalThis.Response("{}", { status: 200 })
    );

    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    const res = await fetchWithAuth("/api/public");

    expect(res.status).toBe(200);
  });
});
