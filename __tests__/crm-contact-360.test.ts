// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetContact = vi.fn();
const mockListOpps = vi.fn();
const mockListCases = vi.fn();
const mockListNotes = vi.fn();
const mockGetStripe = vi.fn();
const mockGetAuthDbFromEnv = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockIsConfiguredAsync = vi.fn();

vi.mock("@/lib/espocrm", () => ({
  isEspoRecordId: (id: string) => /^[a-zA-Z0-9]{8,24}$/.test(id),
  getContact: (...args: unknown[]) => mockGetContact(...args),
  listContactOpportunities: (...args: unknown[]) => mockListOpps(...args),
  listContactCases: (...args: unknown[]) => mockListCases(...args),
  listContactNotes: (...args: unknown[]) => mockListNotes(...args),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: (...args: unknown[]) => mockGetStripe(...args),
}));

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: (...args: unknown[]) => mockGetAuthDbFromEnv(...args),
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
}));

const mockGetGoldSection = vi.fn();

vi.mock("@/lib/datalake-serve", () => ({
  getGoldSection: (...args: unknown[]) => mockGetGoldSection(...args),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: async (request: NextRequest) => {
    const token = request.headers.get("authorization");
    if (token === "Bearer test-admin-session") {
      return { ok: true, user: { sub: "admin", groups: ["admin"] } };
    }
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  },
}));

import {
  contactDisplayName,
  isEspoRecordId,
  matchGoldAttributionRows,
  normalizeEspoContact,
  summarizeNote,
  summarizeRelated,
} from "@/lib/crm-contact-360-shared";
import { getContact360 } from "@/lib/crm-contact-360";

const CONTACT_ID = "67abc123def456789";

function adminRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: "Bearer test-admin-session" },
  });
}

describe("crm-contact-360 helpers", () => {
  it("accepts EspoCRM-shaped ids and rejects junk", () => {
    expect(isEspoRecordId(CONTACT_ID)).toBe(true);
    expect(isEspoRecordId("abc")).toBe(false);
    expect(isEspoRecordId("../etc/passwd")).toBe(false);
    expect(isEspoRecordId("sample-id")).toBe(false);
  });

  it("prefers full name then email", () => {
    expect(contactDisplayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(contactDisplayName({ email: "ada@example.com" })).toBe("ada@example.com");
    expect(contactDisplayName({})).toBe("—");
  });

  it("normalizes EspoCRM contact fields", () => {
    const person = normalizeEspoContact({
      id: CONTACT_ID,
      emailAddress: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "+30 210 0000000",
      accountName: "Analytical Engines",
      accountId: "acct1acct1acct11",
      leadSource: "Web Site",
      description: "Interested in k3s",
      createdAt: "2026-08-01 10:00:00",
      modifiedAt: "2026-08-02 10:00:00",
    });
    expect(person.email).toBe("ada@example.com");
    expect(person.company).toBe("Analytical Engines");
    expect(person.leadSource).toBe("Web Site");
  });

  it("summarizes opportunities and notes", () => {
    expect(
      summarizeRelated({
        id: "opp1opp1opp1opp11",
        name: "Website rebuild",
        stage: "Proposal",
        amount: 1800,
        createdAt: "2026-08-01 10:00:00",
      })
    ).toEqual({
      id: "opp1opp1opp1opp11",
      name: "Website rebuild",
      status: "Proposal",
      amount: 1800,
      createdAt: "2026-08-01 10:00:00",
    });
    expect(summarizeNote({ id: "n1", post: "Called", createdAt: "2026-08-01" }).post).toBe(
      "Called"
    );
  });

  it("matches gold attribution rows by source/medium/campaign", () => {
    const matches = matchGoldAttributionRows(
      [
        {
          utm_source: "linkedin",
          utm_medium: "cpc",
          utm_campaign: "shop-online",
          sessions: 12,
          signups: 2,
          purchases: 1,
          revenue: 1800,
        },
        {
          utm_source: "google",
          utm_medium: "organic",
          utm_campaign: "(none)",
          sessions: 40,
          signups: 0,
          purchases: 0,
          revenue: 0,
        },
      ],
      [{ source: "linkedin", medium: "cpc", campaign: "shop-online" }]
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.utmCampaign).toBe("shop-online");
    expect(matches[0]?.sessions).toBe(12);
  });
});

describe("getContact360", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListOpps.mockResolvedValue([]);
    mockListCases.mockResolvedValue([]);
    mockListNotes.mockResolvedValue([]);
    mockGetStripe.mockResolvedValue(null);
    mockGetAuthDbFromEnv.mockReturnValue(null);
    mockGetUserByEmail.mockResolvedValue(null);
    mockGetGoldSection.mockResolvedValue({ section: "attribution", rows: [] });
  });

  it("returns null when EspoCRM has no contact", async () => {
    mockGetContact.mockResolvedValue(null);
    expect(await getContact360(CONTACT_ID)).toBeNull();
  });

  it("joins Stripe and D1 when email matches", async () => {
    mockGetContact.mockResolvedValue({
      id: CONTACT_ID,
      emailAddress: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    mockListOpps.mockResolvedValue([
      { id: "opp1opp1opp1opp11", name: "Deal", stage: "Prospecting" },
    ]);
    mockGetStripe.mockResolvedValue({
      customers: {
        list: vi
          .fn()
          .mockResolvedValue({
            data: [{ id: "cus_1", email: "ada@example.com", created: 1_700_000_000 }],
          }),
      },
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: "cs_1",
                payment_status: "paid",
                amount_total: 180000,
                currency: "eur",
                created: 1_700_000_100,
              },
            ],
          }),
        },
      },
      subscriptions: { list: vi.fn().mockResolvedValue({ data: [] }) },
    });
    const prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "evt_1",
              event: "contact_submit",
              page: "/contact",
              source: "linkedin",
              medium: "cpc",
              campaign: "shop-online",
              properties_json: null,
              created_at: 1_700_000_200,
            },
          ],
        }),
      }),
    });
    mockGetAuthDbFromEnv.mockReturnValue({ prepare });
    mockGetUserByEmail.mockResolvedValue({
      id: "user_1",
      email: "ada@example.com",
      name: "Ada",
      company: "Analytical Engines",
      created_at: 1_700_000_000,
    });

    mockGetGoldSection.mockResolvedValue({
      section: "attribution",
      rows: [
        {
          utm_source: "linkedin",
          utm_medium: "cpc",
          utm_campaign: "shop-online",
          sessions: 9,
          signups: 1,
          purchases: 1,
          revenue: 1800,
        },
      ],
    });

    const payload = await getContact360(CONTACT_ID);
    expect(payload).not.toBeNull();
    expect(payload?.contact.email).toBe("ada@example.com");
    expect(payload?.opportunities).toHaveLength(1);
    expect(payload?.stripe.customer?.id).toBe("cus_1");
    expect(payload?.stripe.purchases[0]?.amount).toBe(1800);
    expect(payload?.account?.id).toBe("user_1");
    expect(payload?.events[0]?.event).toBe("contact_submit");
    expect(payload?.attribution.firstTouch?.campaign).toBe("shop-online");
    expect(payload?.attribution.goldMatches).toHaveLength(1);
  });
});

