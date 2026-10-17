import { describe, expect, it } from "vitest";
import { mapGoldRowsForGscDimension } from "@/lib/gsc-dimension-gold";

describe("mapGoldRowsForGscDimension", () => {
  const sections = {
    top_keywords: [{ query: "cloudless", clicks: 10, impressions: 100, ctr: 0.1, avg_position: 3 }],
    top_pages: [
      { page: "https://cloudless.gr/", clicks: 50, impressions: 500, ctr: 0.1, avg_position: 4 },
      {
        page: "https://cloudless.gr/en/store/hosting",
        clicks: 20,
        impressions: 200,
        ctr: 0.1,
        avg_position: 8,
      },
    ],
    gsc_countries: [{ country: "grc", clicks: 30, impressions: 300, ctr: 0.1, avg_position: 5 }],
    gsc_devices: [{ device: "MOBILE", clicks: 12, impressions: 120, ctr: 0.1, avg_position: 6 }],
    gsc_query_pages: [
      {
        query: "hosting",
        page: "https://cloudless.gr/en/store/hosting",
        clicks: 5,
        impressions: 50,
        ctr: 0.1,
        position: 7,
      },
    ],
  };

  it("maps page/country/device/query_page/product", () => {
    expect(mapGoldRowsForGscDimension("page", sections).rows[0]).toMatchObject({
      page: "https://cloudless.gr/",
      position: 4,
    });
    expect(mapGoldRowsForGscDimension("country", sections).rows[0]).toMatchObject({
      country: "grc",
      avgPosition: 5,
    });
    expect(mapGoldRowsForGscDimension("device", sections).rows[0]).toMatchObject({
      device: "MOBILE",
    });
    expect(mapGoldRowsForGscDimension("query_page", sections).rows).toHaveLength(1);
    expect(mapGoldRowsForGscDimension("product", sections).rows).toHaveLength(1);
    expect(mapGoldRowsForGscDimension("product", sections).rows[0]).toMatchObject({
      page: "https://cloudless.gr/en/store/hosting",
    });
  });

  it("returns empty for unknown dimensions", () => {
    expect(mapGoldRowsForGscDimension("unknown", sections).rows).toEqual([]);
  });

  describe("missing sections and malformed gold rows", () => {
    // Gold parquet rows come back with nulls, numeric strings and NaN-ish
    // values; the admin tables must never render NaN or "null".
    const messy = {
      page: null,
      country: null,
      device: null,
      clicks: null,
      impressions: "abc",
      ctr: undefined,
      avg_position: null,
      position: null,
    } as unknown as Record<string, string | number | null>;

    it.each(["query", "page", "country", "device", "query_page", "product"])(
      "returns no rows when the %s section is absent",
      (dimension) => {
        const out = mapGoldRowsForGscDimension(dimension, {});
        expect(out.rows).toEqual([]);
        expect(out.note).toMatch(/^Served from gold /);
      }
    );

    it("zeroes non-numeric metrics and blanks null labels for page rows", () => {
      expect(mapGoldRowsForGscDimension("page", { top_pages: [messy] }).rows).toEqual([
        { page: "", clicks: 0, impressions: 0, ctr: 0, position: 0 },
      ]);
    });

    it("zeroes non-numeric metrics and blanks null labels for country rows", () => {
      expect(mapGoldRowsForGscDimension("country", { gsc_countries: [messy] }).rows).toEqual([
        { country: "", clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 },
      ]);
    });

    it("zeroes non-numeric metrics and blanks null labels for device rows", () => {
      expect(mapGoldRowsForGscDimension("device", { gsc_devices: [messy] }).rows).toEqual([
        { device: "", clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 },
      ]);
    });

    it("drops null-page rows from the product view instead of matching them", () => {
      expect(mapGoldRowsForGscDimension("product", { top_pages: [messy] }).rows).toEqual([]);
    });

    it("zeroes non-numeric metrics on store-page product rows", () => {
      expect(
        mapGoldRowsForGscDimension("product", { top_pages: [{ ...messy, page: "/el/store/seo" }] })
          .rows
      ).toEqual([{ page: "/el/store/seo", clicks: 0, impressions: 0, ctr: 0, position: 0 }]);
    });

    it("coerces numeric strings and falls back from avg_position to position", () => {
      const row = {
        page: "/en/store/vps",
        clicks: "7",
        impressions: "70",
        ctr: "0.1",
        avg_position: null,
        position: "2.5",
      };
      const expected = {
        page: "/en/store/vps",
        clicks: 7,
        impressions: 70,
        ctr: 0.1,
        position: 2.5,
      };
      expect(mapGoldRowsForGscDimension("page", { top_pages: [row] }).rows).toEqual([expected]);
      expect(mapGoldRowsForGscDimension("product", { top_pages: [row] }).rows).toEqual([expected]);
      expect(
        mapGoldRowsForGscDimension("country", { gsc_countries: [{ ...row, country: "grc" }] })
          .rows[0]
      ).toMatchObject({ country: "grc", avgPosition: 2.5 });
      expect(
        mapGoldRowsForGscDimension("device", { gsc_devices: [{ ...row, device: "DESKTOP" }] })
          .rows[0]
      ).toMatchObject({ device: "DESKTOP", avgPosition: 2.5 });
    });

    it("names the unknown dimension in the note", () => {
      expect(mapGoldRowsForGscDimension("search_appearance", {}).note).toBe(
        'Dimension "search_appearance" not in gold — no live GSC.'
      );
    });
  });
});
