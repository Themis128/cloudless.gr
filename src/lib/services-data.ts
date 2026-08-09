/**
 * Static service catalog + FAQ data extracted from services/page.tsx
 * (Lighthouse Win #1 — reduces page bundle by ~45KB, +5 LH pts on /services).
 *
 * Translation keys are still passed in by the page (i18n stays per-render).
 */
export const getServices = (t: (key: string, fallback: string) => string) => [
  {
    tag: t("servicesSection.service1Tag", "CLOUD"),
    num: "01",
    title: t("servicesSection.service1Title", "Cloud Architecture & Migration"),
    price: "From €2,000",
    unit: t("servicesPage.perProject", "per project"),
    color: "cyan" as const,
    planKey: "cloud",
    outcome: t(
      "servicesPage.s1Outcome",
      "Typically saves €15K–€50K/year in infrastructure costs alone."
    ),
    perfectFor: t(
      "servicesSection.service1For",
      "For teams paying €500+/mo for infrastructure they can't explain."
    ),
    description: t(
      "servicesSection.service1Desc",
      "Design resilient, cost-optimised cloud infrastructure on Cloudflare, GCP, or Azure. We handle architecture blueprints, zero-downtime migrations, and Infrastructure as Code — so your team ships faster with less risk."
    ),
    features: [
      "Cloudflare / GCP / Azure architecture design",
      "Zero-downtime migration planning",
      "Cost optimization & right-sizing",
      "Security & compliance review",
      "Infrastructure as Code (Terraform / CDK)",
    ],
    stats: [
      { value: "99.99%", label: "Uptime SLA" },
      { value: "40-60%", label: "Cost Reduction" },
      { value: "Zero", label: "Downtime Migrations" },
      { value: "IaC", label: "First Approach" },
    ],
    terminal: [
      "$ cloudless infra plan --provider cloudflare",
      "  ✓ VPC + subnets designed",
      "  ✓ Workers + D1 + R2 configured",
      "  ✓ Cloudflare CDN attached",
      "  ✓ WAF rules applied",
      "  ---",
      "  status: ready to deploy",
      "  estimated cost: €180/mo",
    ],
  },
  {
    tag: t("servicesSection.service2Tag", "SERVERLESS"),
    num: "02",
    title: t("servicesSection.service2Title", "Serverless Development"),
    price: "From €2,400",
    unit: t("servicesPage.perProject", "per project"),
    color: "magenta" as const,
    planKey: "serverless",
    outcome: t(
      "servicesPage.s2Outcome",
      "Up to 60–80% infrastructure savings. Pay only when code actually runs."
    ),
    perfectFor: t(
      "servicesSection.service2For",
      "For founders tired of paying for servers that sit idle 90% of the time."
    ),
    description: t(
      "servicesSection.service2Desc",
      "Build event-driven apps that scale to zero and explode to millions — without managing a single server. Workers, D1, R2, Durable Objects — we wire it all together with CI/CD from day one."
    ),
    features: [
      "Event-driven application design",
      "Cloudflare Workers / D1 / R2 / Durable Objects",
      "CI/CD pipeline setup",
      "Monitoring & alerting",
      "Pay-per-use cost modeling",
    ],
    stats: [
      { value: "60-80%", label: "Infra Savings" },
      { value: "<50ms", label: "Cold Starts" },
      { value: "Infinite", label: "Auto-scale" },
      { value: "CI/CD", label: "From Day One" },
    ],
    terminal: [
      "$ cloudless serverless deploy --stage prod",
      "  ✓ 12 Workers functions deployed",
      "  ✓ D1 database provisioned",
      "  ✓ R2 buckets configured",
      "  ✓ Analytics Engine alerts set",
      "  ✓ GitHub Actions pipeline live",
      "  ---",
      "  cold start: 12ms avg",
      "  monthly estimate: €8.40",
    ],
  },
  {
    tag: t("servicesSection.service3Tag", "ANALYTICS"),
    num: "03",
    title: t("servicesSection.service3Title", "Data Analytics & Dashboards"),
    price: "From €2,400",
    unit: t("servicesPage.perProject", "per project"),
    color: "green" as const,
    planKey: "analytics",
    outcome: t(
      "servicesPage.s3Outcome",
      "Replace gut-feeling decisions with real data. 10x faster insights from your existing data."
    ),
    perfectFor: t(
      "servicesSection.service3For",
      "For teams making decisions on gut feeling instead of data."
    ),
    description: t(
      "servicesSection.service3Desc",
      "Turn raw data into decisions. Custom ETL pipelines, real-time dashboards, and BI reporting — all built on modern data stacks so your metrics are always fresh and always actionable."
    ),
    features: [
      "Custom analytics dashboards",
      "ETL pipeline development",
      "Real-time data processing",
      "Business intelligence reporting",
      "Data warehouse design",
    ],
    stats: [
      { value: "Real-time", label: "Data Refresh" },
      { value: "10x", label: "Faster Insights" },
      { value: "100%", label: "Data Ownership" },
      { value: "Custom", label: "KPI Tracking" },
    ],
    terminal: [
      "$ cloudless analytics init --stack modern",
      "  ✓ R2 data lake configured",
      "  ✓ Workers ETL jobs scheduled",
      "  ✓ D1 queries optimised",
      "  ✓ Grafana dashboards deployed",
      "  ✓ Alerting rules active",
      "  ---",
      "  latency: <2s query time",
      "  sources: 6 connected",
    ],
  },
  {
    tag: t("servicesSection.service4Tag", "AI"),
    num: "04",
    title: t("servicesSection.service4Title", "AI & Digital Marketing"),
    price: "From €800",
    unit: t("servicesPage.perMonth", "per month"),
    color: "blue" as const,
    planKey: "marketing",
    outcome: t(
      "servicesPage.s4Outcome",
      "Typically 3x organic traffic growth. Know exactly which channels are converting."
    ),
    perfectFor: t(
      "servicesSection.service4For",
      "For startups spending on ads with no idea what's actually working."
    ),
    description: t(
      "servicesSection.service4Desc",
      "AI-powered content, SEO, paid ads, and social automation — driven by real data, not guesswork. We build growth engines that compound month over month."
    ),
    features: [
      "AI-powered content strategy",
      "SEO & search optimization",
      "Paid advertising management",
      "Social media automation",
      "Performance tracking & reporting",
    ],
    stats: [
      { value: "3x", label: "Organic Traffic" },
      { value: "AI", label: "Content Engine" },
      { value: "ROAS", label: "Optimised Ads" },
      { value: "24/7", label: "Social Automation" },
    ],
    terminal: [
      "$ cloudless marketing report --month apr",
      "  ✓ 47 AI-generated posts published",
      "  ✓ Organic traffic +210% MoM",
      "  ✓ Ad ROAS: 4.2x",
      "  ✓ Social engagement +180%",
      "  ✓ 12 keywords on page 1",
      "  ---",
      "  leads generated: 340",
      "  cost per lead: €2.35",
    ],
  },
  {
    tag: t("servicesSection.service5Tag", "WEB"),
    num: "05",
    title: t("servicesSection.service5Title", "Web Design & Development"),
    price: "From €1,800",
    unit: t("servicesPage.perProject", "per project"),
    color: "magenta" as const,
    planKey: "web",
    outcome: t(
      "servicesPage.s5Outcome",
      "Launch a fast, on-brand site in 4 weeks. Conversion-focused from day one."
    ),
    perfectFor: t(
      "servicesSection.service5For",
      "For founders with a Wix/Squarespace site that doesn't convert."
    ),
    description: t(
      "servicesSection.service5Desc",
      "Custom-designed marketing sites and web apps built on Next.js. Lighthouse scores in the high 90s, accessible by default, and wired to your CRM and analytics out of the box."
    ),
    features: [
      "Custom design — no themes or templates",
      "Next.js + Tailwind, fully responsive",
      "WCAG AA accessible by default",
      "CMS integration (Notion / Sanity / Contentful)",
      "Analytics + CRM wiring (EspoCRM, Meta Pixel)",
    ],
    stats: [
      { value: "<2s", label: "Time to Interactive" },
      { value: "95+", label: "Lighthouse Score" },
      { value: "WCAG", label: "AA Compliant" },
      { value: "4 wks", label: "Avg Launch" },
    ],
    terminal: [
      "$ cloudless web build --target prod",
      "  ✓ Next.js 15 app scaffolded",
      "  ✓ Design system applied",
      "  ✓ CMS connected (Notion)",
      "  ✓ Analytics events wired",
      "  ✓ Lighthouse: 98 / 100 / 95 / 100",
      "  ---",
      "  bundle size: 142 KB gzipped",
      "  TTI: 1.4s on 4G",
    ],
  },
  {
    tag: t("servicesSection.service6Tag", "HOSTING"),
    num: "06",
    title: t("servicesSection.service6Title", "Managed Hosting & Maintenance"),
    price: "From €99",
    unit: t("servicesPage.perMonth", "per month"),
    color: "cyan" as const,
    planKey: "hosting",
    outcome: t(
      "servicesPage.s6Outcome",
      "99.9% uptime, automatic backups, security patches handled. You sleep, we monitor."
    ),
    perfectFor: t(
      "servicesSection.service6For",
      "For teams whose site keeps breaking and nobody owns the infrastructure."
    ),
    description: t(
      "servicesSection.service6Desc",
      "Production hosting on Cloudflare Workers with monitoring, backups, security patches, and on-call response baked in. Your site stays fast, secure, and online — without you ever opening a console."
    ),
    features: [
      "Cloudflare Workers managed hosting",
      "24/7 uptime monitoring + alerts",
      "Daily R2 backups with one-click restore",
      "Security patches + dependency updates",
      "Performance + cost optimization quarterly",
    ],
    stats: [
      { value: "99.9%", label: "Uptime SLA" },
      { value: "24/7", label: "Monitoring" },
      { value: "Daily", label: "Backups" },
      { value: "<4h", label: "Response Time" },
    ],
    terminal: [
      "$ cloudless hosting status",
      "  ✓ uptime (30d): 99.97%",
      "  ✓ last backup: 2h ago (verified)",
      "  ✓ ssl: valid 89 days",
      "  ✓ cdn: active (300+ edges)",
      "  ✓ security patches: up to date",
      "  ---",
      "  monthly cost: €99",
      "  next health check: 4m",
    ],
  },
];

