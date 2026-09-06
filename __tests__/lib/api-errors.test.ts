/**
 * Tests for src/lib/api-errors.ts
 */
import { describe, it, expect } from "vitest";
import { mapIntegrationError } from "@/lib/api-errors";
import { IntegrationNotConfiguredError } from "@/lib/integrations";

describe("mapIntegrationError", () => {
  it("returns null for a generic Error", () => {
    expect(mapIntegrationError(new Error("something failed"))).toBeNull();
  });

  it("returns null for a non-error value", () => {
    expect(mapIntegrationError("string error")).toBeNull();
    expect(mapIntegrationError(null)).toBeNull();
    expect(mapIntegrationError(42)).toBeNull();
  });

  it("returns a 503 JSON response for IntegrationNotConfiguredError", async () => {
    const err = new IntegrationNotConfiguredError(["NOTION_API_KEY"]);
    const res = mapIntegrationError(err);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    const body = await res!.json();
    expect(body.error).toBe("Service unavailable");
    expect(body.reason).toBe("integration_not_configured");
    expect(body.missing).toContain("NOTION_API_KEY");
  });

  it("includes all missing keys in the response", async () => {
    const err = new IntegrationNotConfiguredError(["NOTION_API_KEY", "ANTHROPIC_API_KEY"]);
    const res = mapIntegrationError(err);
    const body = await res!.json();
    expect(body.missing).toContain("NOTION_API_KEY");
    expect(body.missing).toContain("ANTHROPIC_API_KEY");
  });
});
