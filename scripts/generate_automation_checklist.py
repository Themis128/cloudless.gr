#!/usr/bin/env python3
"""Generate the Cloudless "12-Automation Checklist" lead-magnet PDF.

Run inside social-api (has reportlab):

    docker exec social-api python /app/scripts/generate_automation_checklist.py \
        /tmp/automation-checklist.pdf

then copy into cloudless.gr/public/.
"""

import sys

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

VOID = HexColor("#0a0a0f")
VOID_LIGHT = HexColor("#12121a")
CYAN = HexColor("#00fff5")
SLATE_300 = HexColor("#cbd5e1")
SLATE_500 = HexColor("#64748b")
WHITE = HexColor("#f8fafc")

OUTPUT = sys.argv[1] if len(sys.argv) > 1 else "automation-checklist.pdf"

CHECKLIST = [
    (
        "Cross-platform publishing",
        "Write one post, publish to LinkedIn, Threads, Instagram, TikTok, Facebook, and X automatically. One dashboard, six platforms, zero copy-pasting.",
        "Celery + Redis + free-tier platform APIs",
        "~60 min/week",
    ),
    (
        "AI content generation",
        "Generate platform-adapted post copy from a single brief. SEO scoring, NLP plain-English check, and brand-voice compliance built in.",
        "Workers AI / local LLM + brand voice system prompt",
        "~40 min/post",
    ),
    (
        "Social analytics digest",
        "Pull every platform's engagement, reach, and follower data daily. AI writes the summary and delivers it to Slack before your coffee.",
        "n8n cron + analytics APIs + LLM summary",
        "~45 min/week",
    ),
    (
        "Lead capture to CRM",
        "Every form submission, download, or booking lands in your CRM with zero manual entry. Automatic lead scoring and Slack notification.",
        "Webhook + EspoCRM / Airtable free tier",
        "~30 min/week",
    ),
    (
        "SEO rank and content watch",
        "Weekly report: which pages gained or lost positions, new keyword opportunities, and a drafted action plan.",
        "Google Search Console API + Ahrefs + LLM summary",
        "~35 min/week",
    ),
    (
        "Uptime and deploy alerts",
        "Get pinged the moment production breaks or a deploy rolls back. Self-hosted monitoring with zero monthly cost.",
        "Uptime Kuma + Healthchecks.io free tier",
        "sleep at night",
    ),
    (
        "Serverless deploy pipeline",
        "Push to main, auto-deploy to Cloudflare Workers. Zero-downtime with automatic rollback if health checks fail.",
        "GitHub Actions + Wrangler + Workers",
        "~20 min/deploy",
    ),
    (
        "Automated backup and restore",
        "Daily backups to R2 with one-click restore. Database, files, and config. Tested monthly so it works when you need it.",
        "Cron + R2 + pg_dump / restic",
        "disaster-proof",
    ),
    (
        "Email triage and auto-reply",
        "Classify inbound mail (lead / support / spam) and draft first replies automatically. Route to the right person.",
        "IMAP poll + LLM classifier + self-hosted Postfix",
        "~30 min/day",
    ),
    (
        "Custom analytics dashboards",
        "Real-time dashboards that pull from your actual data sources. No more spreadsheets, no more guessing.",
        "Metabase / Grafana + DuckDB / Postgres",
        "~50 min/week",
    ),
    (
        "Competitor pricing watch",
        "Weekly diff of competitor pricing and feature pages. AI summary of what changed and what it means for you.",
        "URL watch + diff + LLM summary",
        "~20 min/week",
    ),
    (
        "Weekly strategy brief",
        "One scheduled job assembles your metrics, wins, content performance, and next-week plan into a brief. Delivered to Slack every Monday.",
        "n8n cron + Windsor.ai + LLM",
        "~50 min/week",
    ),
]

