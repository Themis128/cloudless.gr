/**
 * AppFlowy Blog CMS adapter.
 *
 * Reads blog posts from AppFlowy workspace Document pages.
 * Falls back to an empty result when AppFlowy is not configured.
 *
 * Page naming convention:
 *   [Blog] <title>   - published post, title becomes slug
 *   [Review] <title> - queued for newsletter publishing
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  markdownToHtml,
} from "./appflowy";
import { isAppFlowyConfigured } from "./appflowy";

export type TocEntry = {
  id?: string;
  blockId: string;
  text: string;
  level: number;
};

export interface AppFlowyPost {
  toc?: TocEntry[];
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  coverImage?: string;
  readTime: string;
  seoTitle?: string;
  seoDescription?: string;
  html: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripPrefix(name: string): string {
  return name
    .replace(/^\[Blog\]\s*/i, "")
    .replace(/^\[Review\]\s*/i, "")
    .trim();
}

function isBlogPage(name: string): boolean {
  return /^\[Blog\]\s/i.test(name) || /^\[Review\]\s/i.test(name);
}

function isPublished(name: string): boolean {
  return /^\[Blog\]\s/i.test(name);
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

function mapViewToPost(view: {
  view_id: string;
  name: string;
  last_edited_time: string;
}): Omit<AppFlowyPost, "html"> {
  const raw = stripPrefix(view.name);
  return {
    id: view.view_id,
    slug: slugify(raw),
    title: raw,
    excerpt: "",
    date: view.last_edited_time,
    author: "Cloudless Team",
    category: "Cloud",
    tags: [],
    published: isPublished(view.name),
    featured: false,
    readTime: "5 min read",
  };
}

export async function getPosts(): Promise<AppFlowyPost[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const blogViews = views.filter((v) => isBlogPage(v.name));

    const posts: AppFlowyPost[] = [];
    for (const view of blogViews) {
      const base = mapViewToPost(view);
      let html = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = extractDocText(doc);
        html = markdownToHtml(text);
      } catch {
        html = "";
      }
      posts.push({ ...base, html });
    }

    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<AppFlowyPost | null> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export async function getAllSlugs(): Promise<string[]> {
  const posts = await getPosts();
  return posts.map((p) => p.slug);
}

export async function getFeaturedPosts(): Promise<AppFlowyPost[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.featured);
}

export async function getCategories(): Promise<string[]> {
  const posts = await getPosts();
  const set = new Set(posts.map((p) => p.category));
  return Array.from(set).sort();
}

export async function getTags(): Promise<string[]> {
  const posts = await getPosts();
  const set = new Set<string>();
  for (const p of posts) {
    for (const t of p.tags) set.add(t);
  }
  return Array.from(set).sort();
}

export async function getPostsByCategory(category: string): Promise<AppFlowyPost[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.category === category);
}

export async function getPostsByTag(tag: string): Promise<AppFlowyPost[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.tags.includes(tag));
}

export async function searchPosts(query: string): Promise<AppFlowyPost[]> {
  const posts = await getPosts();
  const q = query.toLowerCase();
  return posts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export async function getRelatedPosts(post: AppFlowyPost, limit = 3): Promise<AppFlowyPost[]> {
  const allPosts = await getPosts();
  const others = allPosts.filter((p) => p.id !== post.id);
  const scored = others.map((p) => {
    let score = 0;
    if (p.category === post.category) score += 2;
    for (const tag of p.tags) {
      if (post.tags.includes(tag)) score += 1;
    }
    return { post: p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post);
}
