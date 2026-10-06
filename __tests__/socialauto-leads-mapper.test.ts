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

    expect(data.source).toBe("Other");
    expect(String(data.description)).toContain("Facebook Messenger");
    expect(String(data.description)).toContain("Thread ID: t_123");
    expect(String(data.description)).toContain("Notes: Asked about pricing");
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
    expect(String(data.description)).toContain("website (Website)");
  });
});