describe("GET /api/admin/crm/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetContact.mockResolvedValue({
      id: CONTACT_ID,
      emailAddress: "ada@example.com",
      firstName: "Ada",
    });
    mockListOpps.mockResolvedValue([]);
    mockListCases.mockResolvedValue([]);
    mockListNotes.mockResolvedValue([]);
    mockGetStripe.mockResolvedValue(null);
    mockGetAuthDbFromEnv.mockReturnValue(null);
    mockGetGoldSection.mockResolvedValue({ section: "attribution", rows: [] });
  });

  it("rejects unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/[id]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/crm/contacts/abcdefghijklmnopq"),
      {
        params: Promise.resolve({ id: "abcdefghijklmnopq" }),
      }
    );
    expect(res.status).toBe(403);
  });

  it("returns 503 when EspoCRM is not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/crm/contacts/[id]/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/crm/contacts/abcdefghijklmnopq"),
      {
        params: Promise.resolve({ id: "abcdefghijklmnopq" }),
      }
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 for an invalid id", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/[id]/route");
    const res = await GET(adminRequest("http://localhost/api/admin/crm/contacts/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the contact is missing", async () => {
    mockGetContact.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/crm/contacts/[id]/route");
    const res = await GET(adminRequest(`http://localhost/api/admin/crm/contacts/${CONTACT_ID}`), {
      params: Promise.resolve({ id: CONTACT_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the joined payload for an admin", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/[id]/route");
    const res = await GET(adminRequest(`http://localhost/api/admin/crm/contacts/${CONTACT_ID}`), {
      params: Promise.resolve({ id: CONTACT_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contact.id).toBe(CONTACT_ID);
    expect(data.contact.email).toBe("ada@example.com");
    expect(Array.isArray(data.opportunities)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
  });
});
