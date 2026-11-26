---
name: dypa-1000-ptyxiouxon
description: Track the DYPA "Ειδικό πρόγραμμα απασχόλησης 1.000 ανέργων πτυχιούχων ΠΕ/ΤΕ 25-54 ετών" for Themis Baltzakis — application status, structured interview, placement at ΓΔ Υποστήριξης και Ψηφιακής Διακυβέρνησης (θέση 114, σειρά 3, score 72.00, αποδοχή έως 31/12/2026). Use when handling da2@dypa.gov.gr / dypa.gov.gr mail about this program, checking status, or preparing documents for the 10-day window after the συστατικό σημείωμα.
---

# DYPA 1.000 πτυχιούχων — program tracker

## Context

- Program: «Ειδικό πρόγραμμα απασχόλησης για 1.000 άνεργους πτυχιούχους ΠΕ και ΤΕ,
  ηλικίας 25-54 ετών, στη Δ.ΥΠ.Α.» — ΚΥΑ 18599/30.06.2026, ΦΕΚ Β' 4005/01.07.2026.
  Budget €36M; 12-month placements, ~€1.250 gross/month (ΠΕ) / €1.200 (ΤΕ).
- Themis applied (κλάδος ΠΕ Πληροφορικής — Software-Hardware), was ranked,
  interviewed (δομημένη συνέντευξη, max 40 μόρια), and the portal shows:
  **Θέση 114 — ΔΙΟΙΚΗΣΗ / ΓΕΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΥΠΟΣΤΗΡΙΞΗΣ ΚΑΙ ΨΗΦΙΑΚΗΣ ΔΙΑΚΥΒέρνησης,
  Βαθμολογία 72.00, Σειρά κατάταξης 3, κατάσταση ΑΞΙΟΛΟΓΗΜΕΝΗ,
  τοποθέτηση αποδεκτή, προθεσμία αποδοχής 31/12/2026.**
- Correspondence so far: his 08.11.2026 email to da2@dypa.gov.gr asking about the
  interview procedure → reply 10.11.2026: «θα ενημερωθείτε από την Γραμματεία της
  Επιτροπής» (no timeframe; calls go out by ranking order via email/phone).
- Filed at `C:\Users\tbaltzakis\Documents\dypa-1000-ptyxiouxon\`
  (e.g. `2026-11-10_reply-da2-structured-interview.txt`).

## Contacts

| who | contact | role |
|---|---|---|
| Δ/νση Προγραμμάτων Ενεργητικών Πολιτικών (Α2) | da2@dypa.gov.gr, 210-99.89.116, Εθν. Αντιστάσεως 8, Άλιμος | program owner — handled his inquiry |
| Γραμματεία αρμόδιας Τριμελούς Επιτροπής | contacted BY them (call/email) | conducts interviews, notifies candidates |
| ΚΠΑ2 Τοποθέτησης | via συστατικό σημείωμα | issues placement, collects documents |
| 1555 / dypa.gov.gr | general | status questions |

## Procedure (from ΦΕΚ, verified 2026-11-10)

1. Applications closed 18/08/2026. Προσωρινοί πίνακες 16/09 → ενστάσεις 3 εργάσιμες.
2. Αναμορφωμένοι πίνακες 30/10 (+ νέος 06/11/2026). Interviews from 04/11/2026,
   called in rank order, 3× positions per service, by email/phone.
   Interview = 3 sections, max 40 μόρια (προσωπικότητα 10 / αντικείμενο θέσης 15 /
   σενάριο γενικής διοίκησης 15). **No appeal against committee decisions.**
3. Οριστικοί Πίνακες → posted on dypa.gov.gr (NOT yet posted as of 27/11/2026 —
   interviews wrapping up late Nov, placements expected within December).
   27/11: sent follow-up to protokollo@dypa.gov.gr on the unanswered 08/11
   inquiry thread (θέση 114, σειρά 3, 72.00) asking interview-score status +
   final-tables date + συστατικό σημείωμα timing (msg `1a21a21313d1c639`).
4. Συστατικό σημείωμα → **10 calendar days** to submit documents or excluded.
5. ΕΡΓΑΝΗ registration within 60 days of document submission.
6. Placement refusal → strike under ν.4921/2022 + 2-year exclusion from DYPA
   public-sector programs. **Do not decline casually.**

## When new mail arrives

1. Check the `dypa-da2` watch fired (Telegram) or sweep:
   `python %APPDATA%/devin/skills/gmail-telegram-watch/scripts/gmail-fetch.py "da2@dypa.gov.gr OR dypa.gov.gr newer_than:14d"`
   (`case-watch.py` also sweeps all dypa.gov.gr domain mail every ~10 min.)
2. Save the email text to `Documents\dypa-1000-ptyxiouxon\YYYY-MM-DD_<topic>.txt`
   (see existing file for format: From/To/Subject/Date header + body).
3. If it's the συστατικό σημείωμα or a document request: flag the **10-day
   deadline immediately** via `tg-send.py` and start preparing δικαιολογητικά
   (ΑΦΜ/ΑΜΚΑ, πτυχίο, μεταπτυχιακό if any, βεβαίωση εμπειρίας >12μ, πιστοποιητικό
   κατάρτισης, ΑΣΔ, δελτίο ανεργίας).
4. Summarize for Themis and send via `tg-send.py`.

## Tools

- `scripts/file-mail.py` (this skill) — fetch latest matching Gmail message and
  append it to the correspondence folder as a dated .txt.
- gmail-telegram-watch scripts: `gmail-fetch.py`, `tg-send.py`, watch
  `watches/dypa-da2.json` (armed 2026-11-10, baselines the da2 thread, alerts on
  new inbound replies).
- Public tables: dypa.gov.gr → Προγράμματα Απασχόλησης → κλειστό πρόγραμμα →
  «Νομικό Πλαίσιο – Υποστηρικτικό Υλικό» (νεότερος: Αναμορφωμένος Πίνακας 06/11/2026).
- Portal self-check: his application shows live status/score/rank (the source of
  the θέση 114 / σειρά 3 / 72.00 figures above).

## Related

- `ombudsman-dypa` folder = DIFFERENT matter (επίδομα ανεργίας dispute,
  kpamark@dypa.gov.gr, ΣτΕ/Συνήγορος). Don't mix files.
- gmail-telegram-watch skill — watcher ops, re-auth, adding watches.
- gmail-send-ops skill — outbound Gmail (gmail.modify token, threaded
  drafts, scheduled sends). The 10/11 da2 reply was sent 11/11 via
  `scripts/dypa-da2-reply.py` (hardcoded DYPA variant of that pattern);
  state in `dypa-da2-reply-state.json` (`manual_send`/`sent_message_id`
  recorded). New ad-hoc sends should use `gmail-schedule-reply.py`.
