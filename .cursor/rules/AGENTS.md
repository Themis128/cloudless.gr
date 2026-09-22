# AGENTS.md – Research & Documentation Agents (Customized for **cloudless.gr**)

## General Agents (unchanged)

- **`run_cloudless_agent.py`** – Tavily‑based research agent.  
  - Searches the web, extracts snippets, stores results in `.agent-memory/memories/AGENTS.md`.
- **`run_langchain_docs_research.py`** – LangChain/LangGraph‑focused agent.  
  - Traverses documentation sites, builds a knowledge graph, writes `docs/` summaries.

## Shared Memory

All agents write their findings to the **shared memory file**:  

```
{workspace_root}/.agent-memory/memories/AGENTS.md
```

If you add new research notes, append them **at the end** of that file so existing entries stay intact.

## Integration with the Cloudless Repo

- The agents automatically set `WORKSPACE=/home/$(whoami)/cloudless.gr`.  
- They respect the `.cursor/` configuration (e.g., they respect the `mcp.json` server list).  
- When you open a PR, the CI step `npm run research:reports` will run both agents and commit the updated `docs/research/*.md` files.
