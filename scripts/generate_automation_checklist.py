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
        "Social analytics digest",
        "Pull every platform's numbers once a day, have AI write the summary, deliver to Slack or email.",
        "n8n cron + your analytics source + any LLM",
        "~45 min/week",
    ),
    (
        "Cross-platform publishing",
        "Write one post, publish to LinkedIn, Threads, Instagram, TikTok and Facebook automatically.",
        "SocialAuto or a scheduled n8n workflow",
        "~60 min/week",
    ),
    (
        "Content repurposing",
        "Turn each long post into platform-adapted variants (tone, length, format) without rewriting.",
        "LLM prompt chain + brand voice system prompt",
        "~40 min/post",
    ),
    (
        "DM keyword replies",
        "Comment 'AUTO' -> auto-DM the link. Highest-converting social funnel there is.",
        "Manual replies at small scale; ManyChat free tier later",
        "scales with volume",
    ),
    (
        "Lead capture to inbox",
        "Every download/lead lands in a spreadsheet or CRM with zero manual entry.",
        "Webhook -> Google Sheets / Airtable free tier",
        "~30 min/week",
    ),
    (
        "Invoice & payment tracking",
        "Auto-flag overdue invoices and send a polite nudge before you notice.",
        "Stripe/Paddle webhook + scheduled check",
        "~20 min/week",
    ),
    (
        "Meeting notes to tasks",
        "Transcribe calls, extract action items, push them to your task board.",
        "Whisper (self-hosted) + task webhook",
        "~25 min/meeting",
    ),
    (
        "SEO rank & content watch",
        "Weekly check: which pages gained/lost positions, drafted straight into a report.",
        "Google Search Console API + LLM summary",
        "~35 min/week",
    ),
    (
        "Uptime & deploy alerts",
        "Get pinged the moment prod breaks or a deploy rolls back — before users complain.",
        "Healthchecks.io free tier / Uptime Kuma",
        "sleep at night",
    ),
    (
        "Email triage labels",
        "Classify inbound mail (lead / support / spam) and draft first replies automatically.",
        "IMAP poll + LLM classifier",
        "~30 min/day",
    ),
    (
        "Competitor changelog watch",
        "Get a weekly diff of competitor pricing/feature pages you actually care about.",
        "URL watch + diff + LLM summary",
        "~20 min/week",
    ),
    (
        "Weekly brief generation",
        "One scheduled job that assembles your metrics, wins, and next-week plan into a brief.",
        "n8n cron + your data sources + LLM",
        "~50 min/week",
    ),
]

TOOLS = [
    ("n8n", "Self-hosted workflow engine — the backbone of half this list."),
    ("beehiiv", "Newsletter platform with a genuinely useful free tier."),
    ("Make", "No-code automation, generous free plan for light flows."),
    ("Uptime Kuma", "Free self-hosted monitoring with alerting."),
    ("Semrush", "SEO/competitor data when you're ready to go deeper."),
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
        subject="Free no-code automation checklist for solo founders",
    )

    title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=22, textColor=WHITE, leading=27)
    sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=11, textColor=SLATE_300, leading=15)
    h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=13, textColor=CYAN, leading=17, spaceBefore=14, spaceAfter=6)
    item_t = ParagraphStyle("item_t", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE, leading=14)
    item_b = ParagraphStyle("item_b", fontName="Helvetica", fontSize=9.5, textColor=SLATE_300, leading=13)
    small = ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, textColor=SLATE_500, leading=11)

    def header(canvas, _doc):
        canvas.saveState()
        canvas.setFillColor(VOID)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canvas.setFillColor(CYAN)
        canvas.rect(0, A4[1] - 4 * mm, A4[0], 4 * mm, fill=1, stroke=0)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(SLATE_500)
        canvas.drawCentredString(A4[0] / 2, 9 * mm, f"cloudless.gr/links — free tools, zero fluff. Page {canvas.getPageNumber()}")
        canvas.restoreState()

    story = [
        para("The 12-Automation Checklist", title),
        Spacer(1, 4 * mm),
        para(
            "Reclaim ~6 hours a week. Twelve automations a solo founder "
            "can wire up in an afternoon — every one runs on a free tier "
            "or self-hosted stack. Built from the workflows that run "
            "cloudless.gr in production.",
            sub,
        ),
        Spacer(1, 6 * mm),
    ]

    for i, (name, what, how, saved) in enumerate(CHECKLIST, 1):
        row = Table(
            [[para(f"{i}. {name}", item_t)], [para(what, item_b)], [para(f"<b>Stack:</b> {how} &nbsp;·&nbsp; <b>Saves:</b> {saved}", small)]],
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
        para("Want the workflows built for you? <b>cloudless.gr</b> — managed cloud, automation, and AI marketing systems for startups and SMBs.", sub),
    ]

    doc.build(story, onFirstPage=header, onLaterPages=header)


if __name__ == "__main__":
    build(OUTPUT)
    print(f"wrote {OUTPUT}")
