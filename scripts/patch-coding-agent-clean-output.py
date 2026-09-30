#!/usr/bin/env python3
"""Patch CodingAgent to strip <think> reasoning blocks — wraps
extractText() output through a cleanModelText() helper and adds a
no-chain-of-thought instruction to the prompt."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

os.chdir("/home/tbaltzakis/cloudless.gr")

p = Path("src/agents/coding.ts")
shutil.copy(p, f"{p}.bak-clean-output-{time.strftime('%Y%m%d-%H%M%S')}")

text = p.read_text()

old = """function extractText(result: unknown): string {
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
}"""

new = """function cleanModelText(text: string): string {
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
}"""

if old not in text:
    sys.exit("Could not find extractText block. Inspect src/agents/coding.ts manually.")

text = text.replace(old, new)

old_line = '      "Return concise structured output with these sections:",'
new_line = (
    '      "Do not include <think>, hidden reasoning, '
    'chain-of-thought, or internal analysis.",\n'
    '      "Return concise structured output with '
    'these sections:",'
)
if old_line in text and new_line.splitlines()[0] not in text:
    text = text.replace(old_line, new_line)

p.write_text(text)
subprocess.call(["pnpm", "run", "cf:typecheck"])
print("✅ CodingAgent output cleanup patched.")
