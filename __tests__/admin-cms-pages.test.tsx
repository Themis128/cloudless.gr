/**
 * Populated CRUD interaction tests for the four CMS admin pages — faqs,
 * services, case-studies, testimonials. They share one pattern: list →
 * modal form (required-field validation) → POST/PATCH → Archive via
 * DELETE ?pageId with confirm().
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const out = routes[String(url)];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import AdminFaqsPage from "@/app/[locale]/admin/cms/faqs/page";
import AdminServicesPage from "@/app/[locale]/admin/cms/services/page";
import AdminCaseStudiesPage from "@/app/[locale]/admin/cms/case-studies/page";
import AdminTestimonialsPage from "@/app/[locale]/admin/cms/testimonials/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

interface CmsSpec {
  name: string;
  Page: () => React.JSX.Element;
  route: string;
  listKey: string;
  item: Record<string, unknown>;
  itemText: string;
  emptyText: string;
  requiredMsg: string;
  requiredField: string; // JSON key asserted in POST body
  fillModal: (modal: HTMLElement) => void;
}

const SPECS: CmsSpec[] = [
  {
    name: "faqs",
    Page: AdminFaqsPage,
    route: "/api/admin/appflowy/faqs",
    listKey: "faqs",
    item: {
      id: "f1",
      question: "How much?",
      answer: "It depends",
      category: "pricing",
      locales: ["en", "el"],
    },
    itemText: "How much?",
    emptyText: "No FAQs yet",
    requiredMsg: "Question is required.",
    requiredField: "question",
    fillModal: (m) => {
      fireEvent.change(m.querySelector("input")!, { target: { value: "New Q" } });
      fireEvent.change(m.querySelector("textarea")!, { target: { value: "Ans" } });
      fireEvent.change(m.querySelector("select")!, { target: { value: "technical" } });
      fireEvent.click(m.querySelector("input[type='checkbox']")!);
    },
  },
  {
    name: "services",
    Page: AdminServicesPage,
    route: "/api/admin/appflowy/services",
    listKey: "services",
    item: {
      id: "s1",
      name: "Cloud Audit",
      slug: "cloud-audit",
      price: "€900",
      category: "consulting",
      description: "desc",
      features: ["f1"],
      published: true,
    },
    itemText: "Cloud Audit",
    emptyText: "No services yet",
    requiredMsg: "Name is required.",
    requiredField: "name",
    fillModal: (m) => {
      const inputs = m.querySelectorAll("input[type='text']");
      fireEvent.change(inputs[0], { target: { value: "New Svc" } }); // name
      fireEvent.change(inputs[1], { target: { value: "new-svc" } }); // slug
      fireEvent.change(m.querySelector("textarea")!, { target: { value: "d" } });
      // featuresText, category, stripePriceId, published
      const areas = m.querySelectorAll("textarea");
      fireEvent.change(areas[areas.length - 1], {
        target: { value: "Fast audits\nCost reports" },
      });
      fireEvent.change(m.querySelector("select")!, { target: { value: "devops" } });
      fireEvent.change(inputs[inputs.length - 1], {
        target: { value: "price_123" },
      });
      const cb = m.querySelector("input[type='checkbox']") as HTMLInputElement;
      if (cb.checked === false) fireEvent.click(cb);
    },
  },
  {
    name: "case-studies",
    Page: AdminCaseStudiesPage,
    route: "/api/admin/appflowy/case-studies",
    listKey: "caseStudies",
    item: {
      id: "c1",
      title: "Acme migration",
      client: "Acme",
      industry: "Retail",
      date: "2026-01-01",
      published: true,
      featured: false,
      metrics: [{ label: "Uptime", value: "99.9%" }],
      services: ["cloud"],
      tags: ["migration"],
      results: "done",
    },
    itemText: "Acme migration",
    emptyText: "No case studies yet",
    requiredMsg: "Title is required.",
    requiredField: "title",
    fillModal: (m) => {
      fireEvent.change(m.querySelector("input[type='text']")!, {
        target: { value: "New CS" },
      }); // title (first text input)
      const areas = m.querySelectorAll("textarea");
      fireEvent.change(areas[0], { target: { value: "Result text" } });
      // metrics textarea: "Label | Value" per line
      fireEvent.change(areas[areas.length - 2], {
        target: { value: "Uptime | 99.9%\nbad-line" },
      });
    },
  },
  {
    name: "testimonials",
    Page: AdminTestimonialsPage,
    route: "/api/admin/appflowy/testimonials",
    listKey: "testimonials",
    item: {
      id: "t1",
      name: "Nikos",
      quote: "Great work",
      company: "Acme",
      role: "CTO",
      rating: 5,
      featured: true,
      published: true,
    },
    itemText: "Nikos",
    emptyText: "No testimonials yet",
    requiredMsg: "Name and Quote are required.",
    requiredField: "name",
    fillModal: (m) => {
      const inputs = m.querySelectorAll("input[type='text'], textarea");
      fireEvent.change(inputs[0], { target: { value: "Maria" } }); // name
      fireEvent.change(inputs[1], { target: { value: "Loved it" } }); // quote
    },
  },
];

describe.each(SPECS)("cms $name — CRUD", (spec) => {
  const getCalls = (method?: string) =>
    fetchWithAuthMock.mock.calls.filter(
      ([u, i]) => String(u).startsWith(spec.route) && (!method || i?.method === method)
    );

  beforeEach(() => {
    routes = { [spec.route]: { [spec.listKey]: [spec.item] } };
    fetchWithAuthMock.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("list renders → validation → create → edit → archive → errors", async () => {
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<spec.Page />).container;
    });
    const cc = c!;
    expect(cc.textContent).toContain(spec.itemText);

    // create → required validation fires on empty required field
    await click(screen.getByText("+ New"));
    await click(screen.getByText("Create"));
    expect(cc.textContent).toContain(spec.requiredMsg);

    // fill required fields → POST
    const modal = cc.querySelector(".fixed.inset-0 > div") as HTMLElement;
    spec.fillModal(modal);
    await click(screen.getByText("Create"));
    const post = getCalls("POST")[0];
    expect(JSON.parse(String(post[1].body))).toMatchObject({
      [spec.requiredField]: expect.any(String),
    });

    // edit → PATCH with pageId
    await click(screen.getByText("Edit"));
    await click(screen.getByText("Save Changes"));
    const patch = getCalls("PATCH")[0];
    expect(JSON.parse(String(patch[1].body)).pageId).toBe(spec.item.id);

    // archive → DELETE ?pageId=
    await click(screen.getByText("Archive"));
    const del = getCalls("DELETE")[0];
    expect(String(del[0])).toContain(`pageId=${spec.item.id}`);

    // save-error path: POST returns 400 → formError shows
    routes[spec.route] = (init?: RequestInit) =>
      init?.method === "POST" || init?.method === "PATCH"
        ? okJson({ error: "write failed" }, 400)
        : okJson({ [spec.listKey]: [spec.item] });
    await click(screen.getByText("+ New"));
    const modal2 = cc.querySelector(".fixed.inset-0 > div") as HTMLElement;
    spec.fillModal(modal2);
    await click(screen.getByText("Create"));
    await flush();
    expect(cc.textContent).toContain("write failed");

    // cancel closes modal
    await click(screen.getByText("Cancel"));
    expect(cc.querySelector(".fixed.inset-0")).toBeNull();
  });

  it("load error + empty state + delete cancel", async () => {
    routes[spec.route] = okJson({}, 500);
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<spec.Page />).container;
    });
    expect(c!.textContent).toContain("HTTP 500");

    routes[spec.route] = { [spec.listKey]: [] };
    cleanup();
    await act(async () => {
      c = render(<spec.Page />).container;
    });
    expect(c!.textContent).toContain(spec.emptyText);
  });

  it("confirm-cancel skips delete", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<spec.Page />).container;
    });
    await click(screen.getByText("Archive"));
    expect(getCalls("DELETE").length).toBe(0);
    expect(c!.textContent).toContain(spec.itemText);
  });
});

describe("cms services — delete failure tail", () => {
  beforeEach(() => {
    routes = {
      "/api/admin/appflowy/services": okJson({
        services: [
          {
            id: "s1",
            name: "Cloud Audit",
            slug: "cloud-audit",
            category: "consulting",
            features: [],
            published: true,
          },
        ],
      }),
      "/api/admin/appflowy/services?pageId=s1": okJson({ error: "gone" }, 500),
    };
    fetchWithAuthMock.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("surfaces the delete error and keeps the row", async () => {
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<AdminServicesPage />).container;
    });
    expect(c!.textContent).toContain("Cloud Audit");
    await click(screen.getByText("Archive"));
    await flush();
    expect(c!.textContent).toContain("HTTP 500");
    expect(c!.textContent).toContain("Cloud Audit"); // row not removed
  });
});

describe("cms case-studies — field tails", () => {
  beforeEach(() => {
    routes = {
      "/api/admin/appflowy/case-studies": {
        caseStudies: [
          {
            id: "c1",
            title: "Acme migration",
            client: "Acme",
            industry: "Retail",
            date: "2026-01-01",
            published: true,
            featured: false,
            metrics: [{ label: "Uptime", value: "99.9%" }],
            services: ["cloud"],
            tags: ["migration"],
            results: "done",
          },
        ],
      },
    };
    fetchWithAuthMock.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("parses services/tags/metrics/coverImage/flags into the POST body", async () => {
    let c!: HTMLElement;
    await act(async () => {
      c = render(<AdminCaseStudiesPage />).container;
    });
    await click(screen.getByText("+ New"));
    const modal = c.querySelector(".fixed.inset-0 > div") as HTMLElement;
    const texts = modal.querySelectorAll("input[type='text']");
    fireEvent.change(texts[0], { target: { value: "New CS" } }); // title
    fireEvent.change(texts[1], { target: { value: "new-cs" } }); // slug
    fireEvent.change(texts[2], { target: { value: "Beta Corp" } }); // client
    fireEvent.change(texts[3], { target: { value: "SaaS" } }); // industry
    fireEvent.change(texts[4], { target: { value: "cloud, ai" } }); // services
    fireEvent.change(texts[5], { target: { value: "t1, t2" } }); // tags
    const areas = modal.querySelectorAll("textarea");
    fireEvent.change(areas[areas.length - 1], {
      target: { value: "Cost | 40%" },
    }); // metrics
    fireEvent.change(texts[texts.length - 1], {
      target: { value: "https://cdn.example/cover.png" },
    }); // cover image
    const checks = modal.querySelectorAll("input[type='checkbox']");
    fireEvent.click(checks[0]);
    fireEvent.click(checks[1]);

    await click(screen.getByText("Create"));
    const post = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u) === "/api/admin/appflowy/case-studies" && i?.method === "POST"
    );
    expect(JSON.parse(String(post![1].body))).toMatchObject({
      title: "New CS",
      slug: "new-cs",
      client: "Beta Corp",
      services: ["cloud", "ai"],
      tags: ["t1", "t2"],
      metrics: [{ label: "Cost", value: "40%" }],
      coverImage: "https://cdn.example/cover.png",
      published: true,
      featured: true,
    });
  });

  it("shows the delete error when archive fails", async () => {
    let c!: HTMLElement;
    await act(async () => {
      c = render(<AdminCaseStudiesPage />).container;
    });
    routes["/api/admin/appflowy/case-studies?pageId=c1"] = okJson(
      { error: "archive exploded" },
      500
    );
    await click(screen.getByText("Archive"));
    await flush();
    expect(c.textContent).toContain("HTTP 500");
  });
});
