/**
 * RSS feed route — items block, XML escaping, locale/base handling.
 *
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getBlogPostsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/blog-source", () => ({
  getBlogPosts: getBlogPostsMock,
}));

import { GET } from "@/app/[locale]/blog/rss.xml/route";

const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

const post = (i: number, over: Record<string, unknown> = {}) => ({
  slug: `post-${i}`,
  title: `Post ${i} <&'">`,
  excerpt: `Excerpt & <tags>`,
  category: "Engineering",
  date: "2026-01-01",
  ...over,
});

describe("GET /blog/rss.xml", () => {
  it("emits RSS with escaped entities for real posts", async () => {
    getBlogPostsMock.mockResolvedValueOnce([post(1), post(2)]);
    const res = await GET(
      new NextRequest("http://localhost/en/blog/rss.xml"),
      params("en")
    );
    expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("https://cloudless.gr/en/blog/post-1");
    expect(xml).toContain("Post 1 &lt;&amp;&apos;&quot;&gt;");
    expect(xml).toContain("Excerpt &amp; &lt;tags&gt;");
    expect(xml).toContain("<language>en</language>");
    expect(xml.match(/<item>/g)?.length).toBe(2);
  });

  it("caps at 20 items and respects NEXT_PUBLIC_SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://alt.example";
    getBlogPostsMock.mockResolvedValueOnce(
      Array.from({ length: 25 }, (_, i) => post(i))
    );
    const res = await GET(
      new NextRequest("http://localhost/el/blog/rss.xml"),
      params("el")
    );
    const xml = await res.text();
    expect(xml.match(/<item>/g)?.length).toBe(20);
    expect(xml).toContain("https://alt.example/el/blog/");
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("emits an empty channel when the source has no posts", async () => {
    getBlogPostsMock.mockResolvedValueOnce([]);
    const res = await GET(
      new NextRequest("http://localhost/en/blog/rss.xml"),
      params("en")
    );
    const xml = await res.text();
    expect(xml).not.toContain("<item>");
    expect(xml).toContain("</channel>");
  });
});
