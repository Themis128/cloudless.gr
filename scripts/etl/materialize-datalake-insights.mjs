/**
 * Materialize LLM insights from gold aggregates → R2 JSON.
 *
 * Reads lake/snapshots/admin-datalake.json (prefer) and writes:
 *   lake/snapshots/insights/{domain}.json
 *   lake/snapshots/insights/insights-index.json
 *   lake/snapshots/insights/orchestration.json
 *
 * Never calls live Stripe/GSC/Espo/ads — lake gold only.
 * Workers AI primary, Gemini fallback (same as src/lib/admin-ai.ts).
 */
import { r2Put, r2Get } from "./_r2-config.mjs";

const GOLD_KEY = "lake/snapshots/admin-datalake.json";
const INSIGHTS_PREFIX = "lake/snapshots/insights";
const CONTENT_TYPE_JSON = "application/json";

const DOMAINS = [
  { domain: "seo", sections: ["top_keywords", "freshness"] },
  { domain: "revenue", sections: ["stripe_revenue", "acquisition_funnel", "attribution"] },
  { domain: "crm_funnel", sections: ["espocrm_funnel"] },
  { domain: "ads", sections: ["linkedin_ads"] },
  { domain: "ops_errors", sections: ["top_errors"] },
  {
    domain: "executive",
    sections: [
      "stripe_revenue",
      "top_keywords",
      "espocrm_funnel",
      "linkedin_ads",
      "top_errors",
      "acquisition_funnel",
      "attribution",
    ],
  },
  { domain: "orchestration", sections: ["stripe_revenue", "acquisition_funnel", "attribution"] },
];

const WORKERS_MODEL = process.env.WORKERS_AI_CHAT_MODEL || "@cf/meta/llama-3.1-8b-instruct";

