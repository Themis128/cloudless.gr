import { type NextRequest } from "next/server";
import { notionFetch } from "@/lib/notion";

export const dynamic = "force-dynamic";

const CACHE_MAX_AGE_SECS = 3_300; // 55 min — Notion signed URLs last ~1 h
const CACHE_SWR_SECS = 600; // stale-while-revalidate

interface NotionPage {
  cover?: { type: string; file?: { url: string }; external?: { url: string } };
}

interface NotionBlock {
  type: string;
  [key: string]: { file?: { url: string } } | string | unknown;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") ?? "block";

  if (!id) return new Response("Missing id", { status: 400 });

  try {
    let fileUrl: string | undefined;

    if (type === "cover") {
      const page = await notionFetch<NotionPage>(`/pages/${id}`);
      fileUrl = page.cover?.type === "file" ? page.cover.file?.url : undefined;
    } else {
      const block = await notionFetch<NotionBlock>(`/blocks/${id}`);
      const blockData = block[block.type] as { file?: { url: string } } | undefined;
      fileUrl = blockData?.file?.url;
    }

    if (!fileUrl) return new Response("No file URL found", { status: 404 });

    const img = await fetch(fileUrl);
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
