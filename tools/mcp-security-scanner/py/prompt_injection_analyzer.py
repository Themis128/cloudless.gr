#!/usr/bin/env python3
"""Prompt injection analyzer for MCP security scans.

Reads text from stdin, matches it against known injection patterns, and
reports findings either as human-readable lines or as JSON.
"""

import argparse
import json
import re
import sys

_RAW_PATTERNS = [
    {
        "id": "mcp-008-prompt-injection-directive",
        "message": "Prompt contains explicit injection directive.",
        "pattern": (
            r"ignore previous instructions|forget all previous"
            r"|override .* instructions|disregard .* prior"
            r"|new instructions|do not follow .* previous"
        ),
    },
    {
        "id": "mcp-009-prompt-injection-injection-pattern",
        "message": "Prompt contains suspicious instruction or injection-like pattern.",
        # Note: the \b(human|assistant|system)\s*: pattern triggers on legitimate
        # chat-transcript formatting. Scope it to avoid prefixing colons in normal prose
        # by requiring it at line-start or after a blank/quote character.
        "pattern": (
            r"(?:^|\s)(human|assistant|system)\s*:\s|instruction[s]?\s*:"
            r"|do not answer|bypass .* filters|ignore .* safe"
        ),
    },
]

# Compile patterns once at module load time (not inside the per-line loop).
PROMPT_INJECTION_PATTERNS = [
    {**entry, "regex": re.compile(entry["pattern"], re.IGNORECASE | re.MULTILINE)}
    for entry in _RAW_PATTERNS
]


def analyze_text(text):
    """Scan text for prompt injection patterns and return a list of findings."""
    findings = []
    lines = text.splitlines()
    for entry in PROMPT_INJECTION_PATTERNS:
        regex = entry["regex"]
        for index, line in enumerate(lines):
            if regex.search(line):
                findings.append(
                    {
                        "id": entry["id"],
                        "line": index + 1,
                        "excerpt": line.strip(),
                        "message": entry["message"],
                    }
                )
    return findings


def main():
    """Parse arguments, read stdin, analyze for injections, and print results."""
    parser = argparse.ArgumentParser(
        description="Prompt injection analyzer for MCP security scans.",
    )
    parser.add_argument("--json", action="store_true", help="Output JSON findings")
    args = parser.parse_args()

    content = sys.stdin.read()
    findings = analyze_text(content)

    if args.json:
        print(json.dumps(findings))
    else:
        for finding in findings:
            print(f"{finding['id']}:{finding['line']} - {finding['message']}")

    # Exit 1 when findings are present so CI integration can gate on this check.
    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
