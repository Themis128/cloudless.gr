# GitHub Push / PR / Merge Skill

Use this skill to push commits, open a PR, and merge — especially in cloud sessions where git credentials aren't pre-configured.

## Trigger

Invoke when the user says any of: "push", "push to github", "create pr", "open pr", "merge", "ship it", "push and merge", or when the stop hook reports unpushed commits.

## How credentials work

The credential helper is auto-configured by the `session-start` hook when `GITHUB_PAT` is set as a session secret. If the hook ran, `git push` just works. If it didn't (e.g. you're mid-session and the secret was added after start), this skill re-configures it.

The `GITHUB_PAT` must be a GitHub **Personal Access Token** (classic or fine-grained) with `repo` scope. Generate one at: https://github.com/settings/tokens/new

## Instructions

### Step 1 — Ensure credentials

Check whether git auth is already configured:

```bash
git config --global credential.helper
```

If it doesn't return a path containing `gh-cred-helper`, configure it now using `$GITHUB_PAT`:

```bash
cat > /tmp/gh-cred-helper.sh << 'CRED_EOF'
#!/bin/bash
echo "username=x-access-token"
echo "password=$GITHUB_PAT"
CRED_EOF
chmod +x /tmp/gh-cred-helper.sh
git config --global credential.helper "/tmp/gh-cred-helper.sh"
```

If `GITHUB_PAT` is not in the environment, tell the user:

1. Go to **Claude Code → Session settings → Secrets**
2. Add secret name `GITHUB_PAT`, value = their token

As a last resort, embed temporarily:

```bash
git remote set-url origin https://<TOKEN>@github.com/Themis128/cloudless.gr.git
# push, then clean up:
git remote set-url origin https://github.com/Themis128/cloudless.gr.git
```

### Step 2 — Verify state

```bash
git status
git log --oneline @{u}.. 2>/dev/null || git log --oneline -5
```

Report: branch name, number of commits to push, any uncommitted changes.

### Step 3 — Push

```bash
git push -u origin <branch-name>
```

On failure retry up to 3 times with 2s back-off.

### Step 4 — PR

After pushing, check if a PR already exists via GitHub API:

```bash
curl -s -H "Authorization: token ${GITHUB_PAT}" \
  "https://api.github.com/repos/Themis128/cloudless.gr/pulls?head=Themis128:<branch>&state=open"
```

If no PR, create one:

```bash
curl -s -X POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/Themis128/cloudless.gr/pulls" \
  -d '{"title":"...","head":"<branch>","base":"main","body":"..."}'
```

### Step 5 — Merge

Per CLAUDE.md, always squash-merge immediately after pushing:

```bash
curl -s -X PUT \
  -H "Authorization: token ${GITHUB_PAT}" \
  "https://api.github.com/repos/Themis128/cloudless.gr/pulls/<number>/merge" \
  -d '{"merge_method":"squash","commit_title":"..."}'
```

Report the merge SHA and confirm `main` was updated.
