import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import type { BlogPost } from "@/lib/blog";

interface R2NewsletterArticle {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: BlogPost["category"];
  content: string;
  html: string;
}

const PREFIX = "newsletter/articles/";

export async function getR2BlogPosts(): Promise<BlogPost[]> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return [];
  try {
    const listed = await bucket.list({ prefix: PREFIX });
    const objects = listed.objects ?? [];
    const posts: BlogPost[] = [];
    for (const obj of objects) {
      const item = await bucket.get(obj.key);
      if (!item) continue;
      const text = await item.text();
      const parsed = JSON.parse(text) as R2NewsletterArticle;
      posts.push(parsed);
    }
    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return posts;
  } catch (err) {
    console.error("[blog-r2] list failed:", err);
    return [];
  }
}

export async function getR2BlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return undefined;
  try {
    const item = await bucket.get(`${PREFIX}${slug}.json`);
    if (!item) return undefined;
    const text = await item.text();
    const parsed = JSON.parse(text) as R2NewsletterArticle;
    return parsed;
  } catch (err) {
    console.error("[blog-r2] get failed:", err);
    return undefined;
  }
}
