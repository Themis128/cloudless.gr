import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ POSTIZ_API_URL: "", POSTIZ_API_KEY: "" });

import {
  PostizNotConfiguredError,
  PostizApiError,
  isPostizConfigured,
  listPostizIntegrations,
} from "@/lib/postiz";

describe("PostizNotConfiguredError", () => {
  it("is an Error with the correct name", () => {
    const err = new PostizNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PostizNotConfiguredError");
  });
});

describe("PostizApiError", () => {
  it("is an Error with status and body", () => {
    const err = new PostizApiError(404, "not found");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toContain("404");
  });
});

describe("isPostizConfigured", () => {
  it("returns false when POSTIZ_API_URL is empty", async () => {
    expect(await isPostizConfigured()).toBe(false);
  });
});

describe("listPostizIntegrations", () => {
  it("returns [] when Postiz is not configured", async () => {
    expect(await listPostizIntegrations()).toEqual([]);
  });
});
