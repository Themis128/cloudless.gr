/**
 * Coverage tail batch 4 — self-contained component/context branches:
 * LenisInitializer lazy-import path, PlaybookLeadForm submit error +
 * onChange, CookieConsentProvider reducer dispatches via consumer, and
 * instrumentation.node registerNode development paths.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/lib/i18n", () => ({
  translate: (_l: string, _k: string, fallback: string) => fallback,
}));
vi.mock("@/lib/track-client-event", () => ({ trackClientEvent: vi.fn() }));
vi.mock("@/components/TurnstileWidget", () => ({
  default: ({ onVerify }: { onVerify?: (t: string | null) => void }) =>
    React.createElement(
      "button",
      { "data-testid": "turnstile", onClick: () => onVerify?.("tok") },
      "ts"
    ),
}));

afterEach(() => cleanup());

/* ── LenisInitializer ─────────────────────────────────────────────── */

const lenisCtor = vi.hoisted(() => vi.fn());
vi.mock("lenis", () => ({
  default: class FakeLenis {
    raf = vi.fn();
    destroy = vi.fn();
    constructor(opts: unknown) {
      lenisCtor(opts);
    }
  },
}));

describe("LenisInitializer", () => {
  function stubRafEnv() {
    const rafCbs: FrameRequestCallback[] = [];
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
    vi.stubGlobal("cancelAnimationFrame", cancel);
    return { rafCbs, cancel };
  }

  it("constructs Lenis and drives the raf loop when motion allowed", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { rafCbs } = stubRafEnv();

    const { default: LenisInitializer } = await import("@/components/LenisInitializer");
    render(React.createElement(LenisInitializer));
    await act(async () => {
      await Promise.resolve();
    });
    expect(lenisCtor).toHaveBeenCalled();
    // Exercise the easing callback passed to the constructor.
    const opts = lenisCtor.mock.calls[0][0] as { easing: (t: number) => number };
    expect(opts.easing(0.5)).toBeLessThanOrEqual(1);
    // First raf callback invokes lenis.raf and re-queues.
    expect(rafCbs.length).toBeGreaterThan(0);
    rafCbs[0](16);
    expect(rafCbs.length).toBeGreaterThan(1);
    vi.unstubAllGlobals();
  });

  it("destroys Lenis and cancels raf on unmount", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { cancel } = stubRafEnv();
    const { default: LenisInitializer } = await import("@/components/LenisInitializer");
    const view = render(React.createElement(LenisInitializer));
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
    expect(cancel).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not load Lenis under prefers-reduced-motion", async () => {
    lenisCtor.mockClear();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { default: LenisInitializer } = await import("@/components/LenisInitializer");
    render(React.createElement(LenisInitializer));
    await act(async () => {
      await Promise.resolve();
    });
    expect(lenisCtor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

/* ── PlaybookLeadForm ─────────────────────────────────────────────── */

describe("PlaybookLeadForm", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  async function fillAndSubmit(opts: { consent?: boolean } = {}) {
    const { default: PlaybookLeadForm } = await import("@/components/PlaybookLeadForm");
    render(React.createElement(PlaybookLeadForm));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "ada@example.com" },
    });
    // Honeypot input is hidden but still wired to state.
    fireEvent.change(document.querySelector('input[name="website"]') as HTMLInputElement, {
      target: { value: "spammy.example" },
    });
    if (opts.consent !== false) {
      fireEvent.click(document.querySelector('input[type="checkbox"]') as HTMLInputElement);
    }
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  }

  it("shows the generic error when the submit request rejects", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    await fillAndSubmit();
    await screen.findByText(/something went wrong/i);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/playbook-lead",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("requires consent before submitting", async () => {
    await fillAndSubmit({ consent: false });
    await screen.findByText(/confirm you agree/i);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("shows the email success message on delivery=email", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    await fillAndSubmit();
    await screen.findByText(/on its way to your inbox/i);
  });

  it("shows the already-sent message on delivery=already_sent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, delivery: "already_sent" }), {
        status: 200,
      })
    );
    await fillAndSubmit();
    await screen.findByText(/already received the playbook/i);
  });

  it("shows the download success message on delivery=download", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, delivery: "download" }), { status: 200 })
    );
    await fillAndSubmit();
    await screen.findByText(/Download your copy below/i);
  });

  it("falls back to the direct download when email is not configured", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, code: "not_configured" }), { status: 503 })
    );
    await fillAndSubmit();
    await screen.findByText(/download it directly instead/i);
    const link = document.querySelector('a[href$="cloud-migration-playbook.pdf"]');
    expect(link).not.toBeNull();
  });
});

/* ── CookieConsentProvider dispatch paths ─────────────────────────── */

