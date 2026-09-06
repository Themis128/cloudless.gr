import { describe, it, expect } from "vitest";
import {
  isEspoRecordId,
  emptyAttribution,
  emptyScores,
  contactDisplayName,
  matchGoldAttributionRows,
  matchRfmChurnRow,
  normalizeEspoContact,
  summarizeRelated,
  summarizeNote,
} from "@/lib/crm-contact-360-shared";

describe("isEspoRecordId", () => {
  it("returns true for valid 8-24 alphanum id", () => {
    expect(isEspoRecordId("6a36ef141808ed7")).toBe(true);
    expect(isEspoRecordId("abc12345")).toBe(true);
  });

  it("returns false for id that is too short", () => {
    expect(isEspoRecordId("abc123")).toBe(false);
  });

  it("returns false for id that is too long", () => {
    expect(isEspoRecordId("a".repeat(25))).toBe(false);
  });

  it("returns false for ids with special chars", () => {
    expect(isEspoRecordId("abc123-xyz")).toBe(false);
  });
});

describe("emptyAttribution", () => {
  it("returns null firstTouch and empty goldMatches", () => {
    const result = emptyAttribution();
    expect(result.firstTouch).toBeNull();
    expect(result.goldMatches).toEqual([]);
  });
});

describe("emptyScores", () => {
  it("returns all null fields", () => {
    const result = emptyScores();
    expect(result.rfmScore).toBeNull();
    expect(result.churnScore).toBeNull();
    expect(result.riskBand).toBeNull();
  });
});

describe("contactDisplayName", () => {
  it("returns full name when both firstName and lastName are present", () => {
    expect(contactDisplayName({ firstName: "Jane", lastName: "Doe" })).toBe("Jane Doe");
  });

  it("returns only first name when lastName is missing", () => {
    expect(contactDisplayName({ firstName: "Jane" })).toBe("Jane");
  });

  it("falls back to email when names are missing", () => {
    expect(contactDisplayName({ email: "user@example.com" })).toBe("user@example.com");
  });

  it("returns '—' when all are missing", () => {
    expect(contactDisplayName({})).toBe("—");
  });
});

describe("matchGoldAttributionRows", () => {
  it("returns empty when goldRows is empty", () => {
    expect(matchGoldAttributionRows([], [{ source: "google", medium: "cpc", campaign: "q3" }])).toEqual([]);
  });

  it("returns empty when touches is empty", () => {
    expect(matchGoldAttributionRows([{ utm_source: "google", utm_medium: "cpc", utm_campaign: "q3" }], [])).toEqual([]);
  });

  it("matches rows by utm source/medium/campaign", () => {
    const rows = [
      { utm_source: "google", utm_medium: "cpc", utm_campaign: "q3", sessions: 10, signups: 2, purchases: 1, revenue: 500 },
      { utm_source: "linkedin", utm_medium: "paid", utm_campaign: "launch", sessions: 5, signups: 1, purchases: 0, revenue: 0 },
    ];
    const touches = [{ source: "google", medium: "cpc", campaign: "q3" }];
    const result = matchGoldAttributionRows(rows, touches);
    expect(result).toHaveLength(1);
    expect(result[0].utmSource).toBe("google");
    expect(result[0].sessions).toBe(10);
  });

  it("normalizes empty source to (direct)", () => {
    const rows = [{ utm_source: "", utm_medium: "none", utm_campaign: "", sessions: 1, signups: 0, purchases: 0, revenue: 0 }];
    const touches = [{ source: "", medium: "none", campaign: "" }];
    const result = matchGoldAttributionRows(rows, touches);
    expect(result[0].utmSource).toBe("(direct)");
  });
});

describe("matchRfmChurnRow", () => {
  it("returns empty scores when goldRows is empty", () => {
    expect(matchRfmChurnRow([], "user@example.com")).toEqual(emptyScores());
  });

  it("returns empty scores when email is empty", () => {
    expect(matchRfmChurnRow([{ email: "user@example.com" }], "")).toEqual(emptyScores());
  });

  it("returns scores matching by email (case-insensitive)", () => {
    const rows = [{ email: "User@Example.COM", rfm_score: 80, churn_score: 0.1, risk_band: "low", recency_days: 14, frequency: 3, monetary: 500, last_purchase_at: "2026-09-01" }];
    const result = matchRfmChurnRow(rows, "user@example.com");
    expect(result.rfmScore).toBe(80);
    expect(result.riskBand).toBe("low");
  });
});

describe("normalizeEspoContact", () => {
  it("maps fields correctly", () => {
    const raw = {
      id: "abc123xyz",
      emailAddress: "user@example.com",
      firstName: "Jane",
      lastName: "Doe",
      phoneNumber: "+30 210 0000",
      accountName: "Acme",
      accountId: "acct123",
      leadSource: "Web",
      description: "VIP customer",
      createdAt: "2026-01-01",
      modifiedAt: "2026-09-01",
    };
    const result = normalizeEspoContact(raw);
    expect(result.id).toBe("abc123xyz");
    expect(result.email).toBe("user@example.com");
    expect(result.firstName).toBe("Jane");
    expect(result.company).toBe("Acme");
    expect(result.accountId).toBe("acct123");
  });

  it("returns null accountId when not present", () => {
    const result = normalizeEspoContact({ id: "x" });
    expect(result.accountId).toBeNull();
  });
});

describe("summarizeRelated", () => {
  it("maps id, name, status, amount, createdAt", () => {
    const raw = { id: "opp1", name: "Big Deal", stage: "Qualification", amount: 5000, createdAt: "2026-01-01" };
    const result = summarizeRelated(raw);
    expect(result.id).toBe("opp1");
    expect(result.status).toBe("Qualification");
    expect(result.amount).toBe(5000);
  });

  it("returns null amount for non-numeric", () => {
    const result = summarizeRelated({ id: "x", name: "y", amount: "N/A" });
    expect(result.amount).toBeNull();
  });
});

describe("summarizeNote", () => {
  it("maps id, post, createdAt", () => {
    const raw = { id: "n1", post: "Great call", createdAt: "2026-09-01" };
    const result = summarizeNote(raw);
    expect(result.id).toBe("n1");
    expect(result.post).toBe("Great call");
  });

  it("falls back to data field for post", () => {
    const result = summarizeNote({ id: "n2", data: "Legacy note" });
    expect(result.post).toBe("Legacy note");
  });
});
