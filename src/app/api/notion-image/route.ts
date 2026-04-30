import { type NextRequest } from "next/server";
import { notionFetch } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") ?? "block";

  if (!id) return new Response("Missing id", { status: 400 });

  try {
    let fileUrl: string | undefined;

    if (type === "cover") {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const page = await notionFetch<any>(`/pages/${id}`);
      fileUrl = page.cover?.type === "file" ? page.cover.file?.url : undefined;
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } else {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const block = await notionFetch<any>(`/blocks/${id}`);
      fileUrl = (block[block.type] as any)?.file?.url;
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    if (!fileUrl) return new Response("No file URL found", { status: 404 });

    const img = await fetch(fileUrl);
    if (!img.ok) return new Response("Image unavailable", { status: 502 });

    return new Response(img.body, {
      headers: {
        "Content-Type": img.headers.get("Content-Type") ?? "image/jpeg",
        // Cache for 55 min (Notion signed URLs last ~1 h; revalidate before expiry)
        "Cache-Control": "public, max-age=3300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[notion-image] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
