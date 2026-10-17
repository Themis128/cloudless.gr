/**
 * espocrm.ts branch batch — the degraded-response arms the other suites skip:
 * non-ok and list-less responses on every list helper, retry exhaustion,
 * email lookup fallbacks, 409 bodies that are objects / non-JSON, PUT
 * failures after a resolved conflict, lead/deal payload optional fields,
 * deal-field mapping, and stage grouping for records without a stage.
 *
 * Same harness as espocrm-tail.test.ts: integrations + cache faked, real
 * espocrm.ts, fetch stubbed.
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

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const listResp = (list: unknown[]) => json({ list, total: list.length });
const emailMiss = () => {
  mockFetch.mockResolvedValueOnce(listResp([])).mockResolvedValueOnce(listResp([]));
};

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

const bad = (status = 400) => new Response("nope", { status });
const lastBody = () => JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string);
const contact = { email: "new@x.co", firstname: "New", lastname: "Person" };

describe("espoFetch", () => {
  it("returns the last retryable response once retries are exhausted (no Retry-After)", async () => {
    const { listLeads } = await lib();
    mockFetch.mockResolvedValue(bad(503));
    expect(await listLeads(5)).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("strips a trailing slash from the base URL and sends the API key", async () => {
    mockGetIntegrations.mockResolvedValue({
      ESPOCRM_BASE_URL: "https://espo.example/",
      ESPOCRM_API_KEY: "secret",
    });
    const { listContacts } = await lib();
    mockFetch.mockResolvedValueOnce(listResp([]));
    await listContacts(3);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://espo.example/api/v1/Contact?maxSize=3");
    expect(init.headers["X-Api-Key"]).toBe("secret");
  });

  it("isEspoCRMConfigured reflects missing config", async () => {
    mockGetIntegrations.mockResolvedValue({ ESPOCRM_BASE_URL: "https://espo.example" });
    const { isEspoCRMConfigured } = await lib();
    expect(await isEspoCRMConfigured()).toBe(false);
  });
});

describe("list helpers degrade to [] on non-ok or list-less responses", () => {
  const cases = [
    ["listLeads", (l: Awaited<ReturnType<typeof lib>>) => l.listLeads(5)],
    ["listContacts", (l: Awaited<ReturnType<typeof lib>>) => l.listContacts(5)],
    ["listTickets", (l: Awaited<ReturnType<typeof lib>>) => l.listTickets(5)],
    ["listCompanies", (l: Awaited<ReturnType<typeof lib>>) => l.listCompanies(5)],
    ["listDeals", (l: Awaited<ReturnType<typeof lib>>) => l.listDeals(5)],
    ["listOwners", (l: Awaited<ReturnType<typeof lib>>) => l.listOwners()],
    [
      "listContactOpportunities",
      (l: Awaited<ReturnType<typeof lib>>) => l.listContactOpportunities("c1"),
    ],
    ["listContactCases", (l: Awaited<ReturnType<typeof lib>>) => l.listContactCases("c1")],
    ["listContactNotes", (l: Awaited<ReturnType<typeof lib>>) => l.listContactNotes("c1")],
    ["listNotes", (l: Awaited<ReturnType<typeof lib>>) => l.listNotes("d1")],
  ] as const;

  it.each(cases)("%s: non-ok → []", async (_n, call) => {
    const l = await lib();
    mockFetch.mockResolvedValueOnce(bad(404));
    expect(await call(l)).toEqual([]);
  });

  it.each(cases)("%s: body without list → []", async (_n, call) => {
    const l = await lib();
    mockFetch.mockResolvedValueOnce(json({ total: 0 }));
    expect(await call(l)).toEqual([]);
  });

  it("contact links hit the right sub-resource and skip invalid ids without a request", async () => {
    const l = await lib();
    mockFetch.mockResolvedValue(listResp([{ id: "x" }]));
    await l.listContactOpportunities("c1");
    await l.listContactCases("c1");
    await l.listContactNotes("c1");
    const paths = mockFetch.mock.calls.map((c) => String(c[0]).split("/api/v1")[1]);
    expect(paths).toEqual([
      "/Contact/c1/opportunities?maxSize=100",
      "/Contact/c1/cases?maxSize=100",
      "/Contact/c1/notes?maxSize=100",
    ]);
    mockFetch.mockClear();
    expect(await l.listContactCases("not an id")).toEqual([]);
    expect(await l.getContact("not an id")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getContact returns null on a non-ok response", async () => {
    const { getContact } = await lib();
    mockFetch.mockResolvedValueOnce(bad(404));
    expect(await getContact("c1")).toBeNull();
  });
});

describe("findContactByEmail fallbacks (via setNewsletterStatus)", () => {
  it("falls back to the text filter and only accepts an exact email match", async () => {
    const { setNewsletterStatus } = await lib();
    mockFetch
      .mockResolvedValueOnce(bad(400)) // searchParams lookup fails (400)
      .mockResolvedValueOnce(
        listResp([
          { id: "name-only", emailAddress: "someone@else" },
          { id: "c-match", emailAddress: "a@x.co" },
        ])
      )
      .mockResolvedValueOnce(json({}));
    expect(await setNewsletterStatus("a@x.co", "newsletter_unsubscribed")).toBe(true);
    expect(String(mockFetch.mock.calls[2][0])).toContain("/Contact/c-match");
    expect(lastBody()).toEqual({ leadSource: "Other" });
  });

  it("tries the +alias-stripped address when both lookups miss, then creates", async () => {
    const { setNewsletterStatus } = await lib();
    mockFetch
      .mockResolvedValueOnce(bad()) // exact: searchParams !ok
      .mockResolvedValueOnce(bad()) // exact: textFilter !ok
      .mockResolvedValueOnce(listResp([])) // base: searchParams miss
      .mockResolvedValueOnce(listResp([])) // base: textFilter miss
      .mockResolvedValueOnce(json({ id: "new" }));
    expect(await setNewsletterStatus("a+promo@x.co", "newsletter_signup")).toBe(true);
    const third = decodeURIComponent(String(mockFetch.mock.calls[2][0]));
    expect(third).toContain('"value":"a@x.co"');
    expect(lastBody()).toEqual({
      emailAddress: "a+promo@x.co",
      lastName: "a+promo",
      leadSource: "Email",
    });
  });

  it("unknown email + unsubscribe is a no-op success; errors return false", async () => {
    const { setNewsletterStatus } = await lib();
    emailMiss();
    expect(await setNewsletterStatus("ghost@x.co", "newsletter_unsubscribed")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockGetIntegrations.mockResolvedValue({});
    expect(await setNewsletterStatus("ghost@x.co", "newsletter_signup")).toBe(false);
  });
});

describe("upsertContact edge paths", () => {
  it("joins message and service interest into the description", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch.mockResolvedValueOnce(json({ id: "c9" }));
    await upsertContact({ ...contact, message: "Hi", service_interest: "SEO", lastname: "" });
    expect(lastBody()).toMatchObject({
      description: "Hi\n\nService: SEO",
      lastName: "new",
      firstName: "New",
    });
  });

  it("409 with a single-object body resolves that contact", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json({ id: "solo", emailAddress: "new@x.co" }, 409))
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact(contact)).toBe("solo");
  });

  it("still returns the conflict id when the follow-up PUT fails", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json([{ id: "dup", emailAddress: "new@x.co" }], 409))
      .mockRejectedValue(new Error("network down"));
    expect(await upsertContact(contact)).toBe("dup");
  });

  it("non-phone validation failure on a contact with a phone does not retry", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"emailAddress invalid"}', { status: 400 })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await upsertContact({ ...contact, phone: "+30 210 1234567" })).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });

  it("phone retry hitting a non-JSON 409 resolves via email search", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response("phoneNumber invalid", { status: 400 }))
      .mockResolvedValueOnce(new Response("Conflict", { status: 409 }))
      .mockResolvedValueOnce(listResp([{ id: "found" }]))
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact({ ...contact, phone: "+30 210 1234567" })).toBe("found");
    expect(mockFetch.mock.calls.at(-1)![1].method).toBe("PUT");
  });

  it("phone retry 409 with an object body keeps the resolved id even if the PUT fails", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response("phoneNumber invalid", { status: 400 }))
      .mockResolvedValueOnce(json({ id: "retry-dup" }, 409))
      .mockRejectedValue(new Error("network down"));
    expect(await upsertContact({ ...contact, phone: "+30 210 1234567" })).toBe("retry-dup");
  });

  it("links an existing Account when company is set (search !ok → create)", async () => {
    const { upsertContact } = await lib();
    mockFetch
      .mockResolvedValueOnce(bad()) // Account search !ok
      .mockResolvedValueOnce(json({ id: "acc1" })); // Account create
    emailMiss();
    mockFetch.mockResolvedValueOnce(json({ id: "c-acc" }));
    expect(await upsertContact({ ...contact, company: " Acme " })).toBe("c-acc");
    expect(JSON.parse(mockFetch.mock.calls[1][1].body as string)).toEqual({ name: "Acme" });
    expect(lastBody()).toMatchObject({ accountId: "acc1" });
    expect(lastBody().accountName).toBeUndefined();
  });

  it("upsertCompany: blank names and failed creates return null", async () => {
    const { upsertCompany } = await lib();
    expect(await upsertCompany("   ")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
    mockFetch.mockResolvedValueOnce(listResp([])).mockResolvedValueOnce(bad());
    expect(await upsertCompany("Acme")).toBeNull();
  });
});

describe("tickets", () => {
  it("createTicket defaults status/priority and skips contact invalidation without a contact", async () => {
    const { createTicket } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "case1" }));
    expect(await createTicket({ name: "Broken", description: "d" })).toEqual({ id: "case1" });
    expect(lastBody()).toEqual({
      name: "Broken",
      description: "d",
      status: "New",
      priority: "Normal",
    });
  });
});

describe("searchContacts attribute mapping", () => {
  it.each([
    ["email", "emailAddress"],
    ["firstname", "firstName"],
    ["lastname", "lastName"],
    ["phoneNumber", "phoneNumber"],
  ])("%s → %s, nulls become empty strings", async (prop, attr) => {
    const { searchContacts } = await lib();
    mockFetch.mockResolvedValueOnce(
      json({ list: [{ id: "c1", name: "N", phone: null }], total: 1 })
    );
    const out = await searchContacts(prop, "v");
    const params = JSON.parse(
      decodeURIComponent(String(mockFetch.mock.calls[0][0]).split("searchParams=")[1])
    );
    expect(params.where[0].attribute).toBe(attr);
    expect(out).toEqual({
      total: 1,
      results: [{ id: "c1", properties: { id: "c1", name: "N", phone: "" } }],
    });
  });

  it("throws on a non-ok search", async () => {
    const { searchContacts } = await lib();
    mockFetch.mockResolvedValueOnce(bad(401));
    await expect(searchContacts("email", "x")).rejects.toThrow("EspoCRM search failed 401");
  });
});

describe("leads", () => {
  it("createLead writes every attribution line and creates when the dedupe search fails", async () => {
    const { createLead } = await lib();
    mockFetch.mockResolvedValueOnce(bad()).mockResolvedValueOnce(json({ id: "lead1" }));
    expect(
      await createLead({
        emailAddress: "l@x.co",
        description: "From form",
        campaignSlug: "shop-online",
        tier: "essential",
        orderId: "cs_1",
        utmSource: "linkedin",
        utmMedium: "cpc",
        utmCampaign: "q4",
        utmContent: "ad-a",
        source: "Email",
      })
    ).toBe("lead1");
    expect(lastBody()).toMatchObject({
      lastName: "l",
      source: "Email",
      description: [
        "From form",
        "Campaign: shop-online",
        "Tier: essential",
        "Order: cs_1",
        "utm_source: linkedin",
        "utm_medium: cpc",
        "utm_campaign: q4",
        "utm_content: ad-a",
      ].join("\n"),
    });
  });

  it("createLead omits the description when there are no lines", async () => {
    const { createLead } = await lib();
    mockFetch.mockResolvedValueOnce(listResp([])).mockResolvedValueOnce(json({ id: "lead2" }));
    await createLead({ emailAddress: "m@x.co", firstName: "M", lastName: "N" });
    expect(lastBody()).toMatchObject({ source: "Web Site", firstName: "M", lastName: "N" });
    expect(lastBody().description).toBeUndefined();
  });

  it("countLeadsForCampaign: non-ok and missing total → 0, otherwise the total", async () => {
    const { countLeadsForCampaign } = await lib();
    mockFetch.mockResolvedValueOnce(bad());
    expect(await countLeadsForCampaign("x")).toBe(0);
    mockFetch.mockResolvedValueOnce(json({ list: [] }));
    expect(await countLeadsForCampaign("x")).toBe(0);
    mockFetch.mockResolvedValueOnce(json({ list: [], total: 7 }));
    expect(await countLeadsForCampaign("shop-online")).toBe(7);
    expect(decodeURIComponent(String(mockFetch.mock.calls.at(-1)![0]))).toContain(
      "where[0][value]=Campaign:+shop-online"
    );
  });
});

describe("deals and notes", () => {
  it("createDeal maps service interest, currency and stage defaults", async () => {
    const { createDeal } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "d1" }));
    await createDeal({
      dealname: "Lead deal",
      service_interest: "Ads",
      closedate: "2026-11-30T10:00:00Z",
    });
    expect(lastBody()).toMatchObject({
      name: "Lead deal",
      amountCurrency: "EUR",
      stage: "Prospecting",
      closeDate: "2026-11-30",
      description: "Service: Ads",
    });
  });

  it("updateDeal maps known fields, passes custom ones through, and nulls on !ok", async () => {
    const { updateDeal } = await lib();
    mockFetch.mockResolvedValueOnce(json({ id: "d1" }));
    expect(
      await updateDeal("d1", {
        dealname: "Renamed",
        dealstage: "Proposal",
        amount: 99,
        closedate: "2026-12-01T00:00:00Z",
        cCustom: "x",
      })
    ).toEqual({ id: "d1" });
    expect(lastBody()).toEqual({
      name: "Renamed",
      stage: "Proposal",
      amount: 99,
      closeDate: "2026-12-01",
      cCustom: "x",
    });
    mockFetch.mockResolvedValueOnce(bad());
    expect(await updateDeal("d1", { amount: 1 })).toBeNull();
  });

  it("createNote / createContactNote return null on a non-ok response", async () => {
    const { createNote, createContactNote } = await lib();
    mockFetch.mockResolvedValueOnce(bad()).mockResolvedValueOnce(bad());
    expect(await createNote("d1", "hi")).toBeNull();
    expect(await createContactNote("c1", "hi")).toBeNull();
  });

  it("getDealsByStage / getPipelineStats bucket stage-less deals as Unknown and treat bad amounts as 0", async () => {
    const { getDealsByStage, getPipelineStats } = await lib();
    const deals = [
      { name: "a", stage: "Proposal", amount: 100 },
      { name: "b", amount: null },
      { name: "c", stage: "Proposal", amount: "abc" },
    ];
    mockFetch.mockResolvedValueOnce(listResp(deals));
    const grouped = await getDealsByStage();
    expect(Object.keys(grouped).sort()).toEqual(["Proposal", "Unknown"]);
    expect(grouped.Unknown).toHaveLength(1);

    mockFetch.mockResolvedValueOnce(listResp(deals));
    expect(await getPipelineStats()).toEqual({
      totalDeals: 3,
      totalValue: 100,
      byStage: { Proposal: { count: 2, value: 100 }, Unknown: { count: 1, value: 0 } },
    });
  });
});
