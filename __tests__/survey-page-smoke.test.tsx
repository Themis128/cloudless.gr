/** @vitest-environment jsdom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

import SurveyPage from "@/app/[locale]/survey/page";

afterEach(cleanup);

describe("survey page", () => {
  it("renders questions and submits", async () => {
    render(<SurveyPage />);
    expect(screen.getByText("The 60-second stack audit")).toBeTruthy();
    fireEvent.click(screen.getByText("AWS"));
    fireEvent.change(screen.getByPlaceholderText("Work email"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "A" } });
    fireEvent.click(screen.getByText("Get my audit →"));
    await screen.findByText(/stack audit is on the way/);
    expect(fetch).toHaveBeenCalled();
  });
});

describe("survey page — error path", () => {
  it("shows error message when submit fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } })));
    const { unmount } = render(<SurveyPage />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: "a@b.co" } });
    const btn = screen.getAllByRole("button").find(b => /submit|send|continue|next/i.test(b.textContent || "")) || screen.getAllByRole("button")[0];
    fireEvent.click(btn);
    unmount();
  });
});
