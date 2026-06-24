from scripts.vibe_patch import infer_relevant_files
from scripts.vibe_plan import build_plan


def test_vibe_patch_infers_r14_sentry_files():
    files = infer_relevant_files(
        "Implement R14 Sentry environment tagging so AWS primary uses prod and Pi standby uses pi-standby"
    )

    assert "sentry.client.config.ts" in files
    assert "sentry.server.config.ts" in files
    assert ".github/workflows/deploy.yml" in files
    assert ".github/workflows/deploy-pi.yml" in files
    assert "scripts/check_r14_sentry_env_tagging.sh" in files


def test_vibe_plan_includes_r14_sentry_steps(tmp_path, monkeypatch):
    import scripts.vibe_plan as vibe_plan
    import scripts.vibe_review as vibe_review

    monkeypatch.setattr(vibe_plan, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)

    patch_dir = tmp_path / ".agent-patches"
    patch_dir.mkdir()

    proposal = patch_dir / "r14.md"
    proposal.write_text(
        "\n".join(
            [
                "# Vibe Patch Proposal",
                "",
                "## Request",
                "",
                "Implement R14 Sentry environment tagging so AWS primary uses prod and Pi standby uses pi-standby",
                "",
                "## Goal",
                "",
                "Verify Sentry environment tagging.",
                "",
                "## Relevant existing files",
                "",
                "- `sentry.client.config.ts`",
                "- `sentry.server.config.ts`",
                "- `.github/workflows/deploy.yml`",
                "",
                "## Proposed change",
                "",
                "No patch has been applied.",
                "",
                "## Tests to run",
                "",
                "- bash scripts/check_r14_sentry_env_tagging.sh",
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

    assert "process.env.SENTRY_ENVIRONMENT" in plan
    assert "NEXT_PUBLIC_SENTRY_ENVIRONMENT" in plan
    assert "bash scripts/check_r14_sentry_env_tagging.sh" in plan
