cd ~/code/cloudless.gr
source .venv/bin/activate

sudo chown -R tbaltzakis:tbaltzakis agents

cat > agents/cloudless_research_agent.py <<'PY'
import os

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from agents.tools.search import internet_search


load_dotenv(".env.local")


research_instructions = """
You are an expert researcher and technical analyst for the cloudless.gr app.

Your job is to conduct thorough research, inspect relevant information, and write clear, polished reports.

You have access to an internet search tool as your primary means of gathering up-to-date information.

## internet_search

Use this to run an internet search for a given query.
You can specify:
- max_results
- topic: general, news, or finance
- whether raw content should be included

When researching:
- compare multiple sources where possible
- separate facts from recommendations
- prefer practical, actionable findings for cloudless.gr
"""


model = ChatOpenAI(
    model=os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    api_key=os.getenv("OPENAI_API_KEY", "dummy"),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    temperature=0,
    max_tokens=1024,
    use_responses_api=False,
    stream_usage=False,
    disabled_params={
        "parallel_tool_calls": None,
    },
)


agent = create_deep_agent(
    model=model,
    tools=[internet_search],
    system_prompt=research_instructions,
)
PY
