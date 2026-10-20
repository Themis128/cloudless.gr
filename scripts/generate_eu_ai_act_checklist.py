#!/usr/bin/env python3
"""Generate the Cloudless "EU AI Act Readiness Checklist" lead-magnet PDF.

Run inside social-api (has reportlab):

    docker exec social-api python /app/scripts/generate_eu_ai_act_checklist.py \
        /tmp/eu-ai-act-checklist.pdf

then copy into cloudless.gr/public/.

Content tracks Regulation (EU) 2024/1689 application dates:
- 2024-08-01 in force; 2025-02-02 prohibitions + AI literacy (Art. 4-5);
- 2025-08-02 GPAI + governance; 2026-08-02 high-risk Annex III + Art. 50
  transparency; 2027-08-02 Annex I regulated products.
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

OUTPUT = sys.argv[1] if len(sys.argv) > 1 else "eu-ai-act-checklist.pdf"

# (title, what to do, why it matters, deadline)
CHECKLIST = [
    (
        "Inventory every AI system you touch",
        "List every tool that uses AI — chatbots, CV screeners, content generators, "
        "analytics copilots — whether you built it or bought it. Split the list into "
        "'we provide it' vs 'we only use it'. You can't comply with what you can't name.",
        "Providers and deployers carry different duties. Most SMBs are deployers, "
        "but the moment you rebrand, fine-tune, or substantially modify a system, "
        "you become a provider with the full obligations.",
        "Now — Art. 4 literacy applies since Feb 2025",
    ),
    (
        "Train your team (AI literacy)",
        "Give everyone who operates an AI system a working briefing: what the "
        "system does, what it can't do, and when to escalate. A one-page internal "
        "guide per tool is enough — keep it in your wiki.",
        "Article 4 requires AI literacy for anyone dealing with AI systems on "
        "your behalf. It has applied since 2 Feb 2025 and regulators already ask for it.",
        "Applied 2 Feb 2025 — already binding",
    ),
    (
        "Screen for prohibited practices",
        "Check your stack against the Art. 5 ban list: social scoring, manipulative "
        "dark patterns, untargeted face scraping, workplace emotion recognition, "
        "biometric categorisation by sensitive traits, and predictive policing. "
        "If anything matches, stop using it.",
        "Fines here are the maximum tier — up to EUR 35M or 7% of global turnover. "
        "Prohibitions have applied since 2 Feb 2025.",
        "Applied 2 Feb 2025 — already binding",
    ),
    (
        "Flag high-risk uses in Annex III",
        "The classic SMB traps: CV screening or candidate ranking (employment), "
        "credit scoring or pricing of insurance, biometric ID, education "
        "admissions, and safety components in regulated products. If you deploy "
        "one of these, the high-risk chapter applies to you.",
        "High-risk deployers must follow the provider's instructions, keep "
        "meaningful human oversight, feed relevant input data, and retain logs. "
        "Some deployers also owe a fundamental-rights impact assessment.",
        "2 Aug 2026 (Annex III) · 2 Aug 2027 (Annex I products)",
    ),
    (
        "Disclose when people talk to a machine",
        "Label your chatbot as a bot. If your site, support desk, or DMs answer "
        "with AI, say so up front — 'I'm the Cloudless bot' is enough. Keep the "
        "disclosure close to the first message, not buried in a footer.",
        "Art. 50 transparency duties apply to deployers of chatbots, emotion "
        "recognition, and deep-fake / synthetic content from 2 Aug 2026.",
        "2 Aug 2026",
    ),
    (
        "Mark AI-generated media",
        "Adopt a rule that AI-made images, video, audio, and text you publish are "
        "marked as synthetic in a machine-readable way. Build it into your "
        "pipeline once instead of hand-tagging every asset.",
        "Art. 50 requires synthetic content to be labelled as artificially "
        "generated or manipulated. Content pipelines make this a one-time "
        "engineering decision.",
        "2 Aug 2026",
    ),
    (
        "Put a human in the loop — on paper",
        "For each AI system, name who reviews output before it reaches a customer "
        "and who can switch it off. Write the escalation rule down: a reviewer "
        "must be able to override or halt the system, not just watch it.",
        "Art. 14 human oversight is the control regulators check first. 'A human "
        "glances at it sometimes' is not oversight.",
        "With each high-risk deployment",
    ),
    (
        "Demand documentation from vendors",
        "Ask every AI vendor for their conformity status, instructions for use, "
        "and Art. 11 technical docs before renewal. No docs, no deployment — "
        "their missing homework becomes your compliance risk.",
        "Deployers must use systems 'in accordance with the instructions'. You "
        "can't follow instructions you were never given.",
        "Before each procurement / renewal",
    ),
    (
        "Log what the AI did",
        "Keep automatic records of inputs, outputs, and overrides for every "
        "high-risk deployment — who approved what, when, and why. Six months "
        "minimum is a sensible floor for deployer logs.",
        "Deployers of high-risk systems must retain automatically generated logs "
        "under their control. Good logs also win disputes.",
        "With each high-risk deployment",
    ),
    (
        "Watch your national enforcement regime",
        "Greece designates its market-surveillance authority and national "
        "sandbox under the Act. Track which regulator owns AI oversight and "
        "whether the national sandbox is open — it's the cheapest way to "
        "test a borderline system safely.",
        "Member states had until Aug 2025 to stand up authorities; sandboxes "
        "must exist by Aug 2026. Early sandbox access is free compliance help.",
        "Rolling — check each quarter",
    ),
    (
        "If you build on a GPAI model, know the chain",
        "Using an API model (Llama, Mistral, commercial APIs) keeps you a "
        "deployer — the model provider carries the GPAI duties. But "
        "fine-tuning or releasing a modified model can move provider "
        "obligations to you. Check before you ship.",
        "GPAI obligations applied 2 Aug 2025. 'Substantial modification' is the "
        "line between deployer and provider.",
        "Applied 2 Aug 2025 — already binding",
    ),
    (
        "Budget 30 minutes per quarter for a review",
        "Re-run this checklist quarterly: new tools in the inventory, new "
        "guidance from the AI Office, any change in what your systems do. The "
        "Act phases in through 2027 — readiness is a habit, not a project.",
        "Guidance, codes of practice, and delegated acts keep landing. A "
        "quarterly pass keeps you ahead of each new application date.",
        "Quarterly",
    ),
]

TIMELINE = [
    ("1 Aug 2024", "AI Act enters into force"),
    ("2 Feb 2025", "Prohibited practices banned + AI literacy duty (Art. 4-5)"),
    ("2 Aug 2025", "GPAI model obligations, governance, penalties provisions"),
    ("2 Aug 2026", "High-risk Annex III rules + Art. 50 transparency + sandboxes"),
    ("2 Aug 2027", "Annex I regulated-product obligations"),
]

RESOURCES = [
    ("Regulation (EU) 2024/1689", "the Act itself — EUR-Lex, consolidated text"),
    ("AI Act Service Desk", "the Commission's official implementation guidance"),
    ("National sandbox (GR)", "test a borderline system with regulator cover"),
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
        title="EU AI Act Readiness Checklist",
        author="cloudless.gr",
        subject="Practical EU AI Act readiness for startups and SMBs — October 2026 edition",
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
            f"cloudless.gr/links — practical compliance, zero fluff. Page {canvas.getPageNumber()}",
        )
        canvas.restoreState()

    story = [
        para("The EU AI Act Readiness Checklist", title),
        Spacer(1, 4 * mm),
        para(
            "Twelve checks for founders and small teams who build or use AI in "
            "Europe. The Act lands in waves through 2027 — two of them are "
            "already binding. Written in plain English, mapped to real articles. "
            "Updated October 2026.",
            sub,
        ),
        Spacer(1, 6 * mm),
        para("The timeline you're working against", h),
    ]

    for when, what in TIMELINE:
        row = Table(
            [[para(f"<b>{when}</b>", item_t), para(what, item_b)]],
            colWidths=[28 * mm, 146 * mm],
        )
        row.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), VOID_LIGHT),
                    ("BOX", (0, 0), (-1, -1), 0.6, HexColor("#1e293b")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story += [row, Spacer(1, 1.5 * mm)]

    story += [Spacer(1, 4 * mm)]

    for i, (name, what, why, when) in enumerate(CHECKLIST, 1):
        row = Table(
            [
                [para(f"{i}. {name}", item_t)],
                [para(what, item_b)],
                [para(f"<b>Why:</b> {why}", small)],
                [para(f"<b>Applies:</b> {when}", small)],
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
        para("Where to check official guidance", h),
        ListFlowable(
            [ListItem(para(f"<b>{t}</b> — {d}", item_b)) for t, d in RESOURCES],
            bulletType="bullet",
            leftIndent=12,
        ),
        Spacer(1, 4 * mm),
        para(
            "This checklist is practical orientation, not legal advice. For "
            "borderline classifications, talk to counsel or use your national "
            "sandbox before shipping.",
            small,
        ),
        Spacer(1, 6 * mm),
        para(
            "Want your AI stack audited against the Act? <b>cloudless.gr</b> "
            "maps your systems, classifies the risk, and writes the runbook — "
            "starting with a free 30-minute audit: <b>cloudless.gr/contact</b>",
            sub,
        ),
    ]

    doc.build(story, onFirstPage=header, onLaterPages=header)


if __name__ == "__main__":
    build(OUTPUT)
    print(f"wrote {OUTPUT}")
