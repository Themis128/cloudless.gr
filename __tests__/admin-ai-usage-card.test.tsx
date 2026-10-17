/**
 * AdminAiUsageCard: loading, error (HTTP status / non-Error rejection),
 * every on/off flag in both states, last-error line, and the unmount guard.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

import AdminAiUsageCard from "@/components/admin/AdminAiUsageCard";

const payload = (on: boolean, recent: unknown[] = []) => ({
  configured: on,
  usage: {
    total: 7,
    ok: 5,
    errors: 2,
    viaGateway: 3,
    workersAiConfigured: on,
    aiGatewayConfigured: on,
    gatewayId: on ? "gw-main" : null,
    geminiConfigured: on,
    recent,
  },
  vectorize: { configured: on },
  turnstile: { configured: on },
  espocrmQueue: { configured: on },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function renderCard() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AdminAiUsageCard />).container;
  });
  await act(async () => {});
  return c!;
}

describe("AdminAiUsageCard", () => {
  afterEach(() => {
    cleanup();
    fetchWithAuthMock.mockReset();
  });

  it("shows the loading state until the status call resolves", async () => {
    fetchWithAuthMock.mockReturnValue(new Promise(() => {}));
    const c = await renderCard();
    expect(c.textContent).toBe("Loading AI usage…");
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/admin/ai/status");
  });

  it("all flags on, gateway id shown, last failing call reported", async () => {
    fetchWithAuthMock.mockResolvedValue(
      json(
        payload(true, [
          { at: "t1", ok: true, model: "m", viaGateway: true, latencyMs: 10 },
          {
            at: "t2",
            ok: false,
            model: "m",
            viaGateway: false,
            latencyMs: 420,
            error: "rate limited",
          },
          { at: "t3", ok: false, model: "m", viaGateway: false, latencyMs: 99, error: "older" },
        ])
      )
    );
    const c = await renderCard();
    expect(screen.getByText("ready").className).toContain("text-neon-green");
    expect(c.textContent).toContain("Workers AI: on · Gateway: on (gw-main) · Gemini: on");
    expect(c.textContent).toContain("Calls (this pod): 7 · ok 5 · err 2 · via gateway 3");
    expect(c.textContent).toContain("Vectorize: on · Turnstile: on · Espo queue: on");
    expect(c.textContent).toContain("Last error: rate limited (420ms)");
    expect(c.textContent).not.toContain("older");
  });

  it("all flags off, no errors → no last-error line", async () => {
    fetchWithAuthMock.mockResolvedValue(
      json(payload(false, [{ at: "t", ok: true, model: "m", viaGateway: false, latencyMs: 5 }]))
    );
    const c = await renderCard();
    expect(screen.getByText("not configured").className).toContain("text-neon-magenta");
    expect(c.textContent).toContain("Workers AI: off · Gateway: off · Gemini: off");
    expect(c.textContent).toContain("Vectorize: off · Turnstile: off · Espo queue: off");
    expect(c.textContent).not.toContain("Last error");
  });

  it("failed call without an error message reports 'unknown'", async () => {
    fetchWithAuthMock.mockResolvedValue(
      json(payload(true, [{ at: "t", ok: false, model: "m", viaGateway: true, latencyMs: 12 }]))
    );
    const c = await renderCard();
    expect(c.textContent).toContain("Last error: unknown (12ms)");
  });

  it("non-ok HTTP status renders the status in the error banner", async () => {
    fetchWithAuthMock.mockResolvedValue(json({}, 403));
    const c = await renderCard();
    expect(c.textContent).toBe("AI status unavailable: status 403");
  });

  it("non-Error rejection falls back to a generic message", async () => {
    fetchWithAuthMock.mockRejectedValue("offline");
    const c = await renderCard();
    expect(c.textContent).toBe("AI status unavailable: Failed to load");
  });

  it("ignores results that arrive after unmount", async () => {
    let resolveOk!: (r: Response) => void;
    let rejectErr!: (e: unknown) => void;
    fetchWithAuthMock
      .mockReturnValueOnce(new Promise<Response>((r) => (resolveOk = r)))
      .mockReturnValueOnce(new Promise<Response>((_, j) => (rejectErr = j)));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const a = render(<AdminAiUsageCard />);
    const b = render(<AdminAiUsageCard />);
    a.unmount();
    b.unmount();
    await act(async () => {
      resolveOk(json(payload(true)));
      rejectErr(new Error("late"));
    });
    await act(async () => {});
    // no state updates on unmounted components → React logs nothing
    expect(errSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).toBe("");
    errSpy.mockRestore();
  });
});
