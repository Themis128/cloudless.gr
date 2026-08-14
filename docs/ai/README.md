# AI & agents

| Surface | Runtime | Notes |
|---------|---------|-------|
| Public `/api/chat`, admin AI assistant / generator, NLP, product copy | **Workers AI** (+ Gemini fallback) | Edge-friendly chat — not LangGraph |
| `/admin/langgraph` → `/api/admin/ai/langgraph` | **Pi** (`LANGGRAPH_URL`) | Keep agent graphs on the app path; do **not** port to Cloudflare Workers |
| `bedrock-chat.ts` | Deprecated re-export of Workers AI | Do not expand Bedrock on Workers |

| Doc | File |
|-----|------|
| [AI_ANALYTICS_ORCHESTRATION.md](AI_ANALYTICS_ORCHESTRATION.md) | `ai/AI_ANALYTICS_ORCHESTRATION.md` |
| [langchain-v1-local-experiment-status.md](langchain-v1-local-experiment-status.md) | `ai/langchain-v1-local-experiment-status.md` |
| [local-ai-deep-agent-structure.md](local-ai-deep-agent-structure.md) | `ai/local-ai-deep-agent-structure.md` |
| [cloudless-agent-profile.md](cloudless-agent-profile.md) | `ai/cloudless-agent-profile.md` |
| [contact-nlp.md](contact-nlp.md) | `ai/contact-nlp.md` |
