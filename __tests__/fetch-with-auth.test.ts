import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchAuthSession = vi.fn();

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: () => mockFetchAuthSession(),
}));

describe("fetch-with-auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("throws when no ID token is available", async () => {
    mockFetchAuthSession.mockResolvedValueOnce({ tokens: {} });
    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    await expect(fetchWithAuth("/api/test")).rejects.toThrow("No ID token available");
  });

  it("calls fetch with Authorization header when token is available", async () => {
    mockFetchAuthSession.mockResolvedValueOnce({
      tokens: { idToken: { toString: () => "test-token-abc" } },
    });
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    const res = await fetchWithAuth("/api/admin/data");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/data",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token-abc" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("merges existing headers with the Authorization header", async () => {
    mockFetchAuthSession.mockResolvedValueOnce({
      tokens: { idToken: { toString: () => "tok" } },
    });
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    await fetchWithAuth("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer tok",
        }),
      }),
    );
  });

  it("re-throws when fetchAuthSession itself throws", async () => {
    mockFetchAuthSession.mockRejectedValueOnce(new Error("Amplify not configured"));
    const { fetchWithAuth } = await import("@/lib/fetch-with-auth");
    await expect(fetchWithAuth("/api/test")).rejects.toThrow("Amplify not configured");
  });
});
