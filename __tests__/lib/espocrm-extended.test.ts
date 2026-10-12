/**
 * espocrm.ts coverage extension — the second half of the surface:
 * ticket/company/owner/pipeline/note helpers, newsletter status,
 * search, dedup-on-create, config probe. Cache passthrough +
 * fetch-boundary fakes per espocrm-client.test.ts convention.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetIntegrations } = vi.hoisted(() => ({ mockGetIntegrations: vi.fn() }));

vi.mock("@/lib/integrations", () => ({ getIntegrationsAsync: mockGetIntegrations }));
vi.mock("@/lib/espocrm-cache", () => ({
  ESPO_CACHE_TTL: { list: 60, contact: 60, pipeline: 60 },
  invalidateEspoContactCaches: vi.fn(),
  invalidateEspoListCaches: vi.fn(),
  readThrough: async (_k: string, _p: unknown, fn: () => Promise<unknown>) => ({
    value: await fn(),
  }),
}));
vi.mock("@/lib/crm-contact-360-shared", () => ({
  isEspoRecordId: (v: unknown) => typeof v === "string" && v.length > 0 && !v.includes(" "),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const listResp = (list: unknown[]) => json({ list, total: list.length });
const url = () => String(mockFetch.mock.calls.at(-1)?.[0]);

async function lib() {
  return await import("@/lib/espocrm");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.resetModules();
  mockGetIntegrations.mockResolvedValue({
    ESPOCRM_BASE_URL: "https://espo.example",
    ESPOCRM_API_KEY: "k",
  });
});

describe("newsletter helpers", () => {
  it("listNewsletterSubscribers dedupes + filters; error → []", async () => {
    const { listNewsletterSubscribers } = await lib();
    mockFetch.mockResolvedValueOnce(
      listResp([{ emailAddress: "a@x" }, { emailAddress: "a@x" }, { emailAddress: null }, { emailAddress: "b@x" }])
    );
    expect(await listNewsletterSubscribers()).toEqual(["a@x", "b@x"]);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await listNewsletterSubscribers()).toEqual([]);
  });

  it("setNewsletterStatus: existing → PUT; unknown+unsub → true; unknown+signup → POST", async () => {
    const { setNewsletterStatus } = await lib();
    // existing contact (findContactByEmail search hit)
    mockFetch
      .mockResolvedValueOnce(listResp([{ id: "c1" }]))
      .mockResolvedValueOnce(json({ id: "c1" }));
    expect(await setNewsletterStatus("a@x", "newsletter_unsubscribed")).toBe(true);
    expect(mockFetch.mock.calls[1][1].method).toBe("PUT");

    mockFetch.mockClear();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([])); // textFilter fallback also misses
    expect(await setNewsletterStatus("ghost@x", "newsletter_unsubscribed")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockFetch.mockClear();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(json({ id: "c9" }));
    expect(await setNewsletterStatus("new@x", "newsletter_signup")).toBe(true);
    expect(mockFetch.mock.calls[2][1].method).toBe("POST");

    mockFetch.mockClear();
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await setNewsletterStatus("x@x", "newsletter_signup")).toBe(false);
  });
});

describe("list helpers degrade to []", () => {
  it.each(["listLeads", "listContacts", "listTickets", "listDeals", "listOwners"])(
    "%s ok / !ok / throw",
    async (name) => {
      const m = (await lib()) as Record<string, (l?: number) => Promise<unknown[]>>;
      mockFetch.mockResolvedValueOnce(listResp([{ id: "1" }]));
      expect(await m[name](5)).toEqual([{ id: "1" }]);
      mockFetch.mockResolvedValueOnce(json({}, 500));
      expect(await m[name](5)).toEqual([]);
      mockFetch.mockRejectedValueOnce(new Error("down"));
      expect(await m[name](5)).toEqual([]);
    }
  );

  it("clamps limit to MAX and falls back on NaN", async () => {
    const { listContacts } = await lib();
    mockFetch.mockResolvedValue(listResp([]));
    await listContacts(99999);
    expect(url()).toContain("maxSize=100"); // MAX_LIMIT
    await listContacts(NaN);
    expect(url()).toContain("maxSize=10");
  });

  it("getContact: invalid id → null; !ok → null; ok → record", async () => {
    const { getContact } = await lib();
    expect(await getContact("")).toBeNull();
    mockFetch.mockResolvedValueOnce(json({}, 404));
    expect(await getContact("c1")).toBeNull();
    mockFetch.mockResolvedValueOnce(json({ id: "c1", name: "Ana" }));
    expect(await getContact("c1")).toEqual({ id: "c1", name: "Ana" });
  });

  it("contact link lists: invalid id → []; ok → list; throw → []", async () => {
    const { listContactOpportunities, listContactCases, listContactNotes } = await lib();
    expect(await listContactOpportunities("")).toEqual([]);
    mockFetch.mockResolvedValueOnce(listResp([{ id: "o1" }]));
    expect(await listContactCases("c1")).toEqual([{ id: "o1" }]);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await listContactNotes("c1")).toEqual([]);
  });
});

describe("tickets + companies", () => {
  it("createTicket posts Case, links contact, throws on !ok", async () => {
    const { createTicket } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "t1" }));
    expect(await createTicket({ name: "n", description: "d" }, "c1")).toEqual({ id: "t1" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.contactId).toBe("c1");

    mockFetch.mockResolvedValue(new Response("oops", { status: 500 })); // persistent — espoFetch retries 5xx
    await expect(createTicket({ name: "n", description: "d" })).rejects.toThrow("Case create failed 500");
  });

  it("getPipelines returns the static 6-stage shape", async () => {
    const { getPipelines } = await lib();
    const p = (await getPipelines()) as { stages: unknown[] }[];
    expect(p[0].stages).toHaveLength(6);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("upsertCompany: empty → null; exists → id; create ok/fail; throw → null", async () => {
    const { upsertCompany } = await lib();
    expect(await upsertCompany("  ")).toBeNull();

    mockFetch.mockResolvedValueOnce(listResp([{ id: "a1" }]));
    expect(await upsertCompany("Acme")).toBe("a1");

    mockFetch.mockClear();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(json({ id: "a2" }));
    expect(await upsertCompany("New Co")).toBe("a2");
    expect(mockFetch.mock.calls[1][0]).toContain("/Account");

    mockFetch.mockClear();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(json({}, 500));
    expect(await upsertCompany("Fail Co")).toBeNull();

    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await upsertCompany("Err Co")).toBeNull();
  });
});

describe("search + config", () => {
  it("searchContacts maps property aliases and stringifies values", async () => {
    const { searchContacts } = await lib();
    mockFetch.mockResolvedValueOnce(json({ total: 1, list: [{ id: "c1", firstName: "Ana", age: 5, x: null }] }));
    const r = await searchContacts("email", "a@x");
    expect(url()).toContain(encodeURIComponent('"emailAddress"'));
    expect(r.results[0].properties).toEqual({ id: "c1", firstName: "Ana", age: "5", x: "" });
    mockFetch.mockResolvedValue(json({}, 500)); // persistent — espoFetch retries 5xx
    await expect(searchContacts("firstname", "Ana")).rejects.toThrow("search failed 500");
  });

  it("isEspoCRMConfigured true/false", async () => {
    const { isEspoCRMConfigured } = await lib();
    expect(await isEspoCRMConfigured()).toBe(true);
    mockGetIntegrations.mockResolvedValueOnce({});
    expect(await isEspoCRMConfigured()).toBe(false);
  });
});

describe("lead + deal ops", () => {
  const lead = { emailAddress: "l@x", firstName: "L", campaignSlug: "c", utmSource: "s" };

  it("createLead dedup: existing → PUT + id; fresh → POST; !ok → null; throw → null", async () => {
    const { createLead } = await lib();
    mockFetch
      .mockResolvedValueOnce(listResp([{ id: "dup" }]))
      .mockResolvedValueOnce(json({}));
    expect(await createLead(lead)).toBe("dup");
    expect(mockFetch.mock.calls[1][1].method).toBe("PUT");

    mockFetch.mockClear();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(json({ id: "new" }));
    expect(await createLead(lead)).toBe("new");
    const body = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(body.description).toContain("Campaign: c");
    expect(body.description).toContain("utm_source: s");

    mockFetch.mockClear();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(json({}, 500));
    expect(await createLead(lead)).toBeNull();

    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await createLead(lead)).toBeNull();
  });

  it("countLeadsForCampaign: total / !ok→0 / throw→0", async () => {
    const { countLeadsForCampaign } = await lib();
    mockFetch.mockResolvedValueOnce(json({ total: 7, list: [] }));
    expect(await countLeadsForCampaign("c")).toBe(7);
    mockFetch.mockResolvedValueOnce(json({}, 500));
    expect(await countLeadsForCampaign("c")).toBe(0);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await countLeadsForCampaign("c")).toBe(0);
  });

  it("createDeal ok/fail/throw", async () => {
    const { createDeal } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "d1" }));
    expect(await createDeal({ dealname: "D", amount: 100 })).toBe("d1");
    mockFetch.mockResolvedValueOnce(json({}, 500));
    expect(await createDeal({ dealname: "D" })).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await createDeal({ dealname: "D" })).toBeNull();
  });

  it("updateDeal maps snake_case fields; !ok/throw → null", async () => {
    const { updateDeal } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "d1" }));
    expect(await updateDeal("d1", { dealname: "N", dealstage: "Qualification", closedate: "2026-10-20T00:00:00Z", custom: 1 })).toEqual({ id: "d1" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).toEqual({ name: "N", stage: "Qualification", closeDate: "2026-10-20", custom: 1 });
    mockFetch.mockResolvedValueOnce(json({}, 500));
    expect(await updateDeal("d1", {})).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await updateDeal("d1", {})).toBeNull();
  });

  it("moveDealStage: valid stage → update; unknown → null", async () => {
    const { moveDealStage } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "d1" }));
    expect(await moveDealStage("d1", "Qualification")).toEqual({ id: "d1" });
    mockFetch.mockClear();
    expect(await moveDealStage("d1", "Bogus Stage")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getDealsByStage groups + error → {}", async () => {
    const { getDealsByStage } = await lib();
    mockFetch.mockResolvedValueOnce(
      listResp([{ stage: "Won" }, { stage: "Won" }, { stage: "Lost" }])
    );
    const g = (await getDealsByStage()) as Record<string, unknown[]>;
    expect(g.Won).toHaveLength(2);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await getDealsByStage()).toEqual({});
  });
});

describe("notes + pipeline stats + association", () => {
  it("createNote / createContactNote ok + !ok + throw", async () => {
    const { createNote, createContactNote } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "n1" }));
    expect(await createNote("d1", "hi")).toEqual({ id: "n1" });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body as string).parentType).toBe("Opportunity");
    mockFetch.mockResolvedValueOnce(json({ id: "n2" }));
    expect(await createContactNote("c1", "hi")).toEqual({ id: "n2" });
    expect(JSON.parse(mockFetch.mock.calls[1][1].body as string).parentType).toBe("Contact");
    mockFetch.mockResolvedValueOnce(json({}, 500));
    expect(await createNote("d1", "x")).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await createContactNote("c1", "x")).toBeNull();
  });

  it("listNotes ok / !ok / throw", async () => {
    const { listNotes } = await lib();
    mockFetch.mockResolvedValueOnce(listResp([{ post: "p" }]));
    expect(await listNotes("d1")).toEqual([{ post: "p" }]);
    mockFetch.mockResolvedValueOnce(json({}, 500));
    expect(await listNotes("d1")).toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await listNotes("d1")).toEqual([]);
  });

  it("getPipelineStats aggregates by stage; error → empty", async () => {
    const { getPipelineStats } = await lib();
    mockFetch.mockResolvedValueOnce(
      listResp([
        { stage: "Won", amount: 100 },
        { stage: "Won", amount: 50 },
        { stage: "Lost", amount: null },
      ])
    );
    const s = await getPipelineStats();
    expect(s.totalDeals).toBe(3);
    expect(s.totalValue).toBe(150);
    expect(s.byStage.Won).toEqual({ count: 2, value: 150 });

    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect((await getPipelineStats()).totalDeals).toBe(0);
  });

  it("associateDealWithContact posts link; throw swallowed", async () => {
    const { associateDealWithContact } = await lib();
    mockFetch.mockResolvedValueOnce(json({}));
    await associateDealWithContact("d1", "c1");
    expect(url()).toContain("/Opportunity/d1/contacts");
    mockFetch.mockRejectedValueOnce(new Error("down"));
    await associateDealWithContact("d1", "c1"); // no throw
  });
});
