import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  configured: vi.fn(async () => true),
  workspaces: vi.fn(async () => [{ workspace_id: "ws1" }]),
  views: vi.fn(async () => []),
  fetchMd: vi.fn(async () => new Map<string, string | null>()),
  mdToHtml: vi.fn(async () => "<p>x</p>"),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: m.configured,
  listAllWorkspaces: m.workspaces,
  listAllViewsDeep: m.views,
  fetchViewMarkdownMap: m.fetchMd,
  markdownToHtml: m.mdToHtml,
}));

import {
  getAllCaseStudiesAdmin,
  getCaseStudies,
  getCaseStudyBySlug,
  getFeaturedCaseStudies,
  staticCaseStudies,
} from "@/lib/appflowy-case-studies";

const view = (id: string, name: string) => ({
  view_id: id, name, last_edited_time: "2026-10-01",
});

const MD = `**Slug**: acme-migration
**Client**: Acme
**Industry**: Retail
**Services**: Cloud, Analytics
**Tags**: a,b
**Featured**: true
**Metric1Label**: Cost
**Metric1Value**: -40%
**Metric2Label**: p95
**Metric2Value**: 10ms
**Summary**: Moved to cloud
**Date**: 2026-09-15
freeform body`;

beforeEach(() => {
  vi.clearAllMocks();
  m.configured.mockResolvedValue(true);
  m.workspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
  m.fetchMd.mockResolvedValue(new Map());
});

describe("getCaseStudies", () => {
  it("unconfigured → []; no workspace → []; views filtered + sorted by date", async () => {
    m.configured.mockResolvedValueOnce(false);
    expect(await getCaseStudies()).toEqual([]);

    m.workspaces.mockResolvedValueOnce([]);
    expect(await getCaseStudies()).toEqual([]);

    m.views.mockResolvedValue([
      view("v1", "[CaseStudy] Newer"),
      view("v2", "[CaseStudy] Older"),
      view("v3", "Not a case study"),
    ]);
    m.fetchMd.mockResolvedValue(new Map([
      ["v1", "**Date**: 2026-10-10"],
      ["v2", "**Date**: 2026-01-01"],
    ]));
    const out = await getCaseStudies();
    expect(out).toHaveLength(2);
    expect(out[0].slug).toBe("newer"); // date desc
    expect(out[1].title).toBe("Older");
  });

  it("maps markdown fields incl. metrics, tags, featured", async () => {
    m.views.mockResolvedValue([view("v1", "[CaseStudy] Acme")]);
    m.fetchMd.mockResolvedValue(new Map([["v1", MD]]));
    const [cs] = await getCaseStudies();
    expect(cs.slug).toBe("acme-migration");
    expect(cs.client).toBe("Acme");
    expect(cs.services).toEqual(["Cloud", "Analytics"]);
    expect(cs.featured).toBe(true);
    expect(cs.metrics).toEqual([
      { label: "Cost", value: "-40%" }, { label: "p95", value: "10ms" },
    ]);
  });

  it("null doc → empty-markdown fallback; listAllViewsDeep throw → []", async () => {
    m.views.mockResolvedValue([view("v1", "[CaseStudy] X")]);
    m.fetchMd.mockResolvedValue(new Map([["v1", null]]));
    const [cs] = await getCaseStudies();
    expect(cs.title).toBe("X");

    m.views.mockRejectedValueOnce(new Error("views down"));
    expect(await getCaseStudies()).toEqual([]);
  });

  it("workspace list throw → null → []", async () => {
    m.workspaces.mockRejectedValueOnce(new Error("ws down"));
    expect(await getCaseStudies()).toEqual([]);
  });
});

describe("getFeaturedCaseStudies + getCaseStudyBySlug", () => {
  it("featured filter", async () => {
    m.views.mockResolvedValue([view("v1", "[CaseStudy] A")]);
    m.fetchMd.mockResolvedValue(new Map([["v1", MD]]));
    expect(await getFeaturedCaseStudies()).toHaveLength(1);
    m.fetchMd.mockResolvedValue(new Map([["v1", "**Featured**: no"]]));
    expect(await getFeaturedCaseStudies()).toHaveLength(0);
  });

  it("bySlug returns html; not found → null; unconfigured → null", async () => {
    m.views.mockResolvedValue([view("v1", "[CaseStudy] A")]);
    m.fetchMd.mockResolvedValue(new Map([["v1", MD]]));
    const hit = await getCaseStudyBySlug("acme-migration");
    expect(hit?.html).toBe("<p>x</p>");
    expect(await getCaseStudyBySlug("nope")).toBeNull();
    m.configured.mockResolvedValueOnce(false);
    expect(await getCaseStudyBySlug("x")).toBeNull();
  });
});

describe("getAllCaseStudiesAdmin", () => {
  it("unconfigured → static; views throw → static; happy path", async () => {
    m.configured.mockResolvedValueOnce(false);
    expect(await getAllCaseStudiesAdmin()).toBe(staticCaseStudies);
    m.views.mockRejectedValueOnce(new Error("down"));
    expect(await getAllCaseStudiesAdmin()).toBe(staticCaseStudies);
    m.views.mockResolvedValue([view("v1", "[CaseStudy] A")]);
    m.fetchMd.mockResolvedValue(new Map([["v1", MD]]));
    expect(await getAllCaseStudiesAdmin()).toHaveLength(1);
  });
});
