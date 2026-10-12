/**
 * Tail coverage — appflowy-case-studies configured-path catches:
 * workspace-listing failure, per-doc extraction failures, outer catch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConfigured = vi.fn();
const mockWorkspaces = vi.fn();
const mockViews = vi.fn();
const mockGetDoc = vi.fn();
const mockExtract = vi.fn();
const mockHtml = vi.fn();

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => mockConfigured(...a),
  listAllWorkspaces: (...a: unknown[]) => mockWorkspaces(...a),
  listAllViewsDeep: (...a: unknown[]) => mockViews(...a),
  getDocument: (...a: unknown[]) => mockGetDoc(...a),
  extractDocText: (...a: unknown[]) => mockExtract(...a),
  markdownToHtml: (...a: unknown[]) => mockHtml(...a),
}));

import {
  getCaseStudies,
  getCaseStudyBySlug,
  getAllCaseStudiesAdmin,
} from "@/lib/appflowy-case-studies";

const caseView = (id: string, name: string) => ({
  view_id: id,
  name,
  last_edited_time: "2026-10-01T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockResolvedValue(true);
  mockWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
  mockViews.mockResolvedValue([caseView("v1", "[CaseStudy] Acme Migration")]);
  mockGetDoc.mockResolvedValue({});
  mockExtract.mockResolvedValue(
    "**Slug**: acme-migration\n**Client**: Acme\n**Industry**: SaaS"
  );
  mockHtml.mockResolvedValue("<p>html</p>");
});

describe("getCaseStudies tails", () => {
  it("returns [] when the workspace listing throws", async () => {
    mockWorkspaces.mockRejectedValue(new Error("workspaces down"));
    expect(await getCaseStudies()).toEqual([]);
    expect(await getCaseStudyBySlug("acme-migration")).toBeNull();
  });

  it("keeps the view with empty markdown when doc extraction fails", async () => {
    mockGetDoc.mockRejectedValue(new Error("doc 500"));
    const studies = await getCaseStudies();
    expect(studies).toHaveLength(1);
    expect(studies[0].title).toBe("Acme Migration");
    expect(studies[0].slug).toBe("acme-migration");
  });

  it("returns [] when the views listing throws", async () => {
    mockViews.mockRejectedValue(new Error("views down"));
    expect(await getCaseStudies()).toEqual([]);
  });
});

describe("getCaseStudyBySlug tails", () => {
  it("still resolves the slug when doc extraction fails", async () => {
    mockExtract.mockRejectedValue(new Error("extract down"));
    const study = await getCaseStudyBySlug("acme-migration");
    expect(study).not.toBeNull();
    expect(study!.slug).toBe("acme-migration");
  });
});

describe("getAllCaseStudiesAdmin tails", () => {
  it("keeps the view with empty markdown when doc extraction fails", async () => {
    mockGetDoc.mockRejectedValue(new Error("doc 500"));
    const studies = await getAllCaseStudiesAdmin();
    expect(studies).toHaveLength(1);
    expect(studies[0].slug).toBe("acme-migration");
  });
});
