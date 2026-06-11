---
name: pr-event-triage
description: Triage incoming PR webhook events (failed CI checks, bot comments, review threads) and decide whether to silently skip, fix immediately, or escalate to the user. Use whenever subscribed to PR activity and a `<github-webhook-activity>` event arrives. Prevents the "respond to every duplicate root-cause event" loop that wastes cycles and adds noise. Triggers on "webhook event", "PR activity", "babysit PR", "check failed", "review comment", "Sonar comment", "what should I do about this event".
allowed-tools: Bash, Read, mcp__github__pull_request_read, mcp__github__add_issue_comment
---

# PR Event Triage

## What this skill knows

When subscribed to PR activity, the harness delivers a `<github-webhook-activity>` event for every CI check failure, bot comment, and review comment. The temptation is to respond to each one. Most of the time the correct response is **silent skip** — the event is a duplicate of an already-known root cause, or it's working exactly as designed and surfacing a duplicate informational signal.

Acknowledging every event creates noise that drowns the real signals (a human review, a new failure class, a real merge blocker). The user is fatigued by it.

## The four event classes

### 1. SILENT SKIP — no action, no message

- **Repeated bot comment with unchanged numbers** (SonarCloud "1 New issue / Quality Gate passed" posted on every push, ActiveCampaign daily digest, Dependabot bump notifications that are identical to the prior one).
- **A CI check that fails for the same documented root cause already handled this session.** E.g. once you've diagnosed a hosted-runner outage and pushed the migration commit, every subsequent instant-fail check on the same workflow during the same session is a duplicate. Don't acknowledge it.
- **An informational check failing in its by-design way.** E.g. a workflow with step-level `continue-on-error: true` on every step *intended* to silence false-positive findings. If you've already configured it to not be a merge gate, its red status is expected.
- **Auto-merge / auto-label results that are `skipped` or `success`** — these are routine.

The user is the author and has the same notifications you do. Re-stating "no action needed" in a chat reply adds nothing.

### 2. FIX IMMEDIATELY — small, confident change

- **A CI check that failed for a *new* reason** (not the established root cause of this session).
- **A bot review comment with a single concrete suggestion** that's small, mechanical, and matches the conversation's intent (e.g. Sonar bot points to a specific rule + file:line and the fix is the canonical one for that rule).
- **A `Format Check` failure** after editing code — almost always a prettier reflow. Run `pnpm exec prettier --write` on the changed files and push.
- **A human review comment** with a small, mechanical ask ("rename this variable", "extract this constant", "add a type annotation").

Push the fix. **Reply only if the fix resolves the conversation, raises a question, or contradicts a prior commit.** Otherwise just push — the diff is the record.

### 3. ASK THE USER — ambiguous or architecturally significant

Use `AskUserQuestion` (with all required fields including `question`). Don't waffle; offer 2–3 concrete options and recommend one.

- **A check failed for a *new* reason that could be a real bug OR a flake OR a platform issue**, and you can't read the job log to disambiguate.
- **A human review comment that could be interpreted multiple ways** ("not sure about this approach" — do they want rework, a comment defending it, or a discussion?).
- **A change in CI policy** (removing a check from required, adding `continue-on-error`, migrating a workflow to/from Pi). These are repo-wide effects; never apply unilaterally.
- **A merge attempt or branch-protection bypass.** Always ask.

### 4. SKIP + STATE BLOCKED ONCE — needs the user, but only once

For events that require admin action *outside* your reach:

- Branch protection rule changes (only repo admins).
- GitHub-hosted runner billing / capacity issues.
- Sonar private-project authenticated-only operations.
- Anything requiring `gh` CLI write to a repo variable.

State the blocker **the first time it surfaces** with the exact action the user needs to take. After that, every duplicate event for the same blocker is class 1 (silent skip). Track in your head what you've already explained.

## Decision script

For each `<github-webhook-activity>` event:

```
1. Is the event identical to a previous one I've already classified this session?
   YES → class 1 (silent skip). Do not respond.
   NO  → continue.

2. Is it a known-by-design state? (informational scanner, Sonar pass-with-non-blocking-issue,
   continue-on-error workflow exit non-zero, auto-merge skipped)
   YES → class 1 (silent skip).
   NO  → continue.

3. Is there a concrete, small, mechanical fix I'm confident about and that matches the
   conversation's intent?
   YES → class 2 (fix immediately, push, reply only if necessary).
   NO  → continue.

4. Does the right move require admin action only the user can do?
   YES → class 4 (state blocked ONCE with the specific action, then silent skip on duplicates).
   NO  → continue.

5. Is the event ambiguous (multiple plausible interpretations) or architecturally
   significant (touching branch protection, repo variables, removing checks)?
   YES → class 3 (AskUserQuestion with 2–3 concrete options).
   NO  → re-examine — if you've reached this branch your event probably fits class 1 or 2.
```

## Signature patterns

These let you classify quickly from the event metadata, without fetching logs.

### CI check failures

| Duration | Likely cause | Class |
|---|---|---|
| 2–4 seconds | Hosted-runner outage — job never started | 4 (state once) → 1 (silent skip) |
| 10–60 seconds | Setup step failed (npm install, action download) — could be ARM-incompatible deps on Pi, network issue | 2 if obvious fix, 3 if ambiguous |
| > 1 minute | Job actually ran and produced a real failure | 2 if you can read the log via `gh` (you usually can't here), else 3 |

### Bot comments

| Bot | Pattern | Class |
|---|---|---|
| SonarCloud | "Quality Gate passed" + same number of "X New issues" as previous comment | 1 (silent skip) |
| SonarCloud | Quality Gate *failed* with new condition or rule citation | 2 if fix is obvious from rule, 3 if rule is opaque |
| Dependabot | Routine bump notification, same package as previous | 1 (silent skip) |
| Claude code review | Recommends a small mechanical change | 2 |
| Claude code review | Calls out architectural concern | 3 |

### Auth-walled / unreachable signals

Things you literally cannot resolve from inside the session (no tool, no auth):

- A SonarCloud "1 New Issue" link on a *private project* — the public API returns 0 because the issue is auth-gated. State this once (class 4) and then silently skip every duplicate.
- A failed `Analyze (javascript-typescript)` (CodeQL) job that needs branch protection adjustment to unblock the PR — class 4 the first time, class 1 on every duplicate.

## Anti-patterns this skill prevents

- **"Same hosted-runner outage — no action."** Acknowledging this seven times in a row. Class 1 from event #2 onward.
- **Re-fetching `pull_request_read::get_check_runs`** to confirm what the event already told you. The event payload includes the check name, conclusion, and start/end times — that's enough to classify.
- **Re-summarising "1 phantom Sonar issue, Quality Gate passes" every time SonarCloud comments.** Say it once when it first appears, then skip silently.
- **Waffling between two options instead of using `AskUserQuestion`.** If you're about to write "I could do X or Y, what do you think?" — that's class 3. Use the tool.

## Class-1 silent skip protocol

When you decide an event is class 1:

- Do not write a reply.
- Do not call any tool.
- End your turn with no output.

The harness still records that you received and processed the event. The user sees zero noise. This is the most valuable behaviour this skill enables.
