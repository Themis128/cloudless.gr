import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetIntegrations, mockInvalidateContacts, mockInvalidateLists } = vi.hoisted(() => ({
  mockGetIntegrations: vi.fn(),
  mockInvalidateContacts: vi.fn(),
  mockInvalidateLists: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: mockGetIntegrations,
}));
vi.mock("@/lib/espocrm-cache", () => ({
  ESPO_CACHE_TTL: { list: 60, contact: 60 },
  invalidateEspoContactCaches: mockInvalidateContacts,
  invalidateEspoListCaches: mockInvalidateLists,
  readThrough: async (_k: string, _p: unknown, fn: () => Promise<unknown>) => ({
    value: await fn(),
  }),
}));
vi.mock("@/lib/crm-contact-360-shared", () => ({
  isEspoRecordId: (v: unknown) => typeof v === "string" && v.length > 0,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const CONFIGURED = {
  ESPOCRM_BASE_URL: "https://espo.example",
  ESPOCRM_API_KEY: "espo-key",
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });
}

function listResp(list: unknown[]) {
  return jsonResponse({ list, total: list.length });
}

async function lib() {
  return await import("@/lib/espocrm");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.resetModules();
  mockGetIntegrations.mockResolvedValue(CONFIGURED);
});

describe("espoFetch retry + config", () => {
  it("retries retryable statuses then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ err: 1 }, 500))
      .mockResolvedValueOnce(jsonResponse({ err: 1 }, 503))
      .mockResolvedValueOnce(listResp([{ id: "c1", emailAddress: "x@y.z" }]));
    const { searchContacts } = await lib();
    const out = await searchContacts("email", "x@y.z");
    expect(out.results[0].id).toBe("c1");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable 400s", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ err: 1 }, 400));
    const { searchContacts } = await lib();
    await expect(searchContacts("email", "x@y.z")).rejects.toThrow("400");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After on 429 without exceeding attempts", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "999" }))
      .mockResolvedValueOnce(listResp([]));
    const { searchContacts } = await lib();
    await searchContacts("email", "x@y.z");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws when unconfigured", async () => {
    mockGetIntegrations.mockResolvedValue({});
    const { searchContacts } = await lib();
    await expect(searchContacts("x@y.z")).rejects.toThrow("not configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("findContactByEmail via upsertContact", () => {
  it("creates when no contact found", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([])) // equals search
      .mockResolvedValueOnce(listResp([])) // textFilter fallback
      .mockResolvedValueOnce(jsonResponse({ id: "new1" }, 201)); // POST
    const { upsertContact } = await lib();
    const id = await upsertContact({ email: "a@b.co", firstname: "A" });
    expect(id).toBe("new1");
    const [url, init] = mockFetch.mock.calls[2];
    expect(url).toBe("https://espo.example/api/v1/Contact");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Skip-Duplicate-Check"]).toBe("true");
    const body = JSON.parse(String(init.body));
    expect(body.emailAddress).toBe("a@b.co");
    expect(body.lastName).toBe("a"); // falls back to local part
    expect(mockInvalidateContacts).toHaveBeenCalledWith("new1");
  });

  it("PUTs when a contact already exists", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([{ id: "ex1" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "ex1" }));
    const { upsertContact } = await lib();
    const id = await upsertContact({ email: "a@b.co" });
    expect(id).toBe("ex1");
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toContain("/Contact/ex1");
    expect(init.method).toBe("PUT");
  });

  it("tries base email for +alias addresses", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([])) // alias: equals miss
      .mockResolvedValueOnce(listResp([])) // alias: textFilter miss
      .mockResolvedValueOnce(listResp([{ id: "base1" }])) // base: equals hit
      .mockResolvedValueOnce(jsonResponse({ id: "base1" }));
    const { upsertContact } = await lib();
    const id = await upsertContact({ email: "a+tag@b.co" });
    expect(id).toBe("base1");
  });

  it("409 conflict resolves to the matching contact", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      // POST → 409 with a conflict array containing our email
      .mockResolvedValueOnce(jsonResponse([{ id: "dup9", emailAddress: "a@b.co" }], 409))
      .mockResolvedValueOnce(jsonResponse({ id: "dup9" })); // PUT
    const { upsertContact } = await lib();
    const id = await upsertContact({ email: "a@b.co" });
    expect(id).toBe("dup9");
    expect(mockFetch.mock.calls[3][1].method).toBe("PUT");
  });

  it("409 conflict falls back to first dup when email not in body", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(jsonResponse([{ id: "dupX", emailAddress: "other@x" }], 409))
      // conflict email search after 409: equals + textFilter both miss
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(jsonResponse({ id: "dupX" })); // PUT dup
    const { upsertContact } = await lib();
    const id = await upsertContact({ email: "a@b.co" });
    expect(id).toBe("dupX");
  });

  it("phone-validation 400 retries without phoneNumber", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(new Response('{"error":"phoneNumber is not valid"}', { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({ id: "ph1" }, 201));
    const { upsertContact } = await lib();
    const id = await upsertContact({
      email: "a@b.co",
      phone: "+30 210 123 4567",
    });
    expect(id).toBe("ph1");
    const retry = JSON.parse(String(mockFetch.mock.calls[3][1].body));
    expect(retry.phoneNumber).toBeUndefined();
  });

  it("create failure returns null", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(jsonResponse({ err: "x" }, 400));
    const { upsertContact } = await lib();
    expect(await upsertContact({ email: "a@b.co" })).toBeNull();
  });

  it("network error during create returns null", async () => {
    mockFetch.mockRejectedValue(new Error("dns"));
    const { upsertContact } = await lib();
    expect(await upsertContact({ email: "a@b.co" })).toBeNull();
  });

  it("company name links a real Account via upsertCompany", async () => {
    mockFetch
      // upsertCompany: search miss → create Account
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(jsonResponse({ id: "acc1" }, 201))
      // findContactByEmail: miss + miss
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      // POST Contact
      .mockResolvedValueOnce(jsonResponse({ id: "c9" }, 201));
    const { upsertContact } = await lib();
    const id = await upsertContact({ email: "a@b.co", company: "Acme" });
    expect(id).toBe("c9");
    const body = JSON.parse(String(mockFetch.mock.calls[4][1].body));
    expect(body.accountId).toBe("acc1");
    expect(body.accountName).toBeUndefined();
  });
});

