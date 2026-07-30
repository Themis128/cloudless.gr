import { describe, it, expect, vi, beforeEach } from "vitest";

describe("fetch-with-auth.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new globalThis.Response("{}", { status: 200 })));
  });

  it("uses same-origin credentials and does not attach Authorization", async () => {
    const { fetchWithAuth, clearSessionCache } = await import("@/lib/fetch-with-auth");
    clearSessionCache();
    await fetchWithAuth("/api/test");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        credentials: "same-origin",
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    );
  });

  it("preserves caller headers without adding Bearer", async () => {
    const { fetchWithAuth, clearSessionCache } = await import("@/lib/fetch-with-auth");
    clearSessionCache();
    const res = await fetchWithAuth("/api/admin/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/data",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
