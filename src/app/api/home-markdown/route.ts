import { NextResponse } from "next/server";

export async function GET() {
  const markdown = `# Cloudless — Cloud Computing, Serverless & AI Marketing

Clear skies. Zero friction. We help startups and SMBs with cloud architecture, serverless development, data analytics, and AI-powered digital marketing.

## Our Services
- **Cloud Architecture & Migration**: Design and migrate your infrastructure to AWS, GCP, or Azure with zero downtime.
- **Serverless Development**: Build event-driven applications that scale automatically and cost nothing when idle.
- **Data Analytics & Dashboards**: Turn raw data into actionable insights with custom dashboards and pipelines.
- **AI & Digital Marketing**: AI-powered campaigns, SEO, and content strategy that drives measurable growth.

## Why Cloudless?
- **Results in 14 Days**: Measurable progress within two weeks of kickoff.
- **No Lock-in Contracts**: Month-to-month. Cancel anytime.
- **Your Code Is Yours**: Full documentation, handoff-ready.

## Get Started
Book a free 30-minute audit to review your current setup and identify quick wins.
URL: https://cloudless.gr/contact
`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}