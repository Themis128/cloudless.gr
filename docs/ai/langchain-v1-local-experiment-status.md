# LangChain v1 local experiment status

## Validated

- `create_agent` with local vLLM.
- Normal tools with local vLLM.
- `ModelRequest` middleware with `wrap_model_call`.
- `request.override(model_settings=...)`.
- `ToolStrategy` structured output with a Pydantic schema.

## Keep experimental

These files are experiments and should not replace the main Deep Agents workflow yet:

- `agents/experiments/langchain_v1_create_agent_local_vllm.py`
- `agents/experiments/langchain_v1_modelrequest_middleware_local_vllm.py`
- `agents/experiments/langchain_v1_structured_output_local_vllm.py`

## Promotion criteria before production use

Before promoting any experiment into the main app:

1. Add deterministic Python-side validation.
2. Avoid relying on model self-assessment.
3. Keep local vLLM compatibility with `use_responses_api=False`.
4. Prove behavior with a small tool set.
5. Confirm no recursion-limit loops.
6. Add tests or smoke scripts.
7. Keep Deep Agents fallback until replacement is proven.
