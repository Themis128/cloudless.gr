/**
 * Tests for GET /api/cron/voice-brief — Phase 3 voice-brief agent.
 *
 * Covers:
 *   - cron auth gate
 *   - agent path: agent invoked, brief persisted to SSM, Slack notified
 *   - failures in persist / Slack don't break the response (best-effort)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockRunAgent,
  mockGetSeo,
  mockIsHubSpot,
  mockPipeline,
  mockSubscribers,
  mockGetStripe,
  mockSSMSend,
  mockSlackPost,
  mockFetch,
  mockGetConfig,
  mockIsCronAuthorized,
} = vi.hoisted(() => ({
  mockRunAgent: vi.fn(),
  mockGetSeo: vi.fn(),
  mockIsHubSpot: vi.fn(),
  mockPipeline: vi.fn(),
  mockSubscribers: vi.fn(),
  mockGetStripe: vi.fn(),
  mockSSMSend: vi.fn(),
  mockSlackPost: vi.fn(),
  mockFetch: vi.fn(),
  mockGetConfig: vi.fn(),
  mockIsCronAuthorized: vi.fn(),
}));

vi.mock("@/lib/agent-voice-brief", () => ({
  runVoiceBriefAgent: (...args: unknown[]) => mockRunAgent(...args),
}));

vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: (...args: unknown[]) => mockGetSeo(...args),
}));

vi.mock("@/lib/espocrm", () => ({
  isEspoCRMConfigured: (...args: unknown[]) => mockIsHubSpot(...args),
  getPipelineStats: (...args: unknown[]) => mockPipeline(...args),
  listNewsletterSubscribers: (...args: unknown[]) => mockSubscribers(...args),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: (...args: unknown[]) => mockGetStripe(...args),
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn(function (this: { post: unknown }) {
    this.post = mockSlackPost;
  }),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
}));

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: (...args: unknown[]) => mockIsCronAuthorized(...args),
  cronUnauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

vi.mock("@aws-sdk/client-ssm", () => {
  function SSMClient(this: { send: unknown }) {
    this.send = mockSSMSend;
  }
  return {
    SSMClient,
    PutParameterCommand: vi.fn((input: unknown) => ({ __cmd: "Put", input })),
  };
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VOICE_BRIEF_ROUTE = "@/app/api/cron/voice-brief/route";

function authedRequest(url = "http://localhost/api/cron/voice-brief") {
  return new NextRequest(url, {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockIsCronAuthorized.mockResolvedValue(true);
  mockGetConfig.mockResolvedValue({
    ANTHROPIC_API_KEY: "test-anthropic-key",
    AWS_REGION: "eu-central-1",
    STRIPE_SECRET_KEY: "sk_test_x",
    GOOGLE_CLIENT_EMAIL: "svc@example.iam",
    GOOGLE_PRIVATE_KEY: "fake-key",
  });
  mockSSMSend.mockResolvedValue({});
  mockSlackPost.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/cron/voice-brief", () => {
  it("returns 401 when cron auth fails", async () => {
    mockIsCronAuthorized.mockResolvedValueOnce(false);
    const { GET } = await import(VOICE_BRIEF_ROUTE);
    const res = await GET(authedRequest());
    expect(res.status).toBe(401);
  });

  describe("agent mode (default)", () => {
    it("invokes the agent, persists to SSM, posts Slack summary", async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: "This week we landed three new deals and shipped two features.",
        sources: [
          { name: "get_pipeline_stats", status: "ok", detail: "3 deals" },
          { name: "get_seo_metrics", status: "skipped", detail: "no data" },
        ],
      });

      const { GET } = await import(VOICE_BRIEF_ROUTE);
      const res = await GET(authedRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.text).toContain("three new deals");
      expect(body.sources).toHaveLength(2);
      // The `mode` field was removed when the legacy path was deleted.
      // Lock the contract: response keys are exactly text + sources + generatedAt.
      expect(body).not.toHaveProperty("mode");
      expect(Object.keys(body).sort()).toEqual(["generatedAt", "sources", "text"].sort());

      expect(mockRunAgent).toHaveBeenCalledOnce();
      expect(mockSlackPost).toHaveBeenCalledOnce();

      const slackPayload = mockSlackPost.mock.calls[0][0];
      expect(slackPayload.text).toContain("Weekly voice brief");
      // No more "(agent)" or "(legacy)" suffix on the Slack header.
      expect(slackPayload.text).not.toMatch(/\(agent\)|\(legacy\)/);
      // The brief text and a per-source breakdown should both be in the blocks.
      const blockText = JSON.stringify(slackPayload.blocks);
      expect(blockText).toContain("three new deals");
      expect(blockText).toContain("get_pipeline_stats");
      // The legacy fallback string is gone.
      expect(blockText).not.toContain("no per-source breakdown");
    });

    it("?legacy=true URL param has no effect (legacy path was removed)", async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: "Same agent output regardless of URL params.",
        sources: [{ name: "get_pipeline_stats", status: "ok" }],
      });

      const { GET } = await import(VOICE_BRIEF_ROUTE);
      const res = await GET(authedRequest("http://localhost/api/cron/voice-brief?legacy=true"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.text).toBe("Same agent output regardless of URL params.");
      // Confirm the route reached the agent and not a legacy branch.
      expect(mockRunAgent).toHaveBeenCalledOnce();
      // The legacy path used to call the Anthropic API directly via global fetch.
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("still returns 200 if persistBrief throws (best-effort)", async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: "brief text",
        sources: [],
      });
      mockSSMSend.mockRejectedValueOnce(new Error("ssm down"));

      const { GET } = await import(VOICE_BRIEF_ROUTE);
      const res = await GET(authedRequest());

      expect(res.status).toBe(200);
      // Slack still fires even if SSM blew up.
      expect(mockSlackPost).toHaveBeenCalledOnce();
    });

    it("does not break the response when Slack post fails", async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: "brief",
        sources: [],
      });
      mockSlackPost.mockRejectedValueOnce(new Error("slack down"));

      const { GET } = await import(VOICE_BRIEF_ROUTE);
      const res = await GET(authedRequest());

      expect(res.status).toBe(200);
    });
  });
});
