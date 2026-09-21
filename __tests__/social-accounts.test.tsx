import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SOCIAL_ACCOUNTS } from "@/components/social-accounts";
import SocialLinks from "@/components/SocialLinks";

describe("SOCIAL_ACCOUNTS", () => {
  it("lists every connected Cloudless business profile", () => {
    expect(SOCIAL_ACCOUNTS.map((a) => a.key)).toEqual([
      "linkedin",
      "instagram",
      "facebook",
      "threads",
      "tiktok",
      "x",
      "github",
      "telegram",
    ]);
  });

  it("uses https profile URLs with a handle", () => {
    for (const a of SOCIAL_ACCOUNTS) {
      expect(a.href).toMatch(/^https:\/\//);
      expect(a.handle.length).toBeGreaterThan(0);
    }
  });

  it("marks messaging channels as chat", () => {
    expect(SOCIAL_ACCOUNTS.find((a) => a.key === "telegram")?.kind).toBe("chat");
    expect(SOCIAL_ACCOUNTS.filter((a) => a.kind === "follow").length).toBe(
      SOCIAL_ACCOUNTS.length - 1
    );
  });
});

describe("SocialLinks", () => {
  it("renders one external link per account", () => {
    const { container } = render(<SocialLinks />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(SOCIAL_ACCOUNTS.length);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });

  it("labels links with platform and handle", () => {
    const { container } = render(<SocialLinks />);
    const link = container.querySelector('a[aria-label="Cloudless on LinkedIn (cloudless.gr)"]');
    expect(link?.getAttribute("href")).toBe("https://www.linkedin.com/company/cloudless-gr");
  });
});
