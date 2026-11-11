#!/usr/bin/env python3
"""devin-skills-sync — publish roaming Devin skills into cloudless.gr.

The live skills live in %APPDATA%/devin/skills (user-level, not
versioned). This tool mirrors selected skill dirs into the canonical
cloudless.gr repo's .devin/skills/ on a fresh worktree off origin/main,
commits, pushes, opens a PR and arms auto-merge — without touching the
dirty pr-2408 checkout or D:\\cloudless.gr (stale).

usage:
  sync-skills-to-repo.py SKILL [SKILL...] [--repo PATH] [--dry-run]
  sync-skills-to-repo.py --all-new [--repo PATH] [--dry-run]

--all-new syncs every roaming skill dir missing from the repo's
.devin/skills (compares names only).
"""
import argparse, json, os, shutil, subprocess, sys, time

ROAMING = os.path.join(os.environ.get("APPDATA", ""), "devin", "skills")
REPO = "//wsl.localhost/Ubuntu-24.04/home/tbaltzakis/cloudless.gr"
WT_PARENT = "//wsl.localhost/Ubuntu-24.04/home/tbaltzakis"
GIT_ID = ["-c", "user.name=Devin",
          "-c", "user.email=158243242+devin-ai-integration[bot]@users.noreply.github.com"]


def git(repo, *args, check=True):
    safe = "-c"
    safe_dir = "safe.directory=" + repo
    cmd = ["git", safe, safe_dir] + GIT_ID + ["-C", repo] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if check and r.returncode != 0:
        sys.stderr.write(r.stderr or r.stdout)
        sys.exit(r.returncode)
    return r


def repo_skills(repo):
    d = os.path.join(repo, ".devin", "skills")
    return set(os.listdir(d)) if os.path.isdir(d) else set()


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("skills", nargs="*")
    ap.add_argument("--all-new", action="store_true")
    ap.add_argument("--repo", default=REPO)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    if a.all_new:
        have = repo_skills(a.repo)
        skills = sorted(d for d in os.listdir(ROAMING)
                        if os.path.isdir(os.path.join(ROAMING, d))
                        and d not in have)
    else:
        skills = a.skills
    if not skills:
        print("nothing to sync")
        return 0
    for s in skills:
        if not os.path.isdir(os.path.join(ROAMING, s)):
            print("missing roaming skill:", s)
            return 2

    stamp = time.strftime("%Y%m%d-%H%M%S")
    branch = "devin/skills-sync-" + stamp
    # UNC paths must keep forward slashes — os.path.join emits backslashes
    wt = WT_PARENT.rstrip("/\\") + "/cloudless-skills-wt-" + stamp

    if a.dry_run:
        print(json.dumps({"skills": skills, "branch": branch,
                          "worktree": wt, "repo": a.repo}, indent=1))
        return 0

    print("fetch origin/main ...")
    git(a.repo, "fetch", "origin", "main")
    print("worktree add", wt, "on", branch)
    git(a.repo, "worktree", "add", wt, "-b", branch, "origin/main")
    try:
        for s in skills:
            dst = wt + "/.devin/skills/" + s
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(os.path.join(ROAMING, s), dst)
            print("copied", s)
        rel = [".devin/skills/" + s for s in skills]
        git(wt, "add", *rel)
        msg = ("feat(skills): sync roaming Devin skills to repo\n\n"
               + "\n".join("- " + s for s in skills)
               + "\n\nGenerated with [Devin](https://devin.ai)\n\n"
               "Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>")
        git(wt, "commit", "-m", msg)
        print("push ...")
        git(wt, "push", "-u", "origin", branch)
        body = ("## Summary\nSynced roaming Devin skills into `.devin/skills/`:\n\n"
                + "\n".join("- `" + s + "`" for s in skills)
                + "\n\nGenerated with [Devin](https://devin.ai)")
        r = subprocess.run(
            ["gh", "pr", "create", "-R", "Themis128/cloudless.gr",
             "--base", "main", "--head", branch,
             "--title", "feat(skills): sync " + ", ".join(skills[:3])
             + (" +%d more" % (len(skills) - 3) if len(skills) > 3 else ""),
             "--body", body],
            capture_output=True, text=True, timeout=120)
        print(r.stdout.strip() or r.stderr.strip())
        pr = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
        if "/pull/" in pr:
            num = pr.rsplit("/", 1)[-1]
            subprocess.run(["gh", "pr", "merge", num, "-R",
                            "Themis128/cloudless.gr", "--squash", "--auto",
                            "--delete-branch"], timeout=60)
            print("auto-merge armed on PR", num)
    finally:
        git(a.repo, "worktree", "remove", wt, "--force", check=False)
        print("worktree removed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
