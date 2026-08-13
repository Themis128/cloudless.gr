/**
 * AppFlowy / CMS RAG context for admin AI assistant.
 * Returns empty string when Vectorize is unbound (free-tier optional).
 */

export async function retrieveAdminRagContext(query: string): Promise<string> {
  const q = query.trim();
  if (!q) return "";

  try {
    const { queryAdminVectorize } = await import("@/lib/admin-vectorize");
    const hits = await queryAdminVectorize(q, { topK: 5 });
    if (!hits.length) return "";
    return hits.map((h, i) => `[${i + 1}] (${h.source}) ${h.title}\n${h.text}`).join("\n\n");
  } catch {
    return "";
  }
}
