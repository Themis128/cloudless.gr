/**
 * Cloudflare Vectorize REST helpers for admin RAG over AppFlowy content.
 * Index name: CLOUDFLARE_VECTORIZE_INDEX (default cloudless-admin-rag).
 * Dimensions must match embed model (bge-small-en-v1.5 → 384).
 */

import { callWorkersAiEmbed, isWorkersAiConfigured } from "@/lib/workers-ai-client";

const DEFAULT_INDEX = "cloudless-admin-rag";

export type AdminVectorHit = {
  id: string;
  score: number;
  title: string;
  text: string;
  source: string;
};

function indexName(): string {
  return process.env.CLOUDFLARE_VECTORIZE_INDEX?.trim() || DEFAULT_INDEX;
}

export function isAdminVectorizeConfigured(): boolean {
  return Boolean(
    isWorkersAiConfigured() &&
      process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_API_TOKEN
  );
}

async function vectorizeFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("Vectorize: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN required");
  }
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName()}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );
}

export async function upsertAdminVectors(
  docs: Array<{ id: string; text: string; title: string; source: string }>
): Promise<number> {
  if (!docs.length) return 0;
  const vectors = [];
  for (const doc of docs) {
    const values = await callWorkersAiEmbed(doc.text.slice(0, 4000));
    vectors.push({
      id: doc.id,
      values,
      metadata: {
        title: doc.title.slice(0, 200),
        text: doc.text.slice(0, 1200),
        source: doc.source.slice(0, 80),
      },
    });
  }

  const res = await vectorizeFetch("/upsert", {
    method: "POST",
    body: JSON.stringify({ vectors }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vectorize upsert failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return vectors.length;
}

export async function queryAdminVectorize(
  query: string,
  opts?: { topK?: number }
): Promise<AdminVectorHit[]> {
  if (!isAdminVectorizeConfigured() || !query.trim()) return [];

  const values = await callWorkersAiEmbed(query.slice(0, 2000));
  const res = await vectorizeFetch("/query", {
    method: "POST",
    body: JSON.stringify({
      vector: values,
      topK: opts?.topK ?? 5,
      returnMetadata: "all",
    }),
  });

  if (!res.ok) {
    console.warn("[admin-vectorize] query failed:", res.status);
    return [];
  }

  const data = (await res.json()) as {
    result?: {
      matches?: Array<{
        id: string;
        score: number;
        metadata?: { title?: string; text?: string; source?: string };
      }>;
    };
  };

  return (data.result?.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    title: String(m.metadata?.title ?? m.id),
    text: String(m.metadata?.text ?? ""),
    source: String(m.metadata?.source ?? "cms"),
  }));
}

/** Pull AppFlowy FAQs + docs and upsert into Vectorize. */
export async function syncAppFlowyToVectorize(): Promise<{ upserted: number }> {
  const docs: Array<{ id: string; text: string; title: string; source: string }> = [];

  try {
    const { getFaqs } = await import("@/lib/appflowy-faqs");
    const faqs = await getFaqs("en");
    for (const f of faqs.slice(0, 80)) {
      if (!f.answer?.trim()) continue;
      docs.push({
        id: `faq:${f.id}`.slice(0, 64),
        title: f.question,
        text: `${f.question}\n${f.answer}`,
        source: "appflowy-faq",
      });
    }
  } catch (err) {
    console.warn("[admin-vectorize] FAQ sync skipped:", err);
  }

  try {
    const { getDocs } = await import("@/lib/appflowy-docs");
    const pages = await getDocs();
    for (const d of pages.slice(0, 40)) {
      const body = d.description?.trim() || "";
      if (!body) continue;
      docs.push({
        id: `doc:${d.id || d.slug}`.slice(0, 64),
        title: d.title,
        text: `${d.title}\n${body}`,
        source: "appflowy-doc",
      });
    }
  } catch (err) {
    console.warn("[admin-vectorize] Docs sync skipped:", err);
  }

  // Batch upserts in chunks of 10
  let upserted = 0;
  for (let i = 0; i < docs.length; i += 10) {
    upserted += await upsertAdminVectors(docs.slice(i, i + 10));
  }
  return { upserted };
}
