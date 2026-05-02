import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getConfigMock = vi.fn();
const revalidatePathMock = vi.fn();
const invalidateCacheMock = vi.fn();
const slackContactNotifyMock = vi.fn();
const sendEmailMock = vi.fn();

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
  resetSsmCache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/notion-cache", () => ({
  invalidateCache: invalidateCacheMock,
}));

vi.mock("@/lib/slack-notify", () => ({
  slackContactNotify: slackContactNotifyMock,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
}));

const DEFAULT_CONFIG = {
  NOTION_WEBHOOK_SECRET: "test_notion_secret",
  SES_TO_EMAIL: "team@cloudless.gr",
};

function makeRequest(body: unknown, secret?: string) {
  return new NextRequest("http://localhost:4000/api/webhooks/notion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-webhook-secret": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/notion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue(DEFAULT_CONFIG);
    slackContactNotifyMock.mockResolvedValue(undefined);
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("returns 401 when x-webhook-secret header is missing", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest({ type: "page.updated", database: "blog", page_id: "p1" }),
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("x-webhook-secret");
  });

  it("returns 401 when x-webhook-secret is wrong", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "page.updated", database: "blog", page_id: "p1" },
        "wrong_secret",
      ),
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when webhook secret is not configured", async () => {
    getConfigMock.mockResolvedValueOnce({ ...DEFAULT_CONFIG, NOTION_WEBHOOK_SECRET: "" });

    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "page.updated", database: "blog", page_id: "p1" },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const request = new NextRequest("http://localhost:4000/api/webhooks/notion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": "test_notion_secret",
      },
      body: "not-json{{{",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid JSON");
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest({ type: "page.updated" }, "test_notion_secret"),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 for unknown event type", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "unknown.event", database: "blog", page_id: "p1" },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown event type");
  });

  it("handles page.updated for blog — revalidates blog paths", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "page.updated", database: "blog", page_id: "p1", slug: "my-post" },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.revalidated).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/blog");
    expect(revalidatePathMock).toHaveBeenCalledWith("/blog/my-post");
    expect(invalidateCacheMock).toHaveBeenCalledWith("blog");
  });

  it("handles page.updated for docs — revalidates docs paths", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "page.updated", database: "docs", page_id: "p2", slug: "my-doc" },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledWith("/docs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/docs/my-doc");
    expect(invalidateCacheMock).toHaveBeenCalledWith("docs");
  });

  it("handles page.created for blog — revalidates blog and sitemap", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "page.created", database: "blog", page_id: "p3" },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.created).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/blog");
    expect(revalidatePathMock).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("handles page.created for docs — notifies Slack", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "page.created",
          database: "docs",
          page_id: "p4",
          slug: "new-doc",
          data: { title: "New Guide" },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(slackContactNotifyMock).toHaveBeenCalledTimes(1);
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("New Guide");
  });

  it("handles submission.status Done — sends email to submitter", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "submission.status",
          database: "submissions",
          page_id: "p5",
          data: { email: "client@example.com", name: "Alice", status: "Done" },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.emailed).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailCall = sendEmailMock.mock.calls[0][0];
    expect(emailCall.to).toBe("client@example.com");
    expect(emailCall.subject).toContain("Cloudless");
  });

  it("handles submission.status non-Done — does NOT send email", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "submission.status",
          database: "submissions",
          page_id: "p6",
          data: { email: "client@example.com", name: "Bob", status: "In Progress" },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.emailed).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("handles project.updated Completed — notifies Slack", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "project.updated",
          database: "projects",
          page_id: "p7",
          data: { name: "Cloud Migration", status: "Completed" },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(slackContactNotifyMock).toHaveBeenCalledTimes(1);
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("Cloud Migration");
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("Completed");
  });

  it("handles project.updated Blocked — notifies Slack", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "project.updated",
          database: "projects",
          page_id: "p8",
          data: { name: "SEO Audit", status: "Blocked" },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(slackContactNotifyMock).toHaveBeenCalledTimes(1);
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("Blocked");
  });

  it("handles task.updated Blocked — notifies Slack", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "task.updated",
          database: "tasks",
          page_id: "p9",
          data: { task: "Write report", status: "Blocked", assignee: "Themis" },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(slackContactNotifyMock).toHaveBeenCalledTimes(1);
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("Write report");
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("Themis");
  });

  it("handles analytics.event error spike >= 10 — notifies Slack", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "analytics.event",
          database: "analytics",
          page_id: "p10",
          data: { type: "error", count: 15 },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(slackContactNotifyMock).toHaveBeenCalledTimes(1);
    expect(slackContactNotifyMock.mock.calls[0][0].message).toContain("15");
  });

  it("does NOT notify Slack for analytics.event below threshold", async () => {
    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        {
          type: "analytics.event",
          database: "analytics",
          page_id: "p11",
          data: { type: "error", count: 5 },
        },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(slackContactNotifyMock).not.toHaveBeenCalled();
  });

  it("returns 500 when a downstream handler throws", async () => {
    revalidatePathMock.mockImplementationOnce(() => {
      throw new Error("cache revalidation failed");
    });

    const { POST } = await import("@/app/api/webhooks/notion/route");
    const response = await POST(
      makeRequest(
        { type: "page.updated", database: "blog", page_id: "p12", slug: "boom" },
        "test_notion_secret",
      ),
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Internal error");
  });
});
