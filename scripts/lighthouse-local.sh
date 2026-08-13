#!/usr/bin/env bash
# Run Lighthouse against production (or override URLs) and write JSON reports.
# Config: lighthouserc.local.cjs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT_DIR="${LIGHTHOUSE_OUT_DIR:-.lighthouseci}"
mkdir -p "$OUT_DIR"

# Warm CDN / origin before measuring
URLS=(
  "https://cloudless.gr/en"
  "https://cloudless.gr/en/services"
  "https://cloudless.gr/en/store"
  "https://cloudless.gr/en/contact"
)

# Allow: pnpm lighthouse:audit -- https://cloudless.gr/en/blog
if [[ $# -gt 0 ]]; then
  URLS=("$@")
fi

echo "== Warming ${#URLS[@]} URL(s) =="
for url in "${URLS[@]}"; do
  curl -sS -o /dev/null -w "%{url_effective} → %{http_code} (%{time_total}s)\n" "$url" || true
  curl -sS -o /dev/null "$url" || true
done

CHROME_FLAGS='--headless=new --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage'
SUMMARY="$OUT_DIR/summary.json"
echo '[]' >"$SUMMARY"

run_one() {
  local form="$1"
  local url="$2"
  local slug
  slug="$(echo "$url" | sed 's#https://##; s#[^a-zA-Z0-9]#-#g')"
  local out="$OUT_DIR/${slug}-${form}.json"
  echo ""
  echo "== Lighthouse ${form}: $url =="
  # Lighthouse 13+: only `desktop` is a --preset; mobile uses --form-factor.
  local form_args=()
  if [[ "$form" == "desktop" ]]; then
    form_args=(--preset=desktop)
  else
    form_args=(--form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4)
  fi
  pnpm exec lighthouse "$url" \
    --quiet \
    --chrome-flags="$CHROME_FLAGS" \
    "${form_args[@]}" \
    --throttling-method=devtools \
    --only-categories=performance,accessibility,best-practices,seo \
    --blocked-url-patterns='*cdn-cgi/challenge-platform*' \
    --blocked-url-patterns='*challenges.cloudflare.com*' \
    --extra-headers='{"X-Forwarded-Proto":"https"}' \
    --output=json \
    --output-path="$out"

  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const form = process.argv[2];
    const summaryPath = process.argv[3];
    const r = JSON.parse(fs.readFileSync(path, "utf8"));
    const cats = r.categories || {};
    const audits = r.audits || {};
    const pick = (id) => {
      const a = audits[id];
      if (!a) return null;
      return {
        id,
        title: a.title,
        score: a.score,
        displayValue: a.displayValue || null,
        numericValue: a.numericValue ?? null,
      };
    };
    const opportunities = Object.values(audits)
      .filter((a) => a.details && a.details.type === "opportunity" && (a.score ?? 1) < 0.9)
      .map((a) => ({
        id: a.id,
        title: a.title,
        score: a.score,
        displayValue: a.displayValue || null,
        savingsMs: a.numericValue ?? null,
      }))
      .sort((a, b) => (b.savingsMs || 0) - (a.savingsMs || 0))
      .slice(0, 8);
    const diagnostics = ["cumulative-layout-shift","total-blocking-time","largest-contentful-paint","first-contentful-paint","speed-index","interactive","server-response-time","mainthread-work-breakdown","bootup-time","dom-size","third-party-summary","unused-javascript","unused-css-rules","render-blocking-resources","uses-responsive-images","offscreen-images"]
      .map(pick)
      .filter(Boolean);
    const row = {
      url: r.finalDisplayedUrl || r.requestedUrl,
      formFactor: form,
      fetchTime: r.fetchTime,
      scores: {
        performance: cats.performance?.score ?? null,
        accessibility: cats.accessibility?.score ?? null,
        bestPractices: cats["best-practices"]?.score ?? null,
        seo: cats.seo?.score ?? null,
      },
      metrics: {
        fcp: pick("first-contentful-paint"),
        lcp: pick("largest-contentful-paint"),
        tbt: pick("total-blocking-time"),
        cls: pick("cumulative-layout-shift"),
        si: pick("speed-index"),
        tti: pick("interactive"),
        ttfb: pick("server-response-time"),
      },
      opportunities,
      diagnostics,
    };
    const all = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    all.push(row);
    fs.writeFileSync(summaryPath, JSON.stringify(all, null, 2));
    const s = row.scores;
    console.log(
      `  Perf=${Math.round((s.performance||0)*100)} A11y=${Math.round((s.accessibility||0)*100)} BP=${Math.round((s.bestPractices||0)*100)} SEO=${Math.round((s.seo||0)*100)}`
    );
    console.log(`  LCP=${row.metrics.lcp?.displayValue} TBT=${row.metrics.tbt?.displayValue} CLS=${row.metrics.cls?.displayValue}`);
  ' "$out" "$form" "$SUMMARY"
}

# Desktop + mobile for homepage; desktop for other routes (faster, actionable)
for url in "${URLS[@]}"; do
  run_one desktop "$url"
done
# Mobile pass on homepage (usually the constraining score)
HOME_URL="${URLS[0]}"
run_one mobile "$HOME_URL"

echo ""
echo "== Summary written to $SUMMARY =="
node -e 'const s=require("./'"$OUT_DIR"'/summary.json"); console.log(JSON.stringify(s.map(r=>({url:r.url,form:r.formFactor,scores:Object.fromEntries(Object.entries(r.scores).map(([k,v])=>[k, Math.round((v||0)*100)]))})),null,2))'
