/**
 * nlp/analyze-lead.ts — local heuristics vs Workers AI escalation:
 * skip flags, confidence gate, JSON extraction, schema validation,
 * entity merge, fallback-with-reason. Real local classifier; AI at boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockChat = vi.fn();
const mockConfigured = vi.fn().mockReturnValue(true);
vi.mock("@/lib/workers-ai-client", () => ({
  callWorkersAiChat: (...a: unknown[]) => mockChat(...a),
  isWorkersAiConfigured: () => mockConfigured(),
}));

import { analyzeLeadMessage } from "@/lib/nlp/analyze-lead";

const vague = { message: "hello there", pageLocale: "en" as const };
const spammy = { message: "Can we book a call next week for a demo?", pageLocale: "en" as const };

const AI_JSON = JSON.stringify({
  intent: "quote_request", locale: "en", confidence: 0.9,
  entities: { budget: "5k" }, reasons: ["ai saw intent"],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockConfigured.mockReturnValue(true);
  mockChat.mockResolvedValue(AI_JSON);
});

describe("analyzeLeadMessage", () => {
  it("high-confidence local result short-circuits the LLM", async () => {
    const r = await analyzeLeadMessage(spammy);
    expect(r.source).toBe("local");
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("skip flags bypass the LLM entirely", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E", "1");
    const r = await analyzeLeadMessage(vague);
    expect(r.source).toBe("local");
    expect(mockChat).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
    vi.stubEnv("NLP_LEAD_LLM", "0");
    expect((await analyzeLeadMessage(vague)).source).toBe("local");

    vi.unstubAllEnvs();
    mockConfigured.mockReturnValue(false);
    expect((await analyzeLeadMessage(vague)).source).toBe("local");
  });

  it("low-confidence → Workers AI result with merged entities", async () => {
    const r = await analyzeLeadMessage(vague);
    expect(r.source).toBe("workers-ai");
    expect(r.intent).toBe("quote_request");
    expect(r.entities.budget).toBe("5k");
    expect(r.reasons).toEqual(["ai saw intent"]);
    const sysMsg = mockChat.mock.calls[0][0][0];
    expect(sysMsg.role).toBe("system");
  });

  it("AI JSON embedded in prose is still extracted", async () => {
    mockChat.mockResolvedValue(`Sure! Here is the JSON: ${AI_JSON} — done.`);
    const r = await analyzeLeadMessage(vague);
    expect(r.source).toBe("workers-ai");
  });

  it.each([
    ["not json at all", "no braces"],
    ["{ bad json }", "unparseable braces"],
    [JSON.stringify({ intent: "not_an_intent", locale: "en", confidence: 0.9 }), "schema-invalid"],
    [JSON.stringify({ intent: "booking", locale: "fr", confidence: 0.9 }), "bad locale"],
  ])("AI returns %s → fallback result", async (reply) => {
    mockChat.mockResolvedValue(reply);
    const r = await analyzeLeadMessage(vague);
    expect(r.source).toBe("fallback");
    expect(r.reasons).toContain("llm unavailable");
  });

  it("AI throw → fallback", async () => {
    mockChat.mockRejectedValue(new Error("cf down"));
    const r = await analyzeLeadMessage(vague);
    expect(r.source).toBe("fallback");
  });

  it("AI response without reasons gets a synthesized reason", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ intent: "booking", locale: "en", confidence: 0.8 }));
    const r = await analyzeLeadMessage(vague);
    expect(r.source).toBe("workers-ai");
    expect(r.reasons[0]).toContain("intent:booking");
  });
});
