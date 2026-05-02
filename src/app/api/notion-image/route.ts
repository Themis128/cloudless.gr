import { type NextRequest } from "next/server";
import { notionFetch } from "@/lib/notion";

export const dynamic = "force-dynamic";

const CACHE_MAX_AGE_SECS = 3_300; // 55 min — Notion signed URLs last ~1 h
const CACHE_SWR_SECS = 600; // stale-while-revalidate

/** Notion UUIDs: 32 hex digits, optionally hyphenated (8-4-4-4-12). */
const NOTION_ID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const ALLOWED_TYPES = new Set(["block", "cover"]);

/**
 * Notion-hosted file URLs are AWS S3 pre-signed URLs or files.notion.so.
 * Restricting to these known hosts prevents SSRF against internal resources.
 */
const ALLOWED_FILE_HOSTS = /(?:\.amazonaws\.com|^files\.notion\.so)$/;

interface NotionPage {
  cover?: { type: string; file?: { url: string }; external?: { url: string } };
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

function validateNotionFileUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (!ALLOWED_FILE_HOSTS.test(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") ?? "block";

  if (!id) return new Response("Missing id", { status: 400 });
  if (!NOTION_ID_RE.test(id))
    return new Response("Invalid id", { status: 400 });
  if (!ALLOWED_TYPES.has(type))
    return new Response("Invalid type", { status: 400 });

  try {
    let rawUrl: string | undefined;

    if (type === "cover") {
      const page = await notionFetch<NotionPage>(`/pages/${id}`);
      rawUrl = page.cover?.type === "file" ? page.cover.file?.url : undefined;
    } else {
      const block = await notionFetch<NotionBlock>(`/blocks/${id}`);
      const blockData = block[block.type] as
        | { file?: { url: string } }
        | undefined;
      rawUrl = blockData?.file?.url;
    }

    if (!rawUrl) return new Response("No file URL found", { status: 404 });

    const fileUrl = validateNotionFileUrl(rawUrl);
    if (!fileUrl) return new Response("File URL not trusted", { status: 403 });

    const img = await fetch(fileUrl, { signal: AbortSignal.timeout(10_000) });
    if (!img.ok) return new Response("Image unavailable", { status: 502 });

    return new Response(img.body, {
      headers: {
        "Content-Type": img.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECS}, stale-while-revalidate=${CACHE_SWR_SECS}`,
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
