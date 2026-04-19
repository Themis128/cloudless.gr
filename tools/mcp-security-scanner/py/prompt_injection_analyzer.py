#!/usr/bin/env python3
import argparse
import json
import re
import sys

PROMPT_INJECTION_PATTERNS = [
    {
        'id': 'mcp-008-prompt-injection-directive',
        'message': 'Prompt contains explicit injection directive.',
        'pattern': r'ignore previous instructions|forget all previous|override .* instructions|disregard .* prior|new instructions|do not follow .* previous'
    },
    {
        'id': 'mcp-009-prompt-injection-injection-pattern',
        'message': 'Prompt contains suspicious instruction or injection-like pattern.',
        'pattern': r'\b(human|assistant|system)\s*:\s*|instruction[s]?\s*:|do not answer|bypass .* filters|ignore .* safe'
    }
]


def analyze_text(text):
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
    parser = argparse.ArgumentParser(description='Prompt injection analyzer for MCP security scans.')
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
