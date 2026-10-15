/**
 * agency-projects-d1 — real SQL flows against a fake D1 boundary.
 * The fake queues results per prepare() call so the module's actual
 * queries, bind order, and row mapping all execute.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Queued {
  all?: { results: unknown[]; success?: boolean };
  run?: { success?: boolean; meta?: { changes: number } };
  first?: unknown;
  throw?: Error;
}

const queues: Queued[] = [];
const seenSql: string[] = [];
let bound = true;

function makeDb() {
  return {
    prepare(sql: string) {
      seenSql.push(sql);
      const q = queues.shift() ?? {};
      const stmt = {
        bind: () => stmt,
        async all() {
          if (q.throw) throw q.throw;
          return q.all ?? { results: [], success: true };
        },
        async run() {
          if (q.throw) throw q.throw;
          return q.run ?? { success: true, meta: { changes: 1 } };
        },
        async first() {
          if (q.throw) throw q.throw;
          return q.first ?? null;
        },
      };
      return stmt;
    },
  };
}

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: () => (bound ? makeDb() : null),
}));

import {
  isAgencyProjectStatus,
  listAgencyProjects,
  createAgencyProject,
  updateAgencyProjectStatus,
  listTimeEntries,
  createTimeEntry,
  getAgencyProject,
  listUnbilledBillableEntries,
  markTimeEntriesInvoiced,
  setAgencyProjectStripeCustomer,
} from "@/lib/agency-projects-d1";

const projectRow = (o: Record<string, unknown> = {}) => ({
  id: "ap_1",
  name: "Site Rebuild",
  client_email: "c@x.com",
  espo_account_id: null,
  status: "active",
  hourly_rate_cents: 8500,
  currency: "EUR",
  stripe_customer_id: null,
  notes: null,
  created_at: 1000,
  updated_at: 2000,
  total_minutes: 90,
  unbilled_minutes: 30,
  ...o,
});

const entryRow = (o: Record<string, unknown> = {}) => ({
  id: "te_1",
  project_id: "ap_1",
  user_id: "u1",
  work_date: "2026-10-01",
  minutes: 60,
  billable: 1,
  description: "work",
  stripe_invoice_id: null,
  created_at: 100,
  ...o,
});

beforeEach(() => {
  queues.length = 0;
  seenSql.length = 0;
  bound = true;
});

describe("isAgencyProjectStatus", () => {
  it("accepts the known set and rejects the rest", () => {
    for (const s of ["active", "on_hold", "done", "cancelled"]) {
      expect(isAgencyProjectStatus(s)).toBe(true);
    }
    expect(isAgencyProjectStatus("archived")).toBe(false);
  });
});

describe("listAgencyProjects", () => {
  it("returns unbound without a db", async () => {
    bound = false;
    expect(await listAgencyProjects()).toEqual({ bound: false, projects: [] });
  });

  it("maps rows and caps the limit at 100", async () => {
    queues.push({ all: { results: [projectRow()] } });
    const { bound: b, projects } = await listAgencyProjects(500);
    expect(b).toBe(true);
    expect(projects[0]).toMatchObject({
      id: "ap_1",
      totalMinutes: 90,
      unbilledMinutes: 30,
      hourlyRateCents: 8500,
    });
  });

  it("clamps limit to >= 1 and swallows query errors", async () => {
    queues.push({ all: { results: [] } });
    await listAgencyProjects(0);
    queues.push({ throw: new Error("d1 down") });
    const out = await listAgencyProjects();
    expect(out).toEqual({ bound: true, projects: [] });
  });
});

describe("createAgencyProject", () => {
  it("returns null unbound / on empty name", async () => {
    bound = false;
    expect(await createAgencyProject({ name: "x" })).toBeNull();
    bound = true;
    expect(await createAgencyProject({ name: "   " })).toBeNull();
    expect(seenSql.length).toBe(0);
  });

  it("inserts with normalized fields and id prefix", async () => {
    queues.push({ run: { success: true, meta: { changes: 1 } } });
    const p = await createAgencyProject({
      name: "  Rebuild  ",
      clientEmail: "  C@X.COM ",
      hourlyRateCents: 8500.4,
      currency: "eur",
      status: "bogus" as never,
      notes: " n ",
    });
    expect(p).not.toBeNull();
    expect(p!.id).toMatch(/^ap_/);
    expect(p!.status).toBe("active");
    expect(p!.clientEmail).toBe("c@x.com");
    expect(p!.hourlyRateCents).toBe(8500);
    expect(p!.currency).toBe("EUR");
    expect(seenSql[0]).toContain("INSERT INTO agency_project");
  });

  it("keeps a valid status and returns null on insert failure", async () => {
    queues.push({ run: { success: true, meta: { changes: 1 } } });
    const p = await createAgencyProject({ name: "x", status: "on_hold" });
    expect(p!.status).toBe("on_hold");

    queues.push({ throw: new Error("constraint") });
    expect(await createAgencyProject({ name: "x" })).toBeNull();
  });
});

describe("updateAgencyProjectStatus", () => {
  it("rejects bad ids/statuses without a query", async () => {
    expect(await updateAgencyProjectStatus("x_1", "done")).toBe(false);
    expect(await updateAgencyProjectStatus("ap_1", "bogus" as never)).toBe(false);
    bound = false;
    expect(await updateAgencyProjectStatus("ap_1", "done")).toBe(false);
    expect(seenSql.length).toBe(0);
  });

  it("returns true only when a row changed", async () => {
    bound = true;
    queues.push({ run: { success: true, meta: { changes: 1 } } });
    expect(await updateAgencyProjectStatus("ap_1", "done")).toBe(true);
    queues.push({ run: { success: true, meta: { changes: 0 } } });
    expect(await updateAgencyProjectStatus("ap_1", "done")).toBe(false);
    queues.push({ throw: new Error("down") });
    expect(await updateAgencyProjectStatus("ap_1", "done")).toBe(false);
  });
});

describe("listTimeEntries", () => {
  it("maps entries; non-ap ids short-circuit empty", async () => {
    bound = false;
    expect(await listTimeEntries("ap_1")).toEqual({ bound: false, entries: [] });
    bound = true;
    expect(await listTimeEntries("x_1")).toEqual({ bound: true, entries: [] });
    expect(seenSql.length).toBe(0);

    queues.push({ all: { results: [entryRow()] } });
    const { entries } = await listTimeEntries("ap_1", 5);
    expect(entries[0]).toMatchObject({ id: "te_1", minutes: 60, billable: true });
    queues.push({ throw: new Error("d1") });
    expect((await listTimeEntries("ap_1")).entries).toEqual([]);
  });
});

describe("createTimeEntry", () => {
  const base = { projectId: "ap_1", workDate: "2026-10-01", minutes: 60 };

  it("validates project id, date shape, and minute bounds", async () => {
    bound = false;
    expect(await createTimeEntry(base)).toBeNull();
    bound = true;
    expect(await createTimeEntry({ ...base, projectId: "x" })).toBeNull();
    expect(await createTimeEntry({ ...base, workDate: "10-01-2026" })).toBeNull();
    expect(await createTimeEntry({ ...base, minutes: 0 })).toBeNull();
    expect(await createTimeEntry({ ...base, minutes: 24 * 60 + 1 })).toBeNull();
    expect(await createTimeEntry({ ...base, minutes: NaN })).toBeNull();
    expect(seenSql.length).toBe(0);
  });

  it("returns null when the project does not exist", async () => {
    queues.push({ first: null });
    expect(await createTimeEntry(base)).toBeNull();
    expect(seenSql[0]).toContain("SELECT id FROM agency_project");
  });

  it("inserts the entry, touches the project, maps the result", async () => {
    queues.push({ first: { id: "ap_1" } }); // exists check
    queues.push({ run: { success: true, meta: { changes: 1 } } }); // insert
    queues.push({ run: { success: true, meta: { changes: 1 } } }); // touch
    const e = await createTimeEntry({
      ...base,
      billable: false,
      description: " d ",
      userId: " u ",
    });
    expect(e).not.toBeNull();
    expect(e!.id).toMatch(/^te_/);
    expect(e!.billable).toBe(false);
    expect(e!.description).toBe("d");
    expect(seenSql[1]).toContain("INSERT INTO time_entry");
    expect(seenSql[2]).toContain("UPDATE agency_project SET updated_at");
  });

  it("warns and returns null when the insert throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    queues.push({ first: { id: "ap_1" } }); // exists check
    queues.push({ throw: new Error("D1 write fail") }); // insert run() throws
    const e = await createTimeEntry(base);
    expect(e).toBeNull();
    expect(warn).toHaveBeenCalledWith("[agency-projects-d1] create time failed:", "D1 write fail");
    warn.mockRestore();
  });
});

describe("getAgencyProject", () => {
  it("unbound / bad id / missing row / mapped row / error", async () => {
    bound = false;
    expect(await getAgencyProject("ap_1")).toEqual({ bound: false, project: null });
    bound = true;
    expect((await getAgencyProject("x_1")).project).toBeNull();
    queues.push({ first: null });
    expect((await getAgencyProject("ap_1")).project).toBeNull();
    queues.push({ first: projectRow({ status: "weird" }) });
    const { project } = await getAgencyProject("ap_1");
    expect(project!.status).toBe("active"); // unknown status → default
    queues.push({ throw: new Error("down") });
    expect((await getAgencyProject("ap_1")).project).toBeNull();
  });
});

describe("listUnbilledBillableEntries", () => {
  it("maps rows; guards unbound and bad ids", async () => {
    bound = false;
    expect(await listUnbilledBillableEntries("ap_1")).toEqual({ bound: false, entries: [] });
    bound = true;
    expect((await listUnbilledBillableEntries("x")).entries).toEqual([]);
    queues.push({ all: { results: [entryRow({ billable: 0 })] } });
    const { entries } = await listUnbilledBillableEntries("ap_1");
    expect(entries[0].billable).toBe(false);
    queues.push({ throw: new Error("x") });
    expect((await listUnbilledBillableEntries("ap_1")).entries).toEqual([]);
  });
});

describe("markTimeEntriesInvoiced", () => {
  it("guards invoice shape and empty input", async () => {
    bound = false;
    expect(await markTimeEntriesInvoiced(["te_1"], "in_1")).toBe(0);
    bound = true;
    expect(await markTimeEntriesInvoiced(["te_1"], "pi_1")).toBe(0);
    expect(await markTimeEntriesInvoiced([], "in_1")).toBe(0);
    expect(seenSql.length).toBe(0);
  });

  it("skips non-te ids, counts changed rows, touches the project", async () => {
    queues.push({ run: { success: true, meta: { changes: 1 } } }); // te_1 update
    queues.push({ run: { success: true, meta: { changes: 0 } } }); // te_2 already invoiced
    queues.push({ first: { project_id: "ap_9" } }); // project lookup
    queues.push({ run: { success: true, meta: { changes: 1 } } }); // touch project
    const n = await markTimeEntriesInvoiced(["te_1", "bogus", "te_2"], "in_42");
    expect(n).toBe(1);
    expect(seenSql.some((s) => s.includes("UPDATE agency_project SET updated_at"))).toBe(true);
  });

  it("returns partial count and swallows mid-loop errors", async () => {
    queues.push({ run: { success: true, meta: { changes: 1 } } });
    queues.push({ throw: new Error("mid-fail") });
    expect(await markTimeEntriesInvoiced(["te_1", "te_2"], "in_1")).toBe(1);
  });
});

describe("setAgencyProjectStripeCustomer", () => {
  it("validates id prefixes and reports change count", async () => {
    bound = false;
    expect(await setAgencyProjectStripeCustomer("ap_1", "cus_1")).toBe(false);
    bound = true;
    expect(await setAgencyProjectStripeCustomer("x_1", "cus_1")).toBe(false);
    expect(await setAgencyProjectStripeCustomer("ap_1", "acct_1")).toBe(false);
    queues.push({ run: { success: true, meta: { changes: 1 } } });
    expect(await setAgencyProjectStripeCustomer("ap_1", "cus_1")).toBe(true);
    queues.push({ run: { success: true, meta: { changes: 0 } } });
    expect(await setAgencyProjectStripeCustomer("ap_1", "cus_1")).toBe(false);
    queues.push({ throw: new Error("x") });
    expect(await setAgencyProjectStripeCustomer("ap_1", "cus_1")).toBe(false);
  });
});
