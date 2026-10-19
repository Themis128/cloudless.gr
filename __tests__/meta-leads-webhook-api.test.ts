import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(),
}));

const mockCreateLead = vi.fn();
vi.mock("@/lib/espocrm", () => ({
  createLead: (...args: unknown[]) => mockCreateLead(...args),
}));

import { getConfig } from "@/lib/ssm-config";
import {
  extractLeadgenChanges,
  fetchLeadgenLead,
  toEspoLeadDataFromMeta,
  verifyHubSignature,
} from "@/lib/meta-leadgen";
import { GET, POST } from "@/app/api/webhooks/meta-leads/route";

const APP_SECRET = "meta-app-secret";
const VERIFY_TOKEN = "meta-verify-token";
const PAGE_TOKEN = "page-access-token";

function cfg(over: Record<string, string> = {}) {
  vi.mocked(getConfig).mockResolvedValue({
    META_APP_SECRET: APP_SECRET,
    META_LEADS_VERIFY_TOKEN: VERIFY_TOKEN,
    META_ACCESS_TOKEN: PAGE_TOKEN,
    ...over,
  } as never);
}

function sign(body: string, secret = APP_SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

function post(body: string, signature?: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature != null) headers["x-hub-signature-256"] = signature;
  return new NextRequest("https://cloudless.gr/api/webhooks/meta-leads", {
    method: "POST",
    headers,
    body,
  });
}

function leadgenPayload(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    object: "page",
    entry: [
      {
        id: "page-1",
        time: 1760000000,
        changes: [
          {
            field: "leadgen",
            value: { leadgen_id: "lg-1", page_id: "page-1", form_id: "form-9", ...over },
          },
        ],
      },
    ],
  });
}

const GRAPH_LEAD = {
  id: "lg-1",
  form_id: "form-9",
  ad_id: "ad-3",
  campaign_name: "Checklist Q4",
  platform: "fb",
  field_data: [
    { name: "email", values: ["Ada@Example.COM"] },
    { name: "full_name", values: ["Ada Lovelace"] },
    { name: "phone_number", values: ["+30 691"] },
    { name: "company", values: ["Acme"] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  cfg();
  mockCreateLead.mockResolvedValue("lead-1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => GRAPH_LEAD }))
  );
});

describe("GET verification handshake", () => {
  it("echoes hub.challenge when mode+token match", async () => {
    const res = await GET(
      new NextRequest(
        "https://cloudless.gr/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=meta-verify-token&hub.challenge=CH-42"
      )
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("CH-42");
  });

  it("returns 503 when no verify token configured and 403 on mismatch", async () => {
    cfg({ META_LEADS_VERIFY_TOKEN: "" });
    const url =
      "https://cloudless.gr/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=x&hub.challenge=c";
    expect((await GET(new NextRequest(url))).status).toBe(503);

    cfg();
    expect((await GET(new NextRequest(url))).status).toBe(403);
  });
});

describe("POST signature + config guards", () => {
  it("503 without app secret, 401 without/invalid signature", async () => {
    cfg({ META_APP_SECRET: "" });
    expect((await POST(post(leadgenPayload(), sign(leadgenPayload())))).status).toBe(503);

    cfg();
    expect((await POST(post(leadgenPayload()))).status).toBe(401);
    expect((await POST(post(leadgenPayload(), sign(leadgenPayload(), "wrong")))).status).toBe(401);
  });

  it("400 on invalid JSON even when correctly signed", async () => {
    expect((await POST(post("{broken", sign("{broken")))).status).toBe(400);
  });

  it("acks non-leadgen payloads without touching Graph or CRM", async () => {
    const body = JSON.stringify({ object: "page", entry: [{ changes: [{ field: "feed" }] }] });
    const res = await POST(post(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, results: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(mockCreateLead).not.toHaveBeenCalled();
  });

  it("acks with token_missing warning when access token is absent", async () => {
    cfg({ META_ACCESS_TOKEN: "" });
    const body = leadgenPayload();
    const res = await POST(post(body, sign(body)));
    expect(res.status).toBe(200);
    expect((await res.json()).warning).toBe("token_missing");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST leadgen processing", () => {
  it("fetches the lead from Graph and writes a Meta Lead Ad to EspoCRM", async () => {
    const body = leadgenPayload();
    const res = await POST(post(body, sign(body)));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([{ ok: true, espocrm_lead_id: "lead-1", leadgen_id: "lg-1" }]);

    const [url] = vi.mocked(fetch).mock.calls[0] as [URL];
    expect(String(url)).toContain("/lg-1");
    expect(String(url)).toContain(`access_token=${PAGE_TOKEN}`);

    const lead = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(lead.emailAddress).toBe("ada@example.com");
    expect(lead.firstName).toBe("Ada");
    expect(lead.lastName).toBe("Lovelace");
    expect(lead.phoneNumber).toBe("+30 691");
    expect(lead.source).toBe("Meta Lead Ad");
    expect(lead.utmSource).toBe("facebook");
    expect(lead.utmMedium).toBe("paid");
    expect(lead.utmCampaign).toBe("Checklist Q4");
    expect(lead.targetListNames).toEqual(["Meta lead ads"]);
    expect(String(lead.description)).toContain("company: Acme");
  });

  it("returns ok:false when Graph fetch fails or the lead has no email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400 }))
    );
    let res = await POST(post(leadgenPayload(), sign(leadgenPayload())));
    expect((await res.json()).results[0].ok).toBe(false);
    expect(mockCreateLead).not.toHaveBeenCalled();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "lg-1", field_data: [{ name: "phone", values: ["1"] }] }),
      }))
    );
    res = await POST(post(leadgenPayload(), sign(leadgenPayload())));
    expect((await res.json()).results[0].reason).toBe("no_email");
    expect(mockCreateLead).not.toHaveBeenCalled();
  });
});

