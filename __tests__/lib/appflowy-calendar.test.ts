import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { getCalendarEvents, getPostizGroups, syncCalendarEvents } from "@/lib/appflowy-calendar";

describe("appflowy-calendar (not configured)", () => {
  it("getCalendarEvents returns [] when AppFlowy is not configured", async () => {
    expect(await getCalendarEvents()).toEqual([]);
  });

  it("getPostizGroups returns [] when not configured", async () => {
    expect(await getPostizGroups()).toEqual([]);
  });

  it("syncCalendarEvents returns false when not configured", async () => {
    expect(await syncCalendarEvents()).toBe(false);
  });
});
