// @vitest-environment node
/**
 * lib/appflowy-services — configured-path coverage: workspace/view lookup,
 * per-field markdown parsing, doc-failure fallback, defaults.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const isAppFlowyConfigured = vi.fn();
const listAllWorkspaces = vi.fn();
const listAllViewsDeep = vi.fn();
const getDocument = vi.fn();
const extractDocText = vi.fn();

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => isAppFlowyConfigured(...a),
  listAllWorkspaces: (...a: unknown[]) => listAllWorkspaces(...a),
  listAllViewsDeep: (...a: unknown[]) => listAllViewsDeep(...a),
  getDocument: (...a: unknown[]) => getDocument(...a),
  extractDocText: (...a: unknown[]) => extractDocText(...a),
}));

import { getServices } from "@/lib/appflowy-services";

beforeEach(() => {
  vi.clearAllMocks();
  isAppFlowyConfigured.mockResolvedValue(true);
  listAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
  listAllViewsDeep.mockResolvedValue([]);
  getDocument.mockResolvedValue({ doc: true });
  extractDocText.mockResolvedValue("");
});

describe("getServices — configured", () => {
  it("returns [] with no workspace", async () => {
    listAllWorkspaces.mockResolvedValue([]);
    expect(await getServices()).toEqual([]);
    listAllWorkspaces.mockRejectedValue(new Error("ws down"));
    expect(await getServices()).toEqual([]);
  });

  it("parses all markdown fields into a service", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "v1", name: "[Service] Cloud Audit" },
      { view_id: "v2", name: "Not a service" },
    ]);
    extractDocText.mockResolvedValue(
      [
        "**Slug**: audit-2026",
        "**Description**: Deep infra review",
        "**Price**: From €1,500",
        "**Category**: audit",
        "**Features**: one; two; three",
        "**CTA**: Book now",
        "**Icon**: 🔍",
        "**StripePriceId**: price_123",
      ].join("\n")
    );
    const services = await getServices();
    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({
      id: "v1",
      slug: "audit-2026",
      name: "Cloud Audit",
      description: "Deep infra review",
      price: "From €1,500",
      category: "audit",
      features: ["one", "two", "three"],
      cta: "Book now",
      icon: "🔍",
      stripePriceId: "price_123",
    });
  });

  it("applies slugify + defaults when fields are missing", async () => {
    listAllViewsDeep.mockResolvedValue([{ view_id: "v1", name: "[Service] My Cool Service!" }]);
    extractDocText.mockResolvedValue("");
    const services = await getServices();
    expect(services[0].slug).toBe("my-cool-service");
    expect(services[0].category).toBe("consulting");
    expect(services[0].cta).toBe("Contact us");
    expect(services[0].features).toEqual([]);
    expect(services[0].stripePriceId).toBeUndefined();
  });

  it("falls back to empty markdown when doc fetch throws", async () => {
    listAllViewsDeep.mockResolvedValue([{ view_id: "v1", name: "[Service] Thing" }]);
    getDocument.mockRejectedValue(new Error("doc down"));
    const services = await getServices();
    expect(services).toHaveLength(1);
    expect(services[0].slug).toBe("thing");
  });

  it("returns [] when view listing throws", async () => {
    listAllViewsDeep.mockRejectedValue(new Error("views down"));
    expect(await getServices()).toEqual([]);
  });
});
