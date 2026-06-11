// @vitest-environment node
/**
 * /api/admin/users — Cognito provider path.
 *
 * This sets COGNITO_ISSUER
 * so the route dispatches to the AWS-SDK Cognito branch, and asserts:
 *   - GET lists Cognito users mapped to the shared shape, admin role from the
 *     admin group, and provider:"cognito"; pool id + region derive from issuer
 *   - POST disable/enable/promote/demote issue the right Cognito admin commands
 *   - unknown action surfaces as an error (no mutation command sent)
 *   - 503 when no provider is configured
 *
 * requireAdmin is mocked (the Bearer/JWKS path is exercised in api-auth.test.ts),
 * and the Cognito SDK client is mocked so no AWS call is made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({ ok: true, user: { sub: "admin", groups: ["admin"] } })),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => ({})),
  resetSsmCache: vi.fn(),
}));

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  class Cmd {
    input: Record<string, unknown>;
    _t = "Base";
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  const mk = (t: string) =>
    class extends Cmd {
      _t = t;
    };
  return {
    CognitoIdentityProviderClient: class {
      send = sendMock;
    },
    ListUsersCommand: mk("ListUsers"),
    AdminListGroupsForUserCommand: mk("AdminListGroupsForUser"),
    AdminEnableUserCommand: mk("AdminEnableUser"),
    AdminDisableUserCommand: mk("AdminDisableUser"),
    AdminAddUserToGroupCommand: mk("AdminAddUserToGroup"),
    AdminRemoveUserFromGroupCommand: mk("AdminRemoveUserFromGroup"),
  };
});

const ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTPOOL";

function adminReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, { method: init?.method, body: init?.body });
}

describe("/api/admin/users — Cognito path", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    process.env.COGNITO_ISSUER = ISSUER;
  });

  afterEach(() => {
    delete process.env.COGNITO_ISSUER;
  });

  it("GET lists Cognito users with admin role + provider, deriving the pool id", async () => {
    sendMock.mockImplementation(async (cmd: { _t: string }) => {
      if (cmd._t === "ListUsers") {
        return {
          Users: [
            {
              Username: "11111111-1111-1111-1111-111111111111",
              Enabled: true,
              UserStatus: "CONFIRMED",
              UserCreateDate: new Date("2026-01-02T00:00:00Z"),
              Attributes: [
                { Name: "email", Value: "alice@cloudless.gr" },
                { Name: "email_verified", Value: "true" },
                { Name: "name", Value: "Alice A" },
              ],
            },
          ],
        };
      }
      if (cmd._t === "AdminListGroupsForUser") return { Groups: [{ GroupName: "admin" }] };
      return {};
    });

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users?limit=60"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.provider).toBe("cognito");
    expect(data.count).toBe(1);
    expect(data.users[0]).toMatchObject({
      username: "11111111-1111-1111-1111-111111111111",
      email: "alice@cloudless.gr",
      name: "Alice A",
      emailVerified: true,
      status: "active",
      userStatus: "CONFIRMED",
      role: "admin",
    });
    const listCall = sendMock.mock.calls.find((c) => c[0]._t === "ListUsers");
    expect(listCall?.[0].input.UserPoolId).toBe("us-east-1_TESTPOOL");
  });

  it("GET marks a user without the admin group as role=user, status=disabled", async () => {
    sendMock.mockImplementation(async (cmd: { _t: string }) => {
      if (cmd._t === "ListUsers") {
        return {
          Users: [
            {
              Username: "u-2",
              Enabled: false,
              UserStatus: "CONFIRMED",
              Attributes: [{ Name: "email", Value: "bob@cloudless.gr" }],
            },
          ],
        };
      }
      if (cmd._t === "AdminListGroupsForUser") return { Groups: [{ GroupName: "users" }] };
      return {};
    });

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users"));
    const data = await res.json();
    expect(data.users[0]).toMatchObject({ role: "user", status: "disabled" });
  });

  it("POST promote adds the user to the admin group", async () => {
    sendMock.mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "promote", username: "u-1" }),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("User promoted to admin");
    const call = sendMock.mock.calls.find((c) => c[0]._t === "AdminAddUserToGroup");
    expect(call?.[0].input).toMatchObject({ Username: "u-1", GroupName: "admin" });
  });

  it("POST disable issues AdminDisableUser", async () => {
    sendMock.mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "disable", username: "u-1" }),
      })
    );
    expect(res.status).toBe(200);
    expect(sendMock.mock.calls.some((c) => c[0]._t === "AdminDisableUser")).toBe(true);
  });

  it("POST demote removes the user from the admin group", async () => {
    sendMock.mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "demote", username: "u-1" }),
      })
    );
    expect(res.status).toBe(200);
    expect(sendMock.mock.calls.some((c) => c[0]._t === "AdminRemoveUserFromGroup")).toBe(true);
  });

  it("POST missing action/username returns 400", async () => {
    sendMock.mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "disable" }),
      })
    );
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("POST unknown action returns 400 without mutating", async () => {
    sendMock.mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "nuke", username: "u-1" }),
      })
    );
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("GET returns 503 when no auth provider is configured", async () => {
    delete process.env.COGNITO_ISSUER;
    vi.resetModules();
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users"));
    expect(res.status).toBe(503);
  });
});
