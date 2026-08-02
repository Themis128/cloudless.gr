/**
 * Extended tests for modal view_submission handlers added in the Slack bot upgrade:
 *   create-ticket-modal  — posts ticket card to #contacts
 *   deploy-confirm-modal — dispatches GitHub Actions workflow, notifies #deployments
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerify = vi.fn();

vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((_reason: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));

vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: vi.fn().mockReturnValue(true),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: vi.fn(async () => ({
    SLACK_BOT_TOKEN: "xoxb-test-token",
    SLACK_WEBHOOK_URL: undefined,
    SLACK_SIGNING_SECRET: "test-secret",
  })),
  resetSlackConfigCache: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: vi.fn(async () => ({ orders: [], hasMore: false })),
  formatPrice: vi.fn((amount: number) => `€${(amount / 100).toFixed(2)}`),
}));

// Hoist SSM config mock
const { getConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyOk(payloadJson: object) {
  const body = new URLSearchParams({
    payload: JSON.stringify(payloadJson),
  }).toString();
  mockVerify.mockResolvedValue({ ok: true, body });
}

function setGithubToken(token: string) {
  getConfigMock.mockResolvedValue({ GITHUB_TOKEN: token });
}

function makeRequest(payloadJson: object): Request {
  const body = new URLSearchParams({
    payload: JSON.stringify(payloadJson),
  }).toString();
  return new Request("http://localhost/api/slack/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-slack-signature": "v0=test",
    },
    body,
  });
}

const baseUser = { id: "U123", username: "themis" };

/** Builds a minimal view_submission payload for create-ticket-modal */
function ticketSubmission(overrides: Record<string, string> = {}) {
  return {
    type: "view_submission",
    user: baseUser,
    view: {
      callback_id: "create-ticket-modal",
      private_metadata: "",
      state: {
        values: {
          ticket_email: {
            ticket_email_input: { value: overrides.email ?? "customer@example.com" },
          },
          ticket_issue_type: {
            ticket_issue_type_select: {
              selected_option: { value: overrides.issue_type ?? "bug" },
            },
          },
          ticket_priority: {
            ticket_priority_select: {
              selected_option: { value: overrides.priority ?? "high" },
            },
          },
          ticket_description: {
            ticket_description_input: {
              value: overrides.description ?? "The checkout page crashes on mobile.",
            },
          },
        },
      },
    },
  };
}

