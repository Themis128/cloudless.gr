/**
 * OpenGraph image generators — every route's default export renders a real
 * ImageResponse PNG. Slug variants exercise the resolved-title and
 * fallback-title branches with the real static blog post data.
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { ImageResponse } from "next/og";

import RootOg from "@/app/opengraph-image";
import BlogOg from "@/app/[locale]/blog/opengraph-image";
import ContactOg from "@/app/[locale]/contact/opengraph-image";
import DocsOg from "@/app/[locale]/docs/opengraph-image";
import ServicesOg from "@/app/[locale]/services/opengraph-image";
import StoreOg from "@/app/[locale]/store/opengraph-image";
import BlogSlugOg from "@/app/[locale]/blog/[slug]/opengraph-image";
import DocsSlugOg from "@/app/[locale]/docs/[slug]/opengraph-image";

async function expectPng(result: unknown) {
  expect(result).toBeInstanceOf(ImageResponse);
  const res = result as Response;
  expect(res.status).toBe(200);
  const buf = await res.arrayBuffer();
  expect(buf.byteLength).toBeGreaterThan(1000);
}

describe("opengraph-image generators", () => {
  it("static pages each render a PNG", async () => {
    await expectPng(RootOg());
    await expectPng(BlogOg());
    await expectPng(ContactOg());
    await expectPng(DocsOg());
    await expectPng(ServicesOg());
    await expectPng(StoreOg());
  });

  it("blog [slug] uses the real post title when the slug resolves", async () => {
    const res = await BlogSlugOg({
      params: Promise.resolve({
        locale: "en",
        slug: "cloud-migration-guide-small-business",
      }),
    });
    await expectPng(res);
  });

  it("blog [slug] falls back to defaults for an unknown slug", async () => {
    const res = await BlogSlugOg({
      params: Promise.resolve({ locale: "en", slug: "no-such-post-xyz" }),
    });
    await expectPng(res);
  });

  it("blog [slug] falls back when the source throws", async () => {
    const res = await BlogSlugOg({
      params: Promise.resolve({ locale: "en", slug: "" }),
    });
    await expectPng(res);
  });

  it("docs [slug] renders with fallback defaults (appflowy unconfigured)", async () => {
    const res = await DocsSlugOg({
      params: Promise.resolve({ locale: "en", slug: "getting-started" }),
    });
    await expectPng(res);
  });
});
