import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/audit/route";

function req(body: unknown) {
  return new Request("http://localhost/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  name: "Ana",
  email: "ana@x.co",
  goal: "automate lead intake",
  pain: "manual data entry",
  timeline: "next month",
};

describe("/api/audit POST", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("400 on invalid JSON", async () => {
    const res = await POST(req("{oops"));
    expect(res.status).toBe(400);
  });

  it("400 on missing/invalid email", async () => {
    expect((await POST(req({ ...valid, email: "nope" }))).status).toBe(400);
    expect((await POST(req({ ...valid, email: "" }))).status).toBe(400);
  });

  it("400 when a discovery field is missing", async () => {
    for (const key of ["goal", "pain", "timeline"] as const) {
      const body = { ...valid, [key]: "  " };
      expect((await POST(req(body))).status).toBe(400);
    }
  });

  it("forwards a valid lead as form=audit-request", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/leads/public");
    const sent = JSON.parse(init.body as string);
    expect(sent.form).toBe("audit-request");
    expect(sent.interest).toBe("audit");
    expect(sent.email).toBe(valid.email);
    expect(sent.message).toContain(valid.goal);
    expect(sent.message).toContain(valid.pain);
    expect(sent.message).toContain(valid.timeline);
  });

  it("uses the name fallback when name is empty", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await POST(req({ ...valid, name: " " }));
    const sent = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.name).toBe("ana");
  });

  it("502 when the upstream API rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await POST(req(valid))).status).toBe(502);
  });
});