describe("meta-leadgen mapping", () => {
  it("splits full_name, prefers explicit first/last, maps IG platform + organic", () => {
    const explicit = toEspoLeadDataFromMeta(
      {
        id: "lg-2",
        platform: "ig",
        is_organic: true,
        field_data: [
          { name: "email", values: ["b@c.gr"] },
          { name: "first_name", values: ["Grace"] },
          { name: "last_name", values: ["Hopper"] },
          { name: "full_name", values: ["Dr Grace Hopper"] },
        ],
      },
      { leadgen_id: "lg-2" }
    );
    expect(explicit?.firstName).toBe("Grace");
    expect(explicit?.lastName).toBe("Hopper");
    expect(explicit?.utmSource).toBe("instagram");
    expect(explicit?.utmMedium).toBe("social");
    expect(String(explicit?.description)).toContain("Organic lead");

    const split = toEspoLeadDataFromMeta(
      { id: "lg-3", field_data: [{ name: "email", values: ["x@y.z"] }] },
      { leadgen_id: "lg-3", form_id: "f1" }
    );
    expect(split?.campaignSlug).toBe("meta-lead-f1");
    expect(split?.orderId).toBe("meta-leadgen-lg-3");
  });
});

describe("verifyHubSignature / extractLeadgenChanges", () => {
  it("accepts a correct sha256 signature and rejects tampered bodies", () => {
    const body = leadgenPayload();
    expect(verifyHubSignature(body, sign(body), APP_SECRET)).toBe(true);
    expect(verifyHubSignature(body + " ", sign(body), APP_SECRET)).toBe(false);
    expect(verifyHubSignature(body, null, APP_SECRET)).toBe(false);
    expect(verifyHubSignature(body, sign(body), "")).toBe(false);
    expect(verifyHubSignature(body, "sha256=not-hex!", APP_SECRET)).toBe(false);
  });

  it("extracts only page/leadgen changes with a leadgen_id", () => {
    expect(extractLeadgenChanges(null)).toEqual([]);
    expect(extractLeadgenChanges({ object: "user", entry: [] })).toEqual([]);
    const changes = extractLeadgenChanges({
      object: "page",
      entry: [
        {
          changes: [
            { field: "feed", value: {} },
            { field: "leadgen", value: {} },
          ],
        },
        { changes: [{ field: "leadgen", value: { leadgen_id: "lg-9" } }] },
      ],
    });
    expect(changes).toEqual([{ leadgen_id: "lg-9" }]);
  });

  it("fetchLeadgenLead returns null on HTTP error and network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 }))
    );
    expect(await fetchLeadgenLead("lg-x", "tok")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      })
    );
    expect(await fetchLeadgenLead("lg-x", "tok")).toBeNull();
  });
});
