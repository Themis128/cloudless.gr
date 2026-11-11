#!/usr/bin/env python3
"""prep-complaint.py — assemble a cybercrime-complaint submission package.

Copies the canonical evidence PDFs and writes SUBMISSION-NOTES.txt with
suggested gov.gr field values + a filing checklist. Submits nothing.

usage: prep-complaint.py [--case mpaltzakis-house-2026-11] [--out DIR]
"""

import argparse
import os
import shutil
import sys

SRC_DIR = r"C:\Users\tbaltzakis\Documents\mpaltzakis-correspondence"


def _evidence_token():
    """Bearer token for the tokenized evidence host — resolve, never hardcode."""
    env = os.environ.get("EVIDENCE_TOKEN")
    if env:
        return env.strip()
    for path in (
        os.path.join(os.environ.get("APPDATA", ""), "devin", "secrets", "evidence-token.txt"),
        os.path.expanduser("~/.config/devin/secrets/evidence-token.txt"),
    ):
        if path and os.path.exists(path):
            token = open(path, encoding="utf-8").read().strip()
            if token:
                return token
    sys.exit(
        "FAIL: no evidence token — set EVIDENCE_TOKEN or write %APPDATA%/devin/secrets/evidence-token.txt"
    )


def evidence_base(case):
    return (
        "https://pub-6db4c5dc5fee4d5ba450ae560cf8340c.r2.dev/t/"
        + _evidence_token()
        + "/"
        + case
        + "/"
    )


PDFS = [
    "EGKLISI_mpaltzakis_house_2026_11.pdf",
    "REPORT_mpaltzakis_house_2026_11.pdf",
    "AITISI_ASFALISTIKA_METRA_2026_11.pdf",
    "VIDEO_INDEX.pdf",
]

NOTES = """\
ΚΑΤΑΓΓΕΛΙΑ ΓΙΑ ΕΓΚΛΗΜΑΤΑ ΚΥΒΕΡΝΟΧΩΡΟΥ — ΥΠΟΔΕΙΞΕΙΣ ΠΕΔΙΩΝ (gov.gr)
================================================================

Σύνδεση: κωδικοί TAXISnet (ΑΦΜ + κωδικός πρόσβασης).
Διαδρομή: gov.gr → Πολίτης και καθημερινότητα → Καταγγελίες
          → «Καταγγελία για εγκλήματα κυβερνοχώρου».

ΠΕΔΙΑ ΠΡΟΣ ΣΥΜΠΛΗΡΩΣΗ
---------------------
Κατηγορία αδικήματος: Παραβίαση του απορρήτου των ηλεκτρονικών
    και τηλεφωνικών επικοινωνιών
    (δευτερευόντως: οικονομικά/απειλή μέσω ηλεκτρονικών μηνυμάτων —
     αν η φόρμα επιτρέπει ελεύθερη περιγραφή, αναφέρε και την εκβίαση
     για επιστροφή χρημάτων)

Στοιχεία καταγγέλλοντος:
    Θεμιστοκλής Μπαλτζάκης
    Κορωπί, οδός Θερμοπυλών 15, Οικισμός Αγίου Ιωάννη, Τ.Κ. 19441
    ΑΦΜ: 115307716 — τηλ. 6977777838
    e-mail: baltzakis.themis@gmail.com

Στοιχεία καταγγελλόμενου:
    Μιχαήλ Μπαλτζάκης
    ίδια κατοικία (Κορωπί, Θερμοπυλών 15)
    e-mail: mpaltzakis13@hotmail.com
    (ΑΦΜ/ΑΔΤ: ζητείται επιβεβαίωση από την Αρχή — βλ. έγκληση)

Περίληψη υπόθεσης (αντιγραφή για το πεδίο «περιγραφή»):
    Κατά το διάστημα 09–11/11/2026 ο καταγγελλόμενος, συγκάτοικος του
    καταγγέλλοντος στην ίδια διεύθυνση, απέστειλε σειρά ηλεκτρονικών
    μηνυμάτων με βαρύλογη ύβρη, απειλές μελλοντικής σωματικής
    παρέμβασης και αξιώσεις επιστροφής χρημάτων/κάρτας, ενώ η
    κάμερα παρακολούθησης κατέγραφε ηχητικά δύο επεισόδια
    φωνητικής αντιπαράθεσης εντός της οικίας. Ο καταγγέλλων έχει
    ήδη υποβάλει έγκληση στην Εισαγγελία Πλημμεληδοδικών και έχει
    καταθέσει αίτηση λήψης ασφαλιστικών μέτρων στο Μονομελές Πρωτοδικείο
    Αθηνών. Όλο το αποδεικτικό υλικό (βίντεο-κλιπ, ήχος,
    αλληλογραφία, εκθέσεις) είναι διαθέσιμο στους παρακάτω
    κρυπτογραφημένους συνδέσμους.

ΑΠΟΔΕΙΚΤΙΚΟ ΥΛΙΚΟ (κρυπτογραφημένοι σύνδεσμοι HTTPS)
-----------------------------------------------
Βάση φακέλου: {base}
  - EGKLISI_mpaltzakis_house_2026_11.pdf   (έγκληση/μηνυτήρια αναφορά)
  - REPORT_mpaltzakis_house_2026_11.pdf    (έκθεση με 54 συνδέσμους βίντεο)
  - AITISI_ASFALISTIKA_METRA_2026_11.pdf   (αίτηση ασφαλιστικών μέτρων)
  - VIDEO_INDEX.pdf                        (οπτικός κατάλογος κλιπ)

ΣΧΕΤΙΚΑ ΠΡΩΤΟΚΟΛΛΑ
-----------------
  - Έγκληση: Εισαγγελία Πλημμεληδοδικών (αρ. πρωτοκόλλου: ............)
  - Ασφαλιστικά μέτρα: Μονομελές Πρωτοδικείο Αθηνών (αρ. πρωτοκόλλου: ............)
"""

