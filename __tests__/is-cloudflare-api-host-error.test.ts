import { describe, expect, it } from "vitest";
import { isCloudflareApiHostError } from "@/lib/is-cloudflare-api-host-error";

describe("isCloudflareApiHostError", () => {
  it("matches EAI_AGAIN and fetch failed without needing a URL", () => {
    expect(isCloudflareApiHostError(new Error("getaddrinfo EAI_AGAIN api.cloudflare.com"))).toBe(
      true
    );
    expect(isCloudflareApiHostError(new Error("TypeError: fetch failed"))).toBe(true);
  });

  it("matches hostname via URL parse, not substring spoof hosts", () => {
    expect(
      isCloudflareApiHostError(
        new Error("Failed to fetch https://api.cloudflare.com/client/v4/accounts")
      )
    ).toBe(true);
    expect(
      isCloudflareApiHostError(
        new Error("Failed to fetch https://evil.example/api.cloudflare.com/steal")
      )
    ).toBe(false);
  });
});
