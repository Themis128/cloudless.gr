/**
 * Tests for pure/exported helpers in src/lib/workspace-server.ts.
 * No mocks — exercises the authorization decision logic.
 */
import { describe, it, expect } from "vitest";
import {
  checkWorkspaceAccess,
  WORKSPACE_COOKIE,
  SSM_KEY,
  type Workspace,
} from "@/lib/workspace-server";
import type { DecodedToken } from "@/lib/api-auth";

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: "ws-1",
    name: "Test Workspace",
    slug: "test-workspace",
    description: "A test workspace",
    adminEmails: ["admin@example.com"],
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeUser(overrides: Partial<DecodedToken> = {}): DecodedToken {
  return {
    sub: "user-123",
    email: "user@example.com",
    ...overrides,
  };
}

describe("checkWorkspaceAccess", () => {
  it("returns 'no_workspace' when workspace is null", () => {
    const result = checkWorkspaceAccess(makeUser(), null, false);
    expect(result).toBe("no_workspace");
  });

  it("returns 'granted' for global admin regardless of email", () => {
    const user = makeUser({ email: "random@other.com" });
    const ws = makeWorkspace({ adminEmails: ["admin@example.com"] });
    expect(checkWorkspaceAccess(user, ws, true)).toBe("granted");
  });

  it("returns 'granted' when user email matches workspace adminEmails", () => {
    const user = makeUser({ email: "admin@example.com" });
    const ws = makeWorkspace({ adminEmails: ["admin@example.com"] });
    expect(checkWorkspaceAccess(user, ws, false)).toBe("granted");
  });

  it("is case-insensitive for email matching", () => {
    const user = makeUser({ email: "Admin@Example.COM" });
    const ws = makeWorkspace({ adminEmails: ["admin@example.com"] });
    expect(checkWorkspaceAccess(user, ws, false)).toBe("granted");
  });

  it("returns 'forbidden' when user email not in adminEmails", () => {
    const user = makeUser({ email: "outsider@example.com" });
    const ws = makeWorkspace({ adminEmails: ["admin@example.com"] });
    expect(checkWorkspaceAccess(user, ws, false)).toBe("forbidden");
  });

  it("returns 'forbidden' when user has no email", () => {
    const user = makeUser({ email: undefined });
    const ws = makeWorkspace({ adminEmails: ["admin@example.com"] });
    expect(checkWorkspaceAccess(user, ws, false)).toBe("forbidden");
  });

  it("returns 'granted' for global admin even with null workspace (no_workspace takes precedence)", () => {
    // no_workspace is checked first
    expect(checkWorkspaceAccess(makeUser(), null, true)).toBe("no_workspace");
  });

  it("handles workspace with multiple adminEmails", () => {
    const user = makeUser({ email: "second@example.com" });
    const ws = makeWorkspace({ adminEmails: ["first@example.com", "second@example.com"] });
    expect(checkWorkspaceAccess(user, ws, false)).toBe("granted");
  });

  it("handles empty adminEmails list", () => {
    const user = makeUser({ email: "user@example.com" });
    const ws = makeWorkspace({ adminEmails: [] });
    expect(checkWorkspaceAccess(user, ws, false)).toBe("forbidden");
  });
});

describe("constants", () => {
  it("WORKSPACE_COOKIE is defined", () => {
    expect(WORKSPACE_COOKIE).toBe("cloudless_workspace_id");
  });

  it("SSM_KEY aliases the D1 workspaces config key", () => {
    expect(SSM_KEY).toBe("WORKSPACES_JSON");
  });
});
