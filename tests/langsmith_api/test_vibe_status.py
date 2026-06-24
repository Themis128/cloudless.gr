from scripts.vibe_status import git_status_short


def test_git_status_short_returns_string():
    status = git_status_short()

    assert isinstance(status, str)
