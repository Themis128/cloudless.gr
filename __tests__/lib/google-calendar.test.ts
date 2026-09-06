import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({
  GOOGLE_CLIENT_EMAIL: "",
  GOOGLE_PRIVATE_KEY: "",
  GOOGLE_CALENDAR_ID: "",
});

import {
  getAvailableSlots,
  getUpcomingConsultations,
  getConsultationsByEmail,
} from "@/lib/google-calendar";

describe("google-calendar (not configured)", () => {
  it("getAvailableSlots throws when Google Calendar is not configured", async () => {
    await expect(getAvailableSlots()).rejects.toThrow("Google service account not configured");
  });

  it("getUpcomingConsultations returns [] when not configured", async () => {
    const result = await getUpcomingConsultations();
    expect(result).toEqual([]);
  });

  it("getConsultationsByEmail returns [] when not configured", async () => {
    const result = await getConsultationsByEmail("test@example.com");
    expect(result).toEqual([]);
  });
});
