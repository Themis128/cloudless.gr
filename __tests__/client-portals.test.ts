import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSSMSend, putCalls } = vi.hoisted(() => ({
  mockSSMSend: vi.fn(),
  putCalls: [] as unknown[],
}));

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn().mockImplementation(function () {
    return { send: mockSSMSend };
  }),
  GetParameterCommand: vi.fn().mockImplementation(function (input: unknown) {
    return { __cmd: "Get", input };
  }),
  PutParameterCommand: vi.fn().mockImplementation(function (input: unknown) {
    putCalls.push(input);
    return { __cmd: "Put", input };
  }),
}));

import {
  readPortals,
  writePortals,
  tokenMatches,
  findPortalByToken,
  newDeliverable,
  newPaymentLink,
  applyClientResponse,
  clientVisibleDeliverables,
  type ClientPortal,
} from "@/lib/client-portals";

const SAMPLE_PORTAL: ClientPortal = {
  token: "tok-1",
  label: "Acme",
  clientEmail: "x@acme.example",
  clientName: "Acme",
  createdAt: "2026-01-01T00:00:00Z",
  steps: [],
};

describe("client-portals", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
    putCalls.length = 0;
  });

  describe("readPortals", () => {
    it("returns parsed array on success", async () => {
      mockSSMSend.mockResolvedValueOnce({
        Parameter: { Value: JSON.stringify([SAMPLE_PORTAL]) },
      });
      const r = await readPortals();
      // readPortals normalizes records, so the array fields are always present.
      expect(r).toEqual([{ ...SAMPLE_PORTAL, deliverables: [], paymentLinks: [] }]);
    });

    it("normalizes legacy records missing array fields (regression: 500 on GET)", async () => {
      // A pre-deliverables record with no steps array (and a step missing its
      // comments) must be coerced to valid arrays so scoreClientHealth and the
      // admin route can iterate without throwing an unhandled TypeError.
      const legacy = {
        token: "tok-legacy",
        label: "Legacy",
        clientEmail: "y@acme.example",
        clientName: "Acme",
        createdAt: "2026-01-01T00:00:00Z",
        steps: [{ id: "s1", name: "Audit", status: "pending" }],
      };
      mockSSMSend.mockResolvedValueOnce({
        Parameter: { Value: JSON.stringify([legacy]) },
      });
      const [p] = await readPortals();
      expect(p.steps[0].comments).toEqual([]);
      expect(p.deliverables).toEqual([]);
      expect(p.paymentLinks).toEqual([]);
    });

    it("returns empty array when the stored value is not an array", async () => {
      mockSSMSend.mockResolvedValueOnce({
        Parameter: { Value: JSON.stringify({ not: "an array" }) },
      });
      await expect(readPortals()).resolves.toEqual([]);
    });

    it("returns empty array on SSM error", async () => {
      mockSSMSend.mockRejectedValueOnce(new Error("ParameterNotFound"));
      await expect(readPortals()).resolves.toEqual([]);
    });

    it("returns empty array when parameter has no Value", async () => {
      mockSSMSend.mockResolvedValueOnce({ Parameter: {} });
      await expect(readPortals()).resolves.toEqual([]);
    });
  });

  describe("writePortals", () => {
    it("calls PutParameter with JSON payload and Overwrite=true", async () => {
      mockSSMSend.mockResolvedValueOnce({});
      await writePortals([SAMPLE_PORTAL]);
      expect(putCalls).toHaveLength(1);
      const input = putCalls[0] as {
        Value: string;
        Overwrite: boolean;
        Type: string;
        Tier: string;
      };
      expect(input.Overwrite).toBe(true);
      expect(input.Type).toBe("String");
      // Intelligent-Tiering auto-upgrades past the 4KB Standard cap as the
      // portals JSON grows, instead of throwing (which surfaced as a 500).
      expect(input.Tier).toBe("Intelligent-Tiering");
      expect(JSON.parse(input.Value)).toHaveLength(1);
    });
  });

  describe("tokenMatches", () => {
    it("rejects different-length tokens", () => {
      expect(tokenMatches("abc", "abcd")).toBe(false);
      expect(tokenMatches("longer-token-12345", "short")).toBe(false);
    });

    it("accepts identical tokens", () => {
      expect(tokenMatches("xyz-token", "xyz-token")).toBe(true);
    });

    it("rejects same-length but different tokens", () => {
      expect(tokenMatches("abcdef", "abcdeg")).toBe(false);
    });
  });

  describe("findPortalByToken", () => {
    it("returns the matching portal", async () => {
      const portals: ClientPortal[] = [
        { ...SAMPLE_PORTAL, token: "AAA", label: "A" },
        { ...SAMPLE_PORTAL, token: "BBB", label: "B" },
      ];
      mockSSMSend.mockResolvedValueOnce({
        Parameter: { Value: JSON.stringify(portals) },
      });
      const found = await findPortalByToken("BBB");
      expect(found?.label).toBe("B");
    });

    it("returns null when no portal matches", async () => {
      mockSSMSend.mockResolvedValueOnce({ Parameter: { Value: "[]" } });
      expect(await findPortalByToken("nope")).toBeNull();
    });
  });

  describe("newDeliverable", () => {
    it("creates a draft with id, timestamps, and truncated fields", () => {
      const d = newDeliverable({
        title: "x".repeat(200),
        url: "https://example.com/" + "p".repeat(1000),
        description: "y".repeat(2000),
      });
      expect(d.id).toBeTruthy();
      expect(d.status).toBe("draft");
      expect(d.createdAt).toBe(d.updatedAt);
      expect(d.title.length).toBe(120);
      expect(d.url?.length).toBe(500);
      expect(d.description?.length).toBe(1000);
    });

    it("leaves optional fields undefined when not provided", () => {
      const d = newDeliverable({ title: "T" });
      expect(d.url).toBeUndefined();
      expect(d.description).toBeUndefined();
    });
  });

  describe("newPaymentLink", () => {
    it("defaults currency to EUR and rounds amountCents", () => {
      const link = newPaymentLink({
        label: "Deposit",
        url: "https://stripe/x",
        amountCents: 12345.6,
      });
      expect(link.currency).toBe("EUR");
      expect(link.amountCents).toBe(12346);
      expect(link.status).toBe("open");
    });

    it("uppercases and clamps a non-default currency", () => {
      const link = newPaymentLink({
        label: "Deposit",
        url: "https://stripe/x",
        currency: "usd",
      });
      expect(link.currency).toBe("USD");
    });

    it("drops negative amountCents", () => {
      const link = newPaymentLink({
        label: "Deposit",
        url: "https://stripe/x",
        amountCents: -100,
      });
      expect(link.amountCents).toBeUndefined();
    });
  });

  describe("applyClientResponse", () => {
    function portalWith(status: "draft" | "in_review" | "approved"): ClientPortal {
      return {
        ...SAMPLE_PORTAL,
        deliverables: [
          {
            id: "d-1",
            title: "T",
            status,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      };
    }

    it("returns error string when deliverable not found", () => {
      const r = applyClientResponse(portalWith("in_review"), "missing", "approve");
      expect(typeof r).toBe("string");
      expect(r as string).toMatch(/not found/i);
    });

    it("rejects responses on draft deliverables", () => {
      const r = applyClientResponse(portalWith("draft"), "d-1", "approve");
      expect(r as string).toMatch(/not awaiting review/i);
    });

    it("rejects responses on approved deliverables", () => {
      const r = applyClientResponse(portalWith("approved"), "d-1", "request_changes");
      expect(r as string).toMatch(/not awaiting review/i);
    });

    it("transitions in_review to approved on approve", () => {
      const r = applyClientResponse(portalWith("in_review"), "d-1", "approve", "lgtm");
      if (typeof r === "string") throw new Error(r);
      expect(r.status).toBe("approved");
      expect(r.clientComment).toBe("lgtm");
      expect(r.respondedAt).toBeTruthy();
    });

    it("transitions in_review to changes_requested on request_changes", () => {
      const r = applyClientResponse(
        portalWith("in_review"),
        "d-1",
        "request_changes",
        "needs work"
      );
      if (typeof r === "string") throw new Error(r);
      expect(r.status).toBe("changes_requested");
    });

    it("truncates client comment to 2000 chars", () => {
      const r = applyClientResponse(portalWith("in_review"), "d-1", "approve", "x".repeat(3000));
      if (typeof r === "string") throw new Error(r);
      expect(r.clientComment?.length).toBe(2000);
    });
  });

  describe("clientVisibleDeliverables", () => {
    it("filters out drafts", () => {
      const visible = clientVisibleDeliverables({
        ...SAMPLE_PORTAL,
        deliverables: [
          { id: "1", title: "d", status: "draft", createdAt: "x", updatedAt: "x" },
          { id: "2", title: "r", status: "in_review", createdAt: "x", updatedAt: "x" },
          { id: "3", title: "a", status: "approved", createdAt: "x", updatedAt: "x" },
        ],
      });
      expect(visible.map((d) => d.id)).toEqual(["2", "3"]);
    });

    it("returns empty array when deliverables is undefined", () => {
      expect(clientVisibleDeliverables(SAMPLE_PORTAL)).toEqual([]);
    });
  });
});
