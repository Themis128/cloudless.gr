/**
 * Cloudflare AI Search integration for the chat widget.
 *
 * Provides semantic search capabilities using managed AI Search instances.
 * Uses the same environment detection pattern as workers-ai-chat.ts.
 */

// Detect Cloudflare Workers environment
function isWorkersEnvironment(): boolean {
  return (
    typeof (globalThis as unknown as Record<string, string | undefined>).caches !== "undefined"
  );
}

interface AiSearchResult {
  id: string;
  score: number;
  text: string;
  metadata?: Record<string, unknown>;
}

interface AiSearchResponse {
  answer?: string;
  results?: AiSearchResult[];
}

/**
 * Search AI Search instance for relevant documents.
 * Falls back gracefully if AI Search is not configured.
 */
export async function searchAiDocs(
  query: string,
  namespace?: string,
  instance?: string,
  maxResults?: number
): Promise<AiSearchResponse | null> {
  if (!isWorkersEnvironment()) {
    // Non-Workers environment - AI Search not available
    return null;
  }

  // In Workers, the AI binding is available via environment
  // For SST-managed AI Search, use Resource binding
  // For now, we use the REST API directly

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return null;
  }

  const targetInstance = instance || process.env.AI_SEARCH_INSTANCE || "default";
  const targetNamespace = namespace || process.env.AI_SEARCH_NAMESPACE || "default";

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/namespaces/${targetNamespace}/instances/${targetInstance}/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          max_num_results: maxResults || 5,
          score_threshold: 0.5,
        }),
      }
    );

    if (!response.ok) {
      console.warn("[ai-search] Search failed:", response.status);
      return null;
    }

    return (await response.json()) as AiSearchResponse;
  } catch (err) {
    console.warn("[ai-search] Search error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Create an AI Search namespace.
 * Used for initial setup.
 */
export async function createAiSearchNamespace(
  name: string,
  description?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isWorkersEnvironment()) {
    return { success: false, error: "Not in Workers environment" };
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return { success: false, error: "Missing credentials" };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/namespaces`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      }
    );

    const result = (await response.json()) as {
      success: boolean;
      result?: { id: string };
      errors?: Array<{ message: string }>;
    };

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.errors?.[0]?.message ?? "Unknown error",
      };
    }

    return { success: true, id: result.result?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
