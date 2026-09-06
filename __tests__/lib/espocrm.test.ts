import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ ESPOCRM_BASE_URL: "", ESPOCRM_API_KEY: "" });

import {
  isEspoCRMConfigured,
  listContacts,
  listLeads,
  listTickets,
  listDeals,
  listCompanies,
  getPipelineStats,
  getDealsByStage,
  countLeadsForCampaign,
  listNewsletterSubscribers,
} from "@/lib/espocrm";

describe("espocrm (not configured)", () => {
  it("isEspoCRMConfigured returns false when URL and key are empty", async () => {
    expect(await isEspoCRMConfigured()).toBe(false);
  });

  it("listContacts returns [] when not configured", async () => {
    expect(await listContacts()).toEqual([]);
  });

  it("listLeads returns [] when not configured", async () => {
    expect(await listLeads()).toEqual([]);
  });

  it("listTickets returns [] when not configured", async () => {
    expect(await listTickets()).toEqual([]);
  });

  it("listDeals returns [] when not configured", async () => {
    expect(await listDeals()).toEqual([]);
  });

  it("listCompanies returns [] when not configured", async () => {
    expect(await listCompanies()).toEqual([]);
  });

  it("getPipelineStats returns zeroed stats when not configured", async () => {
    const stats = await getPipelineStats();
    expect(stats.totalDeals).toBe(0);
    expect(stats.totalValue).toBe(0);
  });

  it("getDealsByStage returns an object when not configured", async () => {
    const result = await getDealsByStage();
    expect(typeof result).toBe("object");
  });

  it("countLeadsForCampaign returns 0 when not configured", async () => {
    expect(await countLeadsForCampaign("my-campaign")).toBe(0);
  });

  it("listNewsletterSubscribers returns [] when not configured", async () => {
    expect(await listNewsletterSubscribers()).toEqual([]);
  });
});