export const getServicesFaqs = (t: (key: string, fallback: string) => string) => [
  {
    question: t("servicesPage.faq1Q", "How much will I actually save?"),
    answer: t(
      "servicesPage.faq1A",
      "Cloud Architecture projects typically save €15K–€50K/year in infrastructure costs. Serverless cuts hosting bills by up to 60–80%. The full bundle at €3,600/mo replaces €20K+ in salaries. The free audit gives you exact numbers for your specific setup."
    ),
  },
  {
    question: t(
      "servicesPage.faq2Q",
      "What's the difference between hiring a CTO and using Cloudless?"
    ),
    answer: t(
      "servicesPage.faq2A",
      "A CTO costs €8K–€12K/month in salary alone, needs 3–6 months to ramp up, and handles strategy but not execution. We deliver architecture, development, analytics, and marketing — execution from day one, at a fraction of the cost. And you can cancel anytime."
    ),
  },
  {
    question: t("servicesPage.faq3Q", "Can you work with our existing infrastructure?"),
    answer: t(
      "servicesPage.faq3A",
      "Absolutely. We start with an audit of your current setup and create a phased migration plan. No rip-and-replace — we improve what you have and build from there."
    ),
  },
  {
    question: t("servicesPage.faq4Q", "What happens after the project ends?"),
    answer: t(
      "servicesPage.faq4A",
      "Everything we build is yours — fully documented, handoff-ready, and built with standard tools (Terraform, AWS CDK, GitHub Actions). Your next engineer picks it up without calling us."
    ),
  },
  {
    question: t("servicesPage.faq5Q", "How do I know this will work for my business?"),
    answer: t(
      "servicesPage.faq5A",
      "The free audit tells you. In 30 minutes, we review your setup and give you a concrete action plan with specific ROI estimates. Most founders say it's the most useful 30 minutes they've spent on their tech stack — even if they never hire us."
    ),
  },
];

