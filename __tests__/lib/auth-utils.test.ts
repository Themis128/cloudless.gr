import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/admin-notifications", () => ({ recordNotification: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendActivationEmail: vi.fn(), notifyTeam: vi.fn() }));
vi.mock("@/lib/slack-notify", () => ({
  slackRegistrationNotify: vi.fn(),
  SlackClient: class { post = vi.fn(); },
}));
vi.mock("@/lib/password-hashing", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

import {
  recordNotification,
  sendActivationEmail,
  notifyTeam,
  slackRegistrationNotify,
  hashPassword,
  verifyPassword,
  rateLimit,
  getClientIp,
} from "@/lib/auth-utils";

describe("auth-utils re-exports", () => {
  it("recordNotification is a function", () => {
    expect(typeof recordNotification).toBe("function");
  });

  it("sendActivationEmail is a function", () => {
    expect(typeof sendActivationEmail).toBe("function");
  });

  it("notifyTeam is a function", () => {
    expect(typeof notifyTeam).toBe("function");
  });

  it("slackRegistrationNotify is a function", () => {
    expect(typeof slackRegistrationNotify).toBe("function");
  });

  it("hashPassword is a function", () => {
    expect(typeof hashPassword).toBe("function");
  });

  it("verifyPassword is a function", () => {
    expect(typeof verifyPassword).toBe("function");
  });

  it("rateLimit is a function", () => {
    expect(typeof rateLimit).toBe("function");
  });

  it("getClientIp is a function", () => {
    expect(typeof getClientIp).toBe("function");
  });
});
