import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface Env {
  ASSETS: R2Bucket;
  TOOLS_TOKEN?: string;
}

// StandardFonts are WinAnsi (CP1252)-encoded: printable ASCII, Latin-1
// supplement, and a fixed set of punctuation. Anything else — Greek,
// Cyrillic, CJK, emoji — makes drawText throw mid-render, so reject it
// up front with a 400 instead of a 500 or a "???"-mangled document.
const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);
const winansiOk = (s: string): boolean =>
  [...s].every((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.has(c);
  });

// Safety net for the drawText path — unreachable while the 400 guard
// above holds, but keeps a future caller from reintroducing the throw.
const toWinAnsi = (text: string): string =>
  [...text].map((ch) => (winansiOk(ch) ? ch : "?")).join("");

// Unicode-aware slug: \W strips Greek to "-", collapsing distinct clients
// onto the same R2 key. Keep letters/numbers from any script instead.
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "client";

const wrap = (text: string, width: number): string[] => {
  const words = text.split(/\s+/),
    lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
};

async function pdf(lines: { text: string; bold?: boolean }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage(),
    y = 800;
  for (const { text, bold: b } of lines) {
    for (const line of wrap(text, 90)) {
      if (y < 60) {
        page = doc.addPage();
        y = 800;
      }
      page.drawText(toWinAnsi(line), {
        x: 50,
        y,
        size: b ? 14 : 11,
        font: b ? bold : reg,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= b ? 20 : 15;
    }
  }
  return doc.save();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    const token = req.headers.get("Authorization") ?? "";
    if (!env.TOOLS_TOKEN || token !== `Bearer ${env.TOOLS_TOKEN}`)
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (req.method !== "POST") return Response.json({ error: "method" }, { status: 405 });
    const b = (await req.json<Record<string, string>>().catch(() => ({}))) as Record<
      string,
      string
    >;
    const date = b.date ?? new Date().toISOString().slice(0, 10);
    let key = "",
      lines: { text: string; bold?: boolean }[] = [];
    if (url.pathname === "/loa") {
      const client = b.client?.trim();
      if (!client) return Response.json({ error: "client required" }, { status: 400 });
      const amountNum = Number(b.amount ?? 800);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return Response.json({ error: "amount must be a positive number" }, { status: 400 });
      }
      const amount = String(amountNum);
      key = `pipeline-assets/loa-${slug(client)}-${date}.pdf`;
      lines = [
        { text: "LETTER OF AGREEMENT — CLOUDLESS", bold: true },
        { text: `Client: ${client}   Date: ${date}   Amount: EUR ${amount} (excl. VAT)` },
        {
          text: "Scope: web design, hosting setup, and workflow automation — fixed-scope starter engagement.",
          bold: true,
        },
        { text: "Day 1: kickoff call, access handoff, scope freeze." },
        { text: "Day 14: delivery + handoff call. Client owns 100% of the code — no lock-in." },
        {
          text: `Payment: 50% deposit (EUR ${amountNum / 2} + VAT) on signature; 50% (EUR ${amountNum / 2} + VAT) on Day-14 delivery.`,
        },
        { text: "Signatures:  ____________________ Cloudless      ____________________ Client" },
      ];
    } else if (url.pathname === "/worksheet") {
      const client = b.client?.trim();
      if (!client) return Response.json({ error: "client required" }, { status: 400 });
      key = `pipeline-assets/worksheet-${slug(client)}-${date}.pdf`;
      lines = [
        { text: "30-MIN TECH CHECKUP — AUDIT WORKSHEET", bold: true },
        { text: `Company: ${client}   Contact: ${b.contact ?? ""}   Date: ${date}` },
        { text: "DISCOVERY", bold: true },
        { text: "1. What would make the next 6 months a win? (goal)" },
        { text: "2. What's the biggest daily pain / slowest task? (pain)" },
        { text: "3. When does it need to be fixed? (timeline)" },
        { text: "TECHNICAL RED FLAGS / COST LEAKS", bold: true },
        {
          text: "Manual copy-paste between tools ___  Unused seats ___  Slow site ___  Overlapping SaaS ___",
        },
        { text: "QUICK WINS", bold: true },
        { text: "1. ___  2. ___  3. ___" },
        {
          text: "RECOMMENDATION:  [ ] Single Fix EUR 800 / 14 days   [ ] Full Digital Department EUR 3,600/mo",
          bold: true,
        },
        {
          text: "Close: 'Everything above is fixable inside the 14-day window — deposit books your slot. Three new clients a month.'",
        },
      ];
    } else {
      return Response.json({ error: "unknown path" }, { status: 404 });
    }
    if (!lines.every((l) => winansiOk(l.text))) {
      return Response.json(
        {
          error:
            "text contains characters the standard PDF fonts cannot encode (e.g. Greek or CJK); a Unicode-font build is required",
        },
        { status: 400 }
      );
    }
    await env.ASSETS.put(key, await pdf(lines), {
      httpMetadata: { contentType: "application/pdf" },
    });
    return Response.json({ ok: true, key });
  },
};
