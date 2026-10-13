import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ POSTIZ_API_URL: "", POSTIZ_API_KEY: "" });

import {
  PostizNotConfiguredError,
  PostizApiError,
  isPostizConfigured,
  listPostizIntegrations,
  listIntegrations,
  deletePost,
  schedulePost,
  withSocialUtm,
  createPostsBulk,
  listGroups,
  isApiKeyValid,
} from "@/lib/postiz";

describe("PostizNotConfiguredError", () => {
  it("is an Error with the correct name", () => {
    const err = new PostizNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PostizNotConfiguredError");
  });
});

describe("PostizApiError", () => {
  it("is an Error with status and body", () => {
    const err = new PostizApiError(404, "not found");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toContain("404");
  });
});

describe("isPostizConfigured", () => {
  it("returns false when POSTIZ_API_URL is empty", async () => {
    expect(await isPostizConfigured()).toBe(false);
  });
});

describe("listPostizIntegrations", () => {
  it("returns [] when Postiz is not configured", async () => {
    expect(await listPostizIntegrations()).toEqual([]);
  });
});

describe("postizFetch plumbing", () => {
  it("attaches Cloudflare Access headers when a service token is configured", async () => {
    mockGetCfg.mockResolvedValueOnce({
      POSTIZ_API_URL: "https://postiz.test",
      POSTIZ_API_KEY: "key",
    });
    vi.stubEnv("POSTIZ_SERVICE_TOKEN", "cid:csec");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await listIntegrations();
      const headers = new Headers(fetchMock.mock.calls[0][1].headers);
      expect(headers.get("Cf-Access-Client-Id")).toBe("cid");
      expect(headers.get("Cf-Access-Client-Secret")).toBe("csec");
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it("resolves a non-JSON 200 response body as undefined", async () => {
    mockGetCfg.mockResolvedValueOnce({
      POSTIZ_API_URL: "https://postiz.test",
      POSTIZ_API_KEY: "key",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } })
      )
    );
    try {
      await expect(deletePost("post-1")).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("withSocialUtm", () => {
  it("appends source/medium/campaign and preserves existing params", () => {
    const out = withSocialUtm("https://cloudless.gr/contact?ref=nav", "linkedin", "launch");
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("linkedin");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_campaign")).toBe("launch");
    expect(u.searchParams.get("ref")).toBe("nav");
  });

  it("keeps pre-existing utm params untouched", () => {
    const out = withSocialUtm(
      "https://cloudless.gr/x?utm_source=keep&utm_medium=keep&utm_campaign=keep",
      "x"
    );
    expect(out).toContain("utm_source=keep");
    expect(out).toContain("utm_campaign=keep");
  });

  it("passes through non-URLs and unparseable input", () => {
    expect(withSocialUtm("cloudless.gr", "x")).toBe("cloudless.gr");
    expect(withSocialUtm("http://[bad", "x")).toBe("http://[bad");
  });
});

describe("schedulePost settings", () => {
  it("builds per-identifier settings for every connected channel", async () => {
    mockGetCfg.mockResolvedValue({
      POSTIZ_API_URL: "https://postiz.test",
      POSTIZ_API_KEY: "key",
    });
    const integrations = [
      { id: "i-x", name: "X", identifier: "x" },
      { id: "i-lp", name: "LI Page", identifier: "linkedin-page" },
      { id: "i-igs", name: "IG", identifier: "instagram-standalone" },
      { id: "i-tt", name: "TT", identifier: "tiktok" },
      { id: "i-other", name: "Other", identifier: "mastodon" },
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/integrations")) {
        return Promise.resolve(
          new Response(JSON.stringify(integrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([{ id: "post-1" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await schedulePost({
        integrationIds: integrations.map((i) => i.id),
        content: "Ship it",
      });
      expect(result.ok).toBe(true);
      const postCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/posts"));
      const body = JSON.parse(postCall[1].body as string) as {
        posts: { integration: { id: string }; settings: Record<string, unknown> }[];
      };
      const byId = Object.fromEntries(
        body.posts.map((post) => [post.integration.id, post.settings])
      );
      expect(byId["i-x"]).toMatchObject({ __type: "x", who_can_reply_post: "everyone" });
      expect(byId["i-lp"]).toMatchObject({
        __type: "linkedin-page",
        post_as_images_carousel: false,
      });
      expect(byId["i-igs"]).toMatchObject({ __type: "instagram-standalone", post_type: "post" });
      expect(byId["i-tt"]).toMatchObject({
        __type: "tiktok",
        privacy_level: "PUBLIC_TO_EVERYONE",
        content_posting_method: "DIRECT_POST",
      });
      expect(byId["i-other"]).toMatchObject({ __type: "mastodon" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("postiz tails", () => {
  const configured = () => {
    mockGetCfg.mockResolvedValueOnce({
      POSTIZ_API_URL: "https://postiz.example",
      POSTIZ_API_KEY: "pk-test",
    });
  };

  it("throws PostizApiError with content-type detail on malformed JSON", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(listGroups()).rejects.toThrow(PostizApiError);
  });

  it("listGroups returns [] on a 404 (older Postiz builds lack /groups)", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(new Response("nf", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listGroups()).resolves.toEqual([]);
  });

  it("isApiKeyValid reports connected:false on a 404 probe", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(new Response("nf", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(isApiKeyValid()).resolves.toEqual({ connected: false });
  });

  it("createPostsBulk captures a generic (non-PostizApiError) failure per post", async () => {
    configured();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("socket hang up"));
    vi.stubGlobal("fetch", fetchMock);
    const [result] = await createPostsBulk([
      {
        date: "2026-01-01T00:00:00Z",
        type: "schedule",
        shortLink: false,
        tags: [],
        posts: [
          {
            integration: { id: "i1" },
            value: [{ content: "hi", image: [] }],
            settings: {},
          },
        ],
      },
    ] as never[]);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("socket hang up");
    expect(result.status).toBeUndefined();
  });
});
