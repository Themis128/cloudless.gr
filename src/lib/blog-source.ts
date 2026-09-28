import {
  posts as staticPosts,
  getPostBySlug as getStaticPostBySlug,
  type BlogPost,
} from "@/lib/blog";
import {
  getPosts as getAppFlowyPosts,
  getPostBySlug as getAppFlowyPostBySlug,
  type AppFlowyPost,
} from "@/lib/appflowy-blog";
import { getR2BlogPosts, getR2BlogPostBySlug } from "@/lib/blog-r2";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import type { CmsSource } from "@/lib/cms-provider";

const DEFAULT_CATEGORY = "Cloud" as BlogPost["category"];
/** Bound CMS lookups so unbound/unreachable AppFlowy cannot hang SSR. */
const CMS_LOOKUP_MS = 8_000;

async function withCmsTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), CMS_LOOKUP_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mapAppFlowyListingPost(post: AppFlowyPost): BlogPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: post.readTime || "5 min read",
    category: (post.category || DEFAULT_CATEGORY) as BlogPost["category"],
    content: "",
  };
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAppFlowyPost(post: AppFlowyPost): BlogPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: post.readTime || "5 min read",
    category: (post.category || DEFAULT_CATEGORY) as BlogPost["category"],
    content: stripHtml(post.html || ""),
  };
}

export async function getBlogPostsWithSource(): Promise<{
  posts: BlogPost[];
  source: CmsSource;
}> {
  // Merge all sources — a single R2/AppFlowy article must not shadow the
  // static posts. Slug collisions resolve appflowy > r2 > static, matching
  // getBlogPostBySlug's precedence.
  const merged = new Map<string, BlogPost>();
  let appFlowyCount = 0;
  let r2Count = 0;

  if (await isAppFlowyConfigured()) {
    try {
      const appFlowyPosts = await withCmsTimeout(getAppFlowyPosts(), []);
      const published = appFlowyPosts.filter((post) => post.published);
      appFlowyCount = published.length;
      for (const post of published) {
        const mapped = mapAppFlowyListingPost(post);
        merged.set(mapped.slug, mapped);
      }
    } catch {
      // Fall through to R2 / static.
    }
  }

  const r2Posts = await getR2BlogPosts();
  r2Count = r2Posts.length;
  for (const post of r2Posts) {
    if (!merged.has(post.slug)) merged.set(post.slug, post);
  }

  for (const post of staticPosts) {
    if (!merged.has(post.slug)) merged.set(post.slug, post);
  }

  const posts = [...merged.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const source: CmsSource = appFlowyCount > 0 ? "appflowy" : r2Count > 0 ? "r2" : "static";
  return { posts, source };
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const { posts } = await getBlogPostsWithSource();
  return posts;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const staticHit = getStaticPostBySlug(slug);

  if (await isAppFlowyConfigured()) {
    try {
      const appFlowyPost = await withCmsTimeout(getAppFlowyPostBySlug(slug), null);
      if (appFlowyPost?.published) {
        return mapAppFlowyPost(appFlowyPost);
      }
    } catch {
      // Fall through to R2 / static.
    }
  }

  const r2Post = await getR2BlogPostBySlug(slug);
  if (r2Post) return r2Post;

  return staticHit;
}
