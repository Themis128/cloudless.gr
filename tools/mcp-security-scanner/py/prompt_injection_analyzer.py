#!/usr/bin/env python3
"""Prompt injection analyzer for MCP security scans.

Reads text from stdin, matches it against known injection patterns, and
reports findings either as human-readable lines or as JSON.
"""
import argparse
import json
import re
import sys

PROMPT_INJECTION_PATTERNS = [
    {
        'id': 'mcp-008-prompt-injection-directive',
        'message': 'Prompt contains explicit injection directive.',
        'pattern': (
            r'ignore previous instructions|forget all previous'
            r'|override .* instructions|disregard .* prior'
            r'|new instructions|do not follow .* previous'
        ),
    },
    {
        'id': 'mcp-009-prompt-injection-injection-pattern',
        'message': 'Prompt contains suspicious instruction or injection-like pattern.',
        'pattern': (
            r'\b(human|assistant|system)\s*:\s*|instruction[s]?\s*:'
            r'|do not answer|bypass .* filters|ignore .* safe'
        ),
    },
]


def analyze_text(text):
    """Scan text for prompt injection patterns and return a list of findings."""
    findings = []
    lines = text.splitlines()
    for entry in PROMPT_INJECTION_PATTERNS:
        regex = re.compile(entry['pattern'], re.IGNORECASE)
        for index, line in enumerate(lines):
            if regex.search(line):
                findings.append({
                    'id': entry['id'],
                    'line': index + 1,
                    'excerpt': line.strip(),
                    'message': entry['message']
                })
    return findings


def main():
    """Parse arguments, read stdin, analyze for injections, and print results."""
    parser = argparse.ArgumentParser(
        description='Prompt injection analyzer for MCP security scans.',
    )
    parser.add_argument('--json', action='store_true', help='Output JSON findings')
    args = parser.parse_args()

    content = sys.stdin.read()
    findings = analyze_text(content)

    if args.json:
        print(json.dumps(findings))
        return

    for finding in findings:
        print(f"{finding['id']}:{finding['line']} - {finding['message']}")


if __name__ == '__main__':
    main()
