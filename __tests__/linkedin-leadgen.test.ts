import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  buildChallengeResponse,
  mapAnswersToFields,
  parseLeadGenFormId,
  parseLeadGenFormResponseId,
  parseSponsoredCampaignId,
  resolveCampaignSlugFromLinkedInCampaignId,
  toEspoLeadDataFromLeadGen,
  verifyLiSignature,
  isLeadCreatedNotification,
} from "@/lib/linkedin-leadgen";

describe("linkedin-leadgen helpers", () => {
  it("builds challengeResponse as hex HMAC-SHA256", () => {
    const code = "890e4665-4dfe-4ab1-b689-ed553bceeed0";
    const secret = "test-secret";
    const expected = createHmac("sha256", secret).update(code).digest("hex");
    expect(buildChallengeResponse(code, secret)).toBe(expected);
  });

  it("verifies X-LI-Signature over hmacsha256= + raw body", () => {
    const secret = "client-secret";
    const raw = JSON.stringify({ type: "LEAD_ACTION" });
    const sig = createHmac("sha256", secret).update(`hmacsha256=${raw}`).digest("hex");
    expect(verifyLiSignature(raw, sig, secret)).toBe(true);
    expect(verifyLiSignature(raw, "deadbeef", secret)).toBe(false);
    expect(verifyLiSignature(raw, null, secret)).toBe(false);
  });

  it("parses URNs", () => {
    expect(parseLeadGenFormResponseId("urn:li:leadGenFormResponse:abc-123")).toBe("abc-123");
    expect(
      parseLeadGenFormId("urn:li:versionedLeadGenForm:(urn:li:leadGenForm:3162,1)")
    ).toBe("3162");
    expect(parseSponsoredCampaignId("urn:li:sponsoredCampaign:857622786")).toBe("857622786");
  });

  it("resolves shop-online from LinkedIn campaign id 857622786", () => {
    expect(resolveCampaignSlugFromLinkedInCampaignId("857622786")).toBe("shop-online");
    expect(resolveCampaignSlugFromLinkedInCampaignId("999")).toBe("linkedin-leadgen");
  });

  it("maps predefined question answers to email/name", () => {
    const mapped = mapAnswersToFields(
      [
        { questionId: 1, answerDetails: { textQuestionAnswer: { answer: "Ada" } } },
        { questionId: 2, answerDetails: { textQuestionAnswer: { answer: "Lovelace" } } },
        {
          questionId: 3,
          answerDetails: { textQuestionAnswer: { answer: "ada@example.com" } },
        },
      ],
      [
        { questionId: 1, predefinedField: "FIRST_NAME" },
        { questionId: 2, questionDetails: { predefinedField: "LAST_NAME" } },
        { questionId: 3, name: "email", predefinedField: "EMAIL" },
      ]
    );
    expect(mapped).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
  });

  it("builds Espo LeadData from a lead form response", () => {
    const lead = toEspoLeadDataFromLeadGen({
      response: {
        id: "resp-1",
        leadMetadata: {
          sponsoredLeadMetadata: { campaign: "urn:li:sponsoredCampaign:857622786" },
        },
        formResponse: {
          answers: [
            {
              questionId: 1,
              answerDetails: { textQuestionAnswer: { answer: "ada@shop.gr" } },
            },
            {
              questionId: 2,
              answerDetails: { textQuestionAnswer: { answer: "Ada" } },
            },
          ],
        },
      },
      questions: [
        { questionId: 1, predefinedField: "EMAIL" },
        { questionId: 2, predefinedField: "FIRST_NAME" },
      ],
      notification: {
        type: "LEAD_ACTION",
        leadGenFormResponse: "urn:li:leadGenFormResponse:resp-1",
        leadAction: "CREATED",
      },
    });
    expect(lead?.emailAddress).toBe("ada@shop.gr");
    expect(lead?.campaignSlug).toBe("shop-online");
    expect(lead?.orderId).toBe("li-leadgen-resp-1");
    expect(lead?.utmSource).toBe("linkedin");
  });

  it("recognizes CREATED lead notifications", () => {
    expect(
      isLeadCreatedNotification({
        type: "LEAD_ACTION",
        leadGenFormResponse: "urn:li:leadGenFormResponse:x",
        leadAction: "CREATED",
      })
    ).toBe(true);
    expect(
      isLeadCreatedNotification({
        type: "LEAD_ACTION",
        leadGenFormResponse: "urn:li:leadGenFormResponse:x",
        leadAction: "DELETED",
      })
    ).toBe(false);
    expect(isLeadCreatedNotification({ type: "OTHER" })).toBe(false);
  });
});

