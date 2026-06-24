# cloudless.gr LangSmith skill

Use this skill when working with LangSmith, tracing, Deep Agents, endpoint registry, observability, or API tooling.

## Local defaults

Local development should default to:

    LANGSMITH_TRACING=false

Only enable tracing when a real API key exists:

    LANGSMITH_TRACING=true
    LANGSMITH_API_KEY=<real key>
    LANGSMITH_PROJECT=cloudless-vibe-coding

## Existing tooling

Use these commands:

    pnpm run ai:langsmith-check
    pnpm run ai:langsmith-call -- langsmith GET /info/health
    pnpm run ai:langsmith-page -- langsmith GET /datasets --allow-error
    pnpm run ai:langsmith-stream -- agent-server GET /health --allow-error
    pnpm run ai:langsmith-endpoint -- --list

## Endpoint registry

Prefer registered endpoints over arbitrary paths.

Allowed workflow:

1. List endpoints.
2. Describe endpoint.
3. Call registered endpoint only.
4. Block protected endpoints if LANGSMITH_API_KEY is missing.

## Safety

- Never print LANGSMITH_API_KEY.
- Never write .env.local.
- Never commit secrets.
- Treat 401/403 without key as expected auth behavior.
