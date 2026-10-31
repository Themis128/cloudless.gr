import type { LeadData } from "@/lib/espocrm";

export type SocialAutoSource =
  "whatsapp_flow" | "whatsapp_dm" | "facebook_messenger" | "instagram_dm" | "website";
export type SocialAutoInterest = "cloud" | "growth" | "audit";

export interface SocialAutoLead {
  source: SocialAutoSource;
  name: string;
  email: string;
  company_size?: string | number | null;
  interest?: SocialAutoInterest | null;
  notes?: string | null;
  thread_id?: string | null;
  social_account_id?: string | null;
  meta_data?: unknown;
  id?: string | null;
  created_at?: string | null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitName(name: string): { firstName?: string; lastName?: string } {
  const normalized = normalizeWhitespace(name);
  if (!normalized) return {};
  const parts = normalized.split(" ").filter(Boolean);
  const [first, ...rest] = parts;
  if (!first) return {};
  return {
    firstName: first || undefined,
    lastName: rest.length ? rest.join(" ") : undefined,
  };
}

// [espoSource, channelLabel, utmSource, utmMedium, targetListName]
type SourceRow = [string, string, string, string, string | undefined];
const SOURCE_MAP: Record<SocialAutoSource, SourceRow> = {
  facebook_messenger: [
    "Messenger",
    "Facebook Messenger",
    "facebook_messenger",
    "social",
    "Messenger leads",
  ],
  instagram_dm: ["Messenger", "Instagram DM", "instagram_dm", "social", "Messenger leads"],
  whatsapp_flow: ["WhatsApp Flow", "WhatsApp Flow", "whatsapp", "social", "WhatsApp leads"],
  whatsapp_dm: ["Messenger", "WhatsApp DM", "whatsapp", "social", "WhatsApp leads"],
  website: ["Web Site", "Website", "website", "referral", undefined],
};

function mapSourceToEspo(source: SocialAutoSource): {
  espoSource: string;
  channelLabel: string;
  utmSource: string;
  utmMedium: string;
  targetListName?: string;
} {
  const [espoSource, channelLabel, utmSource, utmMedium, targetListName] = SOURCE_MAP[source] ?? [
    "Other",
    "Other",
    "other",
    "other",
    undefined,
  ];
  return { espoSource, channelLabel, utmSource, utmMedium, targetListName };
}

function stringifyMeta(meta: unknown, maxChars = 2000): string | undefined {
  if (meta == null) return undefined;
  try {
    const raw = JSON.stringify(meta);
    if (!raw) return undefined;
    return raw.length <= maxChars ? raw : raw.slice(0, Math.max(0, maxChars - 1)) + "…";
  } catch {
    return undefined;
  }
}

function toDescription(lead: SocialAutoLead): string {
  const { channelLabel } = mapSourceToEspo(lead.source);
  const meta = stringifyMeta(lead.meta_data);
  const lines = [
    `Source: ${lead.source} (${channelLabel})`,
    lead.interest ? `Interest: ${lead.interest}` : null,
    lead.company_size != null && lead.company_size !== ""
      ? `Company size: ${String(lead.company_size)}`
      : null,
    lead.thread_id ? `Thread ID: ${lead.thread_id}` : null,
    lead.social_account_id ? `Social account ID: ${lead.social_account_id}` : null,
    lead.id ? `SocialAuto lead ID: ${lead.id}` : null,
    lead.created_at ? `Created at: ${lead.created_at}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    meta ? `Meta: ${meta}` : null,
  ].filter((v): v is string => Boolean(v));
  return lines.join("\n");
}

export function toEspoLeadData(lead: SocialAutoLead): LeadData {
  const emailAddress = normalizeWhitespace(String(lead.email ?? "")).toLowerCase();
  const { espoSource, utmSource, utmMedium, targetListName } = mapSourceToEspo(lead.source);
  const name = normalizeWhitespace(String(lead.name ?? ""));
  const { firstName, lastName } = splitName(name);
  const campaignSlug = `socialauto-${lead.source}`;
  return {
    emailAddress,
    firstName,
    lastName,
    source: espoSource,
    campaignSlug,
    description: toDescription(lead),
    utmSource,
    utmMedium,
    utmCampaign: campaignSlug,
    targetListNames: targetListName ? [targetListName] : undefined,
  };
}

export function isSocialAutoLead(input: unknown): input is SocialAutoLead {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  const source = obj.source;
  return (
    (source === "whatsapp_flow" ||
      source === "whatsapp_dm" ||
      source === "facebook_messenger" ||
      source === "instagram_dm" ||
      source === "website") &&
    typeof obj.name === "string" &&
    typeof obj.email === "string"
  );
}
