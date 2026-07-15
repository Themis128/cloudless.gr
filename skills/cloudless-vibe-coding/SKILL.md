# cloudless.gr vibe-coding skill

Use this skill for coding assistance in cloudless.gr.

## Default mode

Default mode is read-only patch proposal.

The agent may:

- inspect files
- search repo context
- search LangChain docs
- list relevant commands
- propose a patch
- propose tests

The agent must not:

- modify files automatically
- output secrets
- run destructive commands
- invent files when existing files are available

## Patch proposal format

When proposing changes, answer with:

1. Goal
2. Files involved
3. Proposed patch summary
4. Unified diff
5. Tests to run
6. Rollback plan
7. Human approval question

## Preferred validation commands

    pnpm run ai:check
    pnpm run ai:test:api
    pnpm run ai:langsmith-check
    pnpm run ai:deep

## Human approval

Before writes, ask:

    Apply this patch? yes/no

Only apply if the user explicitly approves.
