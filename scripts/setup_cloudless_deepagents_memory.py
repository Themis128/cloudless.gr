#!/usr/bin/env python3
"""Configure the local Deep Agents research agent for cloudless.gr —
Tavily pre-search + local vLLM OpenAI-compatible endpoint (forced
Chat Completions) + filesystem-backed long-term memory."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT",
                           Path.home() / "code/cloudless.gr"))
AGENTS = ROOT / "agents"
TOOLS = AGENTS / "tools"
MEMORY_DIR = ROOT / ".agent-memory/memories"
ENV = ROOT / ".env.local"
GITIGNORE = ROOT / ".gitignore"

MODEL = os.environ.get(
    "LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ")
BASE_URL_DEFAULT = "http://127.0.0.1:8001/v1"


def info(m): print(f"ℹ️  {m}")
def ok(m): print(f"✅ {m}")
def warn(m): print(f"⚠️  {m}")
def fail(m): print(f"❌ {m}"); sys.exit(1)


def backup(p: Path):
    if p.is_file():
        b = f"{p}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
        shutil.copy(p, b)
        warn(f"Backed up existing file: {b}")


info(f"Project root: {ROOT}")
if not ROOT.is_dir():
    fail(f"Project root not found: {ROOT}")
os.chdir(ROOT)

# 1. venv + deps
venv = ROOT / ".venv"
if not venv.is_dir():
    info("Creating .venv...")
    subprocess.run([sys.executable, "-m", "venv", ".venv"],
                   check=True)
py = str(venv / "bin/python")
info("Installing/verifying Python dependencies...")
subprocess.run([py, "-m", "pip", "install", "--upgrade",
                "pip", "setuptools", "wheel"],
               capture_output=True)
subprocess.run([py, "-m", "pip", "install", "--upgrade",
                "deepagents", "tavily-python",
                "langchain-openai", "python-dotenv"],
               capture_output=True)
ok("Python dependencies installed/verified.")

# 2. folders
TOOLS.mkdir(parents=True, exist_ok=True)
MEMORY_DIR.mkdir(parents=True, exist_ok=True)
(ROOT / "scripts").mkdir(exist_ok=True)
(AGENTS / "__init__.py").touch()
(TOOLS / "__init__.py").touch()
ok("Agent folders created.")

# 3. seed memory
mem_file = MEMORY_DIR / "AGENTS.md"
if not mem_file.is_file():
    mem_file.write_text("""# cloudless.gr Agent Memory

## Response style
- Prefer concise, practical answers.
- Use commands and code blocks when helpful.
- For factual research, prefer source-backed answers.

## Project preferences
- Work safely on the cloudless.gr repository.
- Inspect and plan before editing files.
- Never modify secrets, .env files, deployment credentials, production workflows, or lockfiles without explicit approval.
- Prefer small diffs and validation after changes.

## Research behavior
- Use Tavily search results as source material when available.
- Do not invent sources or unsupported claims.
- Prefer official documentation when available.

## Security
- Never store API keys, tokens, passwords, private credentials, or sensitive personal data in memory.
""")
    ok(f"Seeded memory file: {mem_file}")
else:
    ok(f"Memory file already exists: {mem_file}")

# 4. gitignore rules
GITIGNORE.touch(exist_ok=True)
gi = GITIGNORE.read_text(errors="replace").splitlines()
for rule in (".agent-memory/", ".env.local",
             ".env.local.bak-*"):
    if rule not in gi:
        gi.append(rule)
GITIGNORE.write_text("\n".join(gi) + "\n")
ok("Updated .gitignore rules.")

# 5. Tavily tool
search = TOOLS / "search.py"
backup(search)
search.write_text('''import os
from typing import Literal

from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv(".env.local")


def _get_tavily_client() -> TavilyClient:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "TAVILY_API_KEY is not set. Add it to .env.local or export it in your shell."
        )
    return TavilyClient(api_key=api_key)


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search using Tavily."""
    return _get_tavily_client().search(
        query=query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
''')
ok(f"Wrote Tavily tool: {search}")

# 6. agent with memory backend
agent_f = AGENTS / "cloudless_research_agent.py"
backup(agent_f)
agent_f.write_text('''import os
from pathlib import Path

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from deepagents.backends import CompositeBackend, StateBackend
from deepagents.backends.filesystem import FilesystemBackend

from agents.tools.search import internet_search


load_dotenv(".env.local")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MEMORY_ROOT = PROJECT_ROOT / ".agent-memory"

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

## Memory behavior

You have persistent memory available at /memories/AGENTS.md.

Use memory to remember stable, useful, non-secret preferences and project conventions.
You may update memory when the user explicitly asks you to remember something useful for future runs.
Never store secrets, API keys, tokens, passwords, private credentials, or sensitive personal data in memory.

## Research behavior

When search results are provided in the user message, use those search results as the primary source of truth.
For factual, technical, or current-information questions, do not answer from memory alone.
If search results are insufficient, say so.
Never invent organizations, ownership, URLs, dates, or unsupported claims.
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
    memory=["/memories/AGENTS.md"],
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": FilesystemBackend(root_dir=str(MEMORY_ROOT), virtual_mode=True),
        },
    ),
)
''')
ok(f"Wrote agent: {agent_f}")

# 7. deterministic runner
runner = AGENTS / "run_cloudless_agent.py"
backup(runner)
runner.write_text('''import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.search import internet_search

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or "What is LangGraph?"

