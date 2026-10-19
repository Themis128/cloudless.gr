import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: vi.fn(),
}));

import { getIntegrationsAsync } from "@/lib/integrations";
import { createLead } from "@/lib/espocrm";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...(init ?? {}),
  });
}

describe("EspoCRM createLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIntegrationsAsync).mockResolvedValue({
      ESPOCRM_BASE_URL: "https://espo.example",
      ESPOCRM_API_KEY: "espo-test-key",
    } as never);
  });

  it("includes data.description in the payload description when provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // Dedup search: no existing leads
        .mockResolvedValueOnce(jsonResponse({ list: [] }))
        // Create lead
        .mockResolvedValueOnce(jsonResponse({ id: "lead-xyz" }))
    );

    const id = await createLead({
      emailAddress: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      source: "Other",
      campaignSlug: "socialauto-facebook_messenger",
      utmSource: "socialauto",
      description: "Source: facebook_messenger (Facebook Messenger)\nThread ID: t_123",
    });

    expect(id).toBe("lead-xyz");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);

    const init = vi.mocked(globalThis.fetch).mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(String(body.description)).toContain("Source: facebook_messenger (Facebook Messenger)");
    expect(String(body.description)).toContain("Thread ID: t_123");
    expect(String(body.description)).toContain("Campaign: socialauto-facebook_messenger");
    expect(String(body.description)).toContain("utm_source: socialauto");
  });

  it("writes UTM and lead-magnet values to the native custom fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ list: [{ id: "list-1" }] })) // TargetList lookup
        .mockResolvedValueOnce(jsonResponse({ list: [] })) // dedup search
        .mockResolvedValueOnce(jsonResponse({ id: "lead-1" })) // create
    );

    const id = await createLead({
      emailAddress: "magnet@example.com",
      source: "Lead Magnet",
      leadMagnet: "12-automation-checklist",
      utmSource: "website",
      utmMedium: "lead_magnet",
      utmCampaign: "12-automation-checklist",
      utmContent: "links-page",
      utmTerm: "automation",
      targetListNames: ["Checklist downloaders"],
    });

    expect(id).toBe("lead-1");
    const createInit = vi.mocked(globalThis.fetch).mock.calls[2]?.[1] as RequestInit;
    const body = JSON.parse(String(createInit.body)) as Record<string, unknown>;
    expect(body.utmSource).toBe("website");
    expect(body.utmMedium).toBe("lead_magnet");
    expect(body.utmCampaign).toBe("12-automation-checklist");
    expect(body.utmContent).toBe("links-page");
    expect(body.utmTerm).toBe("automation");
    expect(body.leadMagnet).toBe("12-automation-checklist");
    expect(body.targetListsIds).toEqual(["list-1"]);
    expect(String(body.description)).toContain("lead_magnet: 12-automation-checklist");
    expect(String(body.description)).toContain("utm_term: automation");
  });

  it("on re-ingest updates the existing lead without regressing status and unions target lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ list: [{ id: "list-1" }] })) // TargetList lookup
      .mockResolvedValueOnce(
        jsonResponse({
          list: [{ id: "lead-existing", description: "utm_source: older\nOld context" }],
        })
      ) // dedup search
      .mockResolvedValueOnce(jsonResponse({ list: [{ id: "list-0" }] })) // current memberships
      .mockResolvedValueOnce(jsonResponse({ id: "lead-existing" })); // update
    vi.stubGlobal("fetch", fetchMock);

    const id = await createLead({
      emailAddress: "dup@example.com",
      source: "Messenger",
      utmSource: "facebook_messenger",
      targetListNames: ["Messenger leads"],
    });

    expect(id).toBe("lead-existing");
    // list lookup + dedup search + relation fetch + update = 4 calls
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const relationUrl = String(fetchMock.mock.calls[2]?.[0]);
    expect(relationUrl).toContain("/Lead/lead-existing/targetLists");
    const updateInit = fetchMock.mock.calls[3]?.[1] as RequestInit;
    const body = JSON.parse(String(updateInit.body)) as Record<string, unknown>;
    expect(body.status).toBeUndefined();
    expect(body.targetListsIds).toEqual(["list-0", "list-1"]);
    // Description history is merged, not replaced; no fallback lastName written.
    const desc = String(body.description);
    expect(desc).toContain("Old context");
    expect(desc).toContain("utm_source: facebook_messenger");
    expect(desc.split("\n").filter((l) => l === "utm_source: older")).toHaveLength(1);
    expect(body.lastName).toBeUndefined();
  });

  it("on re-ingest never wipes stored fields with empty values", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ list: [{ id: "lead-existing" }] })) // dedup search
      .mockResolvedValueOnce(jsonResponse({ id: "lead-existing" })); // update
    vi.stubGlobal("fetch", fetchMock);

    const id = await createLead({
      emailAddress: "named@example.com",
      // no firstName → would serialize as "" and clobber the stored name
      utmSource: "referral",
    });

    expect(id).toBe("lead-existing");
    const updateInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(updateInit.body)) as Record<string, unknown>;
    expect(body.firstName).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.utmSource).toBe("referral");
  });

  it("leaves target-list memberships untouched when the relation read fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ list: [{ id: "list-1" }] })) // TargetList lookup
      .mockResolvedValueOnce(jsonResponse({ list: [{ id: "lead-existing" }] })) // dedup search
      .mockResolvedValueOnce(new Response("boom", { status: 403 })) // relation read fails (non-retryable)
      .mockResolvedValueOnce(jsonResponse({ id: "lead-existing" })); // update
    vi.stubGlobal("fetch", fetchMock);

    const id = await createLead({
      emailAddress: "dup2@example.com",
      firstName: "Dup",
      targetListNames: ["Messenger leads"],
    });

    expect(id).toBe("lead-existing");
    const updateInit = fetchMock.mock.calls[3]?.[1] as RequestInit;
    const body = JSON.parse(String(updateInit.body)) as Record<string, unknown>;
    expect(body.targetListsIds).toBeUndefined();
  });
});
