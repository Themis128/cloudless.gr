import { getConfig } from "@/lib/ssm-config";

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

// Default flag definitions — overridden by SSM AB_FLAGS_JSON when configured
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

export async function getABFlags(): Promise<ABFlag[]> {
  try {
    const cfg = await getConfig();
    const raw = (cfg as unknown as Record<string, string | undefined>)
      .AB_FLAGS_JSON;
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
  return Math.random() * 100 < flag.trafficSplit ? "b" : "a";
}
