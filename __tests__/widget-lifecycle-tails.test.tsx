/**
 * Lifecycle tails for TurnstileWidget (script load, callbacks, cleanup) and
 * DeferredRender (idleDelayMs delay + no-requestIdleCallback fallback).
 * Only window.turnstile / env / idle globals are stubbed.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import TurnstileWidget from "@/components/TurnstileWidget";
import DeferredRender from "@/components/DeferredRender";

type TurnstileOpts = {
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

function fakeTurnstile() {
  const renders: { el: HTMLElement; opts: TurnstileOpts }[] = [];
  const removed: string[] = [];
  const api = {
    render: (el: HTMLElement, opts: TurnstileOpts) => {
      renders.push({ el, opts });
      return `w-${renders.length}`;
    },
    reset: vi.fn(),
    remove: (id?: string) => {
      removed.push(String(id));
    },
  };
  return { api, renders, removed };
}

describe("TurnstileWidget", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key-test");
    document.getElementById("cf-turnstile-script")?.remove();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs?.();
    delete (window as Record<string, unknown>).turnstile;
    document.getElementById("cf-turnstile-script")?.remove();
  });

  it("renders, relays token callbacks, and removes the widget on unmount", () => {
    const onToken = vi.fn();
    const { api, renders, removed } = fakeTurnstile();
    (window as Record<string, unknown>).turnstile = api;

    const { unmount } = render(<TurnstileWidget onToken={onToken} />);
    expect(renders).toHaveLength(1);
    expect(renders[0].opts).toHaveProperty("callback");

    renders[0].opts.callback("tok-abc");
    expect(onToken).toHaveBeenCalledWith("tok-abc");
    renders[0].opts["expired-callback"]?.();
    renders[0].opts["error-callback"]?.();
    expect(onToken).toHaveBeenCalledWith(null);
    expect(onToken).toHaveBeenCalledTimes(3);

    unmount();
    expect(removed).toContain("w-1");
  });

  it("mounts via the existing script tag's load listener", () => {
    const onToken = vi.fn();
    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    document.head.appendChild(script);

    render(<TurnstileWidget onToken={onToken} />);
    // turnstile not yet loaded — nothing rendered, listener attached
    const { api, renders } = fakeTurnstile();
    (window as Record<string, unknown>).turnstile = api;
    act(() => {
      script.dispatchEvent(new Event("load"));
    });
    expect(renders).toHaveLength(1);
  });
});

describe("DeferredRender", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete (window as Record<string, unknown>).requestIdleCallback;
    delete (window as Record<string, unknown>).cancelIdleCallback;
  });

  it("honours idleDelayMs before swapping to children", () => {
    vi.useFakeTimers();
    let idleCb: (() => void) | undefined;
    (window as Record<string, unknown>).requestIdleCallback = (cb: () => void) => {
      idleCb = cb;
      return 1;
    };
    (window as Record<string, unknown>).cancelIdleCallback = () => {};

    const c = render(
      <DeferredRender idleDelayMs={300} fallback={<div data-testid="skel" />}>
        <div data-testid="real" />
      </DeferredRender>
    );
    expect(screen.getByTestId("skel")).toBeTruthy();

    // idle fires but the delay hasn't elapsed yet
    act(() => idleCb?.());
    expect(screen.getByTestId("skel")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId("real")).toBeTruthy();
    c.unmount();
  });

  it("falls back to a 0-delay setTimeout without requestIdleCallback", () => {
    vi.useFakeTimers();
    render(
      <DeferredRender fallback={<div data-testid="skel" />}>
        <div data-testid="real" />
      </DeferredRender>
    );
    expect(screen.getByTestId("skel")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByTestId("real")).toBeTruthy();
  });
});
