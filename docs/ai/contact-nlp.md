# Contact-form NLP (en + el)

## Purpose

Enrich inbound contact submissions with **intent**, **language**, and light
**entities** before the deterministic lead scorer runs. Scores stay explainable
in Slack and EspoCRM notes.

## Pipeline

1. `POST /api/contact` validates Turnstile + fields.
2. `analyzeLeadMessage()` ([`src/lib/nlp/analyze-lead.ts`](../../src/lib/nlp/analyze-lead.ts)):
   - Local heuristics (script + patterns) always run.
   - Workers AI (`WORKERS_AI_NLP_MODEL`, default `@cf/meta/llama-3.2-3b-instruct`)
     only when confidence is low and CF credentials exist.
   - Skipped under `NEXT_PUBLIC_E2E=1` or `NLP_LEAD_LLM=0`.
3. `scoreLead({ …, nlp })` adds up to **+15** for intents/entities; `spam_or_noise`
   forces **cold**.

## Intents

| Intent | Meaning |
| --- | --- |
| `quote_request` | Pricing / proposal |
| `booking` | Call / audit / meeting |
| `support` | Existing-customer help |
| `partnership` | Reseller / affiliate |
| `spam_or_noise` | Junk |
| `general_inquiry` | Catch-all |

## References

- [Cloudflare RAG architecture](https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-rag/)
- Intent-router pattern (small model classifies): [NL CLI / RAG writeup](https://sndp.co/writing/building-a-natural-language-cli/)

## Future (not in this MVP)

- Chat tool `handoff_to_contact` using the same taxonomy.
- FAQ RAG for `general_inquiry` via existing Vectorize index.
