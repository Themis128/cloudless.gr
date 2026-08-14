/**
 * Map gold GSC sections into dimension rows for admin analytics APIs.
 * Pure — no R2 / live GSC.
 */

export type GoldSectionRows = ReadonlyArray<Record<string, string | number | null>>;

export function mapGoldRowsForGscDimension(
  dimension: string,
  sections: {
    top_keywords?: GoldSectionRows;
    top_pages?: GoldSectionRows;
    gsc_countries?: GoldSectionRows;
    gsc_devices?: GoldSectionRows;
    gsc_query_pages?: GoldSectionRows;
  }
): { rows: GoldSectionRows; note: string } {
  switch (dimension) {
    case "query":
      return {
        rows: sections.top_keywords ?? [],
        note: "Served from gold top_keywords.",
      };
    case "page":
      return {
        rows: (sections.top_pages ?? []).map((r) => ({
          page: String(r.page ?? ""),
          clicks: Number(r.clicks) || 0,
          impressions: Number(r.impressions) || 0,
          ctr: Number(r.ctr) || 0,
          position: Number(r.avg_position ?? r.position) || 0,
        })),
        note: "Served from gold top_pages (rolled up from keywords parquet).",
      };
    case "country":
      return {
        rows: (sections.gsc_countries ?? []).map((r) => ({
          country: String(r.country ?? ""),
          clicks: Number(r.clicks) || 0,
          impressions: Number(r.impressions) || 0,
          ctr: Number(r.ctr) || 0,
          avgPosition: Number(r.avg_position ?? r.position) || 0,
        })),
        note: "Served from gold gsc_countries.",
      };
    case "device":
      return {
        rows: (sections.gsc_devices ?? []).map((r) => ({
          device: String(r.device ?? ""),
          clicks: Number(r.clicks) || 0,
          impressions: Number(r.impressions) || 0,
          ctr: Number(r.ctr) || 0,
          avgPosition: Number(r.avg_position ?? r.position) || 0,
        })),
        note: "Served from gold gsc_devices.",
      };
    case "query_page":
      return {
        rows: sections.gsc_query_pages ?? [],
        note: "Served from gold gsc_query_pages.",
      };
    case "product": {
      const pages = sections.top_pages ?? [];
      const productRows = pages
        .filter((r) => String(r.page ?? "").includes("/store/"))
        .map((r) => ({
          page: String(r.page ?? ""),
          clicks: Number(r.clicks) || 0,
          impressions: Number(r.impressions) || 0,
          ctr: Number(r.ctr) || 0,
          position: Number(r.avg_position ?? r.position) || 0,
        }));
      return {
        rows: productRows,
        note: "Served from gold top_pages filtered to /store/ paths.",
      };
    }
    default:
      return {
        rows: [],
        note: `Dimension "${dimension}" not in gold — no live GSC.`,
      };
  }
}
