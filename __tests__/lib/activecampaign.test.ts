import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig }));

import {
  createCampaign,
  enrollLeadInAutomation,
  getCampaign,
  getEmailStats,
  getLeadAutomationStatus,
  isActiveCampaignConfigured,
  listACContacts,
  listACLists,
  listAutomations,
  listCampaigns,
  verifyActiveCampaignToken,
} from "@/lib/activecampaign";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const lastCall = () => mockFetch.mock.calls.at(-1)!;

function cfgOn() {
  m.getConfig.mockResolvedValue({
    ACTIVECAMPAIGN_API_URL: "https://ac.example/",
    ACTIVECAMPAIGN_API_TOKEN: "tok",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  m.getConfig.mockResolvedValue({});
});

describe("config + token verify", () => {
  it("configured iff url+token present; trailing slash trimmed", async () => {
    expect(await isActiveCampaignConfigured()).toBe(false);
    cfgOn();
    expect(await isActiveCampaignConfigured()).toBe(true);
    mockFetch.mockResolvedValueOnce(json({ campaigns: [] }));
    await listCampaigns();
    expect(String(lastCall()[0])).toBe("https://ac.example/api/3/campaigns?limit=20&orders[sdate]=DESC");
    expect(lastCall()[1].headers["Api-Token"]).toBe("tok");
  });

  it("verifyActiveCampaignToken maps statuses", async () => {
    expect((await verifyActiveCampaignToken()).status).toBe("not_configured");

    cfgOn();
    mockFetch.mockResolvedValueOnce(new Response("", { status: 200 }));
    expect(await verifyActiveCampaignToken()).toEqual({ status: "valid" });

    for (const code of [401, 403]) {
      mockFetch.mockResolvedValueOnce(new Response("", { status: code }));
      const r = await verifyActiveCampaignToken();
      expect(r.status).toBe("rejected");
      expect(r.message).toContain(String(code));
    }

    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await verifyActiveCampaignToken()).toEqual({ status: "error", message: "API returned 500" });

    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await verifyActiveCampaignToken()).toEqual({ status: "error", message: "Connection failed." });
  });
});

describe("campaigns + contacts + lists + automations", () => {
  it("listCampaigns/getCampaign happy + error paths", async () => {
    cfgOn();
    const camp = { id: "1", name: "N", subject: "S", status: "1", send_amt: "5", opens: "3", uniqueopens: "2", linkclicks: "1", sdate: "d", cdate: "c" };
    mockFetch.mockResolvedValueOnce(json({ campaigns: [camp] }));
    expect(await listCampaigns()).toEqual([camp]);
    mockFetch.mockResolvedValueOnce(json({ campaigns: undefined }));
    expect(await listCampaigns()).toEqual([]);
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await listCampaigns()).toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await listCampaigns()).toEqual([]);

    mockFetch.mockResolvedValueOnce(json({ campaign: camp }));
    expect(await getCampaign("1")).toEqual(camp);
    mockFetch.mockResolvedValueOnce(json({}));
    expect(await getCampaign("1")).toBeNull();
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 404 }));
    expect(await getCampaign("1")).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await getCampaign("1")).toBeNull();
  });

  it("createCampaign posts the single-campaign shape and handles sdate", async () => {
    cfgOn();
    mockFetch.mockResolvedValueOnce(json({ campaign: { id: "9" } }));
    expect(await createCampaign({ name: "N", subject: "S", fromname: "F", fromemail: "f@x.co", listId: "3", sdate: "2026-01-01" })).toEqual({ id: "9" });
    const body = JSON.parse(lastCall()[1].body);
    expect(body.campaign.status).toBe("1");
    expect(body.campaign.lists).toEqual([{ id: "3" }]);
    expect(body.campaign.type).toBe("single");

    mockFetch.mockResolvedValueOnce(json({ campaign: { id: "10" } }));
    await createCampaign({ name: "N", subject: "S", fromname: "F", fromemail: "f@x.co", listId: "3" });
    expect(JSON.parse(lastCall()[1].body).campaign.status).toBe("0");

    mockFetch.mockResolvedValueOnce(new Response("x", { status: 422 }));
    expect(await createCampaign({ name: "N", subject: "S", fromname: "F", fromemail: "f@x.co", listId: "3" })).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await createCampaign({ name: "N", subject: "S", fromname: "F", fromemail: "f@x.co", listId: "3" })).toBeNull();
  });

  it("listACContacts / listACLists / listAutomations", async () => {
    cfgOn();
    mockFetch.mockResolvedValueOnce(json({ contacts: [{ id: "c1" }] }));
    expect(await listACContacts()).toEqual([{ id: "c1" }]);
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await listACContacts()).toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("x"));
    expect(await listACContacts()).toEqual([]);

    mockFetch.mockResolvedValueOnce(json({ lists: [{ id: "l1" }] }));
    expect(await listACLists()).toEqual([{ id: "l1" }]);
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await listACLists()).toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("x"));
    expect(await listACLists()).toEqual([]);

    mockFetch.mockResolvedValueOnce(json({ automations: [{ id: "a1" }] }));
    expect(await listAutomations()).toEqual([{ id: "a1" }]);
    mockFetch.mockResolvedValueOnce(json({}));
    expect(await listAutomations()).toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("x"));
    expect(await listAutomations()).toEqual([]);
  });
});

