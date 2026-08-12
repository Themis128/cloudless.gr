# AGENTS.md – Research & Documentation Agents (Customized for **cloudless.gr**)

## General Agents (unchanged)

- **`run_cloudless_agent.py`** – Tavily‑based research agent.  
  - Searches the web, extracts snippets, stores results in `.agent-memory/memories/AGENTS.md`.
- **`run_langchain_docs_research.py`** – LangChain/LangGraph‑focused agent.  
  - Traverses documentation sites, builds a knowledge graph, writes `docs/` summaries.

## Cloudflare‑Specific Agents (added)

| Agent | Purpose | Entry point | Memory location |
|-------|---------|-------------|-----------------|
| **`run_cloudflare_worker_research.py`** | Investigate Cloudflare Workers API, R2 pricing, D1 limits, Tunnel health. | `agents/run_cloudflare_worker_research.py` | `.agent-memory/memories/AGENTS.md` |
| **`run_cloudflare_cost_analysis.py`** | Estimate monthly cost of moving AWS resources to Cloudflare (R2 storage, Workers KV, etc.). | `agents/run_cloudflare_cost_analysis.py` | `.agent-memory/memories/AGENTS.md` |

> **How to run:**  
>
> ```bash
> ./setup-agents.sh          # installs python deps & sets up .env
> python agents/run_cloudflare_worker_research.py --topic "R2 pricing"
> ```

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
</write_to_file>