describe("CookieConsentProvider", () => {
  it("hydrates, toggles settings, and persists accept/reject flows", async () => {
    const { CookieConsentProvider, useCookieConsent } =
      await import("@/context/CookieConsentContext");
    let ctx: ReturnType<typeof useCookieConsent> | null = null;
    function Probe() {
      ctx = useCookieConsent();
      return null;
    }
    render(React.createElement(CookieConsentProvider, null, React.createElement(Probe)));
    // Mounted + hydrated after effect
    await act(async () => {
      await Promise.resolve();
    });
    expect(ctx).not.toBeNull();
    act(() => ctx!.openSettings());
    expect(ctx!.settingsVisible).toBe(true);
    act(() => ctx!.closeSettings());
    expect(ctx!.settingsVisible).toBe(false);
    act(() => ctx!.acceptAll());
    expect(ctx!.hasConsented).toBe(true);
    expect(ctx!.preferences.analytics).toBe(true);
    act(() => ctx!.rejectAll());
    expect(ctx!.preferences.analytics).toBe(false);
    act(() => ctx!.savePreferences({ marketing: true }));
    expect(ctx!.preferences.marketing).toBe(true);
  });

  it("hydrates consent state from a stored cookie", async () => {
    const stored = encodeURIComponent(
      JSON.stringify({ analytics: true, marketing: false, timestamp: "t" })
    );
    document.cookie = `cookieConsent=${stored}; path=/`;
    const { CookieConsentProvider, useCookieConsent } =
      await import("@/context/CookieConsentContext");
    let ctx: ReturnType<typeof useCookieConsent> | null = null;
    function Probe() {
      ctx = useCookieConsent();
      return null;
    }
    render(React.createElement(CookieConsentProvider, null, React.createElement(Probe)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(ctx!.hasConsented).toBe(true);
    expect(ctx!.preferences.analytics).toBe(true);
    expect(ctx!.bannerVisible).toBe(false);
    document.cookie = "cookieConsent=; path=/; max-age=0";
  });

  it("falls back to defaults on a malformed stored cookie", async () => {
    document.cookie = "cookieConsent=not-json{{{; path=/";
    const { CookieConsentProvider, useCookieConsent } =
      await import("@/context/CookieConsentContext");
    let ctx: ReturnType<typeof useCookieConsent> | null = null;
    function Probe() {
      ctx = useCookieConsent();
      return null;
    }
    render(React.createElement(CookieConsentProvider, null, React.createElement(Probe)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(ctx!.hasConsented).toBe(false);
    expect(ctx!.bannerVisible).toBe(true);
    document.cookie = "cookieConsent=; path=/; max-age=0";
  });

  it("throws when useCookieConsent is called outside the provider", async () => {
    const { useCookieConsent } = await import("@/context/CookieConsentContext");
    function Orphan() {
      useCookieConsent();
      return null;
    }
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(React.createElement(Orphan))).toThrow(/within CookieConsentProvider/);
    err.mockRestore();
  });
});

/* ── instrumentation.node registerNode dev paths ──────────────────── */

describe("instrumentation.node registerNode", () => {
  it("binds remote auth db when remote context provides AUTH_DB", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    vi.doMock("@/instrumentation-flags", () => ({
      shouldBindRemoteAuthDb: () => true,
    }));
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: async () => ({
        env: { AUTH_DB: { prepare: (q: string) => ({ q }) } },
      }),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect((globalThis as { __AUTH_DB__?: { prepare: unknown } }).__AUTH_DB__?.prepare).toBeTypeOf(
      "function"
    );
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("warns and continues when the remote context is unavailable", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    vi.doMock("@/instrumentation-flags", () => ({
      shouldBindRemoteAuthDb: () => true,
    }));
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: async () => {
        throw new Error("workerd host unreachable");
      },
    }));
    vi.doMock("@/lib/is-cloudflare-api-host-error", () => ({
      isCloudflareApiHostError: () => true,
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("warns when the remote context lacks AUTH_DB", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    vi.doMock("@/instrumentation-flags", () => ({
      shouldBindRemoteAuthDb: () => true,
    }));
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: async () => ({ env: {} }),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("missing from Cloudflare context"))
    ).toBe(true);
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("warns with the raw message on non-host bind errors", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    vi.doMock("@/instrumentation-flags", () => ({
      shouldBindRemoteAuthDb: () => true,
    }));
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: async () => {
        throw new Error("plain boom");
      },
    }));
    vi.doMock("@/lib/is-cloudflare-api-host-error", () => ({
      isCloudflareApiHostError: () => false,
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("Local AUTH_DB bind failed"))).toBe(
      true
    );
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns early on AUTH_DB_USE_HTTP=1 with live D1 REST configured", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DB_USE_HTTP", "1");
    vi.doMock("@/lib/d1-http", () => ({ canUseD1Http: () => true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("live D1 REST"))).toBe(true);
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("warns and falls back to sqlite when D1 REST is not configured", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DB_USE_HTTP", "1");
    delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    vi.doMock("@/lib/d1-http", () => ({ canUseD1Http: () => false }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("CLOUDFLARE_ACCOUNT_ID"))).toBe(true);
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("warns and continues when the computed local-D1 require is unavailable", async () => {
    // Under vitest (like webpack dev) the computed require throws
    // MODULE_NOT_FOUND — same path webpackEmptyContext triggers in `next dev`.
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    vi.doMock("@/instrumentation-flags", () => ({
      shouldBindRemoteAuthDb: () => false,
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("AUTH_DB missing"))).toBe(true);
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // getLocalAuthDb itself is covered in auth-db-local.node.test.ts — node:sqlite
  // cannot be bundled in the jsdom/client environment.

  it("loads sentry config and fires the deploy notification outside dev", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "covtestsha1");
    const slackDeployNotify = vi.fn(() => Promise.resolve());
    vi.doMock("../sentry.server.config", () => ({}));
    vi.doMock("@/lib/slack-notify", () => ({ slackDeployNotify }));
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    // Allow the fire-and-forget catch chain to settle.
    await act(async () => {
      await Promise.resolve();
    });
    expect(slackDeployNotify).toHaveBeenCalledWith(
      expect.objectContaining({ version: "covtestsha1", status: "succeeded" })
    );
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("swallows a rejecting slackDeployNotify in fireDeployNotification", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "covtestsha2");
    vi.doMock("../sentry.server.config", () => ({}));
    vi.doMock("@/lib/slack-notify", () => ({
      slackDeployNotify: () => Promise.reject(new Error("slack down")),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    await act(async () => {
      await Promise.resolve();
    });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("slackDeployNotify failed"))).toBe(
      true
    );
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
