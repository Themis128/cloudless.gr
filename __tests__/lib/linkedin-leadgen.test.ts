import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildChallengeResponse,
  verifyLiSignature,
  parseLeadGenFormResponseId,
  parseLeadGenFormId,
  parseSponsoredCampaignId,
  resolveCampaignSlugFromLinkedInCampaignId,
  mapAnswersToFields,
  toEspoLeadDataFromLeadGen,
  isLeadCreatedNotification,
  fetchLeadFormResponse,
  fetchLeadFormQuestions,
} from "@/lib/linkedin-leadgen";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  mockFetch.mockReset();
});

describe("signature + challenge helpers", () => {
  it("builds and verifies the HMAC round-trip", () => {
    const resp = buildChallengeResponse("abc123", "secret");
    expect(resp).toMatch(/^[0-9a-f]{64}$/);
    const body = JSON.stringify({ x: 1 });
    const expected = buildChallengeResponse(`hmacsha256=${body}`, "secret");
    expect(verifyLiSignature(body, expected, "secret")).toBe(true);
    expect(verifyLiSignature(body, "deadbeef", "secret")).toBe(false);
    expect(verifyLiSignature(body, null, "secret")).toBe(false);
    expect(verifyLiSignature(body, expected, "")).toBe(false);
  });
});

describe("URN parsers", () => {
  it("parses lead-gen response / form / campaign urns and rejects junk", () => {
    expect(parseLeadGenFormResponseId("urn:li:leadGenFormResponse:Ab_12-3")).toBe("Ab_12-3");
    expect(parseLeadGenFormResponseId("urn:li:leadGenFormResponse:bad id")).toBeNull();
    expect(parseLeadGenFormResponseId("urn:li:other:1")).toBeNull();
    expect(parseLeadGenFormResponseId(undefined)).toBeNull();
    expect(parseLeadGenFormId("urn:li:leadGenForm:3162")).toBe("3162");
    expect(parseLeadGenFormId("urn:li:versionedLeadGenForm:(urn:li:leadGenForm:77,1)")).toBe("77");
    expect(parseLeadGenFormId("urn:li:x")).toBeNull();
    expect(parseLeadGenFormId(undefined)).toBeNull();
    expect(parseSponsoredCampaignId("urn:li:sponsoredCampaign:907100946")).toBe("907100946");
    expect(parseSponsoredCampaignId(undefined)).toBeNull();
  });

  it("resolves the configured campaign slug and falls back", () => {
    // Live campaign config maps 907100946 → shop-online.
    expect(resolveCampaignSlugFromLinkedInCampaignId("907100946")).toBe("shop-online");
    expect(resolveCampaignSlugFromLinkedInCampaignId("999999999")).toBe("linkedin-leadgen");
    expect(resolveCampaignSlugFromLinkedInCampaignId(null)).toBe("linkedin-leadgen");
  });
});

describe("mapAnswersToFields", () => {
  const questions = [
    { questionId: 1, predefinedField: "EMAIL" },
    { questionId: 2, predefinedField: "FIRST_NAME" },
    { questionId: 3, predefinedField: "LAST_NAME" },
    { questionId: 4, questionDetails: { predefinedField: "PHONE_NUMBER" } },
    { questionId: 5, name: "COMPANY_NAME" },
    { questionId: 6, name: "Role?" },
  ];
  const answer = (questionId: number, text: string) => ({
    questionId,
    answerDetails: { textQuestionAnswer: { answer: text } },
  });

  it("maps predefined fields and collects extras", () => {
    const out = mapAnswersToFields(
      [
        answer(1, " A@B.CO "),
        answer(2, "Jane"),
        answer(3, "Doe"),
        answer(4, "+30 123"),
        answer(5, "Acme"),
        answer(6, "CTO"),
        { answerDetails: { textQuestionAnswer: { answer: "" } } },
        { answerDetails: { multipleChoiceAnswer: { options: [1] } } },
      ],
      questions
    );
    expect(out.email).toBe("a@b.co");
    expect(out.firstName).toBe("Jane");
    expect(out.lastName).toBe("Doe");
    expect(out.phone).toBe("+30 123");
    expect(out.company).toBe("Acme");
    expect(out.extras).toEqual(["Role?: CTO"]);
  });

  it("infers an email-shaped answer when the field is unlabelled", () => {
    const out = mapAnswersToFields([answer(9, "x@y.zw")], []);
    expect(out.email).toBe("x@y.zw");
    expect(out.extras[0]).toBeUndefined();
    const out2 = mapAnswersToFields([{ answerDetails: { textQuestionAnswer: { answer: "hi" } } }], []);
    expect(out2.extras[0]).toBe("q?: hi");
  });
});

