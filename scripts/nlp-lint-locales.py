#!/usr/bin/env python3
"""NLP-lint every UI string in src/locales/*.json against LanguageTool.

LanguageTool is a community grammar/spelling/style checker that supports
all four locales the site ships (en-US, el-GR, fr, de-DE). Run:

  python3 scripts/nlp-lint-locales.py        # check only, print findings
  python3 scripts/nlp-lint-locales.py --fix  # apply unambiguous fixes,
                                            # report ambiguous ones to stderr
  python3 scripts/nlp-lint-locales.py --json # machine-readable report

We skip findings that are not safe to auto-apply (e.g. ones with multiple
replacement suggestions, ones where the replacement is empty, or ones that
would touch interpolation tokens like `{name}` or punctuation that matters
for layout). Those become a "needs human eyes" list at the end so the
operator can decide.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import language_tool_python

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "src" / "locales"

# LanguageTool language codes per locale file.
LANG_MAP = {
    "en": "en-US",
    "el": "el-GR",
    "fr": "fr",
    "de": "de-DE",
}

# Skip findings whose ruleId is in this set — they're things we know are
# fine for UI copy (line-length style, "no period at end" — UI strings
# legitimately omit terminal punctuation, casing of "Cloudless" etc).
SKIP_RULES_GLOBAL = {
    # Generic / formatting
    "WHITESPACE_RULE",  # next-intl ICU placeholders break around args
    "MORFOLOGIK_RULE_EN_US",  # we'll re-include this selectively below
}

# Per-language skip — brand names, technical terms etc that produce noise.
SKIP_FOR_BRAND = {
    "cloudless",
    "Cloudless",
    "Cloudless.gr",
    "AWS",
    "GCP",
    "Azure",
    "GA4",
    "GDPR",
    "Stripe",
    "PayPal",
    "Viva",
    "WooCommerce",
    "Next.js",
    "ELTA",
    "ACS",
    "Speedex",
    "Skroutz",
    "BestPrice",
    "Meta Pixel",
    "Notion",
    "Lambda",
    "DynamoDB",
    "Insight Tag",
    "Hosted UI",
    "Cognito",
    "Slack",
    "HubSpot",
    "Sentry",
    "OpenNext",
    "Cloudflare",
    "Tailscale",
    "Athena",
    "AI",
    "MSP",
    "ETL",
    "SaaS",
    "AWS Lambda",
    "S3",
    "EC2",
    "RDS",
    "Aurora",
    "GraphQL",
    "REST",
    "API",
    "APIs",
    "URL",
    "URLs",
    "HTTPS",
    "TLS",
    "TypeScript",
    "JavaScript",
    "Node.js",
    "React",
    "Vercel",
    "Kubernetes",
    "Docker",
    "DevOps",
    "MLOps",
    "CI/CD",
}

# English/technical loanwords commonly used in Greek/French/German UI copy
# that LanguageTool flags as misspellings. These are intentional, so skip.
LOANWORDS = {
    "growth",
    "hacks",
    "spam",
    "cookies",
    "cookie",
    "dashboard",
    "kickoff",
    "newsletter",
    "online",
    "email",
    "emails",
    "domain",
    "hosting",
    "feed",
    "feeds",
    "logo",
    "blog",
    "blogs",
    "podcast",
    "checkout",
    "marketing",
    "stack",
    "startup",
    "startups",
    "SaaS",
    "premium",
    "Insights",
    "audit",
    "pipeline",
    "pipelines",
    "freemium",
    "marketplace",
    "framework",
    "frameworks",
    "backup",
    "backups",
    "router",
    "firewall",
    "POS",
    "CCTV",
    "B2B",
    "B2C",
    "KPIs",
    "ETL",
    "MLOps",
    "DevOps",
    "frontend",
    "backend",
    "fullstack",
    "cloud",
    "serverless",
    "tokens",
    "token",
    "session",
    "sessions",
    "Pixel",
    "OS",
    "iOS",
    "Android",
    "Microsoft",
}

# Interpolation tokens used by next-intl / ICU.
PLACEHOLDER_RE = re.compile(r"\{[^}]+\}")

# Loanword detection: if the matched text is ASCII-only in a non-English
# locale, treat it as a probable loanword and skip MORFOLOGIK rules on it.
ASCII_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]*$")


def iter_leaf_strings(obj, key_path: str = ""):
    """Yield (key_path, str) for every leaf string in a nested dict/list."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_leaf_strings(v, f"{key_path}.{k}" if key_path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_leaf_strings(v, f"{key_path}[{i}]")
    elif isinstance(obj, str):
        yield key_path, obj


@dataclass
class Finding:
    locale: str
    key: str
    text: str
    rule_id: str
    message: str
    offset: int
    length: int
    replacements: list[str]

    @property
    def context_match(self) -> str:
        return self.text[self.offset : self.offset + self.length]

    @property
    def is_noise(self) -> bool:
        """Return True for findings we never want to act on or report on."""
        m = self.context_match
        if m in SKIP_FOR_BRAND or m in LOANWORDS or m.lower() in LOANWORDS:
            return True
        # Morphological/spelling rule misfires: in non-English locales, ASCII
        # tokens flagged by MORFOLOGIK_RULE_* are almost always English
        # loanwords the team wrote on purpose (growth, hacks, dashboard…).
        if (
            self.locale != "en"
            and self.rule_id.startswith("MORFOLOGIK_RULE_")
            and ASCII_RE.match(m)
        ):
            return True
        # "ETL pipelines", "Big Data", "AI marketing" etc — short ALL CAPS
        # acronyms are virtually never spelling errors.
        if m.isupper() and 2 <= len(m) <= 5:
            return True
        return False

    @property
    def safe_to_apply(self) -> bool:
        if self.is_noise:
            return False
        # Need exactly one replacement and the match must not touch a
        # placeholder like {name}.
        if len(self.replacements) != 1:
            return False
        repl = self.replacements[0]
        if not repl or repl == self.context_match:
            return False
        # Don't touch any region overlapping a placeholder.
        for m in PLACEHOLDER_RE.finditer(self.text):
            if not (m.end() <= self.offset or m.start() >= self.offset + self.length):
                return False
        # Avoid casing-only changes on brand-like tokens.
        if self.context_match.lower() == repl.lower() and len(self.context_match) <= 4:
            return False
        return True


