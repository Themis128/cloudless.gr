/**
 * Notion form submission storage.
 *
 * Saves contact form submissions as pages in a Notion database.
 *
 * Expected Notion database schema (NOTION_SUBMISSIONS_DB_ID):
 * ┌──────────────┬──────────────────────────────┐
 * │ Column       │ Type                         │
 * ├──────────────┼──────────────────────────────┤
 * │ Name         │ Title                        │
 * │ Email        │ Email                        │
 * │ Company      │ Rich text                    │
 * │ Service      │ Rich text                    │
 * │ Message      │ Rich text                    │
 * │ Status       │ Select (New / In Review / Done) │
 * │ Source       │ Select (contact / subscribe / other) │
 * │ Submitted At │ Date                         │
 * └──────────────┴──────────────────────────────┘
 */

import { notionFetch } from "@/lib/notion";
import { getIntegrations } from "@/lib/integrations";

export interface ContactSubmission {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
  source?: "contact" | "subscribe" | "other";
}

export interface SubmissionRecord {
  id: string;
  name: string;
  email: string;
  company: string;
  service: string;
  message: string;
  status: string;
  source: string;
  submittedAt: string;
  url: string;
}

/**
 * Save a contact form submission to Notion.
 * Returns the created page ID, or null if Notion is not configured.
 */
export async function saveSubmission(
  data: ContactSubmission,
): Promise<string | null> {
  const { NOTION_API_KEY, NOTION_SUBMISSIONS_DB_ID } = getIntegrations();
  if (!NOTION_API_KEY || !NOTION_SUBMISSIONS_DB_ID) return null;

  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_SUBMISSIONS_DB_ID },
        properties: {
          Name: {
            title: [{ text: { content: data.name.slice(0, 200) } }],
          },
          Email: {
            email: data.email,
          },
          Company: {
            rich_text: [{ text: { content: (data.company ?? "").slice(0, 200) } }],
          },
          Service: {
            rich_text: [{ text: { content: (data.service ?? "").slice(0, 200) } }],
          },
          Message: {
            rich_text: [{ text: { content: data.message.slice(0, 2000) } }],
          },
          Status: {
            select: { name: "New" },
          },
          Source: {
            select: { name: data.source ?? "contact" },
          },
          "Submitted At": {
            date: { start: new Date().toISOString() },
          },
        },
      }),
    });

    return page.id;
  } catch (err) {
    // Non-blocking — log but don't surface to the user
    console.error("[Notion] Failed to save submission:", err);
    return null;
  }
}

/**
 * List recent submissions from Notion (for the admin panel).
 * Returns empty array if Notion is not configured.
 */
export async function listSubmissions(limit = 50): Promise<SubmissionRecord[]> {
  const { NOTION_API_KEY, NOTION_SUBMISSIONS_DB_ID } = getIntegrations();
  if (!NOTION_API_KEY || !NOTION_SUBMISSIONS_DB_ID) return [];

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data = await notionFetch<{ results: any[] }>(
      `/databases/${NOTION_SUBMISSIONS_DB_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          page_size: Math.min(limit, 100),
          sorts: [{ property: "Submitted At", direction: "descending" }],
        }),
      },
    );

    return (data.results ?? []).map((page: any) => {
      const p = page.properties ?? {};
      return {
        id: page.id,
        name: (p.Name?.title ?? []).map((t: any) => t.plain_text).join(""),
        email: p.Email?.email ?? "",
        company: (p.Company?.rich_text ?? []).map((t: any) => t.plain_text).join(""),
        service: (p.Service?.rich_text ?? []).map((t: any) => t.plain_text).join(""),
        message: (p.Message?.rich_text ?? []).map((t: any) => t.plain_text).join(""),
        status: p.Status?.select?.name ?? "New",
        source: p.Source?.select?.name ?? "contact",
        submittedAt: p["Submitted At"]?.date?.start ?? page.created_time,
        url: page.url,
      };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion] Failed to list submissions:", err);
    return [];
  }
}

/**
 * Update the status of a submission in Notion.
 */
export async function updateSubmissionStatus(
  pageId: string,
  status: "New" | "In Review" | "Done",
): Promise<boolean> {
  const { NOTION_API_KEY } = getIntegrations();
  if (!NOTION_API_KEY) return false;

  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Status: { select: { name: status } },
        },
      }),
    });
    return true;
  } catch (err) {
    console.error("[Notion] Failed to update submission status:", err);
    return false;
  }
}