CHECKLIST = """\
CHECKLIST ΥΠΟΒΟΛΗΣ
=================
[ ] 1. Συνδεθείτε στο gov.gr με κωδικούς TAXISnet.
[ ] 2. Υποβάλετε «Καταγγελία για εγκλήματα κυβερνοχώρου» με τα πεδία
       του SUBMISSION-NOTES.txt. Κρατήστε τον αριθμό πρωτοκόλλου.
[ ] 3. (Προαιρετικό) Στείλτε ενημερωτικό email στο ccu@cybercrimeunit.gov.gr
       με τους 4 συνδέσμους PDF + τον αριθμό πρωτοκόλλου gov.gr.
[ ] 4. Εναλλακτική/παράλληλη οδός: τηλέφωνο 11188 (24/7) ή επίσκεψη
       Λ. Αλεξάνδρας 173, Αθήνα με εκτύπωση του SUBMISSION-NOTES.txt
       και των PDF.
[ ] 5. Καταγράψτε ημερομηνία/πρωτόκολλο εδώ: ....................
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--case", default="mpaltzakis-house-2026-11")
    ap.add_argument("--out", default=None, help="output dir (default: <src>/complaint-package)")
    a = ap.parse_args()

    out = a.out or os.path.join(SRC_DIR, "complaint-package")
    os.makedirs(out, exist_ok=True)

    missing = []
    for pdf in PDFS:
        src = os.path.join(SRC_DIR, pdf)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(out, pdf))
        else:
            missing.append(pdf)

    base = evidence_base(a.case)
    with open(os.path.join(out, "SUBMISSION-NOTES.txt"), "w", encoding="utf-8") as f:
        f.write(NOTES.format(base=base))
    with open(os.path.join(out, "checklist.txt"), "w", encoding="utf-8") as f:
        f.write(CHECKLIST)

    print("package:", out)
    for pdf in PDFS:
        print("  ", "OK " if pdf not in missing else "MISSING ", pdf)
    if missing:
        sys.exit("missing PDFs — run evidence-doc-publish first")


if __name__ == "__main__":
    main()
