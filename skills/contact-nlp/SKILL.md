---
name: contact-nlp
description: Contact-form lead NLP (en + el) — local heuristics, optional Workers AI JSON classify, deterministic scoreLead. Use when editing contact API, lead scoring, analyzeLeadMessage, Slack/Espo CRM notes, or when the user mentions contact NLP, intent classification, or spam_or_noise.
---

# Contact NLP (en + el)

Pipeline: local classify → optional Workers AI JSON → **additive** `scoreLead` (never a black-box score). Contact must still return 2xx/4xx if NLP throws.

Docs: [`docs/ai/contact-nlp.md`](../../docs/ai/contact-nlp.md)

## Code

| Piece | Path |
| --- | --- |
| Types / intents | `src/lib/nlp/types.ts` |
| Locale + regex intent | `src/lib/nlp/language.ts` |
| Budget / timeline / product | `src/lib/nlp/entities.ts` |
| Orchestrator | `src/lib/nlp/analyze-lead.ts` |
| Scorer | `src/lib/lead-scoring.ts` (`nlp?` input, +15 cap, `spam_or_noise` → cold) |
| Wire | `src/app/api/contact/route.ts` |

Intents: `quote_request | booking | support | partnership | spam_or_noise | general_inquiry`.

## Rules

- Greek patterns **must not use `\b`** — JS word boundaries break on Greek script.
- Skip LLM when `NEXT_PUBLIC_E2E=1`, `NLP_LEAD_LLM=0`, or Workers AI unconfigured.
- Default model: `@cf/meta/llama-3.2-3b-instruct` (`WORKERS_AI_NLP_MODEL` override). JSON-only, 3s timeout, Zod parse; on failure keep local result (`source: "fallback"`).
- Slack / Espo notes include `intent`, `locale`, `confidence`, `source` — scores stay explainable (`nlp intent:quote_request (+12)`).
- Do not revive Bedrock / Anthropic / LangGraph for this path.

## References

- [Cloudflare RAG architecture](https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-rag/) — small model classifies, large model answers (we only classify here).
- Workers AI chat: existing `src/lib/workers-ai-client.ts` / `pnpm workers-ai:doctor`.

## Tests

```bash
pnpm exec vitest run __tests__/nlp-lead.test.ts __tests__/lead-scoring.test.ts __tests__/contact-api.test.ts
```

Contact NLP throw must still 200 (route catch → rules-only score).
