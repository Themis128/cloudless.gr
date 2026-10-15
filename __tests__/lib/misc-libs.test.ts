/**
 * Final lib batch — the last untested files:
 * d1-cache-entry, d1-params-hash, upstream-client, nlp/*, track-client-event.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const libs = vi.hoisted(() => ({
  callWorkersAiChat: vi.fn(async () => "{}"),
  isWorkersAiConfigured: vi.fn(() => true),
  trackPixelEvent: vi.fn(),
  sendSocialAutoEvent: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/workers-ai-client", () => ({
  callWorkersAiChat: libs.callWorkersAiChat,
  isWorkersAiConfigured: libs.isWorkersAiConfigured,
}));
vi.mock("@/lib/meta-pixel", () => ({ trackPixelEvent: libs.trackPixelEvent }));
vi.mock("@/lib/socialauto-analytics", () => ({
  sendSocialAutoEvent: libs.sendSocialAutoEvent,
}));

import { rowToEntry } from "@/lib/d1-cache-entry";
import { paramsHash } from "@/lib/d1-params-hash";
import {
  splitServiceToken,
  parseAnalyticsLookback,
  parseJsonOrThrow,
} from "@/lib/upstream-client";
import { detectLeadLocale, classifyIntentLocal } from "@/lib/nlp/language";
import { extractLeadEntities } from "@/lib/nlp/entities";
import { analyzeLeadMessage, LEAD_INTENTS } from "@/lib/nlp";
import { trackClientEvent } from "@/lib/track-client-event";

const now = () => Math.floor(Date.now() / 1000);

describe("rowToEntry", () => {
  it("null on missing payload/cached_at and bad JSON", () => {
    expect(rowToEntry({ result_json: null, cached_at: 1, expires_at: null }, 60)).toBeNull();
    expect(
      rowToEntry({ result_json: "{}", cached_at: null, expires_at: null }, 60)
    ).toBeNull();
    expect(
      rowToEntry({ result_json: "{bad", cached_at: now(), expires_at: null }, 60)
    ).toBeNull();
  });

  it("fresh vs stale-by-ttl vs stale-by-expiry", () => {
    const fresh = rowToEntry<{ a: number }>(
      { result_json: '{"a":1}', cached_at: now() - 10, expires_at: null },
      60
    )!;
    expect(fresh.stale).toBe(false);
    expect(fresh.ageSeconds).toBeGreaterThanOrEqual(10);
    expect(fresh.payload).toEqual({ a: 1 });

    const staleTtl = rowToEntry(
      { result_json: "1", cached_at: now() - 120, expires_at: null },
      60
    )!;
    expect(staleTtl.stale).toBe(true);

    const staleExp = rowToEntry(
      { result_json: "1", cached_at: now(), expires_at: now() - 1 },
      9999
    )!;
    expect(staleExp.stale).toBe(true);
  });
});

describe("paramsHash", () => {
  it("default for empty/null-only params; deterministic + key-sorted", () => {
    expect(paramsHash({})).toBe("default");
    expect(paramsHash({ a: undefined, b: null })).toBe("default");
    const h1 = paramsHash({ b: 2, a: 1 });
    const h2 = paramsHash({ a: 1, b: 2 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    expect(paramsHash({ a: 1 })).not.toBe(paramsHash({ a: 2 }));
  });
});

describe("upstream-client helpers", () => {
  it("splitServiceToken: explicit id + combined + null cases", () => {
    expect(splitServiceToken(null, null)).toBeNull();
    expect(splitServiceToken("sec", "id1")).toEqual({ clientId: "id1", clientSecret: "sec" });
    expect(splitServiceToken("id2:sec2", null)).toEqual({
      clientId: "id2",
      clientSecret: "sec2",
    });
    expect(splitServiceToken("nocolon", null)).toBeNull();
  });

  it("parseAnalyticsLookback allowlist", () => {
    expect(parseAnalyticsLookback("30")).toBe(30);
    expect(parseAnalyticsLookback("90")).toBe(90);
    expect(parseAnalyticsLookback("13")).toBe(7);
    expect(parseAnalyticsLookback(null)).toBe(7);
    expect(parseAnalyticsLookback("abc")).toBe(7);
  });

  it("parseJsonOrThrow wraps parse failures in the domain error", () => {
    const mk = (d: string) => new Error(`api: ${d}`);
    expect(parseJsonOrThrow('{"x":1}', mk)).toEqual({ x: 1 });
    expect(() => parseJsonOrThrow("not json", mk)).toThrow(/api: invalid JSON \(.*len=8\)/);
  });
});

describe("nlp language", () => {
  it("detectLeadLocale: empty→pageLocale, greek chars, stopword vote, tie→pageLocale", () => {
    expect(detectLeadLocale("   ", "el")).toBe("el");
    expect(detectLeadLocale("", "en")).toBe("en");
    expect(detectLeadLocale("Καλημέρα θέλω βοήθεια")).toBe("el");
    expect(detectLeadLocale("I need a quote for the project")).toBe("en");
    // /g regex counts every Greek char: 4/16 = 25% > 15% threshold → "el".
    // Greek-char count <3 and ratio <15% → English stopword vote decides.
    expect(detectLeadLocale("θέλω προσφορά και τιμή please")).toBe("el");
    expect(detectLeadLocale("θέλω and the for")).toBe("el");
    expect(detectLeadLocale("θ and the for of to in")).toBe("en");
    expect(detectLeadLocale("hello")).toBe("en");
    expect(detectLeadLocale("xyzzy plugh", "el")).toBe("el"); // tie → pageLocale
  });

  it("classifyIntentLocal: short→spam, each intent, service hint, general", () => {
    expect(classifyIntentLocal("hi").intent).toBe("spam_or_noise");
    expect(classifyIntentLocal("hi", "bundle").intent).toBeDefined(); // short+service → pattern loop
    expect(classifyIntentLocal("buy viagra casino crypto pump").intent).toBe("spam_or_noise");
    expect(classifyIntentLocal("can we book a demo call next week").intent).toBe("booking");
    expect(classifyIntentLocal("I need a quote and pricing estimate").intent).toBe("quote_request");
    expect(classifyIntentLocal("are you open to a white-label partner deal").intent).toBe("partnership");
    expect(classifyIntentLocal("your login page is broken, need support").intent).toBe("support");
    expect(classifyIntentLocal("θέλω προσφορά και τιμή για cloud").intent).toBe("quote_request");
    const general = classifyIntentLocal("this is a completely neutral message about stuff");
    expect(general.intent).toBe("general_inquiry");
    expect(classifyIntentLocal("tell me more details please", "ai growth").intent).toBe("quote_request");
    expect(LEAD_INTENTS).toContain(general.intent);
  });
});

describe("extractLeadEntities", () => {
  it("budget + timeline + product regexes", () => {
    const e = extractLeadEntities(
      "We have a budget of €5,000 and need it ASAP for our shop-online rebuild"
    );
    expect(e.budget).toContain("5,000");
    expect(e.timeline?.toLowerCase()).toBe("asap");
    expect(e.product).toMatch(/shop[\s-]?online/i);
    expect(extractLeadEntities("nothing here")).toEqual({});
  });
});

describe("analyzeLeadMessage", () => {
  const input = { message: "hello there friend", pageLocale: "en" };

  beforeEach(() => {
    libs.callWorkersAiChat.mockReset();
    libs.isWorkersAiConfigured.mockReturnValue(true);
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.NLP_LEAD_LLM;
  });

  it("high-confidence local → returns local without LLM", async () => {
    const r = await analyzeLeadMessage({ message: "buy viagra casino crypto pump now" });
    expect(r.source).toBe("local");
    expect(r.intent).toBe("spam_or_noise");
    expect(libs.callWorkersAiChat).not.toHaveBeenCalled();
  });

  it("LLM path: valid JSON → workers-ai result merged with local entities", async () => {
    libs.callWorkersAiChat.mockResolvedValue(
      'some prose {"intent":"booking","locale":"en","confidence":0.9,"entities":{"budget":"10k"},"reasons":["llm"]} tail'
    );
    // "budget" would locally classify at 0.95 and short-circuit — neutral text keeps the LLM path
    const r = await analyzeLeadMessage({ ...input, message: "tell me more about your work" });
    expect(r.source).toBe("workers-ai");
    expect(r.intent).toBe("booking");
    expect(r.entities.budget).toBe("10k");
    expect(r.reasons).toEqual(["llm"]);
  });

  it("LLM bad JSON / schema fail / throw → fallback with reason", async () => {
    libs.callWorkersAiChat.mockResolvedValue("no json at all");
    let r = await analyzeLeadMessage(input);
    expect(r.source).toBe("fallback");
    expect(r.reasons).toContain("llm unavailable");

    libs.callWorkersAiChat.mockResolvedValue('{"intent":"bogus","locale":"en","confidence":9}');
    r = await analyzeLeadMessage(input);
    expect(r.source).toBe("fallback");

    libs.callWorkersAiChat.mockRejectedValue(new Error("cf down"));
    r = await analyzeLeadMessage(input);
    expect(r.source).toBe("fallback");
  });

  it("skip flags: E2E, NLP_LEAD_LLM=0, unconfigured", async () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    const r = await analyzeLeadMessage(input);
    expect(r.source).toBe("local");
    expect(libs.callWorkersAiChat).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_E2E;
    libs.isWorkersAiConfigured.mockReturnValue(false);
    const r2 = await analyzeLeadMessage(input);
    expect(r2.source).toBe("local");
  });
});

describe("trackClientEvent", () => {
  beforeEach(() => {
    libs.trackPixelEvent.mockClear();
    libs.sendSocialAutoEvent.mockClear();
    delete (window as Record<string, unknown>).gtag;
    delete (window as Record<string, unknown>).plausible;
  });

  it("fires all sinks + socialauto event; swallows sink failures", async () => {
    const gtag = vi.fn();
    const plausible = vi.fn();
    (window as Record<string, unknown>).gtag = gtag;
    (window as Record<string, unknown>).plausible = plausible;

    trackClientEvent("cta_click", { btn: "buy" }, { path: "/p", locale: "el" });
    expect(gtag).toHaveBeenCalledWith("event", "cta_click", { btn: "buy" });
    expect(plausible).toHaveBeenCalledWith("cta_click", { props: { btn: "buy" } });
    expect(libs.trackPixelEvent).toHaveBeenCalledWith("cta_click", { btn: "buy" });
    expect(libs.sendSocialAutoEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cta_click",
        domain: "cloudless.gr",
        path: "/p",
        locale: "el",
        payload: { btn: "buy" },
      })
    );

    // sink throws → swallowed
    (window as Record<string, unknown>).gtag = () => {
      throw new Error("gtag broke");
    };
    expect(() => trackClientEvent("x")).not.toThrow();

    // socialauto rejection → swallowed
    libs.sendSocialAutoEvent.mockRejectedValueOnce(new Error("net"));
    expect(() => trackClientEvent("y")).not.toThrow();
    await Promise.resolve(); // flush the .catch
  });
});