describe("newsletter status", () => {
  it("updates leadSource on existing contact", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([{ id: "c1" }]))
      .mockResolvedValueOnce(jsonResponse({}));
    const { setNewsletterStatus } = await lib();
    expect(await setNewsletterStatus("a@b.co", "newsletter_signup")).toBe(true);
    const body = JSON.parse(String(mockFetch.mock.calls[1][1].body));
    expect(body.leadSource).toBe("Email");
  });

  it("unknown email + unsubscribe is a no-op true", async () => {
    mockFetch.mockResolvedValueOnce(listResp([])).mockResolvedValueOnce(listResp([]));
    const { setNewsletterStatus } = await lib();
    expect(await setNewsletterStatus("a@b.co", "newsletter_unsubscribed")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("unknown email + subscribe creates a contact", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(jsonResponse({ id: "n1" }, 201));
    const { setNewsletterStatus } = await lib();
    expect(await setNewsletterStatus("a@b.co", "newsletter_signup")).toBe(true);
  });

  it("lists only leadSource=Email addresses, deduped", async () => {
    mockFetch.mockResolvedValueOnce(
      listResp([
        { emailAddress: "a@b.co" },
        { emailAddress: "a@b.co" },
        { emailAddress: null },
        { emailAddress: "c@d.co" },
      ])
    );
    const { listNewsletterSubscribers } = await lib();
    expect(await listNewsletterSubscribers()).toEqual(["a@b.co", "c@d.co"]);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("leadSource");
  });
});

describe("list helpers + clampLimit", () => {
  it("clamps limit and maps list payload", async () => {
    mockFetch.mockResolvedValueOnce(listResp([{ id: "l1" }]));
    const { listLeads } = await lib();
    const out = await listLeads(99999);
    expect(out).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("maxSize=100");
  });

  it("returns empty list on upstream error", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ err: 1 }, 400));
    const { listDeals } = await lib();
    expect(await listDeals(5)).toEqual([]);
  });
});

