import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));

import {
  addToSuppressionList,
  removeFromSuppressionList,
  isSuppressed,
  getSuppressedEmails,
} from "@/lib/ses-suppression-d1";

describe("ses-suppression-d1 (no D1 binding)", () => {
  it("addToSuppressionList returns false when no DB", async () => {
    const result = await addToSuppressionList("test@example.com");
    expect(result).toBe(false);
  });

  it("removeFromSuppressionList returns false when no DB", async () => {
    const result = await removeFromSuppressionList("test@example.com");
    expect(result).toBe(false);
  });

  it("isSuppressed returns false when no DB", async () => {
    const result = await isSuppressed("test@example.com");
    expect(result).toBe(false);
  });

  it("getSuppressedEmails returns empty array when no DB", async () => {
    const result = await getSuppressedEmails();
    expect(result).toEqual([]);
  });
});
