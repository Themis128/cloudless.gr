/**
 * CMS provider selection for the Notion → AppFlowy dual-run cutover.
 *
 * Order: AppFlowy (primary) → Notion (temporary fallback) → static/empty.
 */

import { isConfiguredAsync, type IntegrationConfig } from "@/lib/integrations";
import { isAppFlowyConfigured } from "@/lib/appflowy";

export type CmsSource = "appflowy" | "notion" | "static";

export async function isAppFlowyCmsConfigured(): Promise<boolean> {
  return isAppFlowyConfigured();
}

export async function isNotionCmsConfigured(
  ...dbKeys: (keyof IntegrationConfig)[]
): Promise<boolean> {
  return isConfiguredAsync(...dbKeys);
}

export function cmsSourceHeaders(source: CmsSource): HeadersInit {
  return { "x-cms-source": source };
}

export function blogSourceHeaders(source: CmsSource): HeadersInit {
  return { "x-blog-source": source };
}
