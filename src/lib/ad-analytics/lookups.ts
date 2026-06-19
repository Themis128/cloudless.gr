/**
 * LinkedIn URN → human-label lookups for the demographic pivots in the
 * every-15-min digest.
 *
 * Why static and not a runtime resolver?
 *  - Industries and seniorities are stable LinkedIn reference data. Changes
 *    are rare and version-locked to the `LinkedIn-Version` header we already
 *    pin. A live `/industries` lookup per poll would cost N extra fetches +
 *    a separate token scope (`r_basicprofile` / `r_ads`) without changing
 *    the answer most of the time.
 *  - Falling back to the raw URN tail when an entry isn't in the table is
 *    no worse than what we had before this PR — so a sparse map is safe.
 *
 * Coverage chosen for cloudless.gr's Greek SMB cloud/MSP ICP:
 *  - Industries: B2B-heavy subset (~80 of 434). Tech, services, retail,
 *    finance, healthcare, education, government, hospitality. Aimed at the
 *    industries that actually click a "Get your shop online" LinkedIn ad.
 *  - Seniorities: the full 10-bucket seniority axis. Cheap to ship all of
 *    them so a "Manager 1" never falls back to "5 1."
 *  - Company sizes: 9 buckets, mapped from LinkedIn's `SIZE_*` enum AND the
 *    letter-coded URN form we've seen in practice. Both keys hit the same
 *    label.
 *
 * Sources:
 *  - Microsoft Learn — LinkedIn industries reference
 *    https://learn.microsoft.com/en-us/linkedin/shared/references/v2/standardized-data/industries
 *  - Microsoft Learn — LinkedIn seniorities reference
 *    https://learn.microsoft.com/en-us/linkedin/shared/references/v2/standardized-data/seniorities
 *  - ConnectSafely — "LinkedIn Industry List 2026: All 434 Industries (V2)"
 *    https://connectsafely.ai/articles/linkedin-industry-list
 */

import type { DemographicPivot } from "./types";

/**
 * LinkedIn industry numeric id → label. Sparse map: an industry not in the
 * table falls back to "Industry #<id>" so the digest still shows actionable
 * signal instead of a bare integer.
 */
export const INDUSTRIES: Record<string, string> = {
  // Tech & internet (the biggest cluster for a cloud/MSP product)
  "4": "Computer Software",
  "3": "Computer Hardware",
  "5": "Computer Networking",
  "6": "Internet",
  "96": "Information Technology & Services",
  "118": "Information Services",
  "121": "Telecommunications",
  "1810": "IT Services and IT Consulting",
  "1842": "Software Development",
  "1855": "Technology, Information and Internet",
  "1594": "Online & Mail Order Retail",

  // Services
  "9": "Law Practice",
  "10": "Legal Services",
  "11": "Higher Education",
  "12": "Education Management",
  "70": "Marketing & Advertising",
  "80": "Marketing Services",
  "82": "Market Research",
  "91": "Online Media",
  "94": "Newspapers",
  "95": "Non-profit Organisation Management",
  "98": "Public Relations & Communications",
  "104": "Management Consulting",
  "129": "Accounting",
  "30": "Food & Beverages",

  // Finance & insurance
  "41": "Banking",
  "42": "Insurance",
  "43": "Investment Banking",
  "45": "Investment Management",
  "46": "Accounting Services",
  "47": "Financial Services",

  // Health
  "13": "Mental Health Care",
  "14": "Hospital & Health Care",
  "15": "Pharmaceuticals",
  "16": "Veterinary",
  "17": "Medical Devices",
  "125": "Medical Practice",

  // Retail (matches the "shop-online" ICP exactly)
  "19": "Wholesale",
  "26": "Apparel & Fashion",
  "27": "Retail",
  "31": "Hospitality",
  "61": "Wine & Spirits",
  "111": "Restaurants",

  // Manufacturing & industrial
  "55": "Manufacturing",
  "75": "Mechanical or Industrial Engineering",
  "112": "Sporting Goods",
  "114": "Furniture",
  "131": "Building Materials",

  // Real estate & government
  "44": "Real Estate",
  "67": "Government Administration",

  // Construction & energy
  "48": "Construction",
  "57": "Mining & Metals",
  "59": "Oil & Energy",
  "60": "Utilities",

  // Transport & logistics
  "87": "Logistics & Supply Chain",
  "108": "Maritime",
  "116": "Transportation & Trucking",

  // Media & creative
  "23": "Architecture & Planning",
  "24": "Graphic Design",
  "25": "Design",
  "37": "Entertainment",
  "73": "Media Production",
  "126": "Performing Arts",
};

/**
 * LinkedIn seniority numeric id → label. Full 10-bucket axis per Microsoft
 * Learn's `/seniorities` reference.
 */
export const SENIORITIES: Record<string, string> = {
  "1": "Unpaid",
  "2": "Training",
  "3": "Entry",
  "4": "Senior",
  "5": "Manager",
  "6": "Director",
  "7": "VP",
  "8": "CXO",
  "9": "Partner",
  "10": "Owner",
};

/**
 * LinkedIn company-size buckets. Two key formats coexist in the wild — the
 * `SIZE_2_TO_10` enum string returned by the Marketing API and the letter-
 * coded URN tail (`A`/`B`/…) that some pivot fetches emit. Both keys map to
 * the same label so the digest reads identically regardless of which form
 * LinkedIn returns on a given day.
 */
export const COMPANY_SIZES: Record<string, string> = {
  SIZE_1: "1 employee",
  A: "1 employee",
  SIZE_2_TO_10: "2–10",
  B: "2–10",
  SIZE_11_TO_50: "11–50",
  C: "11–50",
  SIZE_51_TO_200: "51–200",
  D: "51–200",
  SIZE_201_TO_500: "201–500",
  E: "201–500",
  SIZE_501_TO_1000: "501–1,000",
  F: "501–1,000",
  SIZE_1001_TO_5000: "1,001–5,000",
  G: "1,001–5,000",
  SIZE_5001_TO_10000: "5,001–10,000",
  H: "5,001–10,000",
  SIZE_10001_OR_MORE: "10,001+",
  I: "10,001+",
};

/**
 * Strip the URN prefix and look up a human label for one demographic pivot
 * value. Falls back to a "${PivotLabel} #${id}" string when the id isn't in
 * the table — never returns an empty string, never throws.
 *
 * Inputs:
 *   pivot — the `DemographicPivot` the value came from
 *   urnOrId — either a full URN like `urn:li:industry:6` or the bare id `"6"`
 */
export function resolvePivotLabel(pivot: DemographicPivot, urnOrId: string): string {
  const tail = urnOrId.includes(":") ? urnOrId.slice(urnOrId.lastIndexOf(":") + 1) : urnOrId;
  if (!tail) return "unknown";

  switch (pivot) {
    case "MEMBER_INDUSTRY": {
      const label = INDUSTRIES[tail];
      return label ?? `Industry #${tail}`;
    }
    case "MEMBER_SENIORITY": {
      const label = SENIORITIES[tail];
      return label ?? `Seniority #${tail}`;
    }
    case "MEMBER_COMPANY_SIZE": {
      const label = COMPANY_SIZES[tail];
      return label ?? `Size ${tail}`;
    }
    case "MEMBER_JOB_TITLE":
      // Job titles number in the tens of thousands — too many to embed.
      // Surface the raw id for now; a follow-up can wire LinkedIn's
      // `/standardizedTitles` lookup behind the same function signature.
      return `Title #${tail}`;
    default:
      return tail;
  }
}
