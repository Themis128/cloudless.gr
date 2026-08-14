import { describe, it, expect } from "vitest";
import {
  classifyIntentLocal,
  detectLeadLocale,
  extractLeadEntities,
  analyzeLeadMessage,
} from "@/lib/nlp";
import { scoreLead } from "@/lib/lead-scoring";

describe("contact NLP", () => {
  it("detects Greek locale from script", () => {
    expect(detectLeadLocale("Θέλω προσφορά για cloud migration")).toBe("el");
  });

  it("detects English locale from stopwords", () => {
    expect(detectLeadLocale("Please send a quote for cloud architecture")).toBe("en");
  });

  it("classifies quote_request in English and Greek", () => {
    expect(classifyIntentLocal("Can you send a pricing proposal?").intent).toBe("quote_request");
    expect(classifyIntentLocal("Θέλω προσφορά και τιμή για το project").intent).toBe(
      "quote_request"
    );
  });

  it("classifies booking intent", () => {
    expect(classifyIntentLocal("I'd like to book a free audit call").intent).toBe("booking");
  });

  it("extracts budget and timeline entities", () => {
    const entities = extractLeadEntities("Budget around €5k, need this ASAP for Next.js");
    expect(entities.budget).toMatch(/5/);
    expect(entities.timeline?.toLowerCase()).toMatch(/asap/);
    expect(entities.product?.toLowerCase()).toMatch(/next/);
  });

  it("analyzeLeadMessage stays local under E2E", async () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    const result = await analyzeLeadMessage({
      message: "Please send a quote for k3s hosting",
      pageLocale: "en",
    });
    expect(result.source).toBe("local");
    expect(result.intent).toBe("quote_request");
    delete process.env.NEXT_PUBLIC_E2E;
  });

  it("scoreLead boosts quote_request and forces cold on spam", () => {
    const base = scoreLead({
      email: "a@acme.com",
      message: "Hello we need help with our cloud",
      company: "Acme",
    });
    const withNlp = scoreLead({
      email: "a@acme.com",
      message: "Hello we need help with our cloud",
      company: "Acme",
      nlp: {
        intent: "quote_request",
        locale: "en",
        entities: { budget: "10k" },
        confidence: 0.9,
      },
    });
    expect(withNlp.score).toBeGreaterThan(base.score);
    expect(withNlp.reasons.some((r) => r.includes("nlp intent:quote_request"))).toBe(true);

    const spam = scoreLead({
      email: "x@y.com",
      message: "viagra",
      nlp: { intent: "spam_or_noise", locale: "en", entities: {}, confidence: 0.9 },
    });
    expect(spam.band).toBe("cold");
  });
});
