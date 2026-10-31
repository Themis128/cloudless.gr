import { describe, expect, it } from "vitest";

import { toEspoLeadData, type SocialAutoSource } from "@/lib/socialauto-leads";

const CASES: {
  source: SocialAutoSource;
  espoSource: string;
  utmSource: string;
  utmMedium: string;
  list?: string;
}[] = [
  {
    source: "facebook_messenger",
    espoSource: "Messenger",
    utmSource: "facebook_messenger",
    utmMedium: "social",
    list: "Messenger leads",
  },
  {
    source: "instagram_dm",
    espoSource: "Messenger",
    utmSource: "instagram_dm",
    utmMedium: "social",
    list: "Messenger leads",
  },
  {
    source: "whatsapp_flow",
    espoSource: "WhatsApp Flow",
    utmSource: "whatsapp",
    utmMedium: "social",
    list: "WhatsApp leads",
  },
  {
    source: "whatsapp_dm",
    espoSource: "Messenger",
    utmSource: "whatsapp",
    utmMedium: "social",
    list: "WhatsApp leads",
  },
  {
    source: "website",
    espoSource: "Web Site",
    utmSource: "website",
    utmMedium: "referral",
    list: undefined,
  },
];

describe("toEspoLeadData (SocialAuto → EspoCRM Lead)", () => {
  it.each(CASES)("maps $source → $espoSource with correct UTM and segment", (c) => {
    const data = toEspoLeadData({
      source: c.source,
      name: "Ada Lovelace",
      email: "ADA@EXAMPLE.COM",
    });

    expect(data.source).toBe(c.espoSource);
    expect(data.utmSource).toBe(c.utmSource);
    expect(data.utmMedium).toBe(c.utmMedium);
    expect(data.utmCampaign).toBe(`socialauto-${c.source}`);
    expect(data.campaignSlug).toBe(`socialauto-${c.source}`);
    expect(data.targetListNames).toEqual(c.list ? [c.list] : undefined);
  });

  it("keeps channel detail and notes in description", () => {
    const data = toEspoLeadData({
      source: "facebook_messenger",
      name: "Ada Lovelace",
      email: "ada@example.com",
      thread_id: "t_123",
      notes: "Asked about pricing",
    });

    const desc = String(data.description);
    expect(desc).toContain("Facebook Messenger");
    expect(desc).toContain("Thread ID: t_123");
    expect(desc).toContain("Notes: Asked about pricing");
  });
});
