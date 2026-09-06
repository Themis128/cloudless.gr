import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReadFileSync } = vi.hoisted(() => ({ mockReadFileSync: vi.fn() }));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, readFileSync: mockReadFileSync };
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { readLocalManifest, validateManifest, applyManifest } from "@/lib/slack-manifest";

const sampleManifest = {
  _comment: "do not ship this",
  _docs: "https://example.com",
  _apply: "pnpm apply",
  display_information: { name: "Cloudless" },
  features: { slash_commands: [] },
};

function jsonResp(data: unknown, httpOk = true) {
  return Promise.resolve({
    ok: httpOk,
    status: httpOk ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadFileSync.mockReturnValue(JSON.stringify(sampleManifest));
});

describe("readLocalManifest", () => {
  it("returns the manifest without meta-fields", () => {
    const result = readLocalManifest();
    expect(result).not.toHaveProperty("_comment");
    expect(result).not.toHaveProperty("_docs");
    expect(result).not.toHaveProperty("_apply");
    expect(result).toHaveProperty("display_information");
  });
});

describe("validateManifest", () => {
  it("returns valid:true when the API responds ok:true", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true }));
    const result = await validateManifest("xapp-test");
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("returns valid:false with errors array from API", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResp({
        ok: false,
        errors: [{ pointer: "/features", message: "missing scopes" }],
      })
    );
    const result = await validateManifest("xapp-test");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("missing scopes");
  });

  it("returns valid:false with error string when errors array is absent", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "invalid_manifest" }));
    const result = await validateManifest("xapp-test");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("invalid_manifest");
  });
});

describe("applyManifest", () => {
  it("returns ok:true and the app ID on success", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true, app_id: "A123" }));
    const result = await applyManifest("A123", "xoxp-test");
    expect(result).toEqual({ ok: true, appId: "A123" });
  });

  it("throws when the API returns ok:false", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "not_authed" }));
    await expect(applyManifest("A123", "bad-token")).rejects.toThrow("apps.manifest.update");
  });
});
