import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs.readFileSync so tests don't depend on the file on disk
const FAKE_MANIFEST = JSON.stringify({
  _comment: "ignore",
  _docs: "ignore",
  _apply: "ignore",
  display_information: { name: "Cloudless" },
  features: {
    bot_user: { display_name: "Cloudless", always_online: false },
    slash_commands: [
      { command: "/cloudless-status", url: "https://cloudless.gr/api/slack/commands" },
      { command: "/cloudless-orders", url: "https://cloudless.gr/api/slack/commands" },
      { command: "/cloudless-channels", url: "https://cloudless.gr/api/slack/commands" },
      { command: "/cloudless-help", url: "https://cloudless.gr/api/slack/commands" },
    ],
  },
  oauth_config: { scopes: { bot: ["chat:write", "channels:read"] } },
  settings: { socket_mode_enabled: false },
});

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, readFileSync: vi.fn(() => FAKE_MANIFEST) };
});

vi.mock("path", () => ({
  default: { join: (...args: string[]) => args.join("/") },
  join: (...args: string[]) => args.join("/"),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function apiOk(extra: Record<string, unknown> = {}) {
  return { ok: true, json: async () => ({ ok: true, ...extra }) };
}

function apiErr(error: string, errors?: Array<{ message: string; pointer: string }>) {
  return { ok: true, json: async () => ({ ok: false, error, errors }) };
}

describe("slack-manifest.ts", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("readLocalManifest", () => {
    it("strips _comment, _docs, _apply meta-fields", async () => {
      const { readLocalManifest } = await import("@/lib/slack-manifest");
      const m = readLocalManifest();
      expect(m).not.toHaveProperty("_comment");
      expect(m).not.toHaveProperty("_docs");
      expect(m).not.toHaveProperty("_apply");
      expect(m).toHaveProperty("display_information");
      expect(m).toHaveProperty("features");
    });

    it("includes all 4 slash commands", async () => {
      const { readLocalManifest } = await import("@/lib/slack-manifest");
      const m = readLocalManifest() as { features: { slash_commands: Array<{ command: string }> } };
      const commands = m.features.slash_commands.map((c) => c.command);
      expect(commands).toContain("/cloudless-status");
      expect(commands).toContain("/cloudless-orders");
      expect(commands).toContain("/cloudless-channels");
      expect(commands).toContain("/cloudless-help");
    });
  });

  describe("validateManifest", () => {
    it("returns valid:true when API responds ok", async () => {
      const { validateManifest } = await import("@/lib/slack-manifest");
      mockFetch.mockResolvedValueOnce(apiOk());

      const result = await validateManifest("xapp-test");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("apps.manifest.validate");
      expect(call[1].headers.Authorization).toBe("Bearer xapp-test");
    });

    it("returns errors when validation fails", async () => {
      const { validateManifest } = await import("@/lib/slack-manifest");
      mockFetch.mockResolvedValueOnce(
        apiErr("invalid_manifest", [
          { pointer: "/features/slash_commands/0", message: "url is required" },
        ])
      );

      const result = await validateManifest("xapp-test");
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("url is required");
    });

    it("falls back to error string when no errors array", async () => {
      const { validateManifest } = await import("@/lib/slack-manifest");
      mockFetch.mockResolvedValueOnce(apiErr("not_allowed"));

      const result = await validateManifest("xapp-test");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe("not_allowed");
    });
  });

  describe("applyManifest", () => {
    it("posts to apps.manifest.update and returns app ID", async () => {
      const { applyManifest } = await import("@/lib/slack-manifest");
      mockFetch.mockResolvedValueOnce(apiOk({ app_id: "A001" }));

      const result = await applyManifest("A001", "xoxp-test");
      expect(result.ok).toBe(true);
      expect(result.appId).toBe("A001");

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("apps.manifest.update");
      const body = JSON.parse(call[1].body);
      expect(body.app_id).toBe("A001");
      expect(typeof body.manifest).toBe("string");
      const manifest = JSON.parse(body.manifest);
      expect(manifest.display_information.name).toBe("Cloudless");
    });

    it("throws on API error", async () => {
      const { applyManifest } = await import("@/lib/slack-manifest");
      mockFetch.mockResolvedValueOnce(apiErr("invalid_auth"));

      await expect(applyManifest("A001", "bad-token")).rejects.toThrow("invalid_auth");
    });

    it("falls back to passed appId when response omits app_id", async () => {
      const { applyManifest } = await import("@/lib/slack-manifest");
      mockFetch.mockResolvedValueOnce(apiOk()); // no app_id in response

      const result = await applyManifest("A999", "xoxp-test");
      expect(result.appId).toBe("A999");
    });
  });
});
