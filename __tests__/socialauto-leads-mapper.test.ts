import { describe, expect, it } from "vitest";

import { toEspoLeadData } from "@/lib/socialauto-leads";

describe("toEspoLeadData (SocialAuto → EspoCRM Lead)", () => {
  it("emits a valid EspoCRM Lead.source enum and keeps channel detail in description", () => {
    const data = toEspoLeadData({
      source: "facebook_messenger",
      name: "Ada Lovelace",
      email: "ADA@EXAMPLE.COM",
      thread_id: "t_123",
      notes: "Asked about pricing",
    });

    expect(data.source).toBe("Messenger");
    expect(String(data.description)).toContain("Facebook Messenger");
    expect(String(data.description)).toContain("Thread ID: t_123");
    expect(String(data.description)).toContain("Notes: Asked about pricing");
    expect(data.utmSource).toBe("facebook_messenger");
    expect(data.utmMedium).toBe("social");
    expect(data.utmCampaign).toBe("socialauto-facebook_messenger");
    expect(data.targetListNames).toEqual(["Messenger leads"]);
  });

  it("maps whatsapp_flow to the WhatsApp Flow enum and WhatsApp segment", () => {
    const data = toEspoLeadData({
      source: "whatsapp_flow",
      name: "Flow User",
      email: "flow@example.com",
    });

    expect(data.source).toBe("WhatsApp Flow");
    expect(data.utmSource).toBe("whatsapp");
    expect(data.targetListNames).toEqual(["WhatsApp leads"]);
  });

  it("maps whatsapp_dm to the Messenger enum bucket with WhatsApp UTM detail", () => {
    const data = toEspoLeadData({
      source: "whatsapp_dm",
      name: "DM User",
      email: "dm@example.com",
    });

    expect(data.source).toBe("Messenger");
    expect(data.utmSource).toBe("whatsapp");
    expect(data.targetListNames).toEqual(["WhatsApp leads"]);
  });

  it("maps instagram_dm to the Messenger enum bucket", () => {
    const data = toEspoLeadData({
      source: "instagram_dm",
      name: "IG User",
      email: "ig@example.com",
    });

    expect(data.source).toBe("Messenger");
    expect(data.utmSource).toBe("instagram_dm");
    expect(data.targetListNames).toEqual(["Messenger leads"]);
  });

  it("maps website leads to the Web Site enum", () => {
    const data = toEspoLeadData({
      source: "website",
      name: "Web Visitor",
      email: "visitor@cloudless.gr",
      notes: "Contact form",
    });

    expect(data.source).toBe("Web Site");
    expect(data.campaignSlug).toBe("socialauto-website");
    expect(data.utmSource).toBe("website");
    expect(data.utmMedium).toBe("referral");
    expect(data.targetListNames).toBeUndefined();
    expect(String(data.description)).toContain("website (Website)");
  });
});