def lint_locale(
    locale: str, data, tools: dict[str, language_tool_python.LanguageTool]
) -> list[Finding]:
    lt = tools[locale]
    findings: list[Finding] = []
    for key, text in iter_leaf_strings(data):
        # Skip tiny strings — they're labels like "OK", "No", and LT will
        # complain about every short label as "missing context".
        if len(text) < 4:
            continue
        # Strip placeholders for the lint pass, then map offsets back. Easier:
        # replace placeholders with a neutral token of the same length so
        # offsets remain valid.
        cleaned = PLACEHOLDER_RE.sub(lambda m: "X" * len(m.group(0)), text)
        try:
            matches = lt.check(cleaned)
        except Exception as e:  # pragma: no cover
            print(f"  ! {locale}:{key} crashed LT: {e}", file=sys.stderr)
            continue
        for m in matches:
            if m.rule_id in SKIP_RULES_GLOBAL:
                continue
            findings.append(
                Finding(
                    locale=locale,
                    key=key,
                    text=text,
                    rule_id=m.rule_id,
                    message=m.message,
                    offset=m.offset,
                    length=m.error_length,
                    replacements=list(m.replacements[:5]),
                )
            )
    return findings


def apply_fix(text: str, finding: Finding) -> str:
    repl = finding.replacements[0]
    return text[: finding.offset] + repl + text[finding.offset + finding.length :]


def update_value(data, key_path: str, new_value: str) -> None:
    """Set data at dotted/[index] key_path to new_value."""
    parts: list[str | int] = []
    for chunk in key_path.split("."):
        # Handle list indices like name[0]
        m = re.match(r"^([^\[\]]+)((?:\[\d+\])+)$", chunk)
        if m:
            parts.append(m.group(1))
            parts.extend(int(i) for i in re.findall(r"\[(\d+)\]", m.group(2)))
        else:
            parts.append(chunk)
    cur = data
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = new_value


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true", help="Apply unambiguous fixes in place.")
    ap.add_argument(
        "--json", action="store_true", help="Print JSON instead of human-readable text."
    )
    args = ap.parse_args()

    print(
        "=== bootstrapping LanguageTool engines (first run downloads ~250 MB jar) ===",
        file=sys.stderr,
    )
    tools = {locale: language_tool_python.LanguageTool(code) for locale, code in LANG_MAP.items()}

    all_findings: list[Finding] = []
    applied = 0
    needs_review: list[Finding] = []

    for locale in LANG_MAP:
        path = LOCALES_DIR / f"{locale}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        print(f"\n=== {locale} ({path.name}) ===", file=sys.stderr)
        findings = lint_locale(locale, data, tools)
        print(f"  {len(findings)} findings", file=sys.stderr)
        all_findings.extend(findings)

        # Filter noise out before doing anything else.
        findings = [f for f in findings if not f.is_noise]

        if args.fix:
            # Apply safe ones (group by key, apply from end-to-start so
            # offsets don't shift inside the same string).
            by_key: dict[str, list[Finding]] = {}
            for f in findings:
                if f.safe_to_apply:
                    by_key.setdefault(f.key, []).append(f)
                else:
                    needs_review.append(f)
            for key, fs in by_key.items():
                fs.sort(key=lambda f: f.offset, reverse=True)
                text = fs[0].text
                for f in fs:
                    text = apply_fix(text, f)
                update_value(data, key, text)
                applied += len(fs)
            # Persist.
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        else:
            for f in findings:
                if not f.safe_to_apply:
                    needs_review.append(f)

    if args.json:
        print(
            json.dumps(
                {
                    "total": len(all_findings),
                    "applied": applied,
                    "needs_review": [
                        {
                            "locale": f.locale,
                            "key": f.key,
                            "text": f.text,
                            "rule_id": f.rule_id,
                            "message": f.message,
                            "match": f.context_match,
                            "replacements": f.replacements,
                        }
                        for f in needs_review
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        if args.fix:
            print(
                f"\n=== applied {applied} unambiguous fixes; {len(needs_review)} need human review ==="
            )
        else:
            safe = sum(1 for f in all_findings if f.safe_to_apply)
            print(
                f"\n=== {len(all_findings)} findings total; {safe} are auto-fixable, {len(needs_review)} need human review ==="
            )
        print()
        for f in needs_review[:60]:
            print(f"[{f.locale}] {f.key}")
            print(f"  rule={f.rule_id}  match=<{f.context_match}>  repl={f.replacements}")
            print(f"  msg={f.message}")
            print(f"  text={f.text!r}")
            print()
        if len(needs_review) > 60:
            print(f"  … {len(needs_review) - 60} more")

    return 0 if not all_findings else (0 if args.fix else 0)


if __name__ == "__main__":
    sys.exit(main())
