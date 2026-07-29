"""
Cloudless.gr agentic workflows.

This package provides:
- cloudless_research_agent: Main agent for research and technical analysis
- remember: Tool for storing non-secret preferences in filesystem memory
- run_cloudless_agent: CLI runner for the main agent
- run_langchain_docs_research: Research using LangChain documentation
- run_positioning_research: Strategic positioning research agent
- run_langchain_agents_reference: LangChain agents reference reader
- run_langchain_v1_research: LangChain v1 release information reader

Subpackages:
- tools: Shared tools for internet search and docs retrieval
- experiments: Experimental LangChain v1 patterns (create_agent, middleware, structured output)
"""

from agents.cloudless_research_agent import agent

__all__ = ["agent"]
