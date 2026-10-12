/**
 * Root page locale-strip redirect, campaign landing + thanks pages,
 * portal/waiting wrapper.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("notFound");
  })
);
const headersGet = vi.hoisted(() => vi.fn());
const getCampaignMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (u: string) => redirectMock(u),
  notFound: notFoundMock,
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: headersGet }) }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/data/campaigns", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/data/campaigns")>();
  return { ...mod, getCampaign: getCampaignMock };
});
vi.mock("@/components/CampaignHero", () => ({
  default: ({ campaign }: { campaign: { slug: string } }) => <div>HERO:{campaign.slug}</div>,
}));
vi.mock("@/components/TierTable", () => ({ default: () => <div>TIERS</div> }));
vi.mock("@/app/[locale]/campaigns/[slug]/thanks/ThanksConversion", () => ({
  default: ({ tier, orderId }: { tier: string | null; orderId: string | null }) => (
    <div data-testid="conv">{`conv:${tier}:${orderId}`}</div>
  ),
}));
vi.mock("@/app/portal/waiting/WaitingRoomClient", () => ({
  default: () => <div>WAITING_ROOM</div>,
}));

import RootPage from "@/app/page";
import CampaignsIndex from "@/app/[locale]/campaigns/page";
import CampaignPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/[locale]/campaigns/[slug]/page";
import CampaignThanks from "@/app/[locale]/campaigns/[slug]/thanks/page";
import WaitingRoomPage from "@/app/portal/waiting/page";

const sp = (params: Record<string, unknown> = {}) =>
  Promise.resolve(params) as Promise<Record<string, unknown>>;

afterEach(() => cleanup());

describe("root page locale-strip redirect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects bare / to /en", async () => {
    headersGet.mockReturnValue("/");
    await expect(RootPage()).rejects.toThrow("REDIRECT:/en");
  });

  it("strips one locale prefix", async () => {
    headersGet.mockReturnValue("/el/services");
    await expect(RootPage()).rejects.toThrow("REDIRECT:/en/services");
  });

  it("strips cascading locale prefixes", async () => {
    headersGet.mockReturnValue("/en/en/en/services");
    await expect(RootPage()).rejects.toThrow("REDIRECT:/en/services");
  });

  it("leaves non-locale paths untouched but prefixes /en", async () => {
    headersGet.mockReturnValue("/store");
    await expect(RootPage()).rejects.toThrow("REDIRECT:/en/store");
  });
});

describe("campaign landing page", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const real = await vi.importActual<typeof import("@/data/campaigns")>("@/data/campaigns");
    getCampaignMock.mockImplementation(real.getCampaign);
  });

  it("renders a live campaign", async () => {
    const { container } = render(
      await CampaignPage({ params: sp({ locale: "en", slug: "shop-online" }) })
    );
    expect(container.textContent).toContain("HERO:shop-online");
    expect(container.textContent).toContain("TIERS");
  });

  it("notFound on unknown slug", async () => {
    await expect(
      CampaignPage({ params: sp({ locale: "en", slug: "does-not-exist" }) })
    ).rejects.toThrow("notFound");
  });

  it("notFound on archived campaigns", async () => {
    const real = await vi.importActual<typeof import("@/data/campaigns")>("@/data/campaigns");
    const c = real.getCampaign("shop-online")!;
    getCampaignMock.mockReturnValue({ ...c, status: "archived" });
    await expect(
      CampaignPage({ params: sp({ locale: "en", slug: "shop-online" }) })
    ).rejects.toThrow("notFound");
  });

  it("generateMetadata builds localized metadata", async () => {
    const meta = await generateMetadata({ params: sp({ locale: "el", slug: "shop-online" }) });
    expect(String(meta.title)).toContain("Cloudless");
    const missing = await generateMetadata({ params: sp({ locale: "en", slug: "nope" }) });
    expect(missing.title).toBe("Campaign not found");
  });
});

describe("campaigns index page", () => {
  it("lists live campaigns with links", async () => {
    const { container } = render(await CampaignsIndex({ params: sp({ locale: "en" }) }));
    expect(container.textContent).toContain("Active campaigns");
    const link = container.querySelector('a[href*="shop-online"]');
    expect(link).not.toBeNull();
  });

  it("renders Greek copy for el locale", async () => {
    const { container } = render(await CampaignsIndex({ params: sp({ locale: "el" }) }));
    expect(container.textContent).toContain("Ενεργές καμπάνιες");
  });

  it("falls back to EN for non-campaign locales", async () => {
    const { container } = render(await CampaignsIndex({ params: sp({ locale: "fr" }) }));
    expect(container.textContent).toContain("Active campaigns");
  });

  it("generateStaticParams covers every campaign in both locales", async () => {
    const params = await generateStaticParams();
    const slugs = new Set(params.map((p) => p.slug));
    const locales = new Set(params.map((p) => p.locale));
    expect(slugs.has("shop-online")).toBe(true);
    expect([...locales].sort()).toEqual(["el", "en"]);
  });
});

describe("campaign thanks page", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const real = await vi.importActual<typeof import("@/data/campaigns")>("@/data/campaigns");
    getCampaignMock.mockImplementation(real.getCampaign);
  });

  it("renders order confirmation with tier + order", async () => {
    const { container } = render(
      await CampaignThanks({
        params: sp({ locale: "en", slug: "shop-online" }),
        searchParams: sp({ tier: "launch", order: "cs_123" }),
      })
    );
    expect(container.textContent).toContain("We have your order");
    expect(container.textContent).toContain("conv:launch:cs_123");
  });

  it("renders fit-call variant", async () => {
    const { container } = render(
      await CampaignThanks({
        params: sp({ locale: "el", slug: "shop-online" }),
        searchParams: sp({ tier: "fit-call" }),
      })
    );
    expect(container.textContent).toContain("Καταχωρήθηκε");
  });

  it("notFound on unknown campaign", async () => {
    await expect(
      CampaignThanks({
        params: sp({ locale: "en", slug: "nope" }),
        searchParams: sp({}),
      })
    ).rejects.toThrow("notFound");
  });
});

describe("portal waiting page", () => {
  it("renders the waiting room client", () => {
    const { container } = render(<WaitingRoomPage />);
    expect(container.textContent).toContain("WAITING_ROOM");
  });
});
