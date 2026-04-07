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
  it("returns valid Organization + LocalBusiness schema", () => {
    const schema = getOrganizationSchema();

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toContain("Organization");
    expect(schema["@type"]).toContain("LocalBusiness");
    expect(schema.name).toBe("Cloudless");
    expect(schema.url).toBe("https://cloudless.gr");
    expect(schema.email).toBe("tbaltzakis@cloudless.gr");
    expect(schema.address["@type"]).toBe("PostalAddress");
    expect(schema.address.addressCountry).toBe("GR");
  });
});

describe("getServiceSchema", () => {
  it("returns valid Service schema with provider", () => {
    const schema = getServiceSchema({
      name: "Cloud Architecture",
      description: "Design cloud infra",
      price: "2000",
      unit: "per project",
    });

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Service");
    expect(schema.name).toBe("Cloud Architecture");
    expect(schema.description).toBe("Design cloud infra");
    expect(schema.offers["@type"]).toBe("Offer");
    expect(schema.offers.priceCurrency).toBe("EUR");
    expect(schema.provider.name).toBe("Cloudless");
  });
});

describe("getBlogPostSchema", () => {
  it("returns valid BlogPosting schema", () => {
    const schema = getBlogPostSchema({
      title: "Serverless 101",
      excerpt: "Learn serverless basics",
      date: "2026-03-01",
      slug: "serverless-101",
      category: "Serverless",
    });

    expect(schema["@type"]).toBe("BlogPosting");
    expect(schema.headline).toBe("Serverless 101");
    expect(schema.url).toBe("https://cloudless.gr/blog/serverless-101");
    expect(schema.datePublished).toBe("2026-03-01");
    expect(schema.articleSection).toBe("Serverless");
    expect(schema.author.name).toBe("Cloudless");
  });
});

describe("getProductSchema", () => {
  it("returns valid Product schema", () => {
    const schema = getProductSchema({
      name: "Cloud Audit",
      description: "Full audit of your cloud setup",
      price: 499,
    });

    expect(schema["@type"]).toBe("Product");
    expect(schema.name).toBe("Cloud Audit");
    expect(schema.offers.price).toBe("499");
    expect(schema.offers.priceCurrency).toBe("EUR");
    expect(schema.offers.availability).toBe("https://schema.org/InStock");
  });

  it("includes image when provided", () => {
    const schema = getProductSchema({
      name: "T-Shirt",
      description: "Cloudless merch",
      price: 25,
      image: "/images/tshirt.jpg",
    });

    expect(schema.image).toBe("/images/tshirt.jpg");
  });

  it("omits image when not provided", () => {
    const schema = getProductSchema({
      name: "Ebook",
      description: "Cloud guide",
      price: 19,
    });

    expect(schema.image).toBeUndefined();
  });
});

describe("getBreadcrumbSchema", () => {
  it("returns valid BreadcrumbList with correct positions", () => {
    const schema = getBreadcrumbSchema([
      { name: "Home", url: "https://cloudless.gr" },
      { name: "Services", url: "https://cloudless.gr/services" },
    ]);

    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[0].name).toBe("Home");
    expect(schema.itemListElement[1].position).toBe(2);
    expect(schema.itemListElement[1].name).toBe("Services");
  });

  it("handles single breadcrumb", () => {
    const schema = getBreadcrumbSchema([
      { name: "Home", url: "https://cloudless.gr" },
    ]);

    expect(schema.itemListElement).toHaveLength(1);
  });
});

describe("getFAQSchema", () => {
  it("returns valid FAQPage schema", () => {
    const schema = getFAQSchema([
      { question: "What is Cloudless?", answer: "A cloud startup." },
      { question: "Where are you?", answer: "Greece." },
    ]);

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]["@type"]).toBe("Question");
    expect(schema.mainEntity[0].name).toBe("What is Cloudless?");
    expect(schema.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe("A cloud startup.");
  });

  it("handles empty FAQ list", () => {
    const schema = getFAQSchema([]);
    expect(schema.mainEntity).toHaveLength(0);
  });
});
