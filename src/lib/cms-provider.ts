/**
 * CMS provider selection. Live CMS is AppFlowy; static fallbacks when unbound.
 * Notion is not a runtime source — do not revive Notion admin/webhooks.
 */

import { isAppFlowyConfigured } from "@/lib/appflowy";

export type CmsSource = "appflowy" | "r2" | "static";

export async function isAppFlowyCmsConfigured(): Promise<boolean> {
  return isAppFlowyConfigured();
}

export function cmsSourceHeaders(source: CmsSource): HeadersInit {
  return { "x-cms-source": source };
}

export function blogSourceHeaders(source: CmsSource): HeadersInit {
  return { "x-blog-source": source };
}
