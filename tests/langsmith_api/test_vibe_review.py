import scripts.vibe_review as vibe_review


def make_proposal(
    tmp_path,
    name="proposal.md",
    relevant_file="tests/langsmith_api/test_endpoints.py",
    proposed_change="No patch has been applied.",
):
    patch_dir = tmp_path / ".agent-patches"
    patch_dir.mkdir(exist_ok=True)

    proposal = patch_dir / name
    text = "\n".join(
        [
            "# Vibe Patch Proposal",
            "",
            "## Request",
            "",
            "Add test",
            "",
            "## Goal",
            "",
            "Safe test.",
            "",
            "## Relevant existing files",
            "",
            f"- `{relevant_file}`",
            "",
            "## Proposed change",
            "",
            proposed_change,
            "",
            "## Tests to run",
            "",
            "- pnpm run ai:skills-check",
            "- pnpm run ai:test:api",
            "- pnpm run ai:check",
            "",
            "## Rollback plan",
            "",
            "Rollback with git restore.",
            "",
            "## Human approval question",
            "",
            "Apply this patch? yes/no",
            "",
        ]
    )

    proposal.write_text(text, encoding="utf-8")
    return proposal


def test_vibe_review_accepts_safe_proposal(tmp_path, monkeypatch):
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)

    proposal = make_proposal(tmp_path)

    ok, errors, warnings = vibe_review.review_proposal(proposal)

    assert ok is True
    assert errors == []


def test_vibe_review_allows_env_local_when_used_as_avoidance_guidance(tmp_path, monkeypatch):
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)

    proposal = make_proposal(
        tmp_path,
        name="safe-env-guidance.md",
        proposed_change=(
            "No patch has been applied.\n\n"
            "- avoids `.env.local`\n"
            "- avoids generated `.deepagents/` data"
        ),
    )

    ok, errors, warnings = vibe_review.review_proposal(proposal)

    assert ok is True
    assert errors == []


def test_vibe_review_rejects_env_local_as_target_file(tmp_path, monkeypatch):
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)

    proposal = make_proposal(
        tmp_path,
        name="unsafe-env-target.md",
        relevant_file=".env.local",
        proposed_change="Edit `.env.local`.",
    )

    ok, errors, warnings = vibe_review.review_proposal(proposal)

    assert ok is False
    assert any(".env.local" in error for error in errors)


def test_vibe_review_rejects_langsmith_api_key_assignment(tmp_path, monkeypatch):
    monkeypatch.setattr(vibe_review, "REPO_ROOT", tmp_path)

    proposal = make_proposal(
        tmp_path,
        name="unsafe-key.md",
        proposed_change='LANGSMITH_API_KEY="fake-key"',
    )

    ok, errors, warnings = vibe_review.review_proposal(proposal)

    assert ok is False
    assert any("LANGSMITH_API_KEY" in error for error in errors)
