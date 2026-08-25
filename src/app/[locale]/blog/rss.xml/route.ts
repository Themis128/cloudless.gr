import { NextRequest, NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/blog-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cloudless.gr";
  const blogBase = `${base}/${locale}/blog`;

  const posts = await getBlogPosts();

  const items = posts
    .slice(0, 20)
    .map((post) => {
      const link = `${blogBase}/${post.slug}`;
      const pubDate = new Date(post.date).toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
      <category>${escapeXml(post.category)}</category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cloudless Blog</title>
    <link>${blogBase}</link>
    <description>Cloud engineering insights from Cloudless.gr</description>
    <language>${locale}</language>
    <atom:link href="${blogBase}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
