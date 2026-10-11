import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/slack-notify", () => ({
  slackContactNotify: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/content-cache", () => ({
  invalidateCache: vi.fn(),
}));

vi.mock("@/lib/postiz-blog", () => ({
  scheduleBlogShare: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { getConfig } from "@/lib/ssm-config";
import { slackContactNotify } from "@/lib/slack-notify";
import { sendEmail } from "@/lib/email";
import { invalidateCache } from "@/lib/content-cache";
import { scheduleBlogShare } from "@/lib/postiz-blog";
import { POST } from "@/app/api/webhooks/content/route";

const SECRET = "content-webhook-test-secret";

function req(body: unknown, secret: string | null = SECRET): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-webhook-secret"] = secret;
  return new NextRequest("https://cloudless.gr/api/webhooks/content", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function base(over: Record<string, unknown> = {}) {
  return { type: "page.updated", database: "blog", page_id: "p1", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfig).mockResolvedValue({
    CONTENT_WEBHOOK_SECRET: SECRET,
    SES_TO_EMAIL: "team@cloudless.gr",
  } as never);
  vi.mocked(scheduleBlogShare).mockResolvedValue({ ok: true, postIds: ["x"] } as never);
  vi.mocked(slackContactNotify).mockResolvedValue(undefined as never);
  vi.mocked(sendEmail).mockResolvedValue(undefined as never);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));
});

describe("POST /api/webhooks/content — auth", () => {
  it("returns 401 when no secret is configured", async () => {
    vi.mocked(getConfig).mockResolvedValue({ CONTENT_WEBHOOK_SECRET: "" } as never);
    const res = await POST(req(base()));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the header is missing", async () => {
    const res = await POST(req(base(), null));
    expect(res.status).toBe(401);
  });

  it("returns 401 on a wrong secret", async () => {
    const res = await POST(req(base(), "wrong-wrong-wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 401 on a secret of different length (no timingSafeEqual throw)", async () => {
    const res = await POST(req(base(), "short"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/webhooks/content — validation", () => {
  it("returns 400 on malformed JSON", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON");
  });

  it.each(["type", "database", "page_id"])("returns 400 when %s is missing", async (field) => {
    const body = base();
    delete (body as Record<string, unknown>)[field];
    const res = await POST(req(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown event type", async () => {
    const res = await POST(req(base({ type: "bogus.event" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Unknown event type");
  });
});

describe("page.updated", () => {
  it("revalidates blog index, slug and API paths", async () => {
    const res = await POST(req(base({ slug: "hello-world" })));
    expect(res.status).toBe(200);
    expect(invalidateCache).toHaveBeenCalledWith("blog");
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(["/blog", "/blog/hello-world", "/api/blog/posts", "/api/blog/hello-world", "/sitemap.xml"])
    );
    // Not Published → no share scheduling
    expect(scheduleBlogShare).not.toHaveBeenCalled();
  });

  it("schedules Postiz share and n8n multicaption on Published status", async () => {
    const res = await POST(
      req(
        base({
          slug: "launch-post",
          data: { status: "Published", title: "Launch", excerpt: "ex", locale: "en" },
        })
      )
    );
    expect(res.status).toBe(200);
    expect(scheduleBlogShare).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "p1", title: "Launch", url: expect.stringContaining("/blog/launch-post") })
    );
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/webhook/postiz-ai-multicaption"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it.each(["docs", "testimonials", "case-studies", "services", "faqs"])(
    "invalidates the %s cache and revalidates the sitemap",
    async (database) => {
      const res = await POST(req(base({ database })));
      expect(res.status).toBe(200);
      expect(invalidateCache).toHaveBeenCalledWith(database);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    }
  );
});

describe("page.created", () => {
  it("revalidates blog indexes on a new blog page", async () => {
    const res = await POST(req(base({ type: "page.created", database: "blog" })));
    expect(res.status).toBe(200);
    expect(invalidateCache).toHaveBeenCalledWith("blog");
    expect(revalidatePath).toHaveBeenCalledWith("/api/blog/posts");
    expect(slackContactNotify).not.toHaveBeenCalled();
  });

  it("notifies Slack when a new docs page carries a title", async () => {
    const res = await POST(
      req(base({ type: "page.created", database: "docs", slug: "new-doc", data: { title: "New Doc" } }))
    );
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(slackContactNotify).toHaveBeenCalledWith(
        expect.objectContaining({ service: "New doc published" })
      )
    );
  });

  it("does not notify Slack for docs pages without a title", async () => {
    const res = await POST(req(base({ type: "page.created", database: "docs" })));
    expect(res.status).toBe(200);
    expect(slackContactNotify).not.toHaveBeenCalled();
  });
});

describe("submission.status", () => {
  it("skips the email when data lacks email or status", async () => {
    const res = await POST(req(base({ type: "submission.status", database: "submissions", data: {} })));
    expect(res.status).toBe(200);
    expect((await res.json()).emailed).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips the email for non-Done statuses", async () => {
    const res = await POST(
      req(base({ type: "submission.status", database: "submissions", data: { email: "a@b.com", status: "In Review" } }))
    );
    expect((await res.json()).emailed).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails the submitter on Done", async () => {
    const res = await POST(
      req(
        base({
          type: "submission.status",
          database: "submissions",
          data: { email: "ada@example.com", name: "Ada", status: "Done" },
        })
      )
    );
    expect(res.status).toBe(200);
    expect((await res.json()).emailed).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com", replyTo: "team@cloudless.gr" })
    );
  });

  it("reports emailed:false when sendEmail throws", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("smtp down"));
    const res = await POST(
      req(
        base({
          type: "submission.status",
          database: "submissions",
          data: { email: "ada@example.com", status: "Done" },
        })
      )
    );
    expect((await res.json()).emailed).toBe(false);
  });
});

describe("project.updated", () => {
  it("notifies Slack on Completed", async () => {
    const res = await POST(
      req(base({ type: "project.updated", database: "projects", data: { name: "Alpha", status: "Completed" } }))
    );
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(slackContactNotify).toHaveBeenCalledWith(
        expect.objectContaining({ service: "Project completed" })
      )
    );
  });

  it("notifies Slack on Blocked", async () => {
    await POST(
      req(base({ type: "project.updated", database: "projects", data: { name: "Alpha", status: "Blocked" } }))
    );
    await vi.waitFor(() =>
      expect(slackContactNotify).toHaveBeenCalledWith(
        expect.objectContaining({ service: "Project blocked" })
      )
    );
  });

  it("stays silent on other statuses", async () => {
    const res = await POST(
      req(base({ type: "project.updated", database: "projects", data: { name: "Alpha", status: "In Progress" } }))
    );
    expect(res.status).toBe(200);
    expect(slackContactNotify).not.toHaveBeenCalled();
  });
});

describe("task.updated", () => {
  it("notifies Slack when a task is Blocked, with assignee", async () => {
    await POST(
      req(
        base({
          type: "task.updated",
          database: "tasks",
          data: { task: "Deploy", status: "Blocked", assignee: "Themis" },
        })
      )
    );
    await vi.waitFor(() =>
      expect(slackContactNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "Task blocked",
          message: expect.stringContaining("Themis"),
        })
      )
    );
  });
});

describe("analytics.event", () => {
  it("notifies Slack on error spikes (>=10)", async () => {
    await POST(
      req(base({ type: "analytics.event", database: "analytics", data: { type: "error", count: 15 } }))
    );
    await vi.waitFor(() =>
      expect(slackContactNotify).toHaveBeenCalledWith(
        expect.objectContaining({ service: "Error spike detected" })
      )
    );
  });

  it("stays silent below the threshold", async () => {
    const res = await POST(
      req(base({ type: "analytics.event", database: "analytics", data: { type: "error", count: 3 } }))
    );
    expect(res.status).toBe(200);
    expect(slackContactNotify).not.toHaveBeenCalled();
  });
});