describe("toEspoLeadDataFromLeadGen", () => {
  it("builds the LeadData with campaign attribution and extras", () => {
    const lead = toEspoLeadDataFromLeadGen({
      response: {
        id: "r1",
        testLead: true,
        formResponse: {
          answers: [
            {
              questionId: 1,
              answerDetails: { textQuestionAnswer: { answer: "lead@x.co" } },
            },
            {
              questionId: 2,
              answerDetails: { textQuestionAnswer: { answer: "BigCo" } },
            },
          ],
        },
        leadMetadata: {
          sponsoredLeadMetadata: { campaign: "urn:li:sponsoredCampaign:907100946" },
        },
      },
      questions: [
        { questionId: 1, predefinedField: "EMAIL" },
        { questionId: 2, name: "Company" },
      ],
      notification: { leadGenForm: "urn:li:leadGenForm:1" },
    });
    expect(lead).toMatchObject({
      emailAddress: "lead@x.co",
      source: "Other",
      campaignSlug: "shop-online",
      orderId: "li-leadgen-r1",
      utmSource: "linkedin",
      utmMedium: "leadgen_form",
      utmCampaign: "shop-online",
    });
    expect(lead?.description).toContain("Test lead: true");
    expect(lead?.description).toContain("LinkedIn campaign");
    expect(lead?.description).toContain("Company: BigCo");
  });

  it("returns null without an email and derives responseId from the notification", () => {
    expect(
      toEspoLeadDataFromLeadGen({ response: {}, questions: [] })
    ).toBeNull();
    const lead = toEspoLeadDataFromLeadGen({
      response: {
        formResponse: {
          answers: [
            { questionId: 1, answerDetails: { textQuestionAnswer: { answer: "a@b.c" } } },
          ],
        },
      },
      questions: [{ questionId: 1, predefinedField: "EMAIL" }],
      notification: { leadGenFormResponse: "urn:li:leadGenFormResponse:z9" },
    });
    expect(lead?.orderId).toBe("li-leadgen-z9");
    expect(lead?.campaignSlug).toBe("linkedin-leadgen");
  });
});

describe("isLeadCreatedNotification", () => {
  it("accepts LEAD_ACTION with CREATED or missing action, rejects the rest", () => {
    expect(
      isLeadCreatedNotification({
        type: "LEAD_ACTION",
        leadAction: "CREATED",
        leadGenFormResponse: "urn:x",
      })
    ).toBe(true);
    expect(
      isLeadCreatedNotification({ type: "LEAD_ACTION", leadGenFormResponse: "urn:x" })
    ).toBe(true);
    expect(
      isLeadCreatedNotification({
        type: "LEAD_ACTION",
        leadAction: "DELETED",
        leadGenFormResponse: "urn:x",
      })
    ).toBe(false);
    expect(isLeadCreatedNotification({ type: "OTHER", leadGenFormResponse: "urn:x" })).toBe(false);
    expect(isLeadCreatedNotification(null)).toBe(false);
    expect(isLeadCreatedNotification("x")).toBe(false);
  });
});

describe("fetchLeadFormResponse", () => {
  it("rejects a webhook-controlled id that fails the whitelist", async () => {
    expect(await fetchLeadFormResponse({ responseId: "bad id", token: "t" })).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("prefers the owner-scoped batch finder and returns its hit", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ results: { r1: { id: "r1" } } }));
    const out = await fetchLeadFormResponse({
      responseId: "r1",
      token: "t",
      ownerSponsoredAccount: "urn:li:sponsoredAccount:1",
    });
    expect(out).toEqual({ id: "r1" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("leadFormResponses?ids=");
    expect(url).toContain("owner=");
    expect(url).toContain("leadType=");
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
  });

  it("falls back to the single fetch when the batch misses", async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ results: {} }))
      .mockResolvedValueOnce(okJson({ id: "r1", testLead: false }));
    const out = await fetchLeadFormResponse({
      responseId: "r1",
      token: "t",
      ownerSponsoredAccount: "urn:li:sponsoredAccount:1",
    });
    expect(out?.id).toBe("r1");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null on non-ok and on unparseable bodies", async () => {
    mockFetch.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    expect(await fetchLeadFormResponse({ responseId: "r1", token: "t" })).toBeNull();
    mockFetch.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    expect(await fetchLeadFormResponse({ responseId: "r1", token: "t" })).toBeNull();
  });
});

describe("fetchLeadFormQuestions", () => {
  it("rejects bad ids and non-ok responses", async () => {
    expect(await fetchLeadFormQuestions({ formId: "a b", token: "t" })).toEqual([]);
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await fetchLeadFormQuestions({ formId: "f1", token: "t" })).toEqual([]);
  });

  it("reads questions at top level or under content, with owner params", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ questions: [{ questionId: 1 }] }));
    expect(await fetchLeadFormQuestions({ formId: "f1", token: "t" })).toHaveLength(1);
    mockFetch.mockResolvedValueOnce(okJson({ content: { questions: [{ questionId: 2 }] } }));
    const out = await fetchLeadFormQuestions({
      formId: "f1",
      token: "t",
      ownerSponsoredAccount: "urn:li:sponsoredAccount:1",
      leadType: "ORGANIC",
    });
    expect(out[0].questionId).toBe(2);
    expect(mockFetch.mock.calls[1][0] as string).toContain("leadType=");
    mockFetch.mockResolvedValueOnce(okJson({}));
    expect(await fetchLeadFormQuestions({ formId: "f1", token: "t" })).toEqual([]);
  });
});
