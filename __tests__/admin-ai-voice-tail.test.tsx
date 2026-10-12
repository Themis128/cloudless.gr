/**
 * admin voice-brief + ai-generator — generate/play/copy interaction branches.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "a@b.c" }, isAdmin: true, isLoading: false }),
}));
vi.mock("@/components/admin/AdminAiUsageCard", () => ({
  default: () => <div>USAGE_CARD</div>,
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en"] }));
vi.mock("@/lib/i18n", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...mod, translate: (_l: string, _k: string, fb: string) => fb };
});

import VoiceBriefPage from "@/app/[locale]/admin/voice-brief/page";
import AiGeneratorPage from "@/app/[locale]/admin/ai-generator/page";

const flush = () => act(async () => { await Promise.resolve(); });
const brief = { text: "Today we ship things.", generatedAt: "2026-01-01", stats: {} };

describe("admin voice-brief", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("loads, generates, and plays the brief", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ brief }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ brief: { ...brief, text: "Fresh brief" } }), { status: 200 })
      );
    const speak = vi.fn();
    const cancel = vi.fn();
    const synth = { speak, cancel };
    Object.defineProperty(globalThis, "speechSynthesis", { value: synth, configurable: true });
    (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = class {
      text: string;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) { this.text = t; }
    };

    const { container } = render(<VoiceBriefPage />);
    await flush();
    expect(container.textContent).toContain("Today we ship things.");

    const genBtn = [...container.querySelectorAll("button")].find((b) =>
      /generate|regenerate/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(genBtn));
    await flush();
    expect(container.textContent).toContain("Fresh brief");

    const playBtn = container.querySelector("button.rounded-full")!;
    await act(async () => fireEvent.click(playBtn));
    expect(speak).toHaveBeenCalled();
    await act(async () => fireEvent.click(playBtn));
    expect(cancel).toHaveBeenCalled();
  });

  it("surfaces load + generate errors", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(new Response("x", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ brief }), { status: 200 }))
      .mockRejectedValueOnce(new Error("gen blew up"));
    const { container } = render(<VoiceBriefPage />);
    await flush();
    expect(container.textContent).toMatch(/500|error|failed/i);
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockRejectedValueOnce(new Error("gen blew up"));
    cleanup();
    const { container: c2 } = render(<VoiceBriefPage />);
    await flush();
    expect(c2.textContent).toMatch(/gen blew up|error/i);
  });
});

describe("admin ai-generator", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  const submit = async (container: HTMLElement, prompt: string) => {
    fireEvent.change(container.querySelector("textarea")!, { target: { value: prompt } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
  };

  it("generates and copies the result", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, result: "Tagline!", usage: { tokens: 5 } }),
        { status: 200 }
      )
    );
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { container } = render(<AiGeneratorPage />);
    await submit(container, "make a tagline");
    await waitFor(() => expect(container.textContent).toContain("Tagline!"));
    const copyBtn = [...container.querySelectorAll("button")].find((b) =>
      /copy/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(copyBtn));
    expect(writeText).toHaveBeenCalledWith("Tagline!");
    expect(container.textContent).toMatch(/copied/i);
  });

  it("shows the 503 not-configured error and api errors", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(new Response("x", { status: 503 }));
    const { container } = render(<AiGeneratorPage />);
    await submit(container, "x");
    await waitFor(() =>
      expect(container.textContent).toContain("not configured")
    );

    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: "bad prompt" }), { status: 400 })
    );
    await submit(container, "y");
    await waitFor(() => expect(container.textContent).toContain("bad prompt"));
  });
});
