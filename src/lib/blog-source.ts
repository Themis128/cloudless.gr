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
  if (await isAppFlowyConfigured()) {
    try {
      const appFlowyPosts = await withCmsTimeout(getAppFlowyPosts(), []);
      const published = appFlowyPosts.filter((post) => post.published);
      if (published.length > 0) {
        return {
          posts: published.map(mapAppFlowyListingPost),
          source: "appflowy",
        };
      }
    } catch {
      // Fall through to R2 / static.
    }
  }

  const r2Posts = await getR2BlogPosts();
  if (r2Posts.length > 0) {
    return { posts: r2Posts, source: "r2" };
  }

  return { posts: staticPosts, source: "static" };
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