describe("companies / deals / pipelines", () => {
  it("upsertCompany finds existing account", async () => {
    mockFetch.mockResolvedValueOnce(listResp([{ id: "acc9" }]));
    const { upsertCompany } = await lib();
    expect(await upsertCompany("Acme")).toBe("acc9");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("upsertCompany trims and no-ops empty names", async () => {
    const { upsertCompany } = await lib();
    expect(await upsertCompany("   ")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("upsertCompany creates when missing", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(jsonResponse({ id: "acc2" }, 201));
    const { upsertCompany } = await lib();
    expect(await upsertCompany("NewCo")).toBe("acc2");
    expect(mockInvalidateLists).toHaveBeenCalled();
  });

  it("getPipelines returns the static OSS pipeline", async () => {
    const { getPipelines } = await lib();
    const pipes = (await getPipelines()) as Array<{ stages: unknown[] }>;
    expect(pipes[0].stages).toHaveLength(6);
  });

  it("createDeal → POST /Opportunity, updateDeal maps hubspot-style keys", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "d1" }, 201));
    const { createDeal, updateDeal } = await lib();
    const id = await createDeal({
      dealname: "X",
      dealstage: "Prospecting",
      amount: 100,
      closedate: "2026-12-01",
      source: "contact_form",
    } as never);
    expect(id).toBe("d1");
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(body.name).toBe("X");

    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "d1" }));
    const out = await updateDeal("d1", {
      dealname: "Y",
      dealstage: "Qualification",
      closedate: "2026-12-15T00:00:00Z",
    } as never);
    expect(out).toEqual({ id: "d1" });
    const upd = JSON.parse(String(mockFetch.mock.calls[1][1].body));
    expect(upd.name).toBe("Y");
    expect(upd.stage).toBe("Qualification");
    expect(upd.closeDate).toBe("2026-12-15"); // date-only slice
  });

  it("moveDealStage rejects unknown stages and accepts valid ones", async () => {
    const { moveDealStage } = await lib();
    expect(await moveDealStage("d1", "NotAStage")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "d1" }));
    expect(await moveDealStage("d1", "Closed Won")).toEqual({ id: "d1" });
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(body.stage).toBe("Closed Won");
  });

  it("createDeal returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ err: 1 }, 400));
    const { createDeal } = await lib();
    expect(await createDeal({ dealname: "X" } as never)).toBeNull();
  });
});

describe("misc exports", () => {
  it("isEspoCRMConfigured reflects config presence", async () => {
    const { isEspoCRMConfigured } = await lib();
    expect(await isEspoCRMConfigured()).toBe(true);
    mockGetIntegrations.mockResolvedValue({});
    vi.resetModules();
    const lib2 = await lib();
    expect(await lib2.isEspoCRMConfigured()).toBe(false);
  });

  it("getContact returns the record or null", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "c5", name: "Z" }));
    const { getContact } = await lib();
    expect(await getContact("c5")).toMatchObject({ id: "c5" });

    mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));
    expect(await getContact("missing")).toBeNull();
  });
});

describe("mapLeadSource + listCompanies tail", () => {
  it("maps newsletter_unsubscribed to Espo leadSource Email", async () => {
    mockFetch
      .mockResolvedValueOnce(listResp([])) // equals search miss
      .mockResolvedValueOnce(listResp([])) // textFilter miss
      .mockResolvedValueOnce(jsonResponse({ id: "c9" }, 201)); // POST /Contact
    const { upsertContact } = await lib();
    const id = await upsertContact({
      email: "u@n.co",
      lead_source: "newsletter_unsubscribed",
    } as never);
    expect(id).toBe("c9");
    const body = JSON.parse(String(mockFetch.mock.calls[2][1].body));
    expect(body.leadSource).toBe("Email");
  });

  it("listCompanies returns [] when the Account list payload has no list", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ total: 0 }));
    const { listCompanies } = await lib();
    await expect(listCompanies()).resolves.toEqual([]);
  });
});
