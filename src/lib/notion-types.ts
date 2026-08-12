// Stub types file for AppFlowy migration
export interface ServiceInput {
  name: string;
  description?: string;
  features?: string[];
  price?: string;
  category?: string;
  icon?: string;
  slug?: string;
  published?: boolean;
}

export interface CaseStudyInput {
  title: string;
  slug: string;
  description?: string;
  content?: string;
  metrics?: Array<{ label: string; value: string }>;
  featured?: boolean;
  published?: boolean;
}

export interface FaqInput {
  question: string;
  answer: string;
  category?: string;
  locale?: string;
  published?: boolean;
  order?: number;
}
