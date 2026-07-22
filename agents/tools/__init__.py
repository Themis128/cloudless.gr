"""
Shared tools for cloudless.gr agentic workflows.

Available tools:
- internet_search: Tavily-powered web search
- langchain_docs: LangChain documentation fetching and searching
- sst_cloudflare: SST (Serverless Stack) Cloudflare provider operations
- omv_k3s: Open Media Vault k3s cluster tools
"""

from agents.tools.search import internet_search
from agents.tools.langchain_docs import (
    discover_and_fetch_langchain_docs,
    fetch_langchain_doc_pages,
    load_langchain_docs_index,
    refresh_langchain_docs_index,
    search_langchain_docs_index,
)
from agents.tools.sst_cloudflare import (
    sst_deploy_infra,
    sst_list_resources,
    sst_dev,
    sst_remove_infra,
    sst_add_provider,
    validate_sst_config,
    get_sst_outputs,
    SST_CLOUDFLARE_TRIGGERS,
)
from agents.tools.omv_k3s_tools import (
    get_cluster_pods,
    get_cluster_services,
    get_cluster_nodes,
    get_pod_logs,
    get_cluster_info,
)

__all__ = [
    "internet_search",
    "discover_and_fetch_langchain_docs",
    "fetch_langchain_doc_pages",
    "load_langchain_docs_index",
    "refresh_langchain_docs_index",
    "search_langchain_docs_index",
    # SST Cloudflare tools
    "sst_deploy_infra",
    "sst_list_resources",
    "sst_dev",
    "sst_remove_infra",
    "sst_add_provider",
    "validate_sst_config",
    "get_sst_outputs",
    "SST_CLOUDFLARE_TRIGGERS",
    # OMV k3s tools
    "get_cluster_pods",
    "get_cluster_services",
    "get_cluster_nodes",
    "get_pod_logs",
    "get_cluster_info",
]
