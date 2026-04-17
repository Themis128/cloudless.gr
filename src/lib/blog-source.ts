import {
  posts as staticPosts,
  getPostBySlug as getStaticPostBySlug,
  type BlogPost,
} from "@/lib/blog";
import { isConfigured } from "@/lib/integrations";
import {
  getPosts as getNotionPosts,
  getPostBySlug as getNotionPostBySlug,
  type NotionBlock,
  type NotionPost,
} from "@/lib/notion-blog";

const DEFAULT_CATEGORY = "Cloud" as BlogPost["category"];
const WORDS_PER_MINUTE = 200;

function normalizeCategory(tags: string[]): BlogPost["category"] {
  return (tags.find((tag) => tag.trim()) ??
    DEFAULT_CATEGORY) as BlogPost["category"];
}

function estimateReadTime(text: string): string {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

function getPayload(block: NotionBlock): Record<string, unknown> | undefined {
  const payload = block[block.type as string];
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : undefined;
}

function extractPayloadText(payload?: Record<string, unknown>): string {
  if (!payload) return "";

  const richText = payload.rich_text;
  if (Array.isArray(richText)) {
    return richText
      .map((entry) =>
        typeof entry === "object" && entry !== null && "plain_text" in entry
          ? String(entry.plain_text ?? "")
          : "",
      )
      .join("");
  }

  const title = payload.title;
  if (Array.isArray(title)) {
    return title
      .map((entry) =>
        typeof entry === "object" && entry !== null && "plain_text" in entry
          ? String(entry.plain_text ?? "")
          : "",
      )
      .join("");
  }

  return "";
}

function blocksToContent(blocks: NotionBlock[]): string {
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      parts.push(listItems.join("\n"));
      listItems = [];
    }
  };

  for (const block of blocks) {
    const payload = getPayload(block);
    const text = extractPayloadText(payload).trim();

    switch (block.type) {
      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do": {
        if (text) listItems.push(`- ${text}`);
        break;
      }
      case "heading_1":
      case "heading_2":
      case "heading_3": {
        flushList();
        if (text) parts.push(`## ${text}`);
        break;
      }
      case "paragraph":
      case "quote":
      case "callout":
      case "code": {
        flushList();
        if (text) parts.push(text);
        break;
      }
      default: {
        flushList();
        if (text) parts.push(text);
        break;
      }
    }
  }

  flushList();
  return parts.join("\n\n").trim();
}

function mapNotionListingPost(post: NotionPost): BlogPost {
  const readingSource = `${post.title} ${post.excerpt}`.trim();
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: estimateReadTime(readingSource),
    category: normalizeCategory(post.tags),
    content: "",
  };
}

function mapNotionPost(
  post: NotionPost & { content: NotionBlock[] },
): BlogPost {
  const content = blocksToContent(post.content);
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: estimateReadTime(`${post.title} ${post.excerpt} ${content}`),
    category: normalizeCategory(post.tags),
    content,
  };
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  if (!isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID")) {
    return staticPosts;
  }

  try {
    const notionPosts = await getNotionPosts();
    return notionPosts.map(mapNotionListingPost);
  } catch {
    return staticPosts;
  }
}

export async function getBlogPostBySlug(
  slug: string,
): Promise<BlogPost | undefined> {
  if (!isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID")) {
    return getStaticPostBySlug(slug);
  }

  try {
    const notionPost = await getNotionPostBySlug(slug);
    if (notionPost) {
      return mapNotionPost(notionPost);
    }
    return getStaticPostBySlug(slug);
  } catch {
    return getStaticPostBySlug(slug);
  }
}
