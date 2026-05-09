import { describe, it, expect } from "vitest";
import { mapIntegrationError } from "@/lib/api-errors";
import { IntegrationNotConfiguredError } from "@/lib/integrations";

describe("mapIntegrationError()", () => {
  it("returns a 503 NextResponse for IntegrationNotConfiguredError", async () => {
    const err = new IntegrationNotConfiguredError(["SOME_KEY"]);
    const response = mapIntegrationError(err);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    const body = await response?.json();
    expect(body.error).toBe("Service unavailable");
    expect(body.reason).toBe("integration_not_configured");
    expect(body.missing).toEqual(["SOME_KEY"]);
  });

  it("includes all missing keys in the response body", async () => {
    const err = new IntegrationNotConfiguredError(["KEY_A", "KEY_B"]);
    const response = mapIntegrationError(err);
    const body = await response?.json();
    expect(body.missing).toEqual(["KEY_A", "KEY_B"]);
  });

  it("returns null for a plain Error", () => {
    const result = mapIntegrationError(new Error("generic error"));
    expect(result).toBeNull();
  });

  it("returns null for a string error", () => {
    expect(mapIntegrationError("something broke")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(mapIntegrationError(null)).toBeNull();
  });

  it("returns null for an unknown object", () => {
    expect(mapIntegrationError({ code: 404 })).toBeNull();
  });
});
