import { describe, it, expect, vi, beforeEach } from "vitest";

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
    vi.resetModules();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new globalThis.Response("{}", { status: 200 })));
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
  });

  it("D1 mode: skips getSession and does not attach Authorization", async () => {
    mockGetSession.mockResolvedValue({ idToken: "should-not-attach" });

    const { fetchWithAuth, clearSessionCache } = await import("@/lib/fetch-with-auth");
    clearSessionCache();
    await fetchWithAuth("/api/test");

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        credentials: "same-origin",
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      })
    );
  });

  it("cognito: calls fetch with Authorization header when session has idToken", async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
    mockGetSession.mockResolvedValue({ idToken: "test-token-abc" });

    const { fetchWithAuth, clearSessionCache } = await import("@/lib/fetch-with-auth");
    clearSessionCache();
    const res = await fetchWithAuth("/api/admin/data");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/data",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token-abc" }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("cognito: merges existing headers with the Authorization header", async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
    mockGetSession.mockResolvedValue({ idToken: "tok" });

    const { fetchWithAuth, clearSessionCache } = await import("@/lib/fetch-with-auth");
    clearSessionCache();
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

  it("cognito: still calls fetch when getSession returns session without idToken", async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
    mockGetSession.mockResolvedValue({ user: { email: "a@b.com" } });

    const { fetchWithAuth, clearSessionCache } = await import("@/lib/fetch-with-auth");
    clearSessionCache();
    const res = await fetchWithAuth("/api/public");

    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/public",
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      })
    );
  });
});
