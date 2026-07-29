import os

from dotenv import load_dotenv

load_dotenv(".env.local")

os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model=os.getenv(
        "LOCAL_VLLM_MODEL",
        os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    ),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "EMPTY"),
    temperature=0.1,
    max_tokens=1200,
)


def project_summary() -> str:
    """Return a short summary of the cloudless.gr project."""
    return (
        "cloudless.gr is a Next.js, TypeScript, SST, Kubernetes project with "
        "Python local AI tooling, LangChain docs RAG, repo RAG, and local vLLM integration."
    )


agent = create_deep_agent(
    model=llm,
    tools=[project_summary],
    system_prompt=(
        "You are a Deep Agent smoke test for the cloudless.gr repository. "
        "Use project_summary when asked about the project. Be concise."
    ),
)


def main() -> None:
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "What project is this and what tool can you use?",
                }
            ]
        }
    )

    messages = result.get("messages", [])
    print(messages[-1].content if messages else result)


if __name__ == "__main__":
    main()
