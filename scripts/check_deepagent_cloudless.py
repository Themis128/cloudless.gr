import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(".env.local")

base_url = os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1")
api_key = os.getenv("OPENAI_API_KEY", "EMPTY")
model = os.getenv(
    "LOCAL_VLLM_MODEL",
    os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
)

checks = {
    "vLLM base URL configured": bool(base_url),
    "local model configured": bool(model),
    "LangChain docs DB exists": Path(".deepagents/langchain_docs_chroma").exists(),
    "Repo docs DB exists": Path(".deepagents/cloudless_repo_chroma").exists(),
    "local_qwen_agent exists": Path("agents/local_qwen_agent.py").exists(),
    "LangChain docs RAG agent exists": Path("agents/langchain_docs_fast_rag.py").exists(),
    "repo RAG agent exists": Path("agents/cloudless_repo_fast_rag.py").exists(),
    "unified assistant exists": Path("agents/cloudless_unified_assistant.py").exists(),
    "Deep Agent smoke file exists": Path("agents/cloudless_deep_agent_smoke.py").exists(),
    "main Deep Agent exists": Path("agents/cloudless_deep_agent.py").exists(),
}

print("cloudless.gr Deep Agent readiness")
print("=" * 42)

failed = False

for name, ok in checks.items():
    print(f"{'✅' if ok else '❌'} {name}")
    failed = failed or not ok

print("\nTesting vLLM chat completion...")
client = OpenAI(base_url=base_url, api_key=api_key)

try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "Reply with exactly: deep agent stack OK",
            }
        ],
        temperature=0,
        max_tokens=32,
    )
    print("✅ vLLM chat completion OK")
    print(response.choices[0].message.content)
except Exception as exc:
    print("❌ vLLM chat completion failed")
    print(exc)
    failed = True

print("\nTesting deepagents import...")
try:
    import deepagents  # noqa: F401
    print("✅ deepagents import OK")
except Exception as exc:
    print("❌ deepagents import failed")
    print(exc)
    failed = True

if failed:
    raise SystemExit(1)

print("\nAll required Deep Agent checks passed.")
