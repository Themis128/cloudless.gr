---
name: cybercrime-complaint-ops
description: File/prepare a complaint to the Hellenic Police Cyber Crime Directorate (Διεύθυνση Δίωξης Κυβερνοεγκλήματος / Δι.Δι.Κ.) via gov.gr, email ccu@cybercrimeunit.gov.gr, or 11188. Use for "καταγγελία κυβερνοεγκλήματος", "στείλε στη δίωξη ηλεκτρονικού εγκλήματος", cybercrime complaint prep for the mpaltzakis case or any case with digital evidence.
---

# cybercrime-complaint-ops — Δίωξη Κυβερνοεγκλήματος

Official channels to report cybercrime to the Hellenic Police (verified 2026-11-11):

| Channel | Detail |
|---|---|
| **gov.gr** (official, preferred) | `gov.gr` → Πολίτης και καθημερινότητα → Καταγγελίες → «Καταγγελία για εγκλήματα κυβερνοχώρου». Login with **TAXISnet/ΓΓΠΣ codes**; case lands in the police electronic inbox (ηλεκτρονική θυρίδα). |
| **Email** | `ccu@cybercrimeunit.gov.gr` — inquiries/general; usable for sending the dossier but NOT a substitute for the official complaint. |
| **Phone** | `11188` (24/7, free) — intake only, no documents. |
| **In person / post** | Λ. Αλεξάνδρας 173, 11522 Αθήνα (Αμπελόκηποι). Northern sub-directorate: Μοναστηρίου 326, Θεσσαλονίκη — not relevant for Attica cases. |

## What the gov.gr form covers

Categories offered (per joint ministerial decision / government announcement):
- αδικήματα σε βάρος ανηλίκων μέσω διαδικτύου
- παράνομη πρόσβαση σε ηλεκτρονικό υπολογιστή
- παράνομη διακίνηση οπτικοακουστικών έργων
- **παραβίαση απορρήτου ηλεκτρονικών/τηλεφωνικών επικοινωνιών**
- απάτη με υπολογιστή
- οικονομικά κυβερνοεγκλήματα με ηλεκτρονικά/ψηφιακά νομίσματα

For the mpaltzakis case the closest fit is **παραβίαση απορρήτου ηλεκτρονικών επικοινωνιών** (camera/audio capture + email threats); the free-text field carries the rest. Estimated processing time listed on mitos.gov.gr: ~3 months.

## Prerequisites

- **TAXISnet codes** — stored at `%APPDATA%/devin/secrets/taxisnet.json` (`username`=AFM, `password`, `amka`). The gov.gr complaint uses ΓΓΠΣ/AFM login; `gsis-login-ops` (`scripts/gsis_login.py`) automates the shared GSIS OAuth flow on the `:9229` debug Chrome — reuse it if the portal federates through `oauth2.gsis.gr`.
- **Evidence bundle** — PDFs + token links from `evidence-doc-publish` (see that skill). The token base URL is acceptable as the «κρυπτογραφημένος σύνδελμος» referenced in the documents.

## The tools

### `scripts/govgr-complaint.py` — CDP wizard driver (preferred)

Drives the whole gov.gr complaint wizard on the `:9229` debug Chrome. Requires an
authenticated `dilosi.services.gov.gr` session (TAXISnet/GSIS login — see
`gsis-login-ops`). Reads a JSON config:

```
python govgr-complaint.py --config complaint.json                    # fill -> preview, STOP
python govgr-complaint.py --config complaint.json --submit --confirm-submission \
    --receipt-out "C:/path/receipt.pdf"                              # full unattended submit
```

With `--submit --confirm-submission` the script also handles the **OTP step**:
it polls the phone's SMS inbox over ADB (`content://sms/inbox`, sender `GOVGR`)
for the 6-digit code, enters it, waits for `/done/`, extracts the document
code + issue id, and downloads the official receipt PDF (`--receipt-out`).
Override the sender with `--otp-sender` if gov.gr changes it. Requires the
Galaxy S22+ reachable over ADB (USB or WiFi `adb devices`).

Config keys: `category_label` (matched against the select options),
`description` (≤1000 chars), `suspect` (map of `suspect_*` field names),
`attachments` (list of PDF paths, ≤3 slots × 5 MB).

A ready config for the mpaltzakis case lives at
`Documents\mpaltzakis-correspondence\complaint-package\govgr-config.json`.

**Hard rule: never submit without explicit user authorization** — pass BOTH
`--submit --confirm-submission`. The preview page's «Συνέχεια» leads to terms →
final submission; capture the protocol/receipt number afterwards.