TOOLS = [
    ("n8n", "Self-hosted workflow engine — the backbone of half this list."),
    ("Cloudflare Workers", "Serverless compute with zero cold start. Free tier covers most SMB workloads."),
    ("Uptime Kuma", "Free self-hosted monitoring with alerting — runs on a Raspberry Pi."),
    ("Metabase", "Open-source business intelligence. Connect to any database, get dashboards in minutes."),
    ("Workers AI", "Run inference on Cloudflare's edge. Free tier includes 10K requests/day."),
]


def para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def build(path: str) -> None:
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="The 12-Automation Checklist",
        author="cloudless.gr",
        subject="Free automation checklist for startups and SMBs — October 2026 edition",
    )

    title = ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=22, textColor=WHITE, leading=27
    )
    sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=11, textColor=SLATE_300, leading=15)
    h = ParagraphStyle(
        "h",
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=CYAN,
        leading=17,
        spaceBefore=14,
        spaceAfter=6,
    )
    item_t = ParagraphStyle(
        "item_t", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE, leading=14
    )
    item_b = ParagraphStyle(
        "item_b", fontName="Helvetica", fontSize=9.5, textColor=SLATE_300, leading=13
    )
    small = ParagraphStyle(
        "small", fontName="Helvetica", fontSize=8.5, textColor=SLATE_500, leading=11
    )

    def header(canvas, _doc):
        canvas.saveState()
        canvas.setFillColor(VOID)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canvas.setFillColor(CYAN)
        canvas.rect(0, A4[1] - 4 * mm, A4[0], 4 * mm, fill=1, stroke=0)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(SLATE_500)
        canvas.drawCentredString(
            A4[0] / 2,
            9 * mm,
            f"cloudless.gr/links — free tools, zero fluff. Page {canvas.getPageNumber()}",
        )
        canvas.restoreState()

    story = [
        para("The 12-Automation Checklist", title),
        Spacer(1, 4 * mm),
        para(
            "Reclaim ~6 hours a week. Twelve automations any startup can "
            "wire up in an afternoon — every one runs on a free tier "
            "or self-hosted stack. Built from the workflows that run "
            "cloudless.gr in production. Updated October 2026.",
            sub,
        ),
        Spacer(1, 6 * mm),
    ]

    for i, (name, what, how, saved) in enumerate(CHECKLIST, 1):
        row = Table(
            [
                [para(f"{i}. {name}", item_t)],
                [para(what, item_b)],
                [para(f"<b>Stack:</b> {how} &nbsp;·&nbsp; <b>Saves:</b> {saved}", small)],
            ],
            colWidths=[174 * mm],
        )
        row.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), VOID_LIGHT),
                    ("BOX", (0, 0), (-1, -1), 0.6, HexColor("#1e293b")),
                    ("LINEBEFORE", (0, 0), (0, -1), 2, CYAN),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, 0), 7),
                    ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
                    ("TOPPADDING", (0, 1), (-1, -1), 2),
                ]
            )
        )
        story += [row, Spacer(1, 3 * mm)]

    story += [
        para("The tools we actually run", h),
        ListFlowable(
            [ListItem(para(f"<b>{t}</b> — {d}", item_b)) for t, d in TOOLS],
            bulletType="bullet",
            leftIndent=12,
        ),
        Spacer(1, 4 * mm),
        para(
            "Disclosure: cloudless.gr participates in affiliate programs for some tools "
            "listed here. Recommendations reflect what runs in production — affiliate or not.",
            small,
        ),
        Spacer(1, 6 * mm),
        para(
            "Want these workflows built for you? <b>cloudless.gr</b> offers six services — "
            "Cloud Architecture, Serverless Development, Data Analytics, AI Marketing, "
            "Web Design, and Managed Hosting — individually or bundled at 30% savings. "
            "Book a free 30-minute audit: <b>cloudless.gr/contact</b>",
            sub,
        ),
    ]

    doc.build(story, onFirstPage=header, onLaterPages=header)


if __name__ == "__main__":
    build(OUTPUT)
    print(f"wrote {OUTPUT}")
