import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

URL = "https://reference.langchain.com/python/langchain/agents"


def main():
    response = requests.get(
        URL,
        timeout=30,
        headers={"User-Agent": "cloudless-gr-local-agent/0.1"},
    )
    response.raise_for_status()

    lines = [
        "",
        "=== Answer ===",
        "",
        "## 1. Documented facts from the LangChain Agents reference",
        "",
        "- This page is the Python API reference for langchain.agents.",
        "- AgentState is the state schema for the agent.",
        "- ModelRequest contains model request information for the agent.",
        "- ToolStrategy uses a tool-calling strategy for structured model responses.",
        "- ProviderStrategy uses the model provider's native structured output method.",
        "- AutoStrategy automatically selects the best structured-output strategy.",
        "- create_agent creates an agent graph that calls tools in a loop until a stopping condition is met.",
        "- before_model creates middleware with the before_model hook.",
        "- after_model creates middleware with the after_model hook.",
        "- wrap_model_call creates middleware around model calls.",
        "- wrap_tool_call creates middleware around tool calls.",
        "",
        "## 2. Implications for cloudless.gr",
        "",
        "- Inference: create_agent is the main LangChain v1 API to test if you want a lighter alternative or complement to your current Deep Agents runner.",
        "- Inference: ToolStrategy is relevant if you want structured outputs from local agent runs, such as JSON-like research briefs or typed result objects.",
        "- Inference: ModelRequest and wrap_model_call are relevant if you later want middleware that routes between local vLLM models or changes model settings dynamically.",
        "- Inference: wrap_tool_call is relevant if you want deterministic logging, validation, retries, approval checks, or safety checks around tools.",
        "- Inference: before_model and after_model are useful places for prompt/context preparation and output validation.",
        "",
        "## 3. Practical next experiment",
        "",
        "Create a separate experiment file instead of changing your working Deep Agents setup:",
        "",
        "agents/experiments/langchain_v1_create_agent_local_vllm.py",
        "",
        "Suggested goal:",
        "",
        "- Use create_agent with your local vLLM OpenAI-compatible endpoint.",
        "- Add one simple tool first.",
        "- Keep Tavily, memory, and docs runners unchanged until the experiment is validated.",
        "",
        "## 4. Caveats",
        "",
        "- This reference page is API reference, not a full conceptual tutorial.",
        "- Use the LangChain v1 release page and Agents conceptual docs alongside this reference.",
        "- Do not replace your working Deep Agents setup until a separate create_agent experiment passes local tests.",
        "",
        "=== Official Docs Used ===",
        "",
        "1. LangChain Agents reference",
        f"   {URL}",
        "",
        "=== Fetch check ===",
        "",
        f"Fetched {len(response.text)} characters from the official reference page.",
    ]

    print("\n".join(lines))


if __name__ == "__main__":
    main()
