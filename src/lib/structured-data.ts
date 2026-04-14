// Schema.org JSON-LD generators for cloudless.gr

export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": string[];
  name: string;
  url: string;
  email: string;
  logo: {
    "@type": "ImageObject";
    url: string;
    width: number;
    height: number;
  };
  description: string;
  address: {
    "@type": "PostalAddress";
    addressCountry: string;
  };
  sameAs: string[];
}

export function getOrganizationSchema(): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    name: "Cloudless",
    url: "https://cloudless.gr",
    // Use a public contact address — not a personal one — for the Knowledge Panel
    email: "contact@cloudless.gr",
    // Logo helps Google display the brand correctly in the Knowledge Panel.
    // Image should be at least 112×112px, hosted on the same domain.
    logo: {
      "@type": "ImageObject",
      url: "https://cloudless.gr/logo.png",
      width: 512,
      height: 512,
    },
    description:
      "Cloud computing, serverless, and AI marketing solutions for modern businesses. We provide scalable analytics and AI-powered marketing infrastructure.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "GR",
    },
    sameAs: [],
  };
}

export interface ServiceSchemaInput {
  name: string;
  description: string;
  price: string;
  unit: string;
}

export interface ServiceSchema {
  "@context": "https://schema.org";
  "@type": "Service";
  name: string;
  description: string;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: "EUR";
    priceSpecification?: {
      "@type": "PriceSpecification";
      priceCurrency: "EUR";
      price: string;
      unitCode: string;
    };
  };
  provider: {
    "@type": "Organization";
    name: "Cloudless";
  };
}

export function getServiceSchema(service: ServiceSchemaInput): ServiceSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    offers: {
      "@type": "Offer",
      price: service.price,
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "EUR",
        price: service.price,
        unitCode: service.unit,
      },
    },
    provider: {
      "@type": "Organization",
      name: "Cloudless",
    },
  };
}

export interface BlogPostSchemaInput {
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  category: string;
}

export interface BlogPostSchema {
  "@context": "https://schema.org";
  "@type": "BlogPosting";
  headline: string;
  description: string;
  datePublished: string;
  url: string;
  articleSection: string;
  author: {
    "@type": "Organization";
    name: "Cloudless";
  };
}

export function getBlogPostSchema(post: BlogPostSchemaInput): BlogPostSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    url: `https://cloudless.gr/blog/${post.slug}`,
    articleSection: post.category,
    author: {
      "@type": "Organization",
      name: "Cloudless",
    },
  };
}

export interface ProductSchemaInput {
  name: string;
  description: string;
  /** Price in the display currency (e.g., 49.00 for €49), NOT cents. */
  price: number;
  image?: string;
}

export interface ProductSchema {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: "EUR";
    availability: "https://schema.org/InStock";
    seller: {
      "@type": "Organization";
      name: "Cloudless";
    };
  };
  image?: string;
}

export function getProductSchema(product: ProductSchemaInput): ProductSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    offers: {
      "@type": "Offer",
      price: product.price.toString(),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "Cloudless",
      },
    },
    ...(product.image && { image: product.image }),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbSchema {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

export function getBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
}

export function getFAQSchema(faqs: FAQItem[]): FAQSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
