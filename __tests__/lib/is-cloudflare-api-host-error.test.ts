import { describe, it, expect } from "vitest";
import { isCloudflareApiHostError } from "@/lib/is-cloudflare-api-host-error";

describe("isCloudflareApiHostError", () => {
  it("returns true for EAI_AGAIN (DNS failure)", () => {
    expect(isCloudflareApiHostError(new Error("EAI_AGAIN"))).toBe(true);
  });

  it("returns true for 'fetch failed'", () => {
    expect(isCloudflareApiHostError(new Error("fetch failed"))).toBe(true);
  });

  it("returns true for CLOUDFLARE_API_TOKEN in message", () => {
    expect(isCloudflareApiHostError(new Error("Invalid CLOUDFLARE_API_TOKEN"))).toBe(true);
  });

  it("returns true for 'remote proxy session' message", () => {
    expect(isCloudflareApiHostError(new Error("remote proxy session closed"))).toBe(true);
  });

  it("returns true when error message contains api.cloudflare.com URL", () => {
    expect(
      isCloudflareApiHostError(
        new Error("Request to https://api.cloudflare.com/client/v4/zones failed")
      )
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isCloudflareApiHostError(new Error("Something went wrong"))).toBe(false);
  });

  it("returns false for non-cloudflare URLs in message", () => {
    expect(
      isCloudflareApiHostError(new Error("https://api.github.com returned 404"))
    ).toBe(false);
  });

  it("recurses into error.cause", () => {
    const cause = new Error("EAI_AGAIN");
    const outer = new Error("Outer error");
    (outer as Error & { cause: Error }).cause = cause;
    expect(isCloudflareApiHostError(outer)).toBe(true);
  });

  it("handles non-Error values", () => {
    expect(isCloudflareApiHostError("EAI_AGAIN")).toBe(true);
    expect(isCloudflareApiHostError(42)).toBe(false);
    expect(isCloudflareApiHostError(null)).toBe(false);
  });
});
