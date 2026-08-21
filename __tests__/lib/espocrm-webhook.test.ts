import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEspoEvent, verifyEspoWebhookSecret } from "@/lib/espocrm-webhook";

// ── parseEspoEvent ────────────────────────────────────────────────────────────

describe("parseEspoEvent", () => {
  it("splits a well-formed event into entity + action", () => {
    expect(parseEspoEvent("Contact.create")).toEqual(["Contact", "create"]);
    expect(parseEspoEvent("Opportunity.update")).toEqual(["Opportunity", "update"]);
    expect(parseEspoEvent("Case.delete")).toEqual(["Case", "delete"]);
  });

  it("returns [null, null] for undefined", () => {
    expect(parseEspoEvent(undefined)).toEqual([null, null]);
  });

  it("returns [null, null] for empty string", () => {
    expect(parseEspoEvent("")).toEqual([null, null]);
  });

  it("returns [null, null] when the dot is the first character", () => {
    expect(parseEspoEvent(".create")).toEqual([null, null]);
  });

  it("returns [null, null] when the dot is the last character", () => {
    expect(parseEspoEvent("Contact.")).toEqual([null, null]);
  });

  it("returns [null, null] when there is no dot", () => {
    expect(parseEspoEvent("Contactcreate")).toEqual([null, null]);
  });

  it("splits only on the first dot (action may contain dots)", () => {
    expect(parseEspoEvent("Contact.create.extra")).toEqual(["Contact", "create.extra"]);
  });
});

// ── verifyEspoWebhookSecret ───────────────────────────────────────────────────

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: vi.fn(),
}));

import { getIntegrationsAsync } from "@/lib/integrations";
const mockGetIntegrations = vi.mocked(getIntegrationsAsync);

describe("verifyEspoWebhookSecret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when urlSecret is null", async () => {
    expect(await verifyEspoWebhookSecret(null)).toBe(false);
    expect(mockGetIntegrations).not.toHaveBeenCalled();
  });

  it("returns false when the configured secret is missing", async () => {
    mockGetIntegrations.mockResolvedValue({ ESPOCRM_WEBHOOK_SECRET: "" } as never);
    expect(await verifyEspoWebhookSecret("abc")).toBe(false);
  });

  it("returns false when configured secret is undefined", async () => {
    mockGetIntegrations.mockResolvedValue({} as never);
    expect(await verifyEspoWebhookSecret("abc")).toBe(false);
  });

  it("returns true for a matching secret", async () => {
    mockGetIntegrations.mockResolvedValue({
      ESPOCRM_WEBHOOK_SECRET: "correct-secret",
    } as never);
    expect(await verifyEspoWebhookSecret("correct-secret")).toBe(true);
  });

  it("returns false for a wrong secret", async () => {
    mockGetIntegrations.mockResolvedValue({
      ESPOCRM_WEBHOOK_SECRET: "correct-secret",
    } as never);
    expect(await verifyEspoWebhookSecret("wrong-secret")).toBe(false);
  });

  it("returns false when lengths differ (constant-time guard)", async () => {
    mockGetIntegrations.mockResolvedValue({
      ESPOCRM_WEBHOOK_SECRET: "short",
    } as never);
    expect(await verifyEspoWebhookSecret("much-longer-secret")).toBe(false);
  });
});
