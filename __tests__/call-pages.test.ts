import { describe, it, expect, vi } from "vitest";

const { nextRedirectMock, i18nRedirectMock } = vi.hoisted(() => ({
  nextRedirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  i18nRedirectMock: vi.fn((args: { href: string; locale: string }) => {
    throw new Error(`I18N_REDIRECT:${args.locale}:${args.href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: nextRedirectMock }));
vi.mock("@/i18n/navigation", () => ({ redirect: i18nRedirectMock }));

import CallRedirectPage, {
  generateMetadata as tokenMetadata,
} from "@/app/[locale]/call/[token]/page";
import CallPage, { generateMetadata as bareMetadata } from "@/app/[locale]/call/page";
import { TALK_CALL_BASE, CONSULT_ROOM_TOKEN } from "@/app/[locale]/call/shared";

const params = (p: Record<string, string>) => Promise.resolve(p);

describe("CallRedirectPage /call/[token]", () => {
  it("forwards a valid token to Talk", async () => {
    await expect(
      CallRedirectPage({ params: params({ locale: "en", token: "zsykkx97" }) })
    ).rejects.toThrow(`NEXT_REDIRECT:${TALK_CALL_BASE}/zsykkx97`);
  });

  it("resolves the consult alias to the consult room", async () => {
    await expect(
      CallRedirectPage({ params: params({ locale: "en", token: "consult" }) })
    ).rejects.toThrow(`NEXT_REDIRECT:${TALK_CALL_BASE}/${CONSULT_ROOM_TOKEN}`);
  });

  it("falls back to the localized consultation page on bad tokens", async () => {
    await expect(
      CallRedirectPage({
        params: params({ locale: "el", token: "BAD!!token" }),
      })
    ).rejects.toThrow("I18N_REDIRECT:el:/consultation");
  });

  it("falls back to en locale on unknown locale", async () => {
    await expect(
      CallRedirectPage({
        params: params({ locale: "xx", token: "BAD!!token" }),
      })
    ).rejects.toThrow("I18N_REDIRECT:en:/consultation");
  });
});

describe("CallPage /call", () => {
  it("drops straight into the consult room", async () => {
    await expect(CallPage()).rejects.toThrow(
      `NEXT_REDIRECT:${TALK_CALL_BASE}/${CONSULT_ROOM_TOKEN}`
    );
  });
});

describe("call page metadata", () => {
  it("returns noindex metadata for the token page", async () => {
    const meta = await tokenMetadata({ params: params({ locale: "en" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.title).toBeTruthy();
  });

  it("returns noindex metadata for the bare page, bad locale falls back", async () => {
    const meta = await bareMetadata({ params: params({ locale: "zz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.title).toBeTruthy();
  });
});
