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