describe("enrollLeadInAutomation", () => {
  const lead = { email: "l@x.co", firstName: "L", lastName: "M" };

  it("no-ops when automation id or API config missing", async () => {
    cfgOn(); // no ACTIVECAMPAIGN_LEAD_AUTOMATION_ID
    expect(await enrollLeadInAutomation(lead)).toBe(false);
    m.getConfig.mockResolvedValue({ ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: "7" }); // no API url/token
    expect(await enrollLeadInAutomation(lead)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("syncs then enrolls; 422 counts as success", async () => {
    m.getConfig.mockResolvedValue({
      ACTIVECAMPAIGN_API_URL: "https://ac.example",
      ACTIVECAMPAIGN_API_TOKEN: "tok",
      ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: "7",
    });
    mockFetch
      .mockResolvedValueOnce(json({ contact: { id: "42" } })) // sync
      .mockResolvedValueOnce(json({}, 422)); // already enrolled
    expect(await enrollLeadInAutomation(lead)).toBe(true);
    const enrollBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(enrollBody.contactAutomation).toEqual({ contact: "42", automation: "7" });
  });

  it("returns false on sync failure, missing contact id, enroll failure, or throw", async () => {
    m.getConfig.mockResolvedValue({
      ACTIVECAMPAIGN_API_URL: "https://ac.example",
      ACTIVECAMPAIGN_API_TOKEN: "tok",
      ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: "7",
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await enrollLeadInAutomation(lead)).toBe(false);

    mockFetch.mockResolvedValueOnce(json({ contact: {} })); // no id
    expect(await enrollLeadInAutomation(lead)).toBe(false);

    mockFetch
      .mockResolvedValueOnce(json({ contact: { id: "42" } }))
      .mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await enrollLeadInAutomation(lead)).toBe(false);

    mockFetch.mockRejectedValueOnce(new Error("boom"));
    expect(await enrollLeadInAutomation(lead)).toBe(false);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("enrollLeadInAutomation error"), expect.any(Error));
    err.mockRestore();
  });

  it("getLeadAutomationStatus reports both flags", async () => {
    m.getConfig.mockResolvedValue({});
    expect(await getLeadAutomationStatus()).toEqual({ apiConfigured: false, leadAutomationIdSet: false });
    m.getConfig.mockResolvedValue({
      ACTIVECAMPAIGN_API_URL: "https://ac.example",
      ACTIVECAMPAIGN_API_TOKEN: "tok",
      ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: " 7 ",
    });
    expect(await getLeadAutomationStatus()).toEqual({ apiConfigured: true, leadAutomationIdSet: true });
  });
});

describe("getEmailStats", () => {
  it("sums meta totals; tolerant of partial failures", async () => {
    cfgOn();
    mockFetch
      .mockResolvedValueOnce(json({ meta: { total: "120" } }))
      .mockResolvedValueOnce(new Response("x", { status: 500 }))
      .mockResolvedValueOnce(json({ meta: {} }));
    expect(await getEmailStats()).toEqual({ totalContacts: 120, totalCampaigns: 0, totalLists: 0 });

    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await getEmailStats()).toEqual({ totalContacts: 0, totalCampaigns: 0, totalLists: 0 });
  });
});
