/**
 * Tests for /api/user/delete - GDPR Art.17 Right to Erasure
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock AWS SDK clients at module level
const mockAdminDeleteUser = vi.hoisted(() => vi.fn());
const mockDeleteItem = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(function () {
    this.send = mockAdminDeleteUser;
  }),
  AdminDeleteUserCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function () {
    this.send = mockDeleteItem;
  }),
  DeleteItemCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: vi.fn(),
}));

const USER_DELETE_URL = "http://localhost/api/user/delete";

describe("POST /api/user/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.USER_PROFILE_TABLE;
    delete process.env.AWS_REGION;
  });

  it("returns 401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(401);
  });

  it("deletes Cognito user successfully", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockResolvedValue({});
    mockDeleteItem.mockResolvedValue({});

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";
    process.env.AWS_REGION = "us-east-1";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(200);
    expect(mockAdminDeleteUser).toHaveBeenCalled();
  });

  it("ignores UserNotFoundException in Cognito delete", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockRejectedValue({ name: "UserNotFoundException" });
    mockDeleteItem.mockResolvedValue({});

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(200);
  });

  it("returns 500 if Cognito delete fails with other error", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockRejectedValue(new Error("Network error"));
    mockDeleteItem.mockResolvedValue({});

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("cognito");
  });

  it("deletes DynamoDB profile successfully", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockResolvedValue({});
    mockDeleteItem.mockResolvedValue({});

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";
    process.env.USER_PROFILE_TABLE = "cloudless-user-profiles";
    process.env.AWS_REGION = "us-east-1";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(200);
    expect(mockDeleteItem).toHaveBeenCalled();
  });

  it("returns 500 if DynamoDB delete fails", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockResolvedValue({});
    mockDeleteItem.mockRejectedValue(new Error("DynamoDB error"));

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";
    process.env.USER_PROFILE_TABLE = "cloudless-user-profiles";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("profile");
  });

  it("returns partial error if both services fail", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockRejectedValue(new Error("Cognito error"));
    mockDeleteItem.mockRejectedValue(new Error("DynamoDB error"));

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";
    process.env.USER_PROFILE_TABLE = "cloudless-user-profiles";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("cognito");
    expect(body.error).toContain("profile");
  });

  it("returns 200 when both deletions succeed", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockResolvedValue({});
    mockDeleteItem.mockResolvedValue({});

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";
    process.env.USER_PROFILE_TABLE = "cloudless-user-profiles";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("skips Cognito delete if userPoolId not set", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockResolvedValue({});
    mockDeleteItem.mockResolvedValue({});

    // No COGNITO_USER_POOL_ID set
    process.env.USER_PROFILE_TABLE = "cloudless-user-profiles";

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(200);
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });

  it("skips DynamoDB delete if table not set", async () => {
    const { requireAuth } = await import("@/lib/api-auth");
    (requireAuth as vi.Mock).mockResolvedValue({
      ok: true,
      user: { sub: "user-123", email: "user@example.com" },
    });

    mockAdminDeleteUser.mockResolvedValue({});
    mockDeleteItem.mockResolvedValue({});

    process.env.COGNITO_USER_POOL_ID = "us-east-1_XXXXXXXXX";
    // No USER_PROFILE_TABLE set

    const { POST } = await import("@/app/api/user/delete/route");
    const res = await POST(new NextRequest(USER_DELETE_URL));

    expect(res.status).toBe(200);
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });
});