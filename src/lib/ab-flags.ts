import { getConfig } from "@/lib/ssm-config";
import type { AuthDatabase } from "@/lib/auth-d1";

export interface ABFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trafficSplit: number; // 0-100, percentage assigned to variant B
  variants: {
    a: string;
    b: string;
  };
}

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

const D1_CONFIG_KEY = "AB_FLAGS_JSON";

// Default flag definitions — overridden by D1 config or SSM AB_FLAGS_JSON when configured
export const DEFAULT_FLAGS: ABFlag[] = [
  {
    id: "hero-cta",
    name: "Hero CTA Text",
    description: "Test alternate primary CTA copy on the homepage hero",
    enabled: false,
    trafficSplit: 50,
    variants: {
      a: "Get a Free Audit",
      b: "Start for Free",
    },
  },
  {
    id: "pricing-display",
    name: "Pricing Visibility",
    description: "Show pricing ranges on the services page vs. contact-first",
    enabled: false,
    trafficSplit: 50,
    variants: {
      a: "Contact for pricing",
      b: "Show price ranges",
    },
  },
  {
    id: "navbar-badge",
    name: "Navbar Badge",
    description: "Test urgency badge in navbar vs. no badge",
    enabled: false,
    trafficSplit: 50,
    variants: {
      a: "No badge",
      b: "Now Accepting Clients",
    },
  },
];

async function readFlagsFromD1(): Promise<ABFlag[] | null> {
  const db = getAuthDb();
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT value FROM config WHERE key = ?")
      .bind(D1_CONFIG_KEY)
      .first<{ value: string }>();
    if (row?.value) {
      const parsed = JSON.parse(row.value) as ABFlag[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(
      "[ab-flags] D1 read failed, falling back to SSM:",
      err instanceof Error ? err.message : err
    );
  }
  return null;
}

export async function saveFlagsToD1(flags: ABFlag[]): Promise<void> {
  const db = getAuthDb();
  if (!db) throw new Error("D1 not available");
  await db
    .prepare(
      "INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(D1_CONFIG_KEY, JSON.stringify(flags), Math.floor(Date.now() / 1000))
    .run();
}

export async function getABFlags(): Promise<ABFlag[]> {
  // Try D1 first (Cloudflare Workers)
  const d1Flags = await readFlagsFromD1();
  if (d1Flags) return d1Flags;

  // Fall back to SSM via getConfig
  try {
    const cfg = await getConfig();
    const raw = (cfg as unknown as Record<string, string | undefined>).AB_FLAGS_JSON;
    if (raw) {
      const parsed = JSON.parse(raw) as ABFlag[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_FLAGS;
}

export function assignVariant(flag: ABFlag, cookieValue?: string): "a" | "b" {
  if (!flag.enabled) return "a";
  // Stable assignment based on existing cookie
  if (cookieValue === "a" || cookieValue === "b") return cookieValue;
  // Web Crypto is available in both Node and browser; use it instead of
  // Math.random so variant rollout is uniformly distributed and not flagged
  // as a weak-PRNG security hotspot. Bucketing here is non-cryptographic.
  const buf = globalThis.crypto.getRandomValues(new Uint32Array(1));
  const r = (buf[0] ?? 0) / 0xffffffff;
  return r * 100 < flag.trafficSplit ? "b" : "a";
}
