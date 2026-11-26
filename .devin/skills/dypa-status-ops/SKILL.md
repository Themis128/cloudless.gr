---
name: dypa-status-ops
description: Check + act on the DYPA "Ειδικό πρόγραμμα απασχόλησης 1.000 πτυχιούχων" for Themis Baltzakis — one-shot status digest (program page announcements, dypa.gov.gr Gmail traffic, local correspondence), plus the follow-up-email workflow to protokollo@dypa.gov.gr / da2@dypa.gov.gr. Use when the user asks "τι γίνεται με το πρόγραμμα", checks DYPA status, or needs a status inquiry / follow-up sent.
---

# dypa-status-ops — status digest + follow-up workflow

Companion to `dypa-1000-ptyxiouxon` (program facts, contacts, procedure,
10-day document window). This skill is the *ops loop*: check → compare → act.

## Quick check

```
python %APPDATA%/devin/skills/dypa-status-ops/scripts/dypa-status-check.py --days 14 [--save out.txt]
```

Prints three lanes:
1. **dypa.gov.gr program page** — dated announcements + storage links.
   Watch for: «Οριστικοί Πίνακες», «συστατικό σημείωμα», new «Αναμορφωμένος
   Πίνακας». Baseline as of 27/11/2026: newest = 06/11 Νέος Αναμορφωμένος
   Πίνακας + 30/10 announcement; interviews ran 04/11→late Nov.
2. **Gmail** — all mail to/from `dypa.gov.gr` in N days (readonly token via
   gmail-telegram-watch `gmail-fetch.py`; `--all` semantics handled inside).
3. **Local correspondence** — newest files in
   `Documents\dypa-1000-ptyxiouxon\`.

## Key threads (as of 2026-11-27)

| lane | address | thread/message | state |
|---|---|---|---|
| protokollo inquiry (θέση 114) | protokollo@dypa.gov.gr | thread+msg `1a1bbe6c7f2d03a8` (sent 08/11) → follow-up sent 27/11 msg `1a21a21313d1c639` | unanswered ~19d before follow-up; `dypa` watch armed |
| program owner Α2 | da2@dypa.gov.gr | replied 10/11 («θα ενημερωθείτε από τη Γραμματεία») | answered |
| ombudsman/unemployment (DIFFERENT matter) | kpamark@dypa.gov.gr | `dypa-kpamark` watch | separate case — don't mix |

Themis's application data: αίτηση **19156/16/08/2026**, κωδ. θέσης **114**
(ΓΔ Υποστήριξης και Ψηφιακής Διακυβέρνησης), σειρά **3**, βαθμολογία **72.00**,
κατάσταση ΑΞΙΟΛΟΓΗΜΕΝΗ / τοποθέτηση αποδεκτή, αποδοχή έως **31/12/2026**.

## Sending a follow-up (proven 2026-11-27)

User wants to review the draft BEFORE send — always draft first, show body,
wait for approval.

1. Get parent ids (readonly token):
   `gmail-fetch.py "to:protokollo@dypa.gov.gr in:sent"` → note `id`/`threadId`
   and the `Message-ID` header (fetch full message for it).
2. Write body to a file (Greek OK — script handles MIME/UTF-8 correctly):
   `Documents\dypa-1000-ptyxiouxon\YYYY-MM-DD_<topic>-body.txt`
3. Draft threaded:
   ```
   python %APPDATA%/devin/skills/gmail-send-ops/scripts/gmail-schedule-reply.py --draft \
     --to protokollo@dypa.gov.gr \
     --subject "Re: <original subject>" \
     --body-file <body.txt> \
     --in-reply-to "<parent Message-ID>" \
     --thread-id <threadId> \
     --state <state.json>
   ```
4. Show user; on approval `--send --state <state.json>`.
5. Save sent copy: fetch `messages/<sent-id>?format=full`, dump body to
   `YYYY-MM-DD_<topic>-sent.txt` in the correspondence folder.

## After any status change

- Update `dypa-1000-ptyxiouxon/SKILL.md` procedure/status lines.
- Mirror new correspondence .txt files + SKILL.md to GitHub:
  - `Themis128/dypa-1000-ptyxiouxon` (correspondence only; gh api PUT contents)
  - `Themis128/evidence-pipeline` → `skills/dypa-1000-ptyxiouxon/` — keep the
    YAML frontmatter block when overwriting.
- `dypa` gmail-telegram-watch already covers replies to the protokollo
  thread; `dypa-da2` covers da2@. Telegram alerts → `[DYPA ...]`.

## Gotchas

- **gmail MCP (`gmail` plugin) is dead** (connect fail); `gmail-local` MCP
  works for search/read/draft/send BUT Devin's transport corrupts non-ASCII
  args (surrogateescape) — patched in gmail_mcp.py + PYTHONUTF8 env in
  mcp_config.json, effective next session. Until then use the scripts above.
- gmail-fetch.py prints only the NEWEST match unless `--all`.
- Do NOT reintroduce the €4.080 figure anywhere (user rule; amount stays «άνω των 2.000€» — that rule was for the police case, but keep amounts consistent with filed docs).
- Placement refusal = strike + 2-year exclusion — never advise declining.
