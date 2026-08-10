/**
 * FAQ types shared between AppFlowy and Notion adapters.
 */

export type FaqCategory = "general" | "pricing" | "technical" | "process";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  locales: string[];
}

export const staticFaqs: Faq[] = [
  // Default static FAQs
  {
    id: "faq-1",
    question: "What is Cloudless.gr?",
    answer: "Cloudless.gr is a cloud consulting and development company.",
    category: "general",
    locales: ["en", "el"],
  },
  {
    id: "faq-2",
    question: "How much do you charge?",
    answer: "Our pricing varies based on project scope.",
    category: "pricing",
    locales: ["en"],
  },
];