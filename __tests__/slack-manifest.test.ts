import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  };
});

import { validateManifest, applyManifest, readLocalManifest } from "@/lib/slack-manifest";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

describe("slack-manifest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    readFileSyncMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("readLocalManifest", () => {
    it("strips _comment / _docs / _apply meta fields", () => {
      // The fs mock can't override readFileSync from this layer (slack-manifest
      // imports it before vi.mock takes effect for an external dep). Verify
      // the contract against the real file: meta fields are stripped, real
      // schema keys survive.
      const m = readLocalManifest();
      expect(m._comment).toBeUndefined();
      expect(m._docs).toBeUndefined();
      expect(m._apply).toBeUndefined();
      expect(m.display_information).toBeDefined();
      expect(m.oauth_config).toBeDefined();
    });
  });

  describe("validateManifest", () => {
    it("returns valid=true when Slack ok:true", async () => {
      readFileSyncMock.mockReturnValueOnce(JSON.stringify({ display_information: { name: "x" } }));
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      const r = await validateManifest("xapp-x");
      expect(r.valid).toBe(true);
      expect(r.errors).toEqual([]);
    });

    it("maps Slack validation errors to <pointer>: <message>", async () => {
      readFileSyncMock.mockReturnValueOnce(JSON.stringify({ display_information: { name: "x" } }));
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          errors: [
            { pointer: "/oauth_config/scopes/bot/0", message: "Invalid scope" },
            { pointer: "/display_information/name", message: "Required" },
          ],
        }),
      });
      const r = await validateManifest("xapp-x");
      expect(r.valid).toBe(false);
      expect(r.errors).toContain("/oauth_config/scopes/bot/0: Invalid scope");
      expect(r.errors).toContain("/display_information/name: Required");
    });

    it("falls back to res.error when errors[] is absent", async () => {
      readFileSyncMock.mockReturnValueOnce("{}");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "invalid_auth" }),
      });
      const r = await validateManifest("xapp-x");
      expect(r.valid).toBe(false);
      expect(r.errors).toEqual(["invalid_auth"]);
    });

    it("throws on HTTP error", async () => {
      readFileSyncMock.mockReturnValueOnce("{}");
      fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });
      await expect(validateManifest("xapp-x")).rejects.toThrow(/HTTP 502/);
    });
  });

  describe("applyManifest", () => {
    it("returns ok+appId on success", async () => {
      readFileSyncMock.mockReturnValueOnce("{}");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, app_id: "A123" }),
      });
      const r = await applyManifest("A123", "xoxp-x");
      expect(r).toEqual({ ok: true, appId: "A123" });
    });

    it("preserves the requested appId when Slack omits it from the response", async () => {
      readFileSyncMock.mockReturnValueOnce("{}");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      const r = await applyManifest("A999", "xoxp-x");
      expect(r.appId).toBe("A999");
    });

    it("throws on Slack ok:false", async () => {
      readFileSyncMock.mockReturnValueOnce("{}");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "not_allowed_token_type" }),
      });
      await expect(applyManifest("A1", "xoxb-bot")).rejects.toThrow(/not_allowed_token_type/);
    });

    it("sends app_id and manifest in the request body", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, app_id: "A1" }),
      });
      await applyManifest("A1", "xoxp-x");
      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse((init as { body: string }).body);
      expect(body.app_id).toBe("A1");
      expect(typeof body.manifest).toBe("string");
      const m = JSON.parse(body.manifest);
      expect(m.display_information).toBeDefined();
    });
  });
});
