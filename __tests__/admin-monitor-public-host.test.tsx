// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://cloudless.gr/en/admin/monitor"}
/**
 * admin/monitor on a public (non-LAN) host: the log-stream WebSocket is never
 * opened (it would be blocked mixed content), and the console explains why.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: async () => new Response(JSON.stringify({}), { status: 500 }),
}));

import MonitorPage from "@/app/[locale]/admin/monitor/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("never opens a WebSocket and shows the unavailable copy", async () => {
  expect(window.location.hostname).toBe("cloudless.gr");
  const ctor = vi.fn();
  vi.stubGlobal("WebSocket", ctor);
  Element.prototype.scrollIntoView = vi.fn();
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<MonitorPage />).container;
  });
  expect(ctor).not.toHaveBeenCalled();
  expect(c!.textContent).toContain("WebSocket unavailable on this deployment");
  expect(c!.textContent).toContain("WebSocket stream not available on this deployment.");
  expect(c!.textContent).not.toContain("WebSocket reconnects automatically");
  expect(c!.textContent).toContain("Last fetched: —");
});
