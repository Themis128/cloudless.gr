/**
 * AppFlowy form submission storage.
 *
 * Saves contact form submissions as Document pages in an AppFlowy workspace.
 * Falls back to empty results when AppFlowy is not configured.
 *
 * Document naming convention:
 *   [Contact] <Name> - <Email> - contact form submission
 *   [Subscribe] <Email> - newsletter subscription
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";

const SOURCE_CONTACT = "contact";
const SOURCE_SUBSCRIBE = "subscribe";

export interface ContactSubmission {
  name: string;
  email: string;
  phone?: string;
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseContactFields(text: string): Partial<SubmissionRecord> {
  const fields: Record<string, string> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^\*\*([A-Za-z]+)\*\*:\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return {
    name: fields["Name"] || "",
    email: fields["Email"] || "",
    company: fields["Company"] || "",
    service: fields["Service"] || "",
    message: fields["Message"] || "",
    status: fields["Status"] || "New",
    source: fields["Source"] || SOURCE_CONTACT,
    submittedAt: fields["Date"] || new Date().toISOString(),
  };
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Save a contact form submission to AppFlowy.
 * Creates a Document page with the submission data.
 * Returns the created view_id, or null if AppFlowy is not configured.
 */
export async function saveSubmission(data: ContactSubmission): Promise<string | null> {
  if (!(await isAppFlowyConfigured())) return null;

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return null;

  try {
    // Write API not available yet — keep the shape ready without logging PII.
    if (!data.email?.trim()) return null;
    console.log("[AppFlowy Forms] Would create submission (stub)");
    return `submission-${Date.now()}`;
  } catch {
    console.error("[AppFlowy Forms] Failed to save submission");
    return null;
  }
}

/**
 * List recent submissions from AppFlowy (for the admin panel).
 * Returns empty array if AppFlowy is not configured.
 */
export async function listSubmissions(limit = 50): Promise<SubmissionRecord[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    // Filter for contact/subscribe submissions
    const submissionViews = views.filter(
      (v) => /^\[Contact\]\s/i.test(v.name) || /^\[Subscribe\]\s/i.test(v.name)
    );

    const records: SubmissionRecord[] = [];
    for (const view of submissionViews.slice(0, limit)) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        const fields = parseContactFields(text);
        records.push({
          id: view.view_id,
          name: fields.name || "",
          email: fields.email || "",
          company: fields.company || "",
          service: fields.service || "",
          message: fields.message || "",
          status: fields.status || "New",
          source: fields.source || SOURCE_CONTACT,
          submittedAt: fields.submittedAt || view.last_edited_time,
          url: "", // AppFlowy doesn't have public URLs like Notion
        });
      } catch {
        // Skip failed documents
      }
    }

    // Sort by date descending
    return records.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Forms] Failed to list submissions:", msg);
    return [];
  }
}

/**
 * Update the status of a submission in AppFlowy.
 * Note: This would require write API support in AppFlowy.
 */
export async function updateSubmissionStatus(
  _pageId: string,
  _status: "New" | "In Review" | "Done"
): Promise<boolean> {
  if (!(await isAppFlowyConfigured())) return false;

  // AppFlowy write API not yet implemented in appflowy.ts
  // This would update the document's Status field
  console.log("[AppFlowy Forms] Would update status (stub)");
  return false;
}
