/**
 * AppFlowy Services CMS adapter.
 *
 * Page naming: `[Service] <name>`
 * Optional markdown body may include key/value lines:
 *   **Slug**: cloud-audit
 *   **Description**: ...
 *   **Price**: From €1,500
 *   **Category**: audit
 *   **Features**: feature one; feature two
 *   **CTA**: Book an audit
 *   **Icon**: 🔍
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";
import type { CloudlessService, ServiceCategory } from "./notion-services";
import { staticServices } from "./notion-services";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripPrefix(name: string): string {
  return name.replace(/^\[Service\]\s*/i, "").trim();
}

function isServicePage(name: string): boolean {
  return /^\[Service\]\s/i.test(name);
}

function parseField(markdown: string, key: string): string {
  const re = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, "i");
  const match = re.exec(markdown);
  return match?.[1]?.trim() ?? "";
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

export async function getServices(): Promise<CloudlessService[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const serviceViews = views.filter((v) => isServicePage(v.name));
    const services: CloudlessService[] = [];

    for (const view of serviceViews) {
      const title = stripPrefix(view.name);
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }

      const category = (parseField(markdown, "Category") || "consulting") as ServiceCategory;
      const featuresRaw = parseField(markdown, "Features");
      services.push({
        id: view.view_id,
        slug: parseField(markdown, "Slug") || slugify(title),
        name: title,
        description: parseField(markdown, "Description") || "",
        price: parseField(markdown, "Price") || "",
        category,
        features: featuresRaw
          ? featuresRaw
              .split(/[;\n]/)
              .map((f) => f.trim())
              .filter(Boolean)
          : [],
        cta: parseField(markdown, "CTA") || "Contact us",
        icon: parseField(markdown, "Icon") || "⚡",
        stripePriceId: parseField(markdown, "StripePriceId") || undefined,
      });
    }

    return services;
  } catch {
    return [];
  }
}

export { staticServices };
