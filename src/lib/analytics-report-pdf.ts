import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AnalyticsOrchestrationResult } from "@/lib/analytics-agent-orchestrator";
import { APP_TIMEZONE } from "@/lib/timezone";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 50;
const BODY_SIZE = 11;
const BODY_LINE_HEIGHT = 15;
const SECTION_SIZE = 14;
const TITLE_SIZE = 20;
const SUBTITLE_SIZE = 10;
const MAX_TEXT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

interface DrawState {
  page: PDFPage;
  y: number;
}

function splitOversizedWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lines: string[]
): string {
  let segment = "";
  for (const character of word) {
    const nextSegment = `${segment}${character}`;
    if (font.widthOfTextAtSize(nextSegment, size) <= maxWidth) {
      segment = nextSegment;
    } else {
      lines.push(segment);
      segment = character;
    }
  }
  return segment;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 1 && words[0] === "") return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    current = splitOversizedWord(word, font, size, maxWidth, lines);
  }

  if (current) lines.push(current);
  return lines;
}

function newPage(pdf: PDFDocument): DrawState {
  return {
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - PAGE_MARGIN,
  };
}

function ensureSpace(pdf: PDFDocument, state: DrawState, neededHeight: number): DrawState {
  if (state.y - neededHeight >= PAGE_MARGIN) return state;
  return newPage(pdf);
}

function drawLines(params: {
  pdf: PDFDocument;
  state: DrawState;
  lines: string[];
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}): DrawState {
  let state = params.state;
  for (const line of params.lines) {
    state = ensureSpace(params.pdf, state, params.lineHeight);
    state.page.drawText(line, {
      x: PAGE_MARGIN,
      y: state.y,
      size: params.size,
      font: params.font,
      color: params.color ?? rgb(0.12, 0.14, 0.18),
    });
    state = { ...state, y: state.y - params.lineHeight };
  }
  return state;
}

function drawParagraph(params: {
  pdf: PDFDocument;
  state: DrawState;
  text: string;
  font: PDFFont;
  size?: number;
  lineHeight?: number;
}): DrawState {
  const size = params.size ?? BODY_SIZE;
  const lineHeight = params.lineHeight ?? BODY_LINE_HEIGHT;
  const lines = wrapText(params.text, params.font, size, MAX_TEXT_WIDTH);
  return drawLines({
    pdf: params.pdf,
    state: params.state,
    lines,
    font: params.font,
    size,
    lineHeight,
  });
}

function drawSectionTitle(params: {
  pdf: PDFDocument;
  state: DrawState;
  text: string;
  font: PDFFont;
}): DrawState {
  const state = ensureSpace(params.pdf, params.state, 28);
  state.page.drawText(params.text, {
    x: PAGE_MARGIN,
    y: state.y,
    size: SECTION_SIZE,
    font: params.font,
    color: rgb(0.02, 0.59, 0.91),
  });
  return { ...state, y: state.y - 22 };
}

function drawBulletList(params: {
  pdf: PDFDocument;
  state: DrawState;
  items: string[];
  font: PDFFont;
}): DrawState {
  let state = params.state;
  for (const item of params.items) {
    state = drawParagraph({
      pdf: params.pdf,
      state,
      text: `- ${item}`,
      font: params.font,
    });
  }
  return state;
}

function formatMinorUnits(amountMinor: number): string {
  return new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export async function renderAnalyticsReportPdf(params: {
  reportTitle?: string;
  result: AnalyticsOrchestrationResult;
}): Promise<Uint8Array> {
  const title = params.reportTitle?.trim() || "Stripe Analytics Report";
  const { result } = params;
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let state = newPage(pdf);

  state.page.drawText(title, {
    x: PAGE_MARGIN,
    y: state.y,
    size: TITLE_SIZE,
    font: boldFont,
    color: rgb(0.08, 0.1, 0.16),
  });
  state = { ...state, y: state.y - 24 };
  state.page.drawText(
    `Generated ${new Date(result.snapshot.generatedAt).toLocaleString("en-IE", {
      timeZone: APP_TIMEZONE,
    })} (Europe/Athens)`,
    {
      x: PAGE_MARGIN,
      y: state.y,
      size: SUBTITLE_SIZE,
      font: regularFont,
      color: rgb(0.35, 0.39, 0.45),
    }
  );
  state = { ...state, y: state.y - 24 };

  state = drawSectionTitle({ pdf, state, text: "Overview", font: boldFont });
  state = drawBulletList({
    pdf,
    state,
    font: regularFont,
    items: [
      `Window: ${result.snapshot.windowDays} days`,
      `Events: ${result.snapshot.totals.events}`,
      `Processed: ${result.snapshot.totals.processed}`,
      `Failed: ${result.snapshot.totals.failed}`,
      `Tracked revenue: ${formatMinorUnits(result.snapshot.totals.revenueMinor)} major units`,
      `Failure rate: ${result.preprocessed.failureRatePct}%`,
      `Processed rate: ${result.preprocessed.processedRatePct}%`,
    ],
  });
  state = { ...state, y: state.y - 8 };

  state = drawSectionTitle({
    pdf,
    state,
    text: "Executive Summary",
    font: boldFont,
  });
  state = drawParagraph({
    pdf,
    state,
    text: result.report.executiveSummary,
    font: regularFont,
  });
  state = { ...state, y: state.y - 8 };

  state = drawSectionTitle({
    pdf,
    state,
    text: "Key Insights",
    font: boldFont,
  });
  state = drawBulletList({
    pdf,
    state,
    items: result.report.keyInsights,
    font: regularFont,
  });
  state = { ...state, y: state.y - 8 };

  state = drawSectionTitle({ pdf, state, text: "Risks", font: boldFont });
  state = drawBulletList({
    pdf,
    state,
    items: result.report.risks,
    font: regularFont,
  });
  state = { ...state, y: state.y - 8 };

  state = drawSectionTitle({
    pdf,
    state,
    text: "Recommended Moves",
    font: boldFont,
  });
  state = drawBulletList({
    pdf,
    state,
    font: regularFont,
    items: result.report.nextMoves.map(
      (move) => `${move.move} (${move.confidence}, ${move.timeframeDays}d): ${move.expectedOutcome}`
    ),
  });
  state = { ...state, y: state.y - 8 };

  state = drawSectionTitle({
    pdf,
    state,
    text: "Scenario Outcomes",
    font: boldFont,
  });
  state = drawBulletList({
    pdf,
    state,
    font: regularFont,
    items: result.report.scenarioOutcomes.map(
      (scenario) =>
        `${scenario.scenario}: revenue ${scenario.expectedRevenueDeltaPct}%, conversion ${scenario.expectedConversionDeltaPct}%`
    ),
  });
  state = { ...state, y: state.y - 8 };

  state = drawSectionTitle({
    pdf,
    state,
    text: "Connector Payloads",
    font: boldFont,
  });
  state = drawBulletList({
    pdf,
    state,
    font: regularFont,
    items: result.connectorPayloads.map(
      (payload) => `${payload.connector}: ${payload.chartRecommendations[0] ?? "Dashboard ready"}`
    ),
  });

  if (result.preprocessed.dataQuality.notes.length > 0) {
    state = { ...state, y: state.y - 8 };
    state = drawSectionTitle({
      pdf,
      state,
      text: "Data Quality Notes",
      font: boldFont,
    });
    state = drawBulletList({
      pdf,
      state,
      font: regularFont,
      items: result.preprocessed.dataQuality.notes,
    });
  }

  return pdf.save();
}
