/**
 * Coverage-tail batch 5 — final src/lib clusters.
 * Real implementations under test; only true I/O boundaries stubbed
 * (global fetch, env credentials, Slack config lookup).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Blob as NodeBlob } from "node:buffer";

const libs = vi.hoisted(() => ({ slackConfig: vi.fn() }));

vi.mock("@/lib/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations")>("@/lib/integrations");
  return { ...actual, getSlackConfigAsync: libs.slackConfig };
});

import { classifyIntentLocal } from "@/lib/nlp/language";
import { mapGoldRowsForGscDimension } from "@/lib/gsc-dimension-gold";
import {
  isEspoRecordId,
  emptyAttribution,
  emptyScores,
  matchGoldAttributionRows,
  matchRfmChurnRow,
  contactDisplayName,
  normalizeEspoContact,
} from "@/lib/crm-contact-360-shared";
import {
  getChannelInfo,
  renameChannel,
  listChannels,
  createChannel,
  setChannelTopic,
  joinChannel,
  setChannelPurpose,
  archiveChannel,
  inviteToChannel,
  ensureChannel,
  ensureAllChannels,
} from "@/lib/slack-admin";
import { createNodeDataLakeBucket } from "@/lib/r2-node-bucket";
import { trackClientEvent } from "@/lib/track-client-event";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const okJson = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  libs.slackConfig.mockReset().mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-t" });
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// nlp/language classifyIntentLocal — lines 95-125
// ---------------------------------------------------------------------------
describe("classifyIntentLocal", () => {
  it("short message without service → spam_or_noise", () => {
    const r = classifyIntentLocal("hi");
    expect(r.intent).toBe("spam_or_noise");
    expect(r.reasons).toContain("very short message");
  });

  it("booking pattern match wins", () => {
    const r = classifyIntentLocal("I would like to book a call for next week please");
    expect(r.intent).toBe("booking");
    expect(r.reasons[0]).toMatch(/matched/);
  });

  it("repeated-character spam pattern → spam_or_noise", () => {
    const r = classifyIntentLocal("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(r.intent).toBe("spam_or_noise");
  });

  it("service keyword fallback → quote_request when nothing matches", () => {
    const r = classifyIntentLocal("tell me about your offering", "cloud growth");
    expect(r.intent).toBe("quote_request");
    expect(r.confidence).toBe(0.55);
  });

  it("no pattern + no matching service → general_inquiry", () => {
    const r = classifyIntentLocal("just saying hello to the team today", "misc");
    expect(r.intent).toBe("general_inquiry");
    expect(r.reasons).toContain("no strong intent pattern");
  });
});

// ---------------------------------------------------------------------------
// gsc-dimension-gold — page/country/device/query_page/product/default
// ---------------------------------------------------------------------------
describe("mapGoldRowsForGscDimension", () => {
  const sections = {
    top_pages: [
      { page: "/store/x", clicks: 9, impressions: 90, ctr: 0.1, avg_position: 2 },
      { page: "/blog/y", clicks: 4, impressions: 40, ctr: 0.1, avg_position: 5 },
    ],
    gsc_countries: [{ country: "grc", clicks: 7, impressions: 70, ctr: 0.1, position: 3 }],
    gsc_devices: [{ device: "MOBILE", clicks: 5, impressions: 50, ctr: 0.1, position: 4 }],
    gsc_query_pages: [{ query: "cloud", page: "/x", clicks: 2 }],
  };

  it("page dimension maps top_pages", () => {
    const r = mapGoldRowsForGscDimension("page", sections);
    expect(r.rows).toHaveLength(2);
    expect(r.note).toContain("top_pages");
  });

  it("country dimension maps gsc_countries", () => {
    const r = mapGoldRowsForGscDimension("country", sections);
    expect(r.rows[0]).toMatchObject({ country: "grc" });
  });

  it("device dimension maps gsc_devices", () => {
    const r = mapGoldRowsForGscDimension("device", sections);
    expect(r.rows[0]).toMatchObject({ device: "MOBILE" });
  });

  it("query_page passes through gsc_query_pages", () => {
    const r = mapGoldRowsForGscDimension("query_page", sections);
    expect(r.rows).toEqual(sections.gsc_query_pages);
  });

  it("product dimension filters top_pages to /store/", () => {
    const r = mapGoldRowsForGscDimension("product", sections);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ page: "/store/x", clicks: 9 });
  });

  it("unknown dimension → empty rows + note", () => {
    const r = mapGoldRowsForGscDimension("nope", sections);
    expect(r.rows).toEqual([]);
    expect(r.note).toContain("not in gold");
  });
});

// ---------------------------------------------------------------------------
// crm-contact-360-shared — pure helpers
// ---------------------------------------------------------------------------
describe("crm-contact-360-shared helpers", () => {
  it("isEspoRecordId validates Espo id shape", () => {
    expect(isEspoRecordId("abc123XYZ")).toBe(true);
    expect(isEspoRecordId("not-an-id!")).toBe(false);
    expect(isEspoRecordId("short")).toBe(false);
  });

  it("emptyAttribution / emptyScores return zeroed shapes", () => {
    expect(emptyAttribution()).toEqual({ firstTouch: null, goldMatches: [] });
    expect(emptyScores().rfmScore).toBeNull();
  });

  it("matchGoldAttributionRows returns [] on empty inputs", () => {
    expect(matchGoldAttributionRows([], [{ source: "g", medium: "m", campaign: "c" }])).toEqual([]);
    expect(matchGoldAttributionRows([{ utm_source: "g" }], [])).toEqual([]);
  });

  it("matchGoldAttributionRows matches normalized utm keys and skips non-matches", () => {
    const touches = [{ source: " google ", medium: "cpc", campaign: "spring" }];
    const gold = [
      {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "spring",
        sessions: 10,
        signups: 2,
        purchases: 1,
        revenue: 99,
      },
      { utmSource: "bing", utmMedium: "cpc", utmCampaign: "spring" },
      { utm_source: "google", utm_medium: "", utm_campaign: "" },
    ];
    const r = matchGoldAttributionRows(gold, touches);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ utmSource: "google", sessions: 10, revenue: 99 });
  });

  it("matchRfmChurnRow handles empty email, no match, and full row", () => {
    expect(matchRfmChurnRow([{ email: "a@b.c" }], "   ")).toEqual(emptyScores());
    expect(matchRfmChurnRow([], "a@b.c")).toEqual(emptyScores());
    expect(matchRfmChurnRow([{ email: "x@y.z" }], "a@b.c")).toEqual(emptyScores());
    const scores = matchRfmChurnRow(
      [
        {
          email: "A@b.c",
          last_purchase_at: "2026-01-01",
          risk_band: "low",
          rfm_score: "9",
          recency_days: 3,
          frequency: 4,
          monetary: 500,
          churn_risk: 0.1,
        },
      ],
      "a@b.c"
    );
    expect(scores).toMatchObject({
      rfmScore: 9,
      recencyDays: 3,
      frequency: 4,
      monetary: 500,
      churnScore: 0.1,
      riskBand: "low",
      lastPurchaseAt: "2026-01-01",
    });
  });

  it("matchRfmChurnRow coerces non-numeric scores to null/0 via asNumber helpers", () => {
    const scores = matchRfmChurnRow(
      [{ email: "a@b.c", rfm_score: "not-a-number", churn_score: "" }],
      "a@b.c"
    );
    expect(scores.rfmScore).toBeNull();
    expect(scores.churnScore).toBeNull();
  });

  it("contactDisplayName prefers name, falls back to email then dash", () => {
    expect(contactDisplayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(contactDisplayName({ email: "a@b.c" })).toBe("a@b.c");
    expect(contactDisplayName({})).toBe("—");
  });

  it("normalizeEspoContact maps fields incl. leadSource/source fallback", () => {
    const withSource = normalizeEspoContact({
      id: "r1",
      emailAddress: "a@b.c",
      firstName: "A",
      lastName: "B",
      phoneNumber: "123",
      accountName: "Co",
      accountId: "acc9",
      source: "referral",
    });
    expect(withSource).toMatchObject({
      id: "r1",
      email: "a@b.c",
      company: "Co",
      accountId: "acc9",
      leadSource: "referral",
    });
    const withLeadSource = normalizeEspoContact({ leadSource: "ads" });
    expect(withLeadSource.leadSource).toBe("ads");
  });
});

// ---------------------------------------------------------------------------
// slack-admin — full channel management surface (fetch stubbed at boundary)
// ---------------------------------------------------------------------------
describe("slack-admin channel ops", () => {
  const ch = (over: Record<string, unknown> = {}) => ({
    id: "C1",
    name: "orders",
    is_private: false,
    is_member: true,
    is_archived: false,
    ...over,
  });

  it("listChannels paginates via next_cursor and accumulates", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          ok: true,
          channels: [ch({ id: "C1" })],
          response_metadata: { next_cursor: "cur2" },
        })
      )
      .mockResolvedValueOnce(okJson({ ok: true, channels: [ch({ id: "C2", name: "alerts" })] }));
    const all = await listChannels("tok");
    expect(all.map((c) => c.id)).toEqual(["C1", "C2"]);
    expect(String(mockFetch.mock.calls[1][0])).toContain("cursor=cur2");
  });

  it("listChannels throws on slack-level error", async () => {
    mockFetch.mockResolvedValue(okJson({ ok: false, error: "invalid_auth" }));
    await expect(listChannels("tok")).rejects.toThrow("conversations.list: invalid_auth");
  });

  it("createChannel returns channel / throws on error", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ ok: true, channel: ch({ name: "newch" }) }));
    expect((await createChannel("newch", "tok")).name).toBe("newch");
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "name_taken" }));
    await expect(createChannel("newch", "tok")).rejects.toThrow("name_taken");
  });

  it("setChannelTopic + setChannelPurpose resolve on ok, throw on error", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ ok: true }));
    await expect(setChannelTopic("C1", "t", "tok")).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "too_long" }));
    await expect(setChannelTopic("C1", "t", "tok")).rejects.toThrow("setTopic: too_long");

    mockFetch.mockResolvedValueOnce(okJson({ ok: true }));
    await expect(setChannelPurpose("C1", "p", "tok")).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "not_in_channel" }));
    await expect(setChannelPurpose("C1", "p", "tok")).rejects.toThrow("setPurpose");
  });

  it("joinChannel tolerates already_in_channel, throws other errors", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "already_in_channel" }));
    await expect(joinChannel("C1", "tok")).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "channel_not_found" }));
    await expect(joinChannel("C1", "tok")).rejects.toThrow("channel_not_found");
  });

  it("archiveChannel tolerates already_archived, throws other errors", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ ok: true }));
    await expect(archiveChannel("C1", "tok")).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "already_archived" }));
    await expect(archiveChannel("C1", "tok")).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "restricted_action" }));
    await expect(archiveChannel("C1", "tok")).rejects.toThrow("restricted_action");
  });

  it("inviteToChannel resolves on ok, throws on error", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ ok: true }));
    await expect(inviteToChannel("C1", ["U1", "U2"], "tok")).resolves.toBeUndefined();
    expect(String(mockFetch.mock.calls[0][1]?.body)).toContain("U1,U2");
    mockFetch.mockResolvedValueOnce(okJson({ ok: false, error: "user_not_found" }));
    await expect(inviteToChannel("C1", ["U9"], "tok")).rejects.toThrow("user_not_found");
  });

  it("ensureChannel: existing member → no join; non-member → joins; missing → creates+topics", async () => {
    const member = await ensureChannel("orders", "topic", "tok", [ch()]);
    expect(member).toEqual({ id: "C1", name: "orders", created: false, joined: false });

    mockFetch.mockResolvedValueOnce(okJson({ ok: true })); // conversations.join
    const joined = await ensureChannel("orders", "topic", "tok", [ch({ is_member: false })]);
    expect(joined).toEqual({ id: "C1", name: "orders", created: false, joined: true });

    mockFetch
      .mockResolvedValueOnce(okJson({ ok: true, channel: ch({ id: "C9", name: "fresh" }) }))
      .mockResolvedValueOnce(okJson({ ok: true })); // setTopic
    const created = await ensureChannel("fresh", "topic", "tok", []);
    expect(created).toEqual({ id: "C9", name: "fresh", created: true, joined: true });
  });

  it("ensureAllChannels provisions the whole registry", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("conversations.list")) {
        return okJson({ ok: true, channels: [ch({ name: "bookings", is_member: true })] });
      }
      if (url.includes("conversations.create")) {
        return okJson({ ok: true, channel: { id: "NEW", name: "x", is_member: true } });
      }
      return okJson({ ok: true }); // join / setTopic
    });
    const results = await ensureAllChannels();
    expect(results.bookings).toMatchObject({ id: "C1", created: false });
    expect(results.orders.created).toBe(true);
    expect(Object.keys(results)).toHaveLength(6);
  });

  it("getChannelInfo/renameChannel throw when ok but channel payload missing", async () => {
    mockFetch.mockImplementation(async () => okJson({ ok: true }));
    await expect(getChannelInfo("C1", "tok")).rejects.toThrow("conversations.info");
    await expect(renameChannel("C1", "n", "tok")).rejects.toThrow("conversations.rename");
  });

  it("ensureAllChannels throws when the bot token is missing", async () => {
    libs.slackConfig.mockResolvedValue({ SLACK_BOT_TOKEN: "" });
    await expect(ensureAllChannels()).rejects.toThrow("SLACK_BOT_TOKEN is not configured");
  });
});

// ---------------------------------------------------------------------------
// r2-node-bucket — real Node R2Bucket shim over stubbed fetch
// ---------------------------------------------------------------------------
describe("r2-node-bucket operations", () => {
  const creds = () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc");
    vi.stubEnv("CF_R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("CF_R2_SECRET_ACCESS_KEY", "secret");
  };

  it("put accepts string/bytes/stream/blob/null and maps content types", async () => {
    creds();
    const bucket = createNodeDataLakeBucket("bkt")!;
    mockFetch.mockResolvedValue(okJson({}, { headers: { etag: "e1" } }));

    await bucket.put("a.txt", "hello");
    await bucket.put("b.bin", new Uint8Array([1, 2, 3]));
    await bucket.put("c.bin", new Uint8Array([9]).buffer);
    await bucket.put(
      "d.bin",
      new ReadableStream({
        start: (c) => {
          c.enqueue(new Uint8Array([7]));
          c.close();
        },
      })
    );
    await bucket.put("e.bin", new Blob(["blobby"], { type: "text/plain" }));
    await bucket.put("f.bin", null);
    await bucket.put("g.txt", "typed", { httpMetadata: { contentType: "text/plain" } });
    await bucket.put("h.txt", "hdr", {
      httpMetadata: new Headers({ "content-type": "text/csv" }),
      customMetadata: { k: "v" },
    });
    expect(mockFetch).toHaveBeenCalledTimes(8);
    // aws4fetch signs into a Request before calling fetch
    const lastReq = mockFetch.mock.calls[7][0] as Request;
    expect(lastReq.headers.get("content-type")).toBe("text/csv");
  });

  it("get returns null on 404, throws on error, returns a working body on ok", async () => {
    creds();
    const bucket = createNodeDataLakeBucket("bkt")!;
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await bucket.get("missing")).toBeNull();

    // 403 (not 5xx) — aws4fetch retries >=500/429 with backoff; 403 returns at once.
    mockFetch.mockResolvedValueOnce(new Response("boom", { status: 403 }));
    await expect(bucket.get("bad")).rejects.toThrow("R2 GET bkt/bad → 403");

    // jsdom's Blob lacks .stream() — swap in the real Node Blob for this call.
    vi.stubGlobal("Blob", NodeBlob);
    mockFetch.mockResolvedValueOnce(
      new Response('{"n":1}', { status: 200, headers: { "content-type": "application/json" } })
    );
    const obj = (await bucket.get("ok.json"))!;
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", mockFetch);
    expect(await obj.json()).toEqual({ n: 1 });
    expect(await obj.text()).toBe('{"n":1}');
    expect((await obj.arrayBuffer()).byteLength).toBe(7);
    expect((await obj.blob()).type).toBe("application/json");
    expect(obj.size).toBe(7);
  });

  it("head returns null on 404 and maps headers on ok", async () => {
    creds();
    const bucket = createNodeDataLakeBucket("bkt")!;
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await bucket.head("k")).toBeNull();
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          "content-length": "42",
          "content-type": "text/plain",
          etag: "tag",
          "last-modified": "2026-01-01T00:00:00Z",
        },
      })
    );
    const meta = (await bucket.head("k"))!;
    expect(meta.size).toBe(42);
    expect(meta.httpMetadata.contentType).toBe("text/plain");
    expect(meta.etag).toBe("tag");

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(bucket.head("k")).rejects.toThrow("R2 HEAD bkt/k → 403");
  });

  it("delete handles single/array keys and non-404 errors", async () => {
    creds();
    const bucket = createNodeDataLakeBucket("bkt")!;
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(bucket.delete(["a", "b"])).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(bucket.delete("c")).rejects.toThrow("R2 DELETE bkt/c → 403");
  });

  it("list parses XML keys, truncation and continuation token", async () => {
    creds();
    const bucket = createNodeDataLakeBucket("bkt")!;
    const xml =
      "<ListBucketResult><IsTruncated>true</IsTruncated>" +
      "<NextContinuationToken>tok9</NextContinuationToken>" +
      "<Contents><Key>k1</Key></Contents><Contents><Key>k2</Key></Contents>" +
      "</ListBucketResult>";
    mockFetch.mockResolvedValueOnce(new Response(xml, { status: 200 }));
    const page = await bucket.list({ prefix: "p/", limit: 2, cursor: "cur", delimiter: "/" });
    expect(page.objects.map((o) => o.key)).toEqual(["k1", "k2"]);
    expect(page.truncated).toBe(true);
    expect(page.cursor).toBe("tok9");
    const req = mockFetch.mock.calls[0][0] as Request;
    expect(req.url).toContain("prefix=p%2F");
    expect(req.url).toContain("continuation-token=cur");

    mockFetch.mockResolvedValueOnce(new Response("denied", { status: 403 }));
    await expect(bucket.list()).rejects.toThrow("R2 LIST bkt → 403");
  });

  it("multipart stubs throw not-implemented errors", async () => {
    creds();
    const bucket = createNodeDataLakeBucket("bkt")!;
    await expect(bucket.createMultipartUpload("k")).rejects.toThrow("not implemented");
    expect(() => bucket.resumeMultipartUpload("k", "u")).toThrow("not implemented");
  });
});

// ---------------------------------------------------------------------------
// track-client-event — gtag/plausible dispatch + warn paths (jsdom window)
// ---------------------------------------------------------------------------
describe("trackClientEvent analytics fan-out", () => {
  it("dispatches gtag and plausible when present", () => {
    const w = window as unknown as {
      gtag?: (...a: unknown[]) => void;
      plausible?: (...a: unknown[]) => void;
    };
    w.gtag = vi.fn();
    w.plausible = vi.fn();
    trackClientEvent("cta_click", { plan: "pro" }, { path: "/x", locale: "en" });
    expect(w.gtag).toHaveBeenCalledWith("event", "cta_click", { plan: "pro" });
    expect(w.plausible).toHaveBeenCalledWith("cta_click", { props: { plan: "pro" } });
    delete w.gtag;
    delete w.plausible;
  });

  it("warns in non-production when gtag throws", () => {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag = () => {
      throw new Error("blocked");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    trackClientEvent("cta_click");
    expect(warn).toHaveBeenCalledWith("[analytics] gtag event failed", expect.any(Error));
    warn.mockRestore();
    delete w.gtag;
  });
});
