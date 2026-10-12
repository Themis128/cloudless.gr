/**
 * espocrm.ts tail coverage — espoFetch 429 Retry-After, espoListAll
 * pagination/stride/error, mapLeadSource via upsertContact payload,
 * upsertContact's 409-resolution chain + phone-retry path,
 * getContact/listCompanies/createLead error branches.
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

describe("espoFetch retries", () => {
  it("honours Retry-After on 429 then succeeds", async () => {
    const { listContacts } = await lib();
    mockFetch
      .mockResolvedValueOnce(json({}, 429, { "Retry-After": "1" }))
      .mockResolvedValueOnce(listResp([{ id: "c1" }]));
    const out = await listContacts(5);
    expect(out).toEqual([{ id: "c1" }]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("skips the sleep for out-of-range Retry-After values", async () => {
    const { listContacts } = await lib();
    mockFetch
      .mockResolvedValueOnce(json({}, 429, { "Retry-After": "999" }))
      .mockResolvedValueOnce(listResp([{ id: "c1" }]));
    expect(await listContacts(5)).toEqual([{ id: "c1" }]);
  });

  it("throws the last error after MAX_RETRIES on persistent failures", async () => {
    const { listContacts } = await lib();
    mockFetch.mockRejectedValue(new Error("conn dead"));
    // 3 attempts → returns [] via caller's catch
    expect(await listContacts(5)).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe("espoListAll stride + error", () => {
  it("walks a full page then a partial page", async () => {
    const { listNewsletterSubscribers } = await lib();
    const page1 = Array.from({ length: 100 }, (_, i) => ({ emailAddress: `u${i}@x` }));
    mockFetch
      .mockResolvedValueOnce(listResp(page1))
      .mockResolvedValueOnce(listResp([{ emailAddress: "last@x" }]));
    const out = await listNewsletterSubscribers();
    expect(out).toHaveLength(101);
    expect(String(mockFetch.mock.calls[1][0])).toContain("offset=100");
  });

  it("propagates a non-retryable page error to the caller's catch", async () => {
    const { getDealsByStage } = await lib();
    mockFetch.mockResolvedValueOnce(json({}, 400));
    expect(await getDealsByStage()).toEqual({});
  });
});

describe("upsertContact", () => {
  const contact = { email: "new@x.co", firstname: "New", message: "hi" };

  it("creates a contact with mapped leadSource values", async () => {
    const { upsertContact } = await lib();
    for (const [src, want] of [
      ["website_contact_form", "Web Site"],
      ["newsletter_signup", "Email"],
      ["custom_src", "custom_src"],
    ] as const) {
      emailMiss();
      mockFetch.mockResolvedValueOnce(json({ id: `id-${src}` }));
      const id = await upsertContact({ ...contact, lead_source: src });
      expect(id).toBe(`id-${src}`);
      const body = JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string);
      expect(body.leadSource).toBe(want);
    }
  });

  it("PUTs the payload when the contact already exists", async () => {
    const { upsertContact } = await lib();
    mockFetch
      .mockResolvedValueOnce(listResp([{ id: "c1" }]))
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact(contact)).toBe("c1");
    expect(mockFetch.mock.calls[1][1].method).toBe("PUT");
  });

  it("409: resolves the matching email from the conflict array", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(
        json([{ id: "dup1", emailAddress: "other@x" }, { id: "dup2", emailAddress: "new@x.co" }], 409)
      )
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact(contact)).toBe("dup2");
    expect(mockFetch.mock.calls.at(-1)![1].method).toBe("PUT");
  });

  it("409: strips +alias when matching the conflict array", async () => {
    const { upsertContact } = await lib();
    mockFetch
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([])) // base email candidates also miss
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(json([{ id: "d1", emailAddress: "new@x.co" }], 409))
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact({ ...contact, email: "new+tag@x.co" })).toBe("d1");
  });

  it("409: falls back to email search, then to the first conflict contact", async () => {
    const { upsertContact } = await lib();
    // conflict array has a different email; email search finds the real contact
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json([{ id: "stranger", emailAddress: "other@x" }], 409))
      .mockResolvedValueOnce(listResp([{ id: "real" }])) // findContactByEmail hit
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact(contact)).toBe("real");

    // email search also misses → use first conflict contact
    mockFetch.mockClear();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json([{ id: "first", emailAddress: "other@x" }], 409))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([])) // search + textFilter miss
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact(contact)).toBe("first");
  });

  it("409: returns null when nothing resolves", async () => {
    const { upsertContact } = await lib();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json("not json array", 409))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]));
    expect(await upsertContact(contact)).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining("could not resolve"), expect.anything());
    err.mockRestore();
  });

  it("retries without phone when the create rejects phoneNumber", async () => {
    const { upsertContact } = await lib();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response('{"error":"phoneNumber invalid"}', { status: 400 }))
      .mockResolvedValueOnce(json({ id: "nophone" }));
    expect(await upsertContact({ ...contact, phone: "+30 210 1234567" })).toBe("nophone");
    const retryBody = JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string);
    expect(retryBody.phoneNumber).toBeUndefined();
  });

  it("phone retry 409: resolves via conflict contact then email search", async () => {
    const { upsertContact } = await lib();
    // conflict contact wins
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response("phoneNumber bad", { status: 400 }))
      .mockResolvedValueOnce(json([{ id: "rdup" }], 409))
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact({ ...contact, phone: "+302101234567" })).toBe("rdup");

    // non-JSON 409 → email-search fallback wins
    mockFetch.mockClear();
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response("phoneNumber bad", { status: 400 }))
      .mockResolvedValueOnce(new Response("<html>conflict</html>", { status: 409 }))
      .mockResolvedValueOnce(listResp([{ id: "byemail" }]))
      .mockResolvedValueOnce(json({}));
    expect(await upsertContact({ ...contact, phone: "+302101234567" })).toBe("byemail");

    // nothing resolves → null + error
    mockFetch.mockClear();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response("phoneNumber bad", { status: 400 }))
      .mockResolvedValueOnce(json([], 409))
      .mockResolvedValueOnce(listResp([]))
      .mockResolvedValueOnce(listResp([]));
    expect(await upsertContact({ ...contact, phone: "+302101234567" })).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining("could not resolve"), expect.anything());
    err.mockRestore();
  });

  it("non-409, non-phone create failure logs + returns null", async () => {
    const { upsertContact } = await lib();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    emailMiss();
    mockFetch.mockResolvedValueOnce(new Response("boom", { status: 400 }));
    expect(await upsertContact(contact)).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining("create failed"), 400, "boom");
    err.mockRestore();
  });
});

describe("misc error branches", () => {
  it("getContact swallows fetch errors", async () => {
    const { getContact } = await lib();
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await getContact("c1")).toBeNull();
  });

  it("listCompanies: !ok and throw degrade to []", async () => {
    const { listCompanies } = await lib();
    mockFetch.mockResolvedValueOnce(json({}, 400));
    expect(await listCompanies()).toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await listCompanies()).toEqual([]);
  });

  it("createLead logs + nulls on a non-retryable POST failure", async () => {
    const { createLead } = await lib();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch
      .mockResolvedValueOnce(listResp([])) // dedup search
      .mockResolvedValueOnce(json({}, 400)); // create
    expect(await createLead({ emailAddress: "l@x" })).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining("createLead failed"), 400);
    err.mockRestore();
  });
});
