import { getIntegrations } from "@/lib/integrations";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  tags: string[];
  published: boolean;
  coverImage?: string;
  content?: NotionBlock[];
}

interface NotionBlock {
  type: string;
  id: string;
  [key: string]: unknown;
}

type RichText = Array<{ plain_text: string }>;

function extractPlainText(richText: RichText): string {
  return richText?.map((t) => t.plain_text).join("") ?? "";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPage(page: any): NotionPost {
  const props = page.properties ?? {};
  return {
    id: page.id,
    slug: extractPlainText(props.Slug?.rich_text ?? []) || page.id,
    title: extractPlainText((props.Title ?? props.Name)?.title ?? []),
    excerpt: extractPlainText(props.Excerpt?.rich_text ?? []),
    date: props.Date?.date?.start ?? "",
    author: extractPlainText(props.Author?.rich_text ?? []) || "Cloudless Team",
    tags: (props.Tags?.multi_select ?? []).map((t: any) => t.name),
    published: props.Published?.checkbox ?? false,
    coverImage: page.cover?.external?.url ?? page.cover?.file?.url,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function notionHeaders() {
  const { NOTION_API_KEY } = getIntegrations();
  return {
    Authorization: `Bearer ${NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

/**
 * Fetch published blog posts from Notion database.
 * Returns empty array if Notion is not configured.
 */
export async function getPosts(): Promise<NotionPost[]> {
  const { NOTION_API_KEY, NOTION_BLOG_DB_ID } = getIntegrations();
  if (!NOTION_API_KEY || !NOTION_BLOG_DB_ID) return [];

  try {
    const res = await fetch(
      `${NOTION_API}/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [{ property: "Date", direction: "descending" }],
        }),
      },
    );

    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map(mapPage);
  } catch (err) {
    console.error("[Notion] Failed to fetch posts:", err);
    return [];
  }
}

/** Fetch a single post by slug, including block content */
export async function getPostBySlug(
  slug: string,
): Promise<(NotionPost & { content: NotionBlock[] }) | null> {
  const { NOTION_API_KEY, NOTION_BLOG_DB_ID } = getIntegrations();
  if (!NOTION_API_KEY || !NOTION_BLOG_DB_ID) return null;

  try {
    const res = await fetch(
      `${NOTION_API}/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: {
            and: [
              { property: "Slug", rich_text: { equals: slug } },
              { property: "Published", checkbox: { equals: true } },
            ],
          },
        }),
      },
    );

    if (!res.ok) return null;
    const data = await res.json();
    const page = data.results?.[0];
    if (!page) return null;

    // Fetch blocks (content)
    const blocksRes = await fetch(
      `${NOTION_API}/blocks/${page.id}/children?page_size=100`,
      {
        headers: notionHeaders(),
      },
    );
    const blocksData = blocksRes.ok ? await blocksRes.json() : { results: [] };

    return {
      ...mapPage(page),
      content: blocksData.results ?? [],
    };
  } catch (err) {
    console.error("[Notion] Failed to fetch post:", err);
    return null;
  }
}
