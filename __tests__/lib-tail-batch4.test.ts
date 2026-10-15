/**
 * Coverage tail batch 4 — pure-function and error-path lines across src/lib/*.
 * Each describe names the file + line(s) it covers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetConfig, mockSlackConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSlackConfig: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

vi.mock("@/lib/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations")>("@/lib/integrations");
  return { ...actual, getSlackConfigAsync: mockSlackConfig };
});

import { detectLeadLocale } from "@/lib/nlp/language";
import { classifyEmail } from "@/lib/mail-to-slack";
import { mapGoldRowsForGscDimension } from "@/lib/gsc-dimension-gold";
import { summarizeRelated, summarizeNote } from "@/lib/crm-contact-360-shared";
import { toEspoLeadData, type SocialAutoLead } from "@/lib/socialauto-leads";
import { getEffectiveInterval } from "@/lib/polling-utils";
import { getFunnelSessionId } from "@/lib/funnel-client";
import { loadGooglePrivateKey } from "@/lib/google-sa-key";
import { notifyPostPublished } from "@/lib/postiz-slack";
import { trackClientEvent } from "@/lib/track-client-event";
import { getChannelInfo, renameChannel } from "@/lib/slack-admin";
import { sendSocialAutoEvent } from "@/lib/socialauto-analytics";
import { getActiveWorkspaceId } from "@/lib/workspace-server";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import { createNodeDataLakeBucket } from "@/lib/r2-node-bucket";
import { isGoogleAdsConfigured } from "@/lib/campaigns/google-ads";
import { createGoogleAuth } from "@/lib/google-auth";
import { resetIndex } from "@/lib/meilisearch";
import { cancelQueueItem } from "@/lib/socialauto";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  mockGetConfig.mockReset().mockResolvedValue({});
  mockSlackConfig.mockReset().mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-t" });
});

describe("nlp/language detectLeadLocale", () => {
  it("detects Greek text as el", () => {
    expect(detectLeadLocale("γεια σας θέλω πληροφορίες")).toBe("el");
  });
  it("empty text falls back to pageLocale", () => {
    expect(detectLeadLocale("   ", "el")).toBe("el");
    expect(detectLeadLocale("", "en")).toBe("en");
  });
  it("English stopwords vote en", () => {
    expect(detectLeadLocale("I need a quote for the project please")).toBe("en");
  });
  it("no stopword hits falls back to pageLocale", () => {
    expect(detectLeadLocale("xyz qrs tuv", "el")).toBe("el");
    expect(detectLeadLocale("xyz qrs tuv")).toBe("en");
  });
});

describe("mail-to-slack classifyEmail", () => {
  it("applies spam_penalty when spam_score >= 4", () => {
    const r = classifyEmail({ from: "x@y.com", subject: "hi", spam_score: 5 });
    expect(r.reasons).toContain("spam_penalty");
    expect(r.score).toBeLessThan(0);
  });
});

describe("gsc-dimension-gold mapGoldRowsForGscDimension", () => {
  it("query dimension returns top_keywords rows", () => {
    const r = mapGoldRowsForGscDimension("query", {
      top_keywords: [{ query: "cloud", clicks: 3 }],
    });
    expect(r.rows).toEqual([{ query: "cloud", clicks: 3 }]);
  });
});

describe("crm-contact-360-shared asRecord", () => {
  it("summarize helpers tolerate non-object input", () => {
    expect(() => summarizeRelated(42)).not.toThrow();
    expect(() => summarizeNote(null)).not.toThrow();
  });
});

describe("socialauto-leads toEspoLeadData", () => {
  const lead: SocialAutoLead = { email: "a@b.c", source: "website" };
  it("unknown source maps to Other", () => {
    const d = toEspoLeadData({ ...lead, source: "carrier_pigeon" as never });
    expect(d.source).toBe("Other");
  });
  it("circular meta_data → stringifyMeta catch", () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    const d = toEspoLeadData({ ...lead, meta_data: circ });
    expect(d.description ?? "").not.toContain("self");
  });
});

describe("polling-utils SSR guard", () => {
  it("getEffectiveInterval works without window", () => {
    vi.stubGlobal("window", undefined);
    expect(getEffectiveInterval(1000)).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});

describe("funnel-client getFunnelSessionId", () => {
  it("falls back to anon_ when sessionStorage throws", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(getFunnelSessionId()).toMatch(/^anon_\d+$/);
    vi.unstubAllGlobals();
  });
});

describe("google-sa-key loadGooglePrivateKey", () => {
  it("rejects malformed PEM with a descriptive error", () => {
    expect(() =>
      loadGooglePrivateKey(
        "-----BEGIN PRIVATE KEY-----\n" + "QUJD".repeat(80) + "\n-----END PRIVATE KEY-----"
      )
    ).toThrow(/BEGIN PRIVATE KEY/);
  });
});

describe("postiz-slack shorten", () => {
  it("truncates long post content at 280 chars", async () => {
    const long = "x".repeat(400);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await notifyPostPublished({
      id: "p1",
      content: long,
      publishDate: "2026-06-16T10:00:00.000Z",
      state: "PUBLISHED",
      integration: { id: "fb", name: "FB", identifier: "facebook" },
    } as never);
    const sent = String(mockFetch.mock.calls[0]?.[1]?.body ?? "");
    expect(sent).toContain("…");
  });
});

describe("track-client-event", () => {
  it("warns when window.plausible throws (non-production)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const orig = window.plausible;
    (window as unknown as Record<string, unknown>).plausible = () => {
      throw new Error("plausible down");
    };
    trackClientEvent("test_event");
    expect(warn).toHaveBeenCalledWith("[analytics] plausible event failed", expect.any(Error));
    (window as unknown as Record<string, unknown>).plausible = orig;
    warn.mockRestore();
  });
});

describe("slack-admin", () => {
  it("getChannelInfo returns res.channel", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, channel: { id: "C1", name: "ops" } }))
    );
    const ch = await getChannelInfo("C1", "tok");
    expect(ch.id).toBe("C1");
  });
  it("renameChannel returns res.channel", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, channel: { id: "C1", name: "new" } }))
    );
    const ch = await renameChannel("C1", "new", "tok");
    expect(ch.name).toBe("new");
  });
});

describe("socialauto-analytics storage failures", () => {
  it("sends event with undefined session/visitor ids when storage throws", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(sendSocialAutoEvent({ event: "x" } as never)).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("workspace-server", () => {
  it("getActiveWorkspaceId() returns null when cookies() throws", async () => {
    await expect(getActiveWorkspaceId()).resolves.toBeNull();
  });
});

describe("r2-client getDataLakeBucketFromEnv", () => {
  it("returns null in Workers env with no bucket binding", () => {
    vi.stubGlobal("caches", {});
    expect(getDataLakeBucketFromEnv()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("r2-node-bucket", () => {
  it("rejects unsupported put body types", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc");
    vi.stubEnv("CF_R2_ACCESS_KEY_ID", "k");
    vi.stubEnv("CF_R2_SECRET_ACCESS_KEY", "s");
    const bucket = createNodeDataLakeBucket("b");
    expect(bucket).not.toBeNull();
    await expect(bucket!.put("k", { not: "a body" } as never)).rejects.toThrow(TypeError);
    vi.unstubAllEnvs();
  });
});

describe("campaigns/google-ads isGoogleAdsConfigured", () => {
  it("returns false when getConfig throws", async () => {
    mockGetConfig.mockRejectedValue(new Error("ssm down"));
    await expect(isGoogleAdsConfigured()).resolves.toBe(false);
  });
});

describe("google-auth createGoogleAuth", () => {
  it("rejects placeholder GOOGLE_PRIVATE_KEY", async () => {
    mockGetConfig.mockResolvedValue({
      GOOGLE_CLIENT_EMAIL: "svc@x.iam",
      GOOGLE_PRIVATE_KEY: "your_value_here",
    });
    const auth = createGoogleAuth("scope");
    await expect(auth()).rejects.toThrow(/placeholder|GOOGLE_PRIVATE_KEY/);
  });
});

describe("meilisearch resetIndex", () => {
  it("rethrows non-404 delete errors", async () => {
    vi.stubEnv("MEILI_HOST", "https://meili.local");
    vi.stubEnv("MEILI_ADMIN_KEY", "mk");
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(resetIndex([])).rejects.toThrow();
    vi.unstubAllEnvs();
  });
});

describe("socialauto cancelQueueItem", () => {
  it("returns {ok:false,error} on upstream failure", async () => {
    mockGetConfig.mockResolvedValue({
      SOCIALAUTO_ADMIN_EMAIL: "a@b.c",
      SOCIALAUTO_ADMIN_PASSWORD: "pw",
    });
    mockFetch.mockRejectedValue(new Error("net down"));
    const r = await cancelQueueItem("q1");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
