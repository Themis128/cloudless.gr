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

import { notionFetch, notionFetchAll } from "@/lib/notion";
import { requireIntegrationAsync } from "@/lib/integrations";

const SOURCE_CONTACT = "contact";
const SUBMITTED_AT_PROP = "Submitted At";

export interface ContactSubmission {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
  source?: "contact" | "subscribe" | "other"; // NOSONAR — type annotation
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
  const { NOTION_SUBMISSIONS_DB_ID } = await requireIntegrationAsync(
    "NOTION_API_KEY",
    "NOTION_SUBMISSIONS_DB_ID",
  );

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
            rich_text: [
              { text: { content: (data.company ?? "").slice(0, 200) } },
            ],
          },
          Service: {
            rich_text: [
              { text: { content: (data.service ?? "").slice(0, 200) } },
            ],
          },
          Message: {
            rich_text: [{ text: { content: data.message.slice(0, 2000) } }],
          },
          Status: {
            select: { name: "New" },
          },
          Source: {
            select: { name: data.source ?? SOURCE_CONTACT },
          },
          [SUBMITTED_AT_PROP]: {
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
 * Fetches all pages via pagination then slices to `limit` — correctly
 * handles databases with more than 100 entries (old code silently truncated).
 * Returns empty array if Notion is not configured.
 */
export async function listSubmissions(limit = 50): Promise<SubmissionRecord[]> {
  const { NOTION_SUBMISSIONS_DB_ID } = await requireIntegrationAsync(
    "NOTION_API_KEY",
    "NOTION_SUBMISSIONS_DB_ID",
  );

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const results = await notionFetchAll<any>(
      `/databases/${NOTION_SUBMISSIONS_DB_ID}/query`,
      { sorts: [{ property: SUBMITTED_AT_PROP, direction: "descending" }] },
    );

    return results.slice(0, limit).map((page: any) => {
      const p = page.properties ?? {};
      return {
        id: page.id,
        name: (p.Name?.title ?? []).map((t: any) => t.plain_text).join(""),
        email: p.Email?.email ?? "",
        company: (p.Company?.rich_text ?? [])
          .map((t: any) => t.plain_text)
          .join(""),
        service: (p.Service?.rich_text ?? [])
          .map((t: any) => t.plain_text)
          .join(""),
        message: (p.Message?.rich_text ?? [])
          .map((t: any) => t.plain_text)
          .join(""),
        status: p.Status?.select?.name ?? "New",
        source: p.Source?.select?.name ?? SOURCE_CONTACT,
        submittedAt: p[SUBMITTED_AT_PROP]?.date?.start ?? page.created_time,
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
  await requireIntegrationAsync("NOTION_API_KEY");

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
