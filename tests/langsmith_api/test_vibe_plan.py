import scripts.vibe_plan as vibe_plan
import scripts.vibe_review as vibe_review


def test_vibe_plan_includes_langsmith_auth_steps(tmp_path, monkeypatch):
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(vibe_plan, "REPO_ROOT", tmp_path)

    patch_dir = tmp_path / ".agent-patches"
    patch_dir.mkdir()

    proposal = patch_dir / "proposal.md"
    proposal.write_text(
        "\n".join(
            [
                "# Vibe Patch Proposal",
                "",
                "## Request",
                "",
                "Add a test that verifies langsmith.health is public and fleet.connections.list requires auth",
                "",
                "## Goal",
                "",
                "Add endpoint auth test.",
                "",
                "## Relevant existing files",
                "",
                "- `tests/langsmith_api/test_endpoints.py`",
                "",
                "## Proposed change",
                "",
                "No patch has been applied.",
                "",
                "## Tests to run",
                "",
                "- pnpm run ai:test:api",
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

    plan = vibe_plan.build_plan(proposal)

    assert 'get_endpoint("langsmith.health")' in plan
    assert "fleet.connections.list" in plan
    assert "pnpm run ai:test:api" in plan
    assert "This command does not modify source files" in plan
