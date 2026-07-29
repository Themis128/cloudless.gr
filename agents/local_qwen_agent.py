import os

from dotenv import load_dotenv

# Load local env first
load_dotenv(".env.local")

# Keep LangSmith disabled for local-only runs unless explicitly changed later.
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI


@tool
def project_summary() -> str:
    """Return a short summary of the current repository."""
    return (
        "This is the cloudless.gr repository. It includes Next.js, TypeScript, "
        "SST, Kubernetes manifests, infrastructure code, Python tooling, agents, "
        "skills, documentation, tests, and local AI agent workflows."
    )


llm = ChatOpenAI(
    model=os.getenv(
        "LOCAL_VLLM_MODEL", os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ")
    ),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "EMPTY"),
    temperature=0.1,
    max_tokens=2048,
)

agent = create_agent(
    model=llm,
    tools=[project_summary],
    system_prompt=(
        "You are a local coding assistant for the cloudless.gr repository. "
        "Help with Next.js, TypeScript, Python, Kubernetes, SST, LangChain, "
        "Deep Agents, and local vLLM workflows. Be concise and practical."
    ),
)


def main() -> None:
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "What project am I working in and what can you help with?",
                }
            ]
        }
    )

    messages = result.get("messages", [])
    print(messages[-1].content if messages else result)


if __name__ == "__main__":
    main()
