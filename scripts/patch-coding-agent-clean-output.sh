#!/usr/bin/env bash
set -euo pipefail

cd /home/tbaltzakis/cloudless.gr

cp src/agents/coding.ts "src/agents/coding.ts.bak-clean-output-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("src/agents/coding.ts")
text = p.read_text()

old = '''function extractText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {
      return value.response;
    }

    if (typeof value.text === "string") {
      return value.text;
    }

    if (typeof value.result === "string") {
      return value.result;
    }
  }

  return JSON.stringify(result, null, 2);
}'''

new = '''function cleanModelText(text: string): string {
  const thinkEnd = text.lastIndexOf("</think>");

  if (thinkEnd >= 0) {
    text = text.slice(thinkEnd + "</think>".length);
  }

  return text.trim();
}

function extractText(result: unknown): string {
  let text: string;

  if (typeof result === "string") {
    text = result;
  } else if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {
      text = value.response;
    } else if (typeof value.text === "string") {
      text = value.text;
    } else if (typeof value.result === "string") {
      text = value.result;
    } else {
      text = JSON.stringify(result, null, 2);
    }
  } else {
    text = JSON.stringify(result, null, 2);
  }

  return cleanModelText(text);
}'''

if old not in text:
    raise SystemExit("Could not find extractText block. Inspect src/agents/coding.ts manually.")

text = text.replace(old, new)

old_prompt_line = '''      "Return concise structured output with these sections:",'''

new_prompt_line = '''      "Do not include <think>, hidden reasoning, chain-of-thought, or internal analysis.",
      "Return concise structured output with these sections:",'''

if old_prompt_line in text and new_prompt_line not in text:
    text = text.replace(old_prompt_line, new_prompt_line)

p.write_text(text)
PY

pnpm run cf:typecheck

echo "✅ CodingAgent output cleanup patched."
