/**
 * CMS types and static fallbacks. Live source is AppFlowy; these arrays
 * render when AppFlowy is unbound. Do not import Notion adapters from here.
 */

export type FaqCategory = "general" | "pricing" | "technical" | "process";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  locales: string[];
}

export interface FaqInput {
  question: string;
  answer?: string;
  category?: FaqCategory;
  locales?: string[];
  published?: boolean;
  order?: number;
}

export const staticFaqs: Faq[] = [
  {
    id: "f1",
    question: "How long does a cloud audit take?",
    answer:
      "A standard cloud audit is delivered within 5 business days. Complex multi-account organisations may require 7–10 days. You'll receive a full written report plus a 60-minute debrief call.",
    category: "process",
    locales: [],
  },
  {
    id: "f2",
    question: "Do you work with other cloud providers besides AWS?",
    answer:
      "Our core expertise is AWS, but we can advise on GCP and Azure architectures. Most engagements involve AWS as the primary cloud, often alongside Cloudflare for edge and CDN.",
    category: "technical",
    locales: [],
  },
  {
    id: "f3",
    question: "What is the minimum engagement size?",
    answer:
      "The smallest engagement is the Cloud Audit at €1,500. There's no minimum contract length for the monthly retainer — you can cancel at any time.",
    category: "pricing",
    locales: [],
  },
  {
    id: "f4",
    question: "Can you help us pass a SOC 2 or ISO 27001 audit?",
    answer:
      "Yes. Cloud Audits cover security misconfigurations and produce evidence artefacts. We can work alongside your compliance team to close gaps before a formal certification audit.",
    category: "technical",
    locales: [],
  },
  {
    id: "f5",
    question: "Do you sign NDAs?",
    answer:
      "Yes, we sign mutual NDAs before any engagement. Your architecture diagrams, cost data, and business context stay strictly confidential.",
    category: "general",
    locales: [],
  },
  {
    id: "f6",
    question: "How does the monthly retainer work?",
    answer:
      "You get up to 20 hours of senior cloud architecture support per month, a monthly infrastructure review call, unlimited async questions via email or Slack, and on-call incident support. Unused hours do not roll over.",
    category: "pricing",
    locales: [],
  },
];

export interface Testimonial {
  id: string;
  name: string;
  company: string;
  role: string;
  quote: string;
  avatar?: string;
  service?: string;
  rating?: number;
  featured: boolean;
}

export interface TestimonialInput {
  name: string;
  company?: string;
  role?: string;
  quote: string;
  avatar?: string;
  service?: string;
  rating?: number;
  featured?: boolean;
  published?: boolean;
  order?: number;
}

export const staticTestimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Alexandros Papadopoulos",
    company: "TechFlow Athens",
    role: "CTO",
    quote:
      "Cloudless cut our AWS bill by 55% in the first month. Themis understood our architecture immediately and had a plan within 24 hours.",
    service: "Cloud Audit",
    rating: 5,
    featured: true,
  },
  {
    id: "t2",
    name: "Maria Stavridou",
    company: "Retail Plus",
    role: "Head of Engineering",
    quote:
      "We migrated a monolith to serverless in 6 weeks with zero downtime. The result is 10× faster deployments and half the infrastructure cost.",
    service: "Architecture Migration",
    rating: 5,
    featured: true,
  },
  {
    id: "t3",
    name: "Nikos Theodorakis",
    company: "FinStart GR",
    role: "Founder & CEO",
    quote:
      "The monthly retainer gives us a senior cloud architect on call without the full-time hire cost. Invaluable for a startup.",
    service: "Monthly Retainer",
    rating: 5,
    featured: false,
  },
];

export type ServiceCategory = "audit" | "devops" | "consulting" | "training";

export interface CloudlessService {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  category: ServiceCategory;
  features: string[];
  cta: string;
  icon: string;
  stripePriceId?: string;
}

export interface ServiceInput {
  name: string;
  slug?: string;
  description?: string;
  price?: string;
  category?: ServiceCategory;
  features?: string[];
  cta?: string;
  icon?: string;
  stripePriceId?: string;
  published?: boolean;
  order?: number;
}

