/**
 * Tests for src/lib/k8s-cluster.ts and src/lib/cal-com.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: fs.existsSync,
      readFileSync: fs.readFileSync,
    },
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
  };
});

const undici = vi.hoisted(() => ({
  fetch: vi.fn(),
}));
vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return { ...actual, fetch: undici.fetch };
});

const cfg = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => cfg.values),
}));

import {
  isInCluster,
  getCurrentNamespace,
  k8sPost,
  listWatchdogCronJobs,
} from "@/lib/k8s-cluster";
import {
  getAvailableSlots,
  bookConsultation,
  getUpcomingConsultations,
  getConsultationsByEmail,
} from "@/lib/cal-com";

describe("k8s-cluster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue("token-value\n");
    undici.fetch.mockReset();
  });

  it("isInCluster/getCurrentNamespace short-circuit outside a pod", () => {
    expect(isInCluster()).toBe(false);
    expect(getCurrentNamespace()).toBeNull();
  });

  it("reads namespace inside a pod; null on read failure", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("monitoring\n");
    expect(getCurrentNamespace()).toBe("monitoring");
    fs.readFileSync.mockImplementation(() => {
      throw new Error("no file");
    });
    expect(getCurrentNamespace()).toBeNull();
  });

  it("k8sPost 501s outside a cluster", async () => {
    const res = await k8sPost("/x", {});
    expect(res).toEqual({ ok: false, status: 501, error: "not running in a k8s pod" });
  });

  it("k8sPost posts with bearer token; surfaces non-2xx and network errors", async () => {
    fs.existsSync.mockReturnValue(true);
    undici.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"created":true}',
    });
    const res = await k8sPost("/apis/v1/x", { a: 1 });
    expect(res).toEqual({ ok: true, data: { created: true } });
    const init = undici.fetch.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer token-value");

    undici.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    });
    expect(await k8sPost("/x", {})).toEqual({
      ok: false,
      status: 403,
      error: "forbidden",
    });

    undici.fetch.mockRejectedValue(new Error("dns fail"));
    expect(await k8sPost("/x", {})).toEqual({
      ok: false,
      status: 502,
      error: "dns fail",
    });

    undici.fetch.mockRejectedValue("string-err");
    expect(await k8sPost("/x", {})).toEqual({
      ok: false,
      status: 502,
      error: "string-err",
    });
  });

  it("listWatchdogCronJobs returns [] outside cluster / without items", async () => {
    expect(await listWatchdogCronJobs(["a"])).toEqual([]);

    fs.existsSync.mockReturnValue(true);
    undici.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await listWatchdogCronJobs(["a"])).toEqual([]);

    undici.fetch.mockRejectedValue(new Error("net"));
    expect(await listWatchdogCronJobs(["a"])).toEqual([]);
  });

  it("summarizes cronjobs with latest-job failure detection and ordering", async () => {
    fs.existsSync.mockReturnValue(true);
    undici.fetch.mockImplementation(async (url: string) => {
      const body = url.includes("/cronjobs")
        ? {
            items: [
              {
                metadata: { name: "omv-disk-watchdog" },
                spec: { schedule: "*/5 * * * *", suspend: true },
                status: { lastScheduleTime: "t1", lastSuccessfulTime: "t0" },
              },
              {
                metadata: { name: "cluster-alerts" },
                spec: { schedule: "* * * * *" },
                status: {},
              },
              { metadata: { name: "unwanted" }, spec: {} },
              { spec: {} }, // nameless
            ],
          }
        : {
            items: [
              {
                metadata: {
                  name: "j1",
                  ownerReferences: [{ kind: "CronJob", name: "cluster-alerts" }],
                  creationTimestamp: "2026-01-01",
                },
                status: { succeeded: 1 },
              },
              {
                metadata: {
                  name: "j2",
                  ownerReferences: [{ kind: "CronJob", name: "cluster-alerts" }],
                  creationTimestamp: "2026-01-02",
                },
                status: { failed: 2, succeeded: 0 },
              },
              {
                metadata: {
                  name: "j3",
                  ownerReferences: [{ kind: "Job", name: "nested" }],
                },
              },
              { metadata: { name: "j4" } }, // no owner refs
            ],
          };
      return { ok: true, json: async () => body };
    });

    const out = await listWatchdogCronJobs(["cluster-alerts", "omv-disk-watchdog"]);
    expect(out.map((c) => c.name)).toEqual(["cluster-alerts", "omv-disk-watchdog"]);
    expect(out[0].lastRunFailed).toBe(true); // latest job j2 failed
    expect(out[1].lastRunFailed).toBeNull(); // no jobs for it
    expect(out[1].suspended).toBe(true);
    expect(out[1].schedule).toBe("*/5 * * * *");
  });
});

describe("cal-com", () => {
  const jsonRes = (body: unknown, ok = true, status = 200) =>
    ({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    cfg.values = { CAL_API_KEY: "cal-key" };
    delete process.env.CAL_API_KEY;
    delete process.env.CAL_EVENT_TYPE_ID;
    vi.stubGlobal("fetch", vi.fn());
  });

  it("getAvailableSlots throws without a key", async () => {
    cfg.values = {};
    await expect(getAvailableSlots()).rejects.toThrow("not configured");
  });

  it("getAvailableSlots flattens and sorts slots by day", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonRes({
        status: "success",
        data: {
          slots: {
            "2026-01-02": [{ time: "2026-01-02T10:00:00Z" }],
            "2026-01-01": [{ time: "2026-01-01T09:00:00Z" }],
          },
        },
      })
    );
    const slots = await getAvailableSlots(3);
    expect(slots).toHaveLength(2);
    expect(slots[0].start).toBe("2026-01-01T09:00:00Z"); // day sort
    expect(slots[0].end).toBe("2026-01-01T09:30:00.000Z");
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("eventTypeId=4923747");
  });

  it("uses env CAL_API_KEY + CAL_EVENT_TYPE_ID when set", async () => {
    process.env.CAL_API_KEY = "env-key";
    process.env.CAL_EVENT_TYPE_ID = "111";
    vi.mocked(fetch).mockResolvedValue(
      jsonRes({ status: "success", data: { slots: {} } })
    );
    await getAvailableSlots();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toContain("eventTypeId=111");
    expect(init.headers.Authorization).toBe("Bearer env-key");
  });

  it("getAvailableSlots throws on non-OK", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonRes({}, false, 500));
    await expect(getAvailableSlots()).rejects.toThrow("Cal.com slots failed (500)");
  });

  it("bookConsultation returns the booking fields", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonRes({
        status: "success",
        data: { uid: "bk1", meetingUrl: "https://meet/x", status: "ACCEPTED" },
      })
    );
    const res = await bookConsultation({
      name: "N",
      email: "e@x",
      start: "s",
      end: "e",
      notes: "n",
    });
    expect(res).toEqual({
      eventId: "bk1",
      htmlLink: "https://cal.com/booking/bk1",
      meetLink: "https://meet/x",
    });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as { body: string }).body
    );
    expect(body.bookingFieldsResponses).toEqual({ notes: "n" });
    expect(body.guests).toEqual(["tbaltzakis@cloudless.gr"]);
  });

  it("bookConsultation returns null on non-OK / missing uid / fetch error", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonRes({}, false, 422));
    expect(
      await bookConsultation({ name: "n", email: "e", start: "s", end: "e" })
    ).toBeNull();

    vi.mocked(fetch).mockResolvedValue(jsonRes({ status: "success", data: {} }));
    expect(
      await bookConsultation({ name: "n", email: "e", start: "s", end: "e" })
    ).toBeNull();

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect(
      await bookConsultation({ name: "n", email: "e", start: "s", end: "e" })
    ).toBeNull();
  });

  it("upcoming/by-email consultations map + filter, [] on failures", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    vi.mocked(fetch).mockResolvedValue(
      jsonRes({
        status: "success",
        data: [
          { uid: "u1", title: "T", start: future, end: "e", meetingUrl: "m" },
          { id: 7, start: past },
          {},
        ],
      })
    );
    const up = await getUpcomingConsultations();
    expect(up).toHaveLength(3);
    expect(up[0].status).toBe("upcoming");
    expect(up[1].status).toBe("past");
    expect(up[1].id).toBe("7");
    expect(up[2].title).toBe("Cloudless Consultation");
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("status=upcoming");

    const byEmail = await getConsultationsByEmail("a@b.c");
    expect(byEmail).toHaveLength(3);
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain("attendeeEmail=a%40b.c");

    vi.mocked(fetch).mockResolvedValue(jsonRes({}, false, 500));
    expect(await getUpcomingConsultations()).toEqual([]);
    expect(await getConsultationsByEmail("x")).toEqual([]);

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect(await getUpcomingConsultations()).toEqual([]);
    expect(await getConsultationsByEmail("x")).toEqual([]);
  });
});
