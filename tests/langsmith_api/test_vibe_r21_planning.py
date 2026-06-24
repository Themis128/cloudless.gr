from scripts.vibe_patch import infer_relevant_files
from scripts.vibe_plan import build_plan


def test_vibe_patch_infers_r21_product_search_files():
    files = infer_relevant_files(
        "R21 harden existing product search baseline: verify /api/search, Meilisearch config, Bedrock embeddings fallback, and admin reindex safety"
    )

    assert "src/app/api/search/route.ts" in files
    assert "src/app/api/admin/search/reindex/route.ts" in files
    assert "src/lib/product-search.ts" in files
    assert "src/lib/meilisearch.ts" in files
    assert "src/lib/bedrock-embeddings.ts" in files
    assert "__tests__/api-search-route.test.ts" in files
    assert "__tests__/admin-search-reindex-route.test.ts" in files


def test_vibe_plan_includes_r21_steps(tmp_path, monkeypatch):
    import scripts.vibe_plan as vibe_plan
    import scripts.vibe_review as vibe_review

    monkeypatch.setattr(vibe_plan, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)

    patch_dir = tmp_path / ".agent-patches"
    patch_dir.mkdir()

    proposal = patch_dir / "r21.md"
    proposal.write_text(
        "\n".join(
            [
                "# Vibe Patch Proposal",
                "",
                "## Request",
                "",
                "R21 harden existing product search baseline: verify /api/search, Meilisearch config, Bedrock embeddings fallback, and admin reindex safety",
                "",
                "## Goal",
                "",
                "Harden R21 search behavior.",
                "",
                "## Relevant existing files",
                "",
                "- `src/app/api/search/route.ts`",
                "- `src/app/api/admin/search/reindex/route.ts`",
                "- `src/lib/product-search.ts`",
                "",
                "## Proposed change",
                "",
                "No patch has been applied.",
                "",
                "## Tests to run",
                "",
                "- pnpm vitest run __tests__/r21-ai-baseline.test.ts __tests__/product-search.test.ts __tests__/api-search-route.test.ts __tests__/admin-search-reindex-route.test.ts",
                "",
                "## Rollback plan",
                "",
                "Rollback.",
                "",
                "## Human approval question",
                "",
                "Apply this patch? yes/no",
                "",
            ]
        ),
        encoding="utf-8",
    )

    plan = build_plan(proposal)

    assert "src/lib/product-search.ts" in plan
    assert "/api/search" in plan
    assert "admin reindex" in plan
    assert "x-cron-secret" in plan