export const staticServices: CloudlessService[] = [
  {
    id: "cloud-audit",
    slug: "cloud-audit",
    name: "Cloud Audit",
    description:
      "A deep-dive into your AWS infrastructure to uncover hidden costs, security gaps, and performance bottlenecks. Delivered within 5 business days.",
    price: "From €1,500",
    category: "audit",
    icon: "🔍",
    features: [
      "Full cost breakdown by service and team",
      "Security misconfiguration report",
      "Performance & latency analysis",
      "Prioritised remediation roadmap",
      "90-day follow-up check",
    ],
    cta: "Book an audit",
  },
  {
    id: "architecture-review",
    slug: "architecture-review",
    name: "Architecture Review",
    description:
      "Expert evaluation of your system design against AWS Well-Architected Framework pillars: reliability, security, performance, and cost.",
    price: "From €2,000",
    category: "consulting",
    icon: "🏗️",
    features: [
      "Well-Architected Framework assessment",
      "Scalability & reliability analysis",
      "Disaster recovery evaluation",
      "Written recommendations report",
      "60-min debrief call",
    ],
    cta: "Request a review",
  },
  {
    id: "serverless-migration",
    slug: "serverless-migration",
    name: "Serverless Migration",
    description:
      "End-to-end migration from VMs or containers to serverless architecture, with zero-downtime cutover and full monitoring from day one.",
    price: "From €5,000",
    category: "devops",
    icon: "⚡",
    features: [
      "Strangler-fig or big-bang migration strategy",
      "Lambda + API Gateway + EventBridge wiring",
      "CI/CD pipeline setup (GitHub Actions / CodePipeline)",
      "Observability from day one (CloudWatch / Sentry)",
      "Knowledge transfer & runbook",
    ],
    cta: "Start a migration",
  },
  {
    id: "monthly-retainer",
    slug: "monthly-retainer",
    name: "Monthly Retainer",
    description:
      "A senior AWS-certified cloud architect on your team — available for design reviews, incident response, and ongoing cost optimisation.",
    price: "€1,500/mo",
    category: "consulting",
    icon: "🤝",
    features: [
      "Up to 20 hours/month cloud architecture support",
      "Unlimited async questions (email / Slack)",
      "Monthly infrastructure review",
      "On-call incident support",
      "Cancel any time",
    ],
    cta: "Start a retainer",
  },
];

export interface CaseStudyMetric {
  label: string;
  value: string;
}

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  client: string;
  industry: string;
  services: string[];
  summary: string;
  challenge: string;
  solution: string;
  results: string;
  metrics: CaseStudyMetric[];
  coverImage?: string;
  tags: string[];
  featured: boolean;
  date: string;
}

export interface CaseStudyWithContent extends CaseStudy {
  html: string;
}

export interface CaseStudyInput {
  title: string;
  slug?: string;
  client?: string;
  industry?: string;
  services?: string[];
  summary?: string;
  challenge?: string;
  solution?: string;
  results?: string;
  metrics?: CaseStudyMetric[];
  coverImage?: string;
  tags?: string[];
  published?: boolean;
  featured?: boolean;
  date?: string;
}

export const staticCaseStudies: CaseStudy[] = [
  {
    id: "cs1",
    slug: "techflow-aws-cost-reduction",
    title: "55% AWS Cost Reduction for a SaaS Startup",
    client: "TechFlow Athens",
    industry: "SaaS",
    services: ["Cloud Audit", "Cost Optimization"],
    summary:
      "Cloudless identified over-provisioned resources and redesigned the data pipeline architecture, cutting AWS spend by 55% in 30 days.",
    challenge:
      "TechFlow was spending €8,000/month on AWS with no clear understanding of where the money was going. Engineers had accumulated EC2 instances, over-sized RDS databases, and unused Elastic IPs over two years.",
    solution:
      "A full infrastructure audit mapped every resource to its cost. Right-sizing EC2 instances, migrating batch jobs to Lambda, and switching to Aurora Serverless v2 eliminated idle spend immediately.",
    results:
      "Monthly AWS bill dropped from €8,000 to €3,600 within 30 days. The team now has a cost dashboard and automated alerts for anomalies.",
    metrics: [
      { label: "Cost reduction", value: "55%" },
      { label: "Time to results", value: "30 days" },
      { label: "Monthly savings", value: "€4,400" },
    ],
    tags: ["AWS", "Cost optimization", "SaaS"],
    featured: true,
    date: "2026-03-01",
  },
  {
    id: "cs2",
    slug: "retail-plus-serverless-migration",
    title: "Monolith to Serverless in 6 Weeks",
    client: "Retail Plus",
    industry: "E-commerce",
    services: ["Architecture Migration", "DevOps"],
    summary:
      "A 4-year-old Django monolith was decomposed into serverless microservices with zero downtime, enabling 10× faster deployments.",
    challenge:
      "Retail Plus had outgrown their monolithic application. Each deployment took 45 minutes, required manual database migrations, and caused brief downtime during peak trading hours.",
    solution:
      "Critical business domains (orders, inventory, notifications) were extracted into Lambda functions behind API Gateway. A strangler-fig migration allowed the old and new systems to run in parallel during the transition.",
    results:
      "Deployment time fell from 45 minutes to under 4 minutes. Infrastructure cost dropped 40% due to pay-per-use Lambda pricing. Zero downtime migrations are now standard.",
    metrics: [
      { label: "Deploy time", value: "−90%" },
      { label: "Infrastructure cost", value: "−40%" },
      { label: "Migration duration", value: "6 weeks" },
    ],
    tags: ["Serverless", "Lambda", "Migration", "E-commerce"],
    featured: true,
    date: "2026-01-15",
  },
];
