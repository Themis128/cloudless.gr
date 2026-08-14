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
});