Wizard gotchas (verified 2026-11-11):
- Server-side state machine: once a step is submitted you CANNOT go back —
  `/preview/` redirects forward, `history.back()` and direct step URLs bounce
  back to preview. To fix anything, start a NEW draft (`/templates/KATHLEG/create`).
- Fields need the native prototype setter + `input`/`change`/`blur` events —
  plain `el.value=` triggers «Το πεδίο είναι υποχρεωτικό» on advance.
- The complaint-type step is a `<select name="complaint_type">`; values are
  `complaint_1`..`complaint_6`. For the mpaltzakis case use `complaint_4`
  (privacy violation of electronic/phone communications).
- File inputs: fresh `DOM.getDocument` → `DOM.querySelector` →
  `DOM.setFileInputFiles` per `attachment_N`; verify via `input[type=file].files`.
- Session timer ~20 min; «Ανανέωση Χρόνου» renews. Drafts pile up unsubmitted
  in «Θυρίδα» — harmless, delete manually if needed.
- Personal data (AFM, ΑΔΤ, registered address, postal code, email, phone) comes
  from the gov.gr profile — NOT editable on this wizard. Verify it on the
  preview page; the case address goes inside the description text.
- gov.gr disclaimer on preview: this complaint is NOT a μηνυτήρια αναφορά —
  the separate έγκληση/prosecutor track still applies.

### `scripts/prep-complaint.py` — package assembler

Assembles `complaint-package/` (PDFs + SUBMISSION-NOTES.txt + checklist.txt)
for manual filing or the `ccu@` email route. Does not submit anything.

```
python prep-complaint.py --case mpaltzakis-house-2026-11
```

Writes `complaint-package/` next to the correspondence dir:
- copies of the canonical PDFs (EGKLISI, REPORT, AITISI, VIDEO_INDEX)
- `SUBMISSION-NOTES.txt` — suggested values for every gov.gr field (categories, summary, party details, evidence links)
- `checklist.txt` — step-by-step gov.gr + email + in-person route

Does NOT submit anything — gov.gr submission is interactive (TAXISnet login + form). Use `browser-mcp`/`playwright` on the `:9229` lane if automation of the form itself is wanted; verify each field visually before submit.

## Submission record — mpaltzakis-house-2026-11 (SUBMITTED 2026-11-11 17:37)

- **gov.gr KATHLEG complaint FILED** — issue `680809907`, document code
  `KqcINFjxtDJleFjLQ-ogXw`, category «Παραβίαση απορρήτου ηλεκτρονικών και
  τηλεφωνικών επικοινωνιών», 3 PDF attachments, suspect phone 6980320894.
- **OTP step**: SMS code to +306977777838 — readable via ADB
  `content://sms/inbox` (sender `GOVGR`).
- **Receipt PDF**: `Documents\mpaltzakis-correspondence\KATHLEG-680809907-receipt.pdf`
- Two abandoned drafts remain unsubmitted in «Θυρίδα»: `680803987`, `680808372`.
- **ccu@ email SENT** same day (msg `1a1cb47b65db1c2d`) — body references the
  gov.gr issue/code + verify link, all 4 PDFs attached (~14 MB).

## Case-specific submission notes (mpaltzakis-house-2026-11)

- **Complainant:** Θεμιστοκλής Μπαλτζάκης, Κορωπί Θερμοπυλών 15, ΑΦΜ 115307716, baltzakis.themis@gmail.com
- **Accused:** Μιχαήλ Μπαλτζάκης, same address, mpaltzakis13@hotmail.com
- **Incident window:** 09–11/11/2026 — threats/blackmail by email + covert audio/video capture in shared home
- **Evidence links:** base token `https://evidence.cloudless.gr/t/8827d83d…/mpaltzakis-house-2026-11/` + per-file URLs (EGKLISI, REPORT with 54 clip links, AITISI, VIDEO_INDEX)
- **Related filings:** έγκληση already lodged with Εισαγγελία Πλημμεληδοδικών; AITISI provisional measures prepared for Ειρηνοδικείο Κορωπίου. The cybercrime complaint should reference both (αριθμοί πρωτοκόλλου when known).

## Related

- `evidence-doc-publish` — regenerate/republish the PDFs before submitting.
- `gsis-login-ops` — TAXISnet/GSIS login automation.
- `gmail-send-ops` — optional follow-up email to `ccu@` with the links.
- `POLICE-CONTACTS.md` / `POLICE-REPORT-2026-11-10.md` in the correspondence dir — parallel police-track state.