describe("POST /api/webhooks/linkedin-leads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 on bad signature and creates a lead on valid CREATED notification", async () => {
    const secret = "li-client-secret";
    const token = "li-access-token";

    vi.doMock("@/lib/ssm-config", () => ({
      getConfig: vi.fn().mockResolvedValue({
        LINKEDIN_CLIENT_SECRET: secret,
        LINKEDIN_ACCESS_TOKEN: token,
        LINKEDIN_AD_ACCOUNT_ID: "512642510",
        LINKEDIN_CAPI_ACCESS_TOKEN: "",
      }),
    }));

    const mockCreateLead = vi.fn().mockResolvedValue("lead-99");
    vi.doMock("@/lib/espocrm", () => ({
      createLead: (...args: unknown[]) => mockCreateLead(...args),
    }));

    vi.doMock("@/lib/linkedin-leadgen", async () => {
      const actual = await vi.importActual<typeof import("@/lib/linkedin-leadgen")>(
        "@/lib/linkedin-leadgen"
      );
      return {
        ...actual,
        fetchLeadFormResponse: vi.fn().mockResolvedValue({
          id: "resp-9",
          leadMetadata: {
            sponsoredLeadMetadata: { campaign: "urn:li:sponsoredCampaign:857622786" },
          },
          formResponse: {
            answers: [
              {
                questionId: 1,
                answerDetails: { textQuestionAnswer: { answer: "lead@ex.com" } },
              },
            ],
          },
        }),
        fetchLeadFormQuestions: vi.fn().mockResolvedValue([
          { questionId: 1, predefinedField: "EMAIL" },
        ]),
      };
    });

    const { POST, GET } = await import("@/app/api/webhooks/linkedin-leads/route");

    const challenge = await GET(
      new (await import("next/server")).NextRequest(
        "https://cloudless.gr/api/webhooks/linkedin-leads?challengeCode=abc-1"
      )
    );
    expect(challenge.status).toBe(200);
    const challengeJson = (await challenge.json()) as {
      challengeCode: string;
      challengeResponse: string;
    };
    expect(challengeJson.challengeCode).toBe("abc-1");
    expect(challengeJson.challengeResponse).toBe(buildChallengeResponse("abc-1", secret));

    const body = JSON.stringify({
      type: "LEAD_ACTION",
      leadAction: "CREATED",
      leadType: "SPONSORED",
      leadGenFormResponse: "urn:li:leadGenFormResponse:resp-9",
      leadGenForm: "urn:li:versionedLeadGenForm:(urn:li:leadGenForm:1,1)",
      owner: { sponsoredAccount: "urn:li:sponsoredAccount:512642510" },
      occurredAt: 1,
    });

    const bad = await POST(
      new (await import("next/server")).NextRequest(
        "https://cloudless.gr/api/webhooks/linkedin-leads",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-li-signature": "nope" },
          body,
        }
      )
    );
    expect(bad.status).toBe(401);

    const sig = createHmac("sha256", secret).update(`hmacsha256=${body}`).digest("hex");
    const ok = await POST(
      new (await import("next/server")).NextRequest(
        "https://cloudless.gr/api/webhooks/linkedin-leads",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-li-signature": sig },
          body,
        }
      )
    );
    expect(ok.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    const arg = mockCreateLead.mock.calls[0]?.[0] as { emailAddress: string; campaignSlug: string };
    expect(arg.emailAddress).toBe("lead@ex.com");
    expect(arg.campaignSlug).toBe("shop-online");
  });
});
