import argparse
import re
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PATCH_DIR = REPO_ROOT / '.agent-patches'


def slugify(value, max_len=64):
    value = value.lower()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    value = value.strip('-')
    return value[:max_len].strip('-') or 'proposal'


def infer_relevant_files(request):
    request_lc = request.lower()
    files = []

    if 'langsmith' in request_lc or 'api test' in request_lc:
        files.extend([
            'tests/langsmith_api/test_base_client.py',
            'tests/langsmith_api/test_streaming.py',
            'tests/langsmith_api/test_endpoints.py',
            'tests/langsmith_api/test_fast_answers.py',
            'tools/langsmith_api/endpoints.py',
            'tools/langsmith_api/endpoints.json',
        ])

    if 'dispatcher' in request_lc or 'ai.sh' in request_lc:
        files.extend([
            'scripts/ai.sh',
            'scripts/check_ai_dispatcher.py',
        ])

    if 'skill' in request_lc:
        files.extend([
            'agents/skill_loader.py',
            'scripts/check_deepagent_skills.py',
            'skills/',
        ])

    if 'mcp' in request_lc or 'claude desktop' in request_lc:
        files.extend([
            'docs/agentic-migration/claude-desktop-inventory.md',
            'docs/agentic-migration/mcp-config-template.json',
        ])

    if not files:
        files.extend([
            'docs/cloudless-agent-profile.md',
            'agents/cloudless_deep_agent.py',
            'scripts/ai.sh',
        ])

    deduped = []
    seen = set()

    for file in files:
        if file not in seen:
            deduped.append(file)
            seen.add(file)

    return deduped


def infer_tests(request):
    request_lc = request.lower()

    tests = [
        'pnpm run ai:skills-check',
        'pnpm run ai:test:api',
        'pnpm run ai:check',
    ]

    if 'langsmith' in request_lc:
        tests.insert(0, 'pnpm run ai:fast -- "List registered LangSmith endpoints."')
        tests.insert(1, 'pnpm run ai:langsmith-call -- langsmith GET /info/health')

    return tests


def build_proposal(request):
    relevant_files = infer_relevant_files(request)
    tests = infer_tests(request)

    files_md = '\n'.join(f'- `{file}`' for file in relevant_files)
    tests_md = '\n'.join(f'- `{test}`' for test in tests)

    parts = [
        '# Vibe Patch Proposal',
        '',
        '## Request',
        '',
        request,
        '',
        '## Goal',
        '',
        'Prepare a safe, reviewable patch proposal for the requested cloudless.gr change.',
        '',
        '## Relevant existing files',
        '',
        files_md,
        '',
        '## Proposed change',
        '',
        'This proposal is intentionally not applied automatically.',
        '',
        'Before implementing, inspect the relevant files above and prepare a minimal diff that:',
        '',
        '- uses existing project structure',
        '- avoids secrets',
        '- avoids `.env.local`',
        '- avoids generated `.deepagents/` data',
        '- prefers tests under existing test directories',
        '- follows the cloudless app profile and vibe-coding skill',
        '- requires explicit human approval before writes',
        '',
        '## Suggested implementation notes',
        '',
        '- For LangSmith API tooling tests, prefer `tests/langsmith_api/`.',
        '- For endpoint behavior, use the registered endpoint registry instead of arbitrary API paths.',
        '- For live authenticated behavior, skip or mark optional when `LANGSMITH_API_KEY` is missing.',
        '- Do not add placeholder API keys or secret-looking values to committed files.',
        '- Keep the patch small and reversible.',
        '',
        '## Unified diff',
        '',
        '```diff',
        '# No patch has been applied.',
        '# Fill this section after inspecting the relevant files.',
        '```',
        '',
        '## Tests to run',
        '',
        tests_md,
        '',
        '## Rollback plan',
        '',
        '- Do not apply the patch until reviewed.',
        '- If applied later, rollback with `git restore <changed-files>` before commit.',
        '- If committed later, rollback with `git revert <commit>`.',
        '',
        '## Human approval question',
        '',
        'Apply this patch? yes/no',
        '',
    ]

    return '\n'.join(parts)


def main():
    parser = argparse.ArgumentParser(
        description='Create a deterministic vibe-coding patch proposal'
    )
    parser.add_argument('request', nargs='*', help='Patch request')
    args = parser.parse_args()

    request = ' '.join(args.request).strip()

    if not request:
        raise SystemExit('Missing patch request')

    PATCH_DIR.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    slug = slugify(request)
    output_path = PATCH_DIR / f'{timestamp}-{slug}.md'

    output_path.write_text(build_proposal(request), encoding='utf-8')

    print(f'Created patch proposal: {output_path}')


if __name__ == '__main__':
    main()
