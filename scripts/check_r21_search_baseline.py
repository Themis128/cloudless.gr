#!/usr/bin/env python3
"""R21 search baseline check — verifies the Meilisearch/Bedrock
helper files and API routes reference the expected env/config."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

c = Check()
print("== R21 search baseline check ==\n")

c.expect(c.contains("src/lib/meilisearch.ts", "MEILI_HOST"),
         "Meilisearch host env is referenced",
         "src/lib/meilisearch.ts missing MEILI_HOST")
c.expect(c.contains("src/lib/meilisearch.ts",
                    "MEILI_SEARCH_KEY"),
         "Meilisearch search key env is referenced",
         "src/lib/meilisearch.ts missing MEILI_SEARCH_KEY")
c.expect(c.contains("src/lib/meilisearch.ts",
                    "MEILI_ADMIN_KEY"),
         "Meilisearch admin key env is referenced",
         "src/lib/meilisearch.ts missing MEILI_ADMIN_KEY")
c.expect(c.contains("src/lib/product-search.ts",
                    "amazon.titan-embed-text-v2:0"),
         "Titan embedding model is referenced in product "
         "search metadata",
         "src/lib/product-search.ts missing Titan embedding "
         "metadata")
c.expect(c.contains("src/app/api/search/route.ts",
                    'source: "fallback"'),
         "/api/search has fallback source path",
         "/api/search fallback source path missing")
c.expect(c.contains("src/app/api/admin/search/reindex/route.ts",
                    "x-cron-secret"),
         "admin reindex supports x-cron-secret",
         "admin reindex missing x-cron-secret")
c.expect(c.contains("src/app/api/admin/search/reindex/route.ts",
                    "x-admin-secret"),
         "admin reindex supports x-admin-secret",
         "admin reindex missing x-admin-secret")

c.finish()
