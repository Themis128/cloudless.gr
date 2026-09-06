import { describe, it, expect } from "vitest";
import {
  getOrganizationSchema,
  getServiceSchema,
  getBlogPostSchema,
  getProductSchema,
  getBreadcrumbSchema,
  getFAQSchema,
} from "@/lib/structured-data";

describe("getOrganizationSchema", () => {
  const schema = getOrganizationSchema();

  it("has correct @context and @type", () => {
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toContain("Organization");
    expect(schema["@type"]).toContain("LocalBusiness");
  });

  it("has name and url", () => {
    expect(schema.name).toBe("Cloudless");
    expect(schema.url).toBe("https://cloudless.gr");
  });

  it("has a logo with dimensions", () => {
    expect(schema.logo["@type"]).toBe("ImageObject");
    expect(schema.logo.width).toBe(512);
    expect(schema.logo.height).toBe(512);
  });

  it("has an address with GR country code", () => {
    expect(schema.address.addressCountry).toBe("GR");
  });

  it("has sameAs links", () => {
    expect(schema.sameAs.length).toBeGreaterThan(0);
  });
});

describe("getServiceSchema", () => {
  const input = { name: "Cloud Arch", description: "We build cloud", price: "2000", unit: "MON" };
  const schema = getServiceSchema(input);

  it("has correct @type", () => {
    expect(schema["@type"]).toBe("Service");
  });

  it("maps name and description", () => {
    expect(schema.name).toBe("Cloud Arch");
    expect(schema.description).toBe("We build cloud");
  });

  it("includes offer with EUR currency", () => {
    expect(schema.offers["@type"]).toBe("Offer");
    expect(schema.offers.priceCurrency).toBe("EUR");
    expect(schema.offers.price).toBe("2000");
  });

  it("includes Cloudless as provider", () => {
    expect(schema.provider.name).toBe("Cloudless");
  });
});

describe("getBlogPostSchema", () => {
  const input = {
    title: "My Post",
    excerpt: "Short desc",
    date: "2026-09-06",
    slug: "my-post",
    category: "Cloud",
  };

  it("has @type BlogPosting", () => {
    expect(getBlogPostSchema(input)["@type"]).toBe("BlogPosting");
  });

  it("builds correct url", () => {
    expect(getBlogPostSchema(input).url).toBe("https://cloudless.gr/blog/my-post");
  });

  it("defaults author to Organization when none given", () => {
    const schema = getBlogPostSchema(input);
    expect(schema.author["@type"]).toBe("Organization");
    expect(schema.author.name).toBe("Cloudless");
  });

  it("sets author to Person when given", () => {
    const schema = getBlogPostSchema({ ...input, author: "Jane Dev" });
    expect(schema.author["@type"]).toBe("Person");
    expect(schema.author.name).toBe("Jane Dev");
  });

  it("includes coverImage when provided", () => {
    const schema = getBlogPostSchema({ ...input, coverImage: "https://cdn.example.com/img.png" });
    expect(schema.image).toBe("https://cdn.example.com/img.png");
  });

  it("omits image when coverImage is not given", () => {
    const schema = getBlogPostSchema(input);
    expect("image" in schema).toBe(false);
  });
});

describe("getProductSchema", () => {
  const schema = getProductSchema({ name: "Report", description: "Audit", price: 49 });

  it("has @type Product", () => {
    expect(schema["@type"]).toBe("Product");
  });

  it("formats price as string", () => {
    expect(schema.offers.price).toBe("49");
  });

  it("sets availability to InStock", () => {
    expect(schema.offers.availability).toBe("https://schema.org/InStock");
  });

  it("omits image when not given", () => {
    expect("image" in schema).toBe(false);
  });

  it("includes image when given", () => {
    const s = getProductSchema({ name: "X", description: "Y", price: 10, image: "img.png" });
    expect(s.image).toBe("img.png");
  });
});

describe("getBreadcrumbSchema", () => {
  const items = [
    { name: "Home", url: "https://cloudless.gr" },
    { name: "Blog", url: "https://cloudless.gr/blog" },
  ];
  const schema = getBreadcrumbSchema(items);

  it("has @type BreadcrumbList", () => {
    expect(schema["@type"]).toBe("BreadcrumbList");
  });

  it("assigns correct positions (1-indexed)", () => {
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
  });

  it("maps names and urls", () => {
    expect(schema.itemListElement[0].name).toBe("Home");
    expect(schema.itemListElement[1].item).toBe("https://cloudless.gr/blog");
  });
});

describe("getFAQSchema", () => {
  const faqs = [{ question: "What is cloud?", answer: "It is computing." }];
  const schema = getFAQSchema(faqs);

  it("has @type FAQPage", () => {
    expect(schema["@type"]).toBe("FAQPage");
  });

  it("maps questions and answers", () => {
    expect(schema.mainEntity[0].name).toBe("What is cloud?");
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe("It is computing.");
  });

  it("handles empty list", () => {
    expect(getFAQSchema([]).mainEntity).toHaveLength(0);
  });
});