async function loadGold() {
  try {
    const buf = await r2Get(GOLD_KEY);
    return JSON.parse(buf.toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[insights] gold missing: ${message.slice(0, 200)}`);
    return null;
  }
}

function sectionPack(gold, sectionNames) {
  const byName = new Map((gold?.sections ?? []).map((s) => [s.section, s]));
  const packs = [];
  for (const name of sectionNames) {
    const section = byName.get(name);
    if (!section) {
      packs.push({ section: name, error: "missing from gold" });
      continue;
    }
    if (section.error) {
      packs.push({ section: name, error: section.error });
      continue;
    }
    packs.push({
      section: name,
      rowCount: section.rowCount ?? (section.rows?.length ?? 0),
      rows: (section.rows ?? []).slice(0, 15),
    });
  }
  return packs;
}

function extractMetrics(packs) {
  const metrics = [];
  for (const pack of packs) {
    if (pack.error) {
      metrics.push({ key: `${pack.section}.error`, value: pack.error });
      continue;
    }
    metrics.push({ key: `${pack.section}.rowCount`, value: pack.rowCount ?? 0 });
    const first = pack.rows?.[0];
    if (first && typeof first === "object") {
      for (const [k, v] of Object.entries(first).slice(0, 6)) {
        if (v === null || typeof v === "string" || typeof v === "number") {
          metrics.push({ key: `${pack.section}.${k}`, value: v });
        }
      }
    }
  }
  return metrics.slice(0, 40);
}

function workersAiUrl(accountId, model) {
  const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim();
  if (gatewayId) {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${model}`;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
}

async function callWorkersAi(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!accountId || !token) return null;

  const res = await fetch(workersAiUrl(accountId, WORKERS_MODEL), {
    method: "POST",
      headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": CONTENT_TYPE_JSON,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are a data analyst for cloudless.gr. Reply with ONLY valid JSON matching the schema. No markdown.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Workers AI ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = body?.result?.response;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Workers AI empty response");
  }
  return { text, provider: "workers-ai", model: WORKERS_MODEL };
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": CONTENT_TYPE_JSON },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 900, temperature: 0.3 },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  if (!text.trim()) throw new Error("Gemini empty response");
  return { text, provider: "gemini", model: "gemini-1.5-flash" };
}

function parseInsightJson(text) {
  const cleaned = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildPrompt(domain, packs, metrics) {
  return `Domain: ${domain}
Produce JSON with keys:
  "summary" (string, 1-3 sentences),
  "bullets" (array of 3-7 actionable insight strings),
  "confidence" ("high"|"medium"|"low")

Use ONLY the metrics below. Do not invent numbers not present.

Metrics:
${JSON.stringify(metrics, null, 2)}

Section packs (truncated):
${JSON.stringify(packs, null, 2).slice(0, 6000)}
`;
}

function deterministicFallback(domain, packs, metrics, goldGeneratedAt, error) {
  const usable = packs.filter((p) => !p.error);
  const summary =
    usable.length === 0
      ? `No gold data available for ${domain} yet. Run silver ETL + materialize-datalake-snapshots.`
      : `${domain} snapshot from lake gold (${usable.length} section(s)). LLM unavailable — deterministic summary.`;
  const bullets = usable.slice(0, 5).map((p) => {
    const n = p.rowCount ?? 0;
    return `${p.section}: ${n} row(s) in gold snapshot.`;
  });
  if (bullets.length === 0) {
    bullets.push("Wait for ETL materialize before regenerating insights.");
  }
  return {
    domain,
    generated_at: new Date().toISOString(),
    model: "none",
    provider: "none",
    inputs_ref: {
      gold_generated_at: goldGeneratedAt ?? null,
      sections: packs.map((p) => p.section),
    },
    summary,
    bullets,
    metrics_cited: metrics.slice(0, 20),
    confidence: "low",
    freshness: goldGeneratedAt ?? null,
    error: error ? String(error).slice(0, 300) : undefined,
  };
}

async function generateInsight(domain, packs, metrics, goldGeneratedAt) {
  const prompt = buildPrompt(domain, packs, metrics);
  let lastError = null;

  for (const caller of [callWorkersAi, callGemini]) {
    try {
      const result = await caller(prompt);
      if (!result) continue;
      const parsed = parseInsightJson(result.text);
      return {
        domain,
        generated_at: new Date().toISOString(),
        model: result.model,
        provider: result.provider,
        inputs_ref: {
          gold_generated_at: goldGeneratedAt ?? null,
          sections: packs.map((p) => p.section),
        },
        summary: String(parsed.summary ?? "").slice(0, 2000) || "No summary produced.",
        bullets: Array.isArray(parsed.bullets)
          ? parsed.bullets.map((b) => String(b).slice(0, 500)).slice(0, 10)
          : [],
        metrics_cited: metrics.slice(0, 30),
        confidence: ["high", "medium", "low"].includes(parsed.confidence)
          ? parsed.confidence
          : "medium",
        freshness: goldGeneratedAt ?? null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[insights] ${domain} ${caller.name} failed: ${lastError.slice(0, 160)}`);
    }
  }

  return deterministicFallback(domain, packs, metrics, goldGeneratedAt, lastError);
}

async function main() {
  console.log("[insights] loading gold snapshot…");
  const gold = await loadGold();
  const goldGeneratedAt = gold?.generated_at ?? null;

  const indexDomains = [];

  for (const { domain, sections } of DOMAINS) {
    console.log(`[insights] generating ${domain}…`);
    const packs = sectionPack(gold, sections);
    const metrics = extractMetrics(packs);
    const insight = await generateInsight(domain, packs, metrics, goldGeneratedAt);
    const key = `${INSIGHTS_PREFIX}/${domain}.json`;
    await r2Put(key, JSON.stringify(insight, null, 2), { contentType: CONTENT_TYPE_JSON });
    console.log(`  wrote ${key} (provider=${insight.provider})`);
    indexDomains.push({
      domain,
      generated_at: insight.generated_at,
      has_error: Boolean(insight.error),
      summary_preview: String(insight.summary ?? "").slice(0, 160),
    });
  }

  const index = {
    generated_at: new Date().toISOString(),
    domains: indexDomains,
  };
  const indexKey = `${INSIGHTS_PREFIX}/insights-index.json`;
  await r2Put(indexKey, JSON.stringify(index, null, 2), { contentType: CONTENT_TYPE_JSON });
  console.log(`[insights] wrote ${indexKey}`);
}

main().catch((error) => {
  console.error("[insights] fatal:", error);
  process.exit(1);
});
