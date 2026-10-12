/**
 * admin ab-tests — flag toggle, traffic split, reset, error/warning tails.
 * Fixtures use the real DEFAULT_FLAGS from @/lib/ab-flags.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { DEFAULT_FLAGS, type ABFlag } from "@/lib/ab-flags";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));

import ABTestsPage from "@/app/[locale]/admin/ab-tests/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const flags = (): ABFlag[] => structuredClone(DEFAULT_FLAGS);

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("admin ab-tests", () => {
  it("loads flags, toggles one live, moves the traffic split, resets", async () => {
    fetchWithAuthMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return okJson({ flags: flags(), warning: "Rollout is capped at 5% until metrics stabilize." });
      }
      return okJson({ flags: flags() });
    });

    const { container, getByText } = render(<ABTestsPage />);
    await waitFor(() => expect(container.textContent).toContain(DEFAULT_FLAGS[0].name));
    expect(container.textContent).toContain("Active tests");

    // toggle the first flag → PATCH enabled
    const toggle = container.querySelector('button[role="switch"]')!;
    await act(async () => fireEvent.click(toggle));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([_u, i]) =>
            (i as RequestInit)?.method === "PATCH" &&
            String((i as RequestInit)?.body).includes('"enabled"')
        )
      ).toBe(true)
    );
    await waitFor(() =>
      expect(container.textContent).toContain("Rollout is capped")
    );

    // move the split slider → local state update only
    const slider = container.querySelector('input[type="range"]')!;
    await act(async () => fireEvent.change(slider, { target: { value: "30" } }));

    // reset all → POST action=reset
    fetchWithAuthMock.mockResolvedValueOnce(okJson({ flags: flags() }));
    await act(async () => fireEvent.click(getByText("Reset all")));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([_u, i]) => String((i as RequestInit)?.body ?? "").includes('"action":"reset"')
        )
      ).toBe(true)
    );
  });

  it("shows load and save errors", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(new Response("x", { status: 500 }));
    const { container } = render(<ABTestsPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));

    fetchWithAuthMock.mockReset();
    fetchWithAuthMock
      .mockResolvedValueOnce(okJson({ flags: flags() }))
      .mockResolvedValueOnce(new Response("x", { status: 502 }));
    cleanup();
    const { container: c2 } = render(<ABTestsPage />);
    await waitFor(() => expect(c2.textContent).toContain(DEFAULT_FLAGS[0].name));
    await act(async () =>
      fireEvent.click(c2.querySelector('button[role="switch"]')!)
    );
    await waitFor(() => expect(c2.textContent).toContain("HTTP 502"));
  });
});
