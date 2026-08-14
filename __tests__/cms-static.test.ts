import { describe, expect, it } from "vitest";
import {
  staticCaseStudies,
  staticFaqs,
  staticServices,
  staticTestimonials,
} from "@/lib/cms-static";

describe("cms-static fallbacks", () => {
  it("ships published FAQ, service, testimonial, and case-study fallbacks", () => {
    expect(staticFaqs.length).toBeGreaterThan(0);
    expect(staticServices.every((s) => s.slug && s.name)).toBe(true);
    expect(staticTestimonials.every((t) => t.quote && t.name)).toBe(true);
    expect(staticCaseStudies.every((c) => c.slug && c.title)).toBe(true);
  });
});
