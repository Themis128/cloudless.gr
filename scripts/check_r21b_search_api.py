#!/usr/bin/env python3
"""R21b /api/search + Bedrock embeddings check."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

c = Check()
print("== R21b /api/search + Bedrock embeddings check ==\n")

c.expect(
    c.exists("src/lib/bedrock-embeddings.ts"),
    "Bedrock embedding helper exists",
    "missing src/lib/bedrock-embeddings.ts",
)
c.expect(
    c.exists("src/lib/meilisearch.ts"),
    "Meilisearch helper exists",
    "missing src/lib/meilisearch.ts",
)
c.expect(
    c.exists("src/lib/product-search.ts"),
    "product search/index helper exists",
    "missing src/lib/product-search.ts",
)
c.expect(
    c.exists("src/app/api/search/route.ts"),
    "/api/search route exists",
    "missing src/app/api/search/route.ts",
)
c.expect(
    c.exists("src/app/api/admin/search/reindex/route.ts"),
    "admin reindex route exists",
    "missing admin reindex route",
)

c.expect(
    c.contains("src/lib/bedrock-embeddings.ts", "amazon.titan-embed-text-v2:0"),
    "uses Titan Text Embeddings V2 model id",
    "missing Titan V2 model id",
)
c.expect(
    c.contains("src/lib/bedrock-embeddings.ts", "InvokeModelCommand"),
    "uses Bedrock InvokeModelCommand",
    "missing Bedrock InvokeModelCommand",
)
c.expect(
    c.contains("src/lib/product-search.ts", 'source: "userProvided"'),
    "configures Meilisearch userProvided embedder",
    "missing userProvided embedder config",
)
c.expect(
    c.contains("src/lib/product-search.ts", "_vectors"),
    "indexes precomputed vectors into Meilisearch",
    "missing _vectors indexing",
)
c.expect(
    c.contains("src/lib/product-search.ts", "hybrid"),
    "uses Meilisearch hybrid search",
    "missing hybrid search",
)
c.expect(
    c.contains("src/app/api/search/route.ts", 'source: "fallback"'),
    "has fallback search path",
    "missing fallback search path",
)

c.finish()
