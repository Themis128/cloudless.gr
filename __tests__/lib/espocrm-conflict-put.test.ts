/**
 * upsertContact conflict follow-up updates: after a 409, the PUT onto the
 * existing contact must (a) use the phone-less payload when the conflict came
 * from the phone-retry create, and (b) log HTTP or transport failures instead
 * of silently swallowing them. The contact id is still returned either way,
 * because the contact exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const listResp = (list: unknown[]) => json({ list, total: list.length });
const emailMiss = () => {
  mockFetch.mockResolvedValueOnce(listResp([])).mockResolvedValueOnce(listResp([]));
};
const calls = () =>
  mockFetch.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: (init as RequestInit | undefined)?.method ?? "GET",
    body: (init as RequestInit | undefined)?.body
      ? JSON.parse(String((init as RequestInit).body))
      : undefined,
  }));
const puts = () => calls().filter((c) => c.method === "PUT");

const withPhone = { email: "new@x.co", firstname: "New", phone: "+30 210 123 4567" };

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.resetModules();
  mockGetIntegrations.mockResolvedValue({
    ESPOCRM_BASE_URL: "https://espo.example",
    ESPOCRM_API_KEY: "k",
  });
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("upsertContact — phone-retry 409 updates", () => {
  it("PUTs the phone-less payload onto the first retry-conflict contact", async () => {
    const { upsertContact } = await import("@/lib/espocrm");
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response('{"field":"phoneNumber"}', { status: 400 }))
      .mockResolvedValueOnce(json([{ id: "rdup" }], 409))
      .mockResolvedValueOnce(json({ id: "rdup" }));
    expect(await upsertContact(withPhone)).toBe("rdup");
    const posts = calls().filter((c) => c.method === "POST");
    expect(posts[0].body.phoneNumber).toBe("+302101234567");
    expect(posts[1].body.phoneNumber).toBeUndefined();
    expect(puts()).toHaveLength(1);
    expect(puts()[0].url).toBe("https://espo.example/api/v1/Contact/rdup");
    expect(puts()[0].body).toMatchObject({ emailAddress: "new@x.co", firstName: "New" });
    expect(puts()[0].body.phoneNumber).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("PUTs the phone-less payload onto the email-search fallback contact", async () => {
    const { upsertContact } = await import("@/lib/espocrm");
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(new Response("phoneNumber invalid", { status: 400 }))
      .mockResolvedValueOnce(new Response("<html>conflict</html>", { status: 409 }))
      .mockResolvedValueOnce(listResp([{ id: "found" }]))
      .mockResolvedValueOnce(json({ id: "found" }));
    expect(await upsertContact(withPhone)).toBe("found");
    expect(puts().map((p) => p.url)).toEqual(["https://espo.example/api/v1/Contact/found"]);
    expect(puts()[0].body.phoneNumber).toBeUndefined();
  });
});

describe("upsertContact — failed follow-up updates are logged", () => {
  it("logs an HTTP error from the conflict PUT and still returns the id", async () => {
    const { upsertContact } = await import("@/lib/espocrm");
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json([{ id: "dup", emailAddress: "new@x.co" }], 409))
      .mockResolvedValueOnce(new Response("validation: lastName", { status: 400 }));
    expect(await upsertContact({ email: "new@x.co", firstname: "New" })).toBe("dup");
    expect(warn).toHaveBeenCalledWith(
      "[EspoCRM] upsertContact: follow-up update failed for",
      "dup",
      400,
      "validation: lastName"
    );
  });

  it("logs a transport error from the conflict PUT and still returns the id", async () => {
    const { upsertContact } = await import("@/lib/espocrm");
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json([{ id: "dup", emailAddress: "new@x.co" }], 409))
      .mockRejectedValue(new Error("network down"));
    expect(await upsertContact({ email: "new@x.co", firstname: "New" })).toBe("dup");
    expect(warn).toHaveBeenCalledWith(
      "[EspoCRM] upsertContact: follow-up update errored for",
      "dup",
      expect.objectContaining({ message: "network down" })
    );
  });

  it("a successful conflict PUT logs nothing", async () => {
    const { upsertContact } = await import("@/lib/espocrm");
    emailMiss();
    mockFetch
      .mockResolvedValueOnce(json([{ id: "dup", emailAddress: "new@x.co" }], 409))
      .mockResolvedValueOnce(json({ id: "dup" }));
    expect(await upsertContact({ email: "new@x.co", firstname: "New" })).toBe("dup");
    expect(puts()[0].body.phoneNumber).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
