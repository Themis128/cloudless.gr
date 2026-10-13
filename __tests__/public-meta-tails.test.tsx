/**
 * Metadata/static-param tails for public pages: store index, store/[id],
 * contact, twitter-image.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/store/StoreGrid", () => ({ default: () => null }));
vi.mock("@/components/store/RecommendationGrid", () => ({ default: () => null }));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/ScrollReveal", () => ({ default: () => null }));
vi.mock("@/components/ContactFormSection", () => ({ default: () => null }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));

import { generateMetadata as storeMeta } from "@/app/[locale]/store/page";
import {
  generateMetadata as productMeta,
  generateStaticParams as productStaticParams,
} from "@/app/[locale]/store/[id]/page";
import { generateMetadata as contactMeta } from "@/app/[locale]/contact/page";
import TwitterImage, { alt, size } from "@/app/twitter-image";
import { defaultProducts } from "@/lib/store-products";

const params = (o: Record<string, string>) => Promise.resolve(o);

describe("store index generateMetadata", () => {
  it("returns the localized store meta for a supported locale", async () => {
    const meta = await storeMeta({ params: params({ locale: "en" }) });
    expect(typeof meta.title).toBe("string");
    expect((meta.title as string).length).toBeGreaterThan(0);
  });

  it("falls back to en messages for an unsupported locale", async () => {
    const meta = await storeMeta({ params: params({ locale: "xx" }) });
    const en = await storeMeta({ params: params({ locale: "en" }) });
    expect(meta.title).toBe(en.title);
  });
});

describe("store/[id] metadata + static params", () => {
  it("generateStaticParams emits every default product id", () => {
    const result = productStaticParams();
    expect(result).toHaveLength(defaultProducts.length);
    expect(result).toContainEqual({ id: defaultProducts[0].id });
  });

  it("generateMetadata returns Product Not Found for an unknown id", async () => {
    const meta = await productMeta({
      params: params({ locale: "en", id: "no-such-product" }),
    });
    expect(meta.title).toBe("Product Not Found");
  });

  it("generateMetadata uses the real product name and description", async () => {
    const product = defaultProducts[0];
    const meta = await productMeta({
      params: params({ locale: "en", id: product.id }),
    });
    expect(meta.title).toBe(product.name);
    expect(meta.description).toBe(product.description);
  });
});

describe("contact generateMetadata", () => {
  it("returns contact meta for a supported locale", async () => {
    const meta = await contactMeta({ params: params({ locale: "en" }) });
    expect(typeof meta.title).toBe("string");
  });

  it("falls back to en for an unsupported locale", async () => {
    const meta = await contactMeta({ params: params({ locale: "xx" }) });
    const en = await contactMeta({ params: params({ locale: "en" }) });
    expect(meta.title).toBe(en.title);
  });
});

describe("twitter-image", () => {
  it("exports the twitter card constants and renders an ImageResponse", async () => {
    expect(alt).toContain("Cloudless");
    expect(size).toEqual({ width: 1200, height: 630 });
    const res = TwitterImage();
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
