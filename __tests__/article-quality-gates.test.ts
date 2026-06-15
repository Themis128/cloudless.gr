/**
 * Unit tests for scripts/article-quality-gates.ts
 * Focuses on Layer 1 (deterministic) — Layer 2 (LLM critic) is integration-tested
 * via the existing publish-and-send-newsletter e2e flow.
 */

import { describe, it, expect } from "vitest";
import {
  countWords,
  runDeterministicGates,
  parseCriticJson,
  WORD_MAX,
  MIN_H2_COUNT,
  type DraftInput,
} from "../scripts/article-quality-gates";

const baseDraft: DraftInput = {
  title: "How to size your Lambda memory without burning AWS budget",
  slug: "lambda-memory-sizing-without-burning-budget",
  excerpt: "A practical guide to right-sizing Lambda memory for cost and latency.",
  readTime: "9 min read",
  content:
    [
      "## Why memory sizing matters",
      "Lambda bills you for memory × duration. Picking the right setting is one of the highest-leverage cost levers in serverless.",
      "## How to measure",
      "Use Lambda Power Tuning to sweep configurations. Hit each one with realistic traffic, capture P95 latency and cost per 1M invocations.",
      "## When to choose more memory",
      "Memory-bound workloads (image processing, in-memory caches) saturate before CPU. The plot of cost vs memory looks U-shaped: sweet spot is the trough.",
      "## When to choose less",
      "Glue functions that mostly wait on network calls. Adding memory just adds bill without improving latency.",
      "## Putting it into practice this week",
      "Pick your top 3 most-invoked functions. Run Power Tuning. Apply the cheapest setting that holds your P95 SLO. Save the report. Done.",
    ].join("\n\n") +
    "\n\n" +
    "x ".repeat(750),
};

describe("countWords", () => {
  it("counts plain words ignoring markdown markers", () => {
    expect(countWords("# Hello\n\nworld how are you")).toBe(5);
  });
  it("strips code blocks", () => {
    expect(countWords("hello\n```\ncode here\n```\nworld")).toBe(2);
  });
  it("strips link target text but keeps anchor", () => {
    expect(countWords("read [the docs](https://x.com/y) carefully")).toBe(4);
  });
});

describe("runDeterministicGates", () => {
  it("passes a well-formed draft", () => {
    const r = runDeterministicGates(baseDraft, ["Unrelated old title"], ["other-slug"]);
    const failed = r.filter((g) => !g.pass);
    expect(failed).toEqual([]);
  });

  it("fails word_count when too short", () => {
    const short = { ...baseDraft, content: "## Tiny\n\nNot enough." };
    const r = runDeterministicGates(short, [], []);
    expect(r.find((g) => g.name === "word_count")?.pass).toBe(false);
  });

  it("fails word_count when too long", () => {
    const longContent = "## H\n\n" + "word ".repeat(WORD_MAX + 200);
    const r = runDeterministicGates({ ...baseDraft, content: longContent }, [], []);
    expect(r.find((g) => g.name === "word_count")?.pass).toBe(false);
  });

  it("fails structure_h2 when too few H2 sections", () => {
    const lowStructure = {
      ...baseDraft,
      content: "## one\n\n" + "x ".repeat(900),
    };
    const r = runDeterministicGates(lowStructure, [], []);
    const gate = r.find((g) => g.name === "structure_h2");
    expect(gate?.pass).toBe(false);
    expect(gate?.detail).toContain(`need ≥ ${MIN_H2_COUNT}`);
  });

  it("fails slug_unique when slug already in published list", () => {
    const r = runDeterministicGates(baseDraft, [], [baseDraft.slug]);
    expect(r.find((g) => g.name === "slug_unique")?.pass).toBe(false);
  });

  it("catches LLM tells in the body (banned_phrases)", () => {
    const tell = {
      ...baseDraft,
      content: baseDraft.content + "\n\n## conclusion\n\nAs an AI, I cannot give legal advice.",
    };
    const r = runDeterministicGates(tell, [], []);
    const gate = r.find((g) => g.name === "banned_phrases");
    expect(gate?.pass).toBe(false);
    expect(gate?.detail).toMatch(/as an ai/);
  });

  it("catches placeholders in the body", () => {
    const ph = {
      ...baseDraft,
      content: baseDraft.content + "\n\n[insert pricing details here]",
    };
    const r = runDeterministicGates(ph, [], []);
    expect(r.find((g) => g.name === "banned_phrases")?.pass).toBe(false);
  });

  it("fails title_novelty when title overlaps a recent title heavily", () => {
    // baseDraft significant tokens (>3 chars): how, size, your, lambda,
    // memory, without, burning, budget — 8 distinct. The duplicate below
    // shares 7 of them: size, your, lambda, memory, without, burning,
    // budget → overlap = 7/8 = 87.5%, above the 75% threshold.
    const dup = "Size your Lambda memory without burning your budget guide";
    const r = runDeterministicGates(baseDraft, [dup], []);
    expect(r.find((g) => g.name === "title_novelty")?.pass).toBe(false);
  });

  it("passes title_novelty for genuinely different titles", () => {
    const r = runDeterministicGates(baseDraft, ["A different topic about VPC peering"], []);
    expect(r.find((g) => g.name === "title_novelty")?.pass).toBe(true);
  });

  it("fails forbidden_topics for off-brand subjects", () => {
    const crypto = { ...baseDraft, title: "Why bitcoin will hit 200k" };
    const r = runDeterministicGates(crypto, [], []);
    expect(r.find((g) => g.name === "forbidden_topics")?.pass).toBe(false);
  });
});

describe("parseCriticJson", () => {
  it("parses strict JSON", () => {
    const raw = JSON.stringify({
      scores: {
        factual_credibility: 8,
        brand_voice: 7,
        structure: 8,
        originality: 7,
        technical_accuracy: 9,
      },
      overall: 7.8,
      verdict: "pass",
      issues: [],
    });
    const r = parseCriticJson(raw);
    expect(r.verdict).toBe("pass");
    expect(r.overall).toBe(7.8);
  });

  it("recovers JSON wrapped in prose", () => {
    const raw =
      "Sure! Here is my review:\n\n```json\n" +
      JSON.stringify({
        scores: {
          factual_credibility: 5,
          brand_voice: 6,
          structure: 7,
          originality: 5,
          technical_accuracy: 6,
        },
        overall: 5.8,
        verdict: "revise",
        issues: ["claim about S3 pricing is wrong", "intro buries the lede"],
      }) +
      "\n```\n\nLet me know if you need anything else.";
    const r = parseCriticJson(raw);
    expect(r.verdict).toBe("revise");
    expect(r.issues.length).toBe(2);
  });

  it("throws cleanly on total garbage", () => {
    expect(() => parseCriticJson("just some prose, no braces here at all")).toThrow();
  });
});