search_response = internet_search(
    query=query,
    max_results=5,
    topic="general",
    include_raw_content=False,
)

results = search_response.get("results", [])

formatted_sources = "\\n\\n".join(
    [
        f"Source {i + 1}:\\n"
        f"Title: {item.get('title')}\\n"
        f"URL: {item.get('url')}\\n"
        f"Content: {item.get('content')}"
        for i, item in enumerate(results)
    ]
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Answer the question using ONLY the Tavily search results below. "
                    "Do not rely on model memory. "
                    "If the search results are insufficient, say so. "
                    "Prefer official documentation when present. "
                    "Do not make broad comparisons unless the provided sources explicitly support them. "
                    "Write 3-5 concise bullet points. "
                    "Include no claims that are not supported by the provided search results.\\n\\n"
                    f"Question: {query}\\n\\n"
                    f"Tavily search results:\\n{formatted_sources}"
                ),
            }
        ]
    }
)

print("\\n=== Answer ===\\n")
print(result["messages"][-1].content)

print("\\n=== Sources ===\\n")
if not results:
    print("No Tavily sources returned.")
else:
    for i, item in enumerate(results, start=1):
        title = item.get("title") or "Untitled"
        url = item.get("url") or "No URL"
        print(f"{i}. {title}")
        print(f"   {url}")
''')
ok(f"Wrote runner: {runner}")

# 8. memory test
test = AGENTS / "test_memory.py"
backup(test)
test.write_text('''from dotenv import load_dotenv

from agents.cloudless_research_agent import agent

load_dotenv(".env.local")

print("Step 1: Ask agent to remember preference")

result1 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Remember this preference for future runs: "
                    "When explaining cloudless.gr architecture, use concise bullet points."
                ),
            }
        ]
    }
)

print(result1["messages"][-1].content)

print("\\nStep 2: Ask what is remembered")

result2 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What response style preferences do you remember for cloudless.gr?",
            }
        ]
    }
)

print(result2["messages"][-1].content)
''')
ok(f"Wrote memory test: {test}")

# 9. env defaults
ENV.touch(exist_ok=True)
env_text = ENV.read_text()
if "OPENAI_API_KEY=" not in env_text:
    env_text += "OPENAI_API_KEY=dummy\n"
if "OPENAI_BASE_URL=" not in env_text:
    env_text += f"OPENAI_BASE_URL={BASE_URL_DEFAULT}\n"
if "LOCAL_MODEL_NAME=" not in env_text:
    env_text += f"LOCAL_MODEL_NAME={MODEL}\n"
if "TAVILY_API_KEY=" not in env_text:
    env_text += ("# Add your rotated Tavily key below. "
                 "Do not commit this file.\nTAVILY_API_KEY=\n")
    warn("TAVILY_API_KEY placeholder added to .env.local. "
         "Fill it with your rotated key.")
else:
    ok("TAVILY_API_KEY entry already exists in .env.local.")
ENV.write_text(env_text)

# 10. verify + hints
print()
ok("Deep Agents memory setup complete.\n")
print("Next steps:")
print("1. Make sure vLLM is running in another terminal:")
print("   cd ~/code/hugging-face && "
      "./start_qwen_clean_server.sh\n")
print("2. Verify local model server:")
print("   curl http://127.0.0.1:8001/v1/models\n")
print("3. Add/rotate Tavily key in:")
print(f"   {ENV}\n")
print("4. Run the research agent:")
print(f"   cd {ROOT}")
print("   source .venv/bin/activate")
print('   PYTHONPATH=. python agents/run_cloudless_agent.py '
      '"What is LangGraph?"\n')
print("5. Test memory:")
print("   PYTHONPATH=. python agents/test_memory.py\n")

env = dict(os.environ, PYTHONPATH=".")
subprocess.run(
    [py, "-c",
     "from agents.cloudless_research_agent import agent;"
     "print('Agent import check: OK', bool(agent))"],
    env=env)