/** Builds a view_submission payload for deploy-confirm-modal */
function deploySubmission(
  opts: {
    releaseNotes?: string;
    userId?: string;
    userName?: string;
  } = {}
) {
  return {
    type: "view_submission",
    user: { id: opts.userId ?? "U123", username: opts.userName ?? "themis" },
    view: {
      callback_id: "deploy-confirm-modal",
      private_metadata: JSON.stringify({
        user_id: opts.userId ?? "U123",
        user_name: opts.userName ?? "themis",
      }),
      state: {
        values: {
          deploy_notes: {
            deploy_notes_input: {
              value: opts.releaseNotes ?? null,
            },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: create-ticket-modal submission
// ---------------------------------------------------------------------------

describe("view_submission: create-ticket-modal", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // chat.postMessage succeeds
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const mod = await import("@/app/api/slack/interactions/route");
    POST = mod.POST;
  });

  it("returns 200 immediately (async processing)", async () => {
    verifyOk(ticketSubmission());
    const response = await POST(makeRequest(ticketSubmission()));
    expect(response.status).toBe(200);
  });

  it("posts ticket to Slack with correct channel (#contacts)", async () => {
    const payload = ticketSubmission({ email: "vip@example.com", priority: "high" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    // Allow async handler to complete
    await new Promise((r) => setTimeout(r, 50));

    const postCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body as string) as {
      channel: string;
      blocks: Array<{ type: string }>;
    };
    expect(body.channel).toBe("#contacts");
  });

  it("ticket message includes customer email", async () => {
    const payload = ticketSubmission({ email: "vip@example.com" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const postCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    const body = JSON.parse(postCall![1].body as string) as { blocks: unknown[] };
    expect(JSON.stringify(body.blocks)).toContain("vip@example.com");
  });

  it("ticket message reflects high priority with red emoji", async () => {
    const payload = ticketSubmission({ priority: "high" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const postCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    const bodyStr = postCall![1].body as string;
    // :red_circle: for high priority
    expect(bodyStr).toContain("red_circle");
  });

  it("ticket message reflects low priority with white emoji", async () => {
    const payload = ticketSubmission({ priority: "low" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const postCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    const bodyStr = postCall![1].body as string;
    expect(bodyStr).toContain("white_circle");
  });

  it("escapes malicious content in email field", async () => {
    const payload = ticketSubmission({ email: "<script>alert('xss')</script>" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const postCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    const bodyStr = postCall![1].body as string;
    expect(bodyStr).not.toContain("<script>");
    expect(bodyStr).toContain("&lt;script&gt;");
  });

  it("includes the submitting Slack user in the ticket", async () => {
    const payload = { ...ticketSubmission(), user: { id: "U999", username: "alice" } };
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const postCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    const bodyStr = postCall![1].body as string;
    expect(bodyStr).toContain("U999");
  });
});

// ---------------------------------------------------------------------------
// Tests: deploy-confirm-modal submission
// ---------------------------------------------------------------------------

describe("view_submission: deploy-confirm-modal", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: all fetches succeed, GitHub token configured
    setGithubToken("ghp_test_token");
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const mod = await import("@/app/api/slack/interactions/route");
    POST = mod.POST;
  });

  it("returns 200 immediately (async processing)", async () => {
    verifyOk(deploySubmission());
    const response = await POST(makeRequest(deploySubmission()));
    expect(response.status).toBe(200);
  });

  it("posts 'Deploy Started' to #deployments", async () => {
    const payload = deploySubmission({ releaseNotes: "v1.5 — new features" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const deployPost = mockFetch.mock.calls.find((c) => {
      const url = c[0] as string;
      const body = c[1]?.body as string;
      return url.includes("chat.postMessage") && body?.includes("deployments");
    });
    expect(deployPost).toBeDefined();
    const bodyStr = deployPost![1].body as string;
    expect(bodyStr).toMatch(/Deploy Started|Deploy started|rocket/i);
  });

  it("includes release notes in the deploy message when provided", async () => {
    const payload = deploySubmission({ releaseNotes: "Hotfix: fix payment crash" });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const deployPost = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    expect(deployPost![1].body as string).toContain("Hotfix: fix payment crash");
  });

  it("calls GitHub Actions workflow dispatch API", async () => {
    setGithubToken("ghp_test_token");

    const payload = deploySubmission();
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    // codeql[js/incomplete-url-scheme-check] -- test assertion on mock fetch call args, not URL sanitization
    const githubCall = mockFetch.mock.calls.find(
      (c) => new URL(c[0] as string).hostname === "api.github.com"
    );
    expect(githubCall).toBeDefined();
    expect(githubCall![0]).toContain("dispatches");
  });

  it("posts error to #deployments when GITHUB_TOKEN is missing", async () => {
    setGithubToken("");

    const payload = deploySubmission();
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    // Should not call GitHub at all
    // codeql[js/incomplete-url-scheme-check] -- test assertion on mock fetch call args, not URL sanitization
    const githubCall = mockFetch.mock.calls.find(
      (c) => new URL(c[0] as string).hostname === "api.github.com"
    );
    expect(githubCall).toBeUndefined();

    // Should post error to Slack instead
    const errorPost = mockFetch.mock.calls.find((c) => {
      const body = (c[1]?.body as string) ?? "";
      return body.includes("GITHUB_TOKEN");
    });
    expect(errorPost).toBeDefined();
  });

  it("posts failure message when GitHub returns non-2xx", async () => {
    setGithubToken("ghp_test_token");

    // First fetch (deploy started Slack post) succeeds, GitHub returns 422
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response("Unprocessable Entity", { status: 422 }))
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const payload = deploySubmission();
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    // Should post failure back to Slack
    const failPost = mockFetch.mock.calls.find((c) => {
      const body = (c[1]?.body as string) ?? "";
      return body.includes("failed") || body.includes("422");
    });
    expect(failPost).toBeDefined();
  });

  it("recovers user identity from private_metadata", async () => {
    setGithubToken("ghp_test_token");

    const payload = deploySubmission({
      userId: "U777",
      userName: "deployer_bob",
    });
    verifyOk(payload);

    await POST(makeRequest(payload));
    await new Promise((r) => setTimeout(r, 50));

    const deployPost = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("chat.postMessage")
    );
    expect(deployPost![1].body as string).toContain("U777");
  });
});