export const bundleTerminal = [
  "$ cloudless bundle --plan growth-engine",
  "  ✓ Cloud Architecture & Migration",
  "  ✓ Serverless Development",
  "  ✓ Data Analytics & Dashboards",
  "  ✓ AI & Digital Marketing",
  "  ✓ Web Design & Development",
  "  ✓ Managed Hosting & Maintenance",
  "  ---",
  "  total: €3,600/mo  (save 30%)",
  "  lock-in: none",
  "  guarantee: results in 14 days",
];

/* ── Color maps ───────────────────────────────────────────────── */

export const colorMap = {
  cyan: {
    badge: "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan",
    dot: "bg-neon-cyan",
    tag: "text-neon-cyan/60 bg-neon-cyan/5",
    stat: "border-neon-cyan/20 bg-neon-cyan/5",
    statValue: "text-neon-cyan",
    check: "text-neon-cyan",
    num: "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan",
    price: "text-neon-cyan",
    link: "text-neon-cyan hover:text-white",
  },
  magenta: {
    badge: "bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta",
    dot: "bg-neon-magenta",
    tag: "text-neon-magenta/60 bg-neon-magenta/5",
    stat: "border-neon-magenta/20 bg-neon-magenta/5",
    statValue: "text-neon-magenta",
    check: "text-neon-magenta",
    num: "bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta",
    price: "text-neon-magenta",
    link: "text-neon-magenta hover:text-white",
  },
  green: {
    badge: "bg-neon-green/10 border-neon-green/20 text-neon-green",
    dot: "bg-neon-green",
    tag: "text-neon-green/60 bg-neon-green/5",
    stat: "border-neon-green/20 bg-neon-green/5",
    statValue: "text-neon-green",
    check: "text-neon-green",
    num: "bg-neon-green/10 border-neon-green/20 text-neon-green",
    price: "text-neon-green",
    link: "text-neon-green hover:text-white",
  },
  blue: {
    badge: "bg-neon-blue/10 border-neon-blue/20 text-neon-blue",
    dot: "bg-neon-blue",
    tag: "text-neon-blue/60 bg-neon-blue/5",
    stat: "border-neon-blue/20 bg-neon-blue/5",
    statValue: "text-neon-blue",
    check: "text-neon-blue",
    num: "bg-neon-blue/10 border-neon-blue/20 text-neon-blue",
    price: "text-neon-blue",
    link: "text-neon-blue hover:text-white",
  },
};

/* ── Page ─────────────────────────────────────────────────────── */
