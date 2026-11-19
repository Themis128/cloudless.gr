/**
 * /audit page + AuditForm — server render, metadata, form submit paths.
 *
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));

import AuditPage, { generateMetadata } from "@/app/[locale]/audit/page";
import AuditForm from "@/app/[locale]/audit/AuditForm";

const labels = {
  name: "Your name",
  email: "Work email *",
  goal: "Goal *",
  pain: "Pain *",
  timeline: "When *",
  submit: "Book",
  sending: "Booking…",
  done: "Booked",
  error: "Something went wrong",
  consent: "I agree",
  privacyPolicy: "Privacy Policy",
};

afterEach(() => cleanup());

describe("audit page", () => {
  it("renders sections + form", async () => {
    const el = await AuditPage();
    const { getByText, getByPlaceholderText } = render(el as React.ReactElement);
    expect(getByText(/Why traditional systems drag you down/)).toBeTruthy();
    expect(getByText(/The Cloudless Architecture Blueprint/)).toBeTruthy();
    expect(getByPlaceholderText("Work email *")).toBeTruthy();
  });

  it("generateMetadata: locale-prefixed canonical + fallbacks", async () => {
    const en = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(en.alternates?.canonical).toBe("https://cloudless.gr/en/audit");
    const bad = await generateMetadata({ params: Promise.resolve({ locale: "xx" }) });
    expect(bad.alternates?.canonical).toBe("https://cloudless.gr/en/audit");
  });
});

describe("AuditForm", () => {
  it("submit success shows done state", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const { getByPlaceholderText, getByText, container } = render(
      <AuditForm labels={labels} locale="en" />,
    );
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(getByText("Booked")).toBeTruthy());
    expect(spy).toHaveBeenCalledWith(
      "/api/audit",
      expect.objectContaining({ method: "POST" }),
    );
    spy.mockRestore();
  });

  it("non-ok response shows error state", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("x", { status: 500 }));
    const { getByText, container } = render(<AuditForm labels={labels} locale="en" />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(getByText("Something went wrong")).toBeTruthy());
    spy.mockRestore();
  });

  it("network failure shows error state", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    const { getByText, container } = render(<AuditForm labels={labels} locale="en" />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(getByText("Something went wrong")).toBeTruthy());
    spy.mockRestore();
  });
});
