/**
 * GET /api/newsletter/covers/[slug] — serve the weekly issue cover PNG from R2.
 *
 * The email <img> needs a stable absolute URL; the cover is uploaded by
 * /api/cron/newsletter-auto when SocialAuto renders it. Public (images only,
 * slug-validated, no secrets) — same exposure class as the blog itself.
 */
import { NextRequest } from "next/server";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  // email URLs use covers/<slug>.png — strip the extension before validating
  const slug = rawSlug.replace(/\.png$/, "");
  if (!SLUG_RE.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) {
    return new Response("R2 not configured", { status: 503 });
  }
  try {
    const obj = await bucket.get(`newsletter/covers/${slug}.png`);
    if (!obj) {
      return new Response("Not found", { status: 404 });
    }
    const bytes = await obj.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[newsletter-covers] fetch failed:", err);
    return new Response("Failed to fetch cover", { status: 500 });
  }
}
