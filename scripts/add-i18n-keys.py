#!/usr/bin/env python3
"""Add missing i18n keys for work, docs, case-studies, privacy, terms, refund,
accessibility, agents, campaigns, store/success, and store/[id] pages to all
4 locale files. Adds meta.* keys (title + description) and page-specific UI
string keys."""
import json
import sys
from pathlib import Path

LOCALES_DIR = Path(__file__).parent.parent / "src" / "locales"

# New meta.* keys for 9 pages
META_KEYS = {
    "work": {
        "en": {"title": "Our Work", "description": "Client projects delivered by Cloudless — serverless migrations, analytics pipelines, and AI-powered marketing platforms."},
        "el": {"title": "Η Δουλειά Μας", "description": "Project πελατών που παρέδωσε η Cloudless — serverless μεταναστεύσεις, analytics pipelines και πλατφόρμες marketing με AI."},
        "fr": {"title": "Nos Réalisations", "description": "Projets clients livrés par Cloudless — migrations serverless, pipelines analytics et plateformes marketing IA."},
        "de": {"title": "Unsere Arbeiten", "description": "Kundenprojekte von Cloudless — Serverless-Migrationen, Analytics-Pipelines und KI-gestützte Marketing-Plattformen."},
    },
    "docs": {
        "en": {"title": "Documentation", "description": "Internal guides, integration references, and how-to documentation for the Cloudless platform."},
        "el": {"title": "Τεκμηρίωση", "description": "Εσωτερικοί οδηγοί, αναφορές ενσωμάτωσης και τεκμηρίωση how-to για την πλατφόρμα Cloudless."},
        "fr": {"title": "Documentation", "description": "Guides internes, références d'intégration et documentation how-to pour la plateforme Cloudless."},
        "de": {"title": "Dokumentation", "description": "Interne Leitfäden, Integrationsreferenzen und How-to-Dokumentation für die Cloudless-Plattform."},
    },
    "caseStudies": {
        "en": {"title": "Case Studies", "description": "Real-world results: how Cloudless helped startups and growing businesses cut cloud costs, migrate to serverless, and ship faster."},
        "el": {"title": "Μελέτες Περίπτωσης", "description": "Πραγματικά αποτελέσματα: πώς η Cloudless βοήθησε startups και αναπτυσσόμενες επιχειρήσεις να μειώσουν το κόστος cloud, να μετακινηθούν σε serverless και να αποστείλουν πιο γρήγορα."},
        "fr": {"title": "Études de Cas", "description": "Résultats concrets : comment Cloudless a aidé des startups et entreprises en croissance à réduire leurs coûts cloud, migrer vers le serverless et livrer plus rapidement."},
        "de": {"title": "Fallstudien", "description": "Reale Ergebnisse: Wie Cloudless Startups und wachsende Unternehmen bei der Senkung von Cloud-Kosten, der Migration zu Serverless und schnellerer Lieferung half."},
    },
    "privacy": {
        "en": {"title": "Privacy Policy", "description": "How Cloudless.gr collects, uses, and protects your personal data. GDPR and CCPA compliant."},
        "el": {"title": "Πολιτική Απορρήτου", "description": "Πώς η Cloudless.gr συλλέγει, χρησιμοποιεί και προστατεύει τα προσωπικά σας δεδομένα. Συμμόρφωση με GDPR και CCPA."},
        "fr": {"title": "Politique de Confidentialité", "description": "Comment Cloudless.gr collecte, utilise et protège vos données personnelles. Conforme au RGPD et au CCPA."},
        "de": {"title": "Datenschutzerklärung", "description": "Wie Cloudless.gr Ihre persönlichen Daten erfasst, verwendet und schützt. DSGVO- und CCPA-konform."},
    },
    "terms": {
        "en": {"title": "Terms of Service", "description": "Terms and conditions for using Cloudless.gr services and store. Compliant with EU Consumer Rights Directive."},
        "el": {"title": "Όροι Χρήσης", "description": "Όροι και προϋποθέσεις χρήσης των υπηρεσιών και του καταστήματος Cloudless.gr. Συμμόρφωση με την Οδηγία Δικαιωμάτων Καταναλωτών ΕΕ."},
        "fr": {"title": "Conditions d'Utilisation", "description": "Conditions générales d'utilisation des services et de la boutique Cloudless.gr. Conforme à la Directive sur les droits des consommateurs de l'UE."},
        "de": {"title": "Nutzungsbedingungen", "description": "Allgemeine Geschäftsbedingungen für die Nutzung der Cloudless.gr-Dienste und des Shops. Konform mit der EU-Verbraucherrechte-Richtlinie."},
    },
    "refund": {
        "en": {"title": "Refund & Returns Policy", "description": "Our refund and returns policy, including the EU 14-day right of withdrawal for consumers."},
        "el": {"title": "Πολιτική Επιστροφών & Ακυρώσεων", "description": "Η πολιτική επιστροφών και ακυρώσεων, συμπεριλαμβανομένου του δικαιώματος ανάκλησης 14 ημερών ΕΕ για καταναλωτές."},
        "fr": {"title": "Politique de Remboursement et de Retour", "description": "Notre politique de remboursement et de retour, incluant le droit de rétractation de 14 jours de l'UE pour les consommateurs."},
        "de": {"title": "Rückerstattungs- und Rückgaberichtlinie", "description": "Unsere Rückerstattungs- und Rückgaberichtlinie, einschließlich des 14-tägigen EU-Widerrufsrechts für Verbraucher."},
    },
    "accessibility": {
        "en": {"title": "Accessibility Statement", "description": "Cloudless.gr accessibility statement — WCAG 2.1 AA compliance and contact for assistance."},
        "el": {"title": "Δήλωση Προσβασιμότητας", "description": "Δήλωση προσβασιμότητας Cloudless.gr — συμμόρφωση WCAG 2.1 AA και επαφή για βοήθεια."},
        "fr": {"title": "Déclaration d'Accessibilité", "description": "Déclaration d'accessibilité Cloudless.gr — conformité WCAG 2.1 AA et contact pour assistance."},
        "de": {"title": "Barrierefreiheitserklärung", "description": "Barrierefreiheitserklärung von Cloudless.gr — WCAG 2.1 AA-Konformität und Kontakt für Unterstützung."},
    },
    "agents": {
        "en": {"title": "Agents", "description": "Cloudless Agent Workers — Interactive demos and tools."},
        "el": {"title": "Agents", "description": "Cloudless Agent Workers — Διαδραστικά demos και εργαλεία."},
        "fr": {"title": "Agents", "description": "Cloudless Agent Workers — Démos interactives et outils."},
        "de": {"title": "Agents", "description": "Cloudless Agent Workers — Interaktive Demos und Werkzeuge."},
    },
    "campaigns": {
        "en": {"title": "Campaigns — Cloudless", "description": "Active offers and time-bound campaigns from Cloudless. Greek SMB focus."},
        "el": {"title": "Καμπάνιες — Cloudless", "description": "Ενεργές προσφορές και χρονικά περιορισμένες καμπάνιες από την Cloudless. Εστίαση σε ελληνικά ΜμΕ."},
        "fr": {"title": "Campagnes — Cloudless", "description": "Offres actives et campagnes à durée limitée de Cloudless. Axé sur les PME grecques."},
        "de": {"title": "Kampagnen — Cloudless", "description": "Aktuelle Angebote und zeitlich begrenzte Kampagnen von Cloudless. Fokus auf griechische KMU."},
    },
}

# Page-specific UI string keys
PAGE_KEYS = {
    "workPage": {
        "en": {
            "badge": "OUR WORK",
            "title": "Projects that",
            "titleHighlight": "actually shipped",
            "subtitle": "Serverless migrations, analytics pipelines, and AI-powered marketing platforms — built for teams that need to move fast.",
            "active": "▶ Active",
            "completed": "✓ Completed",
            "emptyTitle": "No client projects to show yet.",
            "emptyDesc": "Check back soon — we're always building.",
        },
        "el": {
            "badge": "Η ΔΟΥΛΕΙΑ ΜΑΣ",
            "title": "Projects που",
            "titleHighlight": "όντως παρεδόθησαν",
            "subtitle": "Serverless μεταναστεύσεις, analytics pipelines και πλατφόρμες marketing με AI — για ομάδες που πρέπει να κινηθούν γρήγορα.",
            "active": "▶ Ενεργά",
            "completed": "✓ Ολοκληρωμένα",
            "emptyTitle": "Δεν υπάρχουν project πελατών προς προβολή ακόμα.",
            "emptyDesc": "Ελέγξτε ξανά σύντομα — πάντα χτίζουμε.",
        },
        "fr": {
            "badge": "NOS RÉALISATIONS",
            "title": "Projets qui",
            "titleHighlight": "ont réellement livré",
            "subtitle": "Migrations serverless, pipelines analytics et plateformes marketing IA — conçus pour les équipes qui doivent avancer vite.",
            "active": "▶ Actifs",
            "completed": "✓ Terminés",
            "emptyTitle": "Aucun projet client à afficher pour le moment.",
            "emptyDesc": "Revenez bientôt — nous construisons en permanence.",
        },
        "de": {
            "badge": "UNSERE ARBEITEN",
            "title": "Projekte, die",
            "titleHighlight": "wirklich ausgeliefert wurden",
            "subtitle": "Serverless-Migrationen, Analytics-Pipelines und KI-gestützte Marketing-Plattformen — für Teams, die schnell vorankommen müssen.",
            "active": "▶ Aktiv",
            "completed": "✓ Abgeschlossen",
            "emptyTitle": "Noch keine Kundenprojekte zu zeigen.",
            "emptyDesc": "Schauen Sie bald wieder vorbei — wir bauen ständig.",
        },
    },
    "docsPage": {
        "en": {
            "label": "[ DOCS ]",
            "title": "Documentation &",
            "titleHighlight": "guides",
            "subtitle": "Everything you need to integrate, configure, and extend the Cloudless platform.",
            "searchPlaceholder": "Search docs…",
            "searchLabel": "Search docs",
            "status": "Status:",
            "all": "All",
            "verified": "✓ Verified",
            "needsReview": "⟳ Needs Review",
            "unverified": "? Unverified",
            "noResults": "No docs match your filters.",
            "noDocs": "No documentation published yet.",
            "viewAll": "View all docs",
            "resultSingular": "result",
            "resultPlural": "results",
            "for": "for",
            "owner": "Owner:",
            "verifiedLabel": "Verified:",
            "allDocs": "← All docs",
            "backToAllDocs": "← Back to all docs",
            "noContent": "No content available.",
            "onThisPage": "On this page",
        },
        "el": {
            "label": "[ ΤΕΚΜΗΡΙΩΣΗ ]",
            "title": "Τεκμηρίωση &",
            "titleHighlight": "οδηγοί",
            "subtitle": "Όλα όσα χρειάζεστε για ενσωμάτωση, ρύθμιση και επέκταση της πλατφόρμας Cloudless.",
            "searchPlaceholder": "Αναζήτηση docs…",
            "searchLabel": "Αναζήτηση docs",
            "status": "Κατάσταση:",
            "all": "Όλα",
            "verified": "✓ Επαληθευμένα",
            "needsReview": "⟳ Χρειάζεται Έλεγχο",
            "unverified": "? Μη επαληθευμένα",
            "noResults": "Δεν βρέθηκαν docs με αυτά τα φίλτρα.",
            "noDocs": "Δεν έχει δημοσιευτεί τεκμηρίωση ακόμα.",
            "viewAll": "Προβολή όλων των docs",
            "resultSingular": "αποτέλεσμα",
            "resultPlural": "αποτελέσματα",
            "for": "για",
            "owner": "Ιδιοκτήτης:",
            "verifiedLabel": "Επαληθευμένο:",
            "allDocs": "← Όλα τα docs",
            "backToAllDocs": "← Πίσω σε όλα τα docs",
            "noContent": "Δεν υπάρχει διαθέσιμο περιεχόμενο.",
            "onThisPage": "Σε αυτή τη σελίδα",
        },
        "fr": {
            "label": "[ DOCS ]",
            "title": "Documentation &",
            "titleHighlight": "guides",
            "subtitle": "Tout ce dont vous avez besoin pour intégrer, configurer et étendre la plateforme Cloudless.",
            "searchPlaceholder": "Rechercher docs…",
            "searchLabel": "Rechercher docs",
            "status": "Statut :",
            "all": "Tous",
            "verified": "✓ Vérifiés",
            "needsReview": "⟳ À vérifier",
            "unverified": "? Non vérifiés",
            "noResults": "Aucun doc ne correspond à vos filtres.",
            "noDocs": "Aucune documentation publiée pour le moment.",
            "viewAll": "Voir tous les docs",
            "resultSingular": "résultat",
            "resultPlural": "résultats",
            "for": "pour",
            "owner": "Propriétaire :",
            "verifiedLabel": "Vérifié :",
            "allDocs": "← Tous les docs",
            "backToAllDocs": "← Retour aux docs",
            "noContent": "Aucun contenu disponible.",
            "onThisPage": "Sur cette page",
        },
        "de": {
            "label": "[ DOKUMENTATION ]",
            "title": "Dokumentation &",
            "titleHighlight": "Leitfäden",
            "subtitle": "Alles, was Sie zur Integration, Konfiguration und Erweiterung der Cloudless-Plattform benötigen.",
            "searchPlaceholder": "Doks durchsuchen…",
            "searchLabel": "Doks durchsuchen",
            "status": "Status:",
            "all": "Alle",
            "verified": "✓ Verifiziert",
            "needsReview": "⟳ Überprüfung nötig",
            "unverified": "? Unverifiziert",
            "noResults": "Keine Doks entsprechen Ihren Filtern.",
            "noDocs": "Noch keine Dokumentation veröffentlicht.",
            "viewAll": "Alle Doks anzeigen",
            "resultSingular": "Ergebnis",
            "resultPlural": "Ergebnisse",
            "for": "für",
            "owner": "Besitzer:",
            "verifiedLabel": "Verifiziert:",
            "allDocs": "← Alle Doks",
            "backToAllDocs": "← Zurück zu allen Doks",
            "noContent": "Kein Inhalt verfügbar.",
            "onThisPage": "Auf dieser Seite",
        },
    },
    "caseStudiesPage": {
        "en": {
            "badge": "Results that speak for themselves",
            "title": "Case Studies",
            "subtitle": "Real engagements, real numbers. Here's how Cloudless helped businesses reduce cloud spend, modernise infrastructure, and ship faster.",
            "empty": "Case studies coming soon.",
            "emptyCta": "Book a free consultation →",
            "ctaTitle": "Ready to be next?",
            "ctaSubtitle": "Book a free 30-minute cloud audit and see what's possible.",
            "ctaButton": "Book a free audit",
            "challenge": "The Challenge",
            "approach": "Our Approach",
            "results": "Results",
            "similarTitle": "Want similar results?",
            "similarDesc": "Book a free 30-minute call and let's talk about your cloud setup.",
            "backToAll": "← All case studies",
        },
        "el": {
            "badge": "Αποτελέσματα που μιλούν μόνα τους",
            "title": "Μελέτες Περίπτωσης",
            "subtitle": "Πραγματικές συνεργασίες, πραγματικοί αριθμοί. Δείτε πώς η Cloudless βοήθησε επιχειρήσεις να μειώσουν το κόστος cloud, να εκσυγχρονίσουν την υποδομή και να αποστείλουν πιο γρήγορα.",
            "empty": "Μελέτες περίπτωσης έρχονται σύντομα.",
            "emptyCta": "Κλείστε δωρεάν συμβουλή →",
            "ctaTitle": "Έτοιμοι να είστε επόμενοι;",
            "ctaSubtitle": "Κλείστε δωρεάν 30λεπτό audit cloud και δείτε τι είναι δυνατό.",
            "ctaButton": "Κλείστε δωρεάν audit",
            "challenge": "Η Πρόκληση",
            "approach": "Η Προσέγγισή Μας",
            "results": "Αποτελέσματα",
            "similarTitle": "Θέλετε παρόμοια αποτελέσματα;",
            "similarDesc": "Κλείστε δωρεάν 30λεπτη κουβέντα και ας μιλήσουμε για το cloud setup σας.",
            "backToAll": "← Όλες οι μελέτες περίπτωσης",
        },
        "fr": {
            "badge": "Des résultats qui parlent d'eux-mêmes",
            "title": "Études de Cas",
            "subtitle": "Véritables engagements, véritables chiffres. Voici comment Cloudless a aidé des entreprises à réduire leurs dépenses cloud, moderniser leur infrastructure et livrer plus rapidement.",
            "empty": "Études de cas à venir bientôt.",
            "emptyCta": "Réserver une consultation gratuite →",
            "ctaTitle": "Prêt à être le prochain ?",
            "ctaSubtitle": "Réservez un audit cloud gratuit de 30 minutes et voyez ce qui est possible.",
            "ctaButton": "Réserver un audit gratuit",
            "challenge": "Le Défi",
            "approach": "Notre Approche",
            "results": "Résultats",
            "similarTitle": "Vous voulez des résultats similaires ?",
            "similarDesc": "Réservez un appel gratuit de 30 minutes et parlons de votre configuration cloud.",
            "backToAll": "← Toutes les études de cas",
        },
        "de": {
            "badge": "Ergebnisse, die für sich selbst sprechen",
            "title": "Fallstudien",
            "subtitle": "Echte Projekte, echte Zahlen. So hat Cloudless Unternehmen geholfen, Cloud-Kosten zu senken, Infrastruktur zu modernisieren und schneller zu liefern.",
            "empty": "Fallstudien folgen in Kürze.",
            "emptyCta": "Kostenlose Beratung buchen →",
            "ctaTitle": "Bereit, der Nächste zu sein?",
            "ctaSubtitle": "Buchen Sie ein kostenloses 30-minütiges Cloud-Audit und sehen Sie, was möglich ist.",
            "ctaButton": "Kostenloses Audit buchen",
            "challenge": "Die Herausforderung",
            "approach": "Unser Ansatz",
            "results": "Ergebnisse",
            "similarTitle": "Ähnliche Ergebnisse gewünscht?",
            "similarDesc": "Buchen Sie ein kostenloses 30-minütiges Gespräch und lassen Sie uns über Ihr Cloud-Setup sprechen.",
            "backToAll": "← Alle Fallstudien",
        },
    },
    "accessibilityPage": {
        "en": {
            "legalDocument": "LEGAL DOCUMENT",
            "title": "Accessibility Statement",
            "lastUpdated": "Last updated: June 2026",
            "intro": "Cloudless is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.",
            "conformanceTitle": "Conformance Status",
            "conformanceText": "Cloudless.gr aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA as required by the EU Web Accessibility Directive (Directive 2016/2102) and the European Accessibility Act (Directive 2019/882).",
            "conformancePartial": "We are partially conformant — most content meets WCAG 2.1 AA. Known limitations are listed below.",
            "measuresTitle": "Measures Taken",
            "measuresIntro": "We have implemented the following to support accessibility:",
            "measuresList": [
                "Semantic HTML5 landmarks and heading hierarchy on all pages",
                "Keyboard navigability across all interactive elements",
                "ARIA labels on icon-only buttons and form controls",
                "Minimum 4.5:1 colour contrast ratio for body text (AA)",
                "Minimum 44×44px touch targets for all interactive elements",
                "Skip-to-content link on every page",
                "Focus trap and Escape-key handling in all modal dialogs",
                "Reduced-motion support via prefers-reduced-motion",
                "All images have descriptive alt attributes",
                "Forms include visible labels and autocomplete attributes",
            ],
            "limitationsTitle": "Known Limitations",
            "limitationsIntro": "The following known issues are being addressed:",
            "limitationsList": [
                "Some third-party embedded content (e.g. EspoCRM forms) may not fully meet WCAG 2.1 AA — we are working with vendors on remediation",
                "3D particle effects are decorative and hidden from assistive technologies; they respect prefers-reduced-motion",
            ],
            "feedbackTitle": "Feedback & Contact",
            "feedbackText": "If you experience any accessibility barrier on cloudless.gr, please contact us:",
            "feedbackResponse": "We aim to respond to accessibility feedback within 5 business days.",
            "enforcementTitle": "Enforcement",
            "enforcementText": "If you are not satisfied with our response, you may contact the Hellenic Data Protection Authority (HDPA) or your national supervisory body.",
            "enforcementUs": "US users may contact us directly or file a complaint under Section 508 of the Rehabilitation Act where applicable.",
            "privacyLink": "Privacy Policy",
            "termsLink": "Terms of Service",
            "cookiesLink": "Cookie Policy",
        },
        "el": {
            "legalDocument": "ΝΟΜΙΚΟ ΕΓΓΡΑΦΟ",
            "title": "Δήλωση Προσβασιμότητας",
            "lastUpdated": "Τελευταία ενημέρωση: Ιούνιος 2026",
            "intro": "Η Cloudless δεσμεύεται να διασφαλίζει την ψηφιακή προσβασιμότητα για άτομα με αναπηρίες. Βελτιώνουμε συνεχώς την εμπειρία χρήσης για όλους και εφαρμόζουμε σχετικά πρότυπα προσβασιμότητας.",
            "conformanceTitle": "Κατάσταση Συμμόρφωσης",
            "conformanceText": "Το Cloudless.gr στοχεύει στη συμμόρφωση με τις Οδηγίες Προσβασιμότητας Περιεχομένου Web (WCAG) 2.1 Επίπεδο AA όπως απαιτείται από την Οδηγία Προσβασιμότητας Web της ΕΕ (Οδηγία 2016/2102) και την Ευρωπαϊκή Πράξη Προσβασιμότητας (Οδηγία 2019/882).",
            "conformancePartial": "Είμαστε μερικώς συμμορφωμένοι — το περισσότερο περιεχόμενο πληροί το WCAG 2.1 AA. Οι γνωστοί περιορισμοί παρατίθενται παρακάτω.",
            "measuresTitle": "Ληφθέντα Μέτρα",
            "measuresIntro": "Έχουμε εφαρμόσει τα παρακάτω για υποστήριξη προσβασιμότητας:",
            "measuresList": [
                "Σημασιολογικά HTML5 landmarks και ιεραρχία επικεφαλίδων σε όλες τις σελίδες",
                "Πλοήγηση με πληκτρολόγιο σε όλα τα διαδραστικά στοιχεία",
                "ARIA ετικέτες σε κουμπιά μόνο-εικονίδιο και στοιχεία ελέγχου φόρμας",
                "Ελάχιστη αναλογία αντίθεσης χρωμάτων 4.5:1 για κείμενο σώματος (AA)",
                "Ελάχιστοι 44×44px στόχοι αφής για όλα τα διαδραστικά στοιχεία",
                "Σύνδεσμος skip-to-content σε κάθε σελίδα",
                "Focus trap και διαχείριση πλήκτρου Escape σε όλους τους modal διαλόγους",
                "Υποστήριξη reduced-motion μέσω prefers-reduced-motion",
                "Όλες οι εικόνες έχουν περιγραφικά alt χαρακτηριστικά",
                "Οι φόρμες περιλαμβάνουν ορατές ετικέτες και χαρακτηριστικά autocomplete",
            ],
            "limitationsTitle": "Γνωστοί Περιορισμοί",
            "limitationsIntro": "Τα παρακάτω γνωστά ζητήματα αντιμετωπίζονται:",
            "limitationsList": [
                "Κάθε ενσωματωμένο περιεχόμενο τρίτων (π.χ. φόρμες EspoCRM) ενδέχεται να μην πληροί πλήρως το WCAG 2.1 AA — συνεργαζόμαστε με τους παρόχους για αποκατάσταση",
                "Τα 3D εφέ σωματιδίων είναι διακοσμητικά και κρυμμένα από τις βοηθητικές τεχνολογίες· σέβονται το prefers-reduced-motion",
            ],
            "feedbackTitle": "Ανατροφοδότηση & Επικοινωνία",
            "feedbackText": "Αν αντιμετωπίσετε οποιοδήποτε εμπόδιο προσβασιμότητας στο cloudless.gr, επικοινωνήστε μαζί μας:",
            "feedbackResponse": "Στοχεύουμε να απαντάμε στην ανατροφοδότηση προσβασιμότητας εντός 5 εργάσιμων ημερών.",
            "enforcementTitle": "Επιβολή",
            "enforcementText": "Αν δεν είστε ικανοποιημένοι με την απάντησή μας, μπορείτε να επικοινωνήσετε με την Ελληνική Αρχή Προστασίας Δεδομένων (HDPA) ή το εθνικό σας εποπτικό σώμα.",
            "enforcementUs": "Οι χρήστες από τις ΗΠΑ μπορούν να επικοινωνήσουν απευθείας μαζί μας ή να καταθέσουν καταγγελία βάσει του Section 508 του Rehabilitation Act όπου ισχύει.",
            "privacyLink": "Πολιτική Απορρήτου",
            "termsLink": "Όροι Χρήσης",
            "cookiesLink": "Πολιτική Cookies",
        },
        "fr": {
            "legalDocument": "DOCUMENT JURIDIQUE",
            "title": "Déclaration d'Accessibilité",
            "lastUpdated": "Dernière mise à jour : juin 2026",
            "intro": "Cloudless s'engage à garantir l'accessibilité numérique pour les personnes en situation de handicap. Nous améliorons continuellement l'expérience utilisateur pour tous et appliquons les normes d'accessibilité pertinentes.",
            "conformanceTitle": "Statut de Conformité",
            "conformanceText": "Cloudless.gr vise à se conformer aux Web Content Accessibility Guidelines (WCAG) 2.1 Niveau AA comme l'exige la Directive européenne sur l'accessibilité du Web (Directive 2016/2102) et la Loi européenne sur l'accessibilité (Directive 2019/882).",
            "conformancePartial": "Nous sommes partiellement conformes — la plupart du contenu respecte WCAG 2.1 AA. Les limitations connues sont listées ci-dessous.",
            "measuresTitle": "Mesures Prises",
            "measuresIntro": "Nous avons mis en place les éléments suivants pour soutenir l'accessibilité :",
            "measuresList": [
                "Structure HTML5 sémantique et hiérarchie de titres sur toutes les pages",
                "Navigabilité au clavier sur tous les éléments interactifs",
                "Étiquettes ARIA sur les boutons à icône seule et les contrôles de formulaire",
                "Ratio de contraste de couleur minimum 4.5:1 pour le texte (AA)",
                "Cibles tactiles minimum 44×44px pour tous les éléments interactifs",
                "Lien skip-to-content sur chaque page",
                "Focus trap et gestion de la touche Échap dans tous les dialogues modaux",
                "Support reduced-motion via prefers-reduced-motion",
                "Toutes les images ont des attributs alt descriptifs",
                "Les formulaires incluent des étiquettes visibles et des attributs autocomplete",
            ],
            "limitationsTitle": "Limitations Connues",
            "limitationsIntro": "Les problèmes connus suivants sont en cours de résolution :",
            "limitationsList": [
                "Certains contenus intégrés tiers (ex. formulaires EspoCRM) peuvent ne pas entièrement respecter WCAG 2.1 AA — nous travaillons avec les fournisseurs sur la remédiation",
                "Les effets 3D de particules sont décoratifs et cachés des technologies d'assistance ; ils respectent prefers-reduced-motion",
            ],
            "feedbackTitle": "Retour d'Information & Contact",
            "feedbackText": "Si vous rencontrez un obstacle d'accessibilité sur cloudless.gr, veuillez nous contacter :",
            "feedbackResponse": "Nous visons à répondre aux retours d'accessibilité dans les 5 jours ouvrables.",
            "enforcementTitle": "Application",
            "enforcementText": "Si vous n'êtes pas satisfait de notre réponse, vous pouvez contacter l'Autorité Hellénique de Protection des Données (HDPA) ou votre autorité de surveillance nationale.",
            "enforcementUs": "Les utilisateurs américains peuvent nous contacter directement ou déposer une plainte en vertu de la Section 508 du Rehabilitation Act le cas échéant.",
            "privacyLink": "Politique de Confidentialité",
            "termsLink": "Conditions d'Utilisation",
            "cookiesLink": "Politique de Cookies",
        },
        "de": {
            "legalDocument": "RECHTLICHES DOKUMENT",
            "title": "Barrierefreiheitserklärung",
            "lastUpdated": "Letzte Aktualisierung: Juni 2026",
            "intro": "Cloudless ist bestrebt, digitalen Zugang für Menschen mit Behinderungen zu gewährleisten. Wir verbessern kontinuierlich die Benutzererfahrung für alle und wenden relevante Barrierefreiheitsstandards an.",
            "conformanceTitle": "Konformitätsstatus",
            "conformanceText": "Cloudless.gr zielt auf Konformität mit den Web Content Accessibility Guidelines (WCAG) 2.1 Stufe AA ab, wie von der EU-Webbarrierefreiheitsrichtlinie (Richtlinie 2016/2102) und dem Europäischen Barrierefreiheitsgesetz (Richtlinie 2019/882) gefordert.",
            "conformancePartial": "Wir sind teilweise konform — die meisten Inhalte erfüllen WCAG 2.1 AA. Bekannte Einschränkungen sind unten aufgeführt.",
            "measuresTitle": "Ergreifene Maßnahmen",
            "measuresIntro": "Wir haben Folgendes zur Unterstützung der Barrierefreiheit umgesetzt:",
            "measuresList": [
                "Semantische HTML5-Landmarks und Überschriftenhierarchie auf allen Seiten",
                "Tastaturnavigierbarkeit aller interaktiven Elemente",
                "ARIA-Labels bei reinen Icon-Buttons und Formularsteuerelementen",
                "Mindestkontrastverhältnis 4.5:1 für Fließtext (AA)",
                "Mindestens 44×44px Touch-Ziele für alle interaktiven Elemente",
                "Skip-to-Content-Link auf jeder Seite",
                "Focus-Trap und Escape-Tasten-Behandlung in allen modalen Dialogen",
                "Reduced-Motion-Unterstützung via prefers-reduced-motion",
                "Alle Bilder haben beschreibende alt-Attribute",
                "Formulare enthalten sichtbare Labels und autocomplete-Attribute",
            ],
            "limitationsTitle": "Bekannte Einschränkungen",
            "limitationsIntro": "Folgende bekannte Probleme werden behoben:",
            "limitationsList": [
                "Eingebettete Drittanbieterinhalte (z.B. EspoCRM-Formulare) erfüllen möglicherweise nicht vollständig WCAG 2.1 AA — wir arbeiten mit Anbietern an der Behebung",
                "3D-Partikeleffekte sind dekorativ und vor Hilfstechnologien verborgen; sie respektieren prefers-reduced-motion",
            ],
            "feedbackTitle": "Feedback & Kontakt",
            "feedbackText": "Wenn Sie eine Barrierefreiheitsbarriere auf cloudless.gr erleben, kontaktieren Sie uns bitte:",
            "feedbackResponse": "Wir zielen darauf, innerhalb von 5 Werktagen auf Barrierefreiheitsfeedback zu antworten.",
            "enforcementTitle": "Durchsetzung",
            "enforcementText": "Wenn Sie mit unserer Antwort nicht zufrieden sind, können Sie die Hellenic Data Protection Authority (HDPA) oder Ihre nationale Aufsichtsbehörde kontaktieren.",
            "enforcementUs": "US-Nutzer können uns direkt kontaktieren oder eine Beschwerde nach Section 508 des Rehabilitation Act einreichen, falls zutreffend.",
            "privacyLink": "Datenschutzerklärung",
            "termsLink": "Nutzungsbedingungen",
            "cookiesLink": "Cookie-Richtlinie",
        },
    },
    "agentsPage": {
        "en": {"label": "AGENTS", "title": "Cloudless Agent Worker"},
        "el": {"label": "AGENTS", "title": "Cloudless Agent Worker"},
        "fr": {"label": "AGENTS", "title": "Cloudless Agent Worker"},
        "de": {"label": "AGENTS", "title": "Cloudless Agent Worker"},
    },
    "storeSuccess": {
        "en": {
            "title": "Order",
            "titleHighlight": "confirmed",
            "subtitle": "Thanks for your purchase. A confirmation email with your order details and any download links is on its way.",
            "nextStepsLabel": "[ WHAT HAPPENS NEXT ]",
            "nextStepsTitle": "Next steps for your order",
            "servicePurchasesTitle": "Service purchases",
            "servicePurchasesDesc": "Our team will reach out within 24 hours to schedule your kickoff call. Check your inbox for a calendar invite.",
            "digitalProductsTitle": "Digital products",
            "digitalProductsDesc": "Download links have been sent to your email. You can access your files immediately. Updates are included for life.",
            "physicalItemsTitle": "Physical items",
            "physicalItemsDesc": "Your order is being prepared. You will receive a shipping confirmation with tracking within 2 business days. Free EU shipping.",
            "questions": "Questions? Reach us at",
            "continueShopping": "Continue Shopping",
            "backToHome": "Back to Home",
        },
        "el": {
            "title": "Η παραγγελία",
            "titleHighlight": "επιβεβαιώθηκε",
            "subtitle": "Ευχαριστούμε για την αγορά. Ένα email επιβεβαίωσης με τις λεπτομέρειες της παραγγελίας σας και τυχόν συνδέσμους λήψης είναι καθ' οδόν.",
            "nextStepsLabel": "[ ΤΙ ΑΚΟΛΟΥΘΕΙ ]",
            "nextStepsTitle": "Επόμενα βήματα για την παραγγελία σας",
            "servicePurchasesTitle": "Αγορές υπηρεσιών",
            "servicePurchasesDesc": "Η ομάδα μας θα επικοινωνήσει εντός 24 ωρών για να προγραμματίσει την κλήση έναρξης. Ελέγξτε τα εισερχόμενά σας για πρόσκληση ημερολογίου.",
            "digitalProductsTitle": "Ψηφιακά προϊόντα",
            "digitalProductsDesc": "Οι σύνδεσμοι λήψης έχουν σταλεί στο email σας. Μπορείτε να αποκτήσετε πρόσβαση στα αρχεία σας άμεσα. Οι ενημερώσεις ισχύουν εφ' όρου ζωής.",
            "physicalItemsTitle": "Φυσικά είδη",
            "physicalItemsDesc": "Η παραγγελία σας ετοιμάζεται. Θα λάβετε επιβεβαίωση αποστολής με παρακολούθηση εντός 2 εργάσιμων ημερών. Δωρεάν αποστολή εντός ΕΕ.",
            "questions": "Ερωτήσεις; Επικοινωνήστε στο",
            "continueShopping": "Συνέχεια Αγορών",
            "backToHome": "Πίσω στην Αρχική",
        },
        "fr": {
            "title": "Commande",
            "titleHighlight": "confirmée",
            "subtitle": "Merci pour votre achat. Un email de confirmation avec les détails de votre commande et les liens de téléchargement est en route.",
            "nextStepsLabel": "[ CE QUI SUIT ]",
            "nextStepsTitle": "Prochaines étapes pour votre commande",
            "servicePurchasesTitle": "Achats de services",
            "servicePurchasesDesc": "Notre équipe vous contactera dans les 24 heures pour planifier votre appel de lancement. Vérifiez votre boîte de réception pour une invitation calendrier.",
            "digitalProductsTitle": "Produits numériques",
            "digitalProductsDesc": "Les liens de téléchargement ont été envoyés à votre email. Vous pouvez accéder à vos fichiers immédiatement. Les mises à jour sont incluses à vie.",
            "physicalItemsTitle": "Articles physiques",
            "physicalItemsDesc": "Votre commande est en préparation. Vous recevrez une confirmation d'expédition avec suivi dans les 2 jours ouvrables. Livraison UE gratuite.",
            "questions": "Questions ? Contactez-nous à",
            "continueShopping": "Continuer mes achats",
            "backToHome": "Retour à l'accueil",
        },
        "de": {
            "title": "Bestellung",
            "titleHighlight": "bestätigt",
            "subtitle": "Danke für Ihren Einkauf. Eine Bestätigungs-E-Mail mit Ihren Bestelldetails und allen Download-Links ist unterwegs.",
            "nextStepsLabel": "[ WAS ALS NÄCHSTES PASSIERT ]",
            "nextStepsTitle": "Nächste Schritte für Ihre Bestellung",
            "servicePurchasesTitle": "Servicekäufe",
            "servicePurchasesDesc": "Unser Team wird sich innerhalb von 24 Stunden melden, um Ihren Kick-off-Anruf zu planen. Prüfen Sie Ihren Posteingang auf eine Kalendereinladung.",
            "digitalProductsTitle": "Digitale Produkte",
            "digitalProductsDesc": "Download-Links wurden an Ihre E-Mail gesendet. Sie können sofort auf Ihre Dateien zugreifen. Updates sind lebenslang inklusive.",
            "physicalItemsTitle": "Physische Artikel",
            "physicalItemsDesc": "Ihre Bestellung wird vorbereitet. Sie erhalten innerhalb von 2 Werktagen eine Versandbestätigung mit Tracking. Kostenloser EU-Versand.",
            "questions": "Fragen? Erreichen Sie uns unter",
            "continueShopping": "Weiter einkaufen",
            "backToHome": "Zurück zur Startseite",
        },
    },
    "storeProduct": {
        "en": {
            "breadcrumbStore": "Store",
            "whatsIncluded": "WHAT'S INCLUDED",
            "youMayAlsoLike": "You may also like",
            "noRelated": "No related products found.",
            "secureCheckout": "Secure checkout powered by Stripe. 30-day money-back guarantee.",
            "notFound": "Product Not Found",
        },
        "el": {
            "breadcrumbStore": "Κατάστημα",
            "whatsIncluded": "ΤΙ ΠΕΡΙΛΑΜΒΑΝΕΙ",
            "youMayAlsoLike": "Μπορεί επίσης να σας αρέσει",
            "noRelated": "Δεν βρέθηκαν συναφή προϊόντα.",
            "secureCheckout": "Ασφαλές checkout μέσω Stripe. Εγγύηση επιστροφής χρημάτων 30 ημερών.",
            "notFound": "Το προϊόν δεν βρέθηκε",
        },
        "fr": {
            "breadcrumbStore": "Boutique",
            "whatsIncluded": "CE QUI EST INCLUS",
            "youMayAlsoLike": "Vous aimerez peut-être aussi",
            "noRelated": "Aucun produit connexe trouvé.",
            "secureCheckout": "Paiement sécurisé par Stripe. Garantie de remboursement de 30 jours.",
            "notFound": "Produit introuvable",
        },
        "de": {
            "breadcrumbStore": "Shop",
            "whatsIncluded": "ENTHALTEN",
            "youMayAlsoLike": "Das könnte Ihnen auch gefallen",
            "noRelated": "Keine verwandten Produkte gefunden.",
            "secureCheckout": "Sichere Bezahlung über Stripe. 30-tägige Geld-zurück-Garantie.",
            "notFound": "Produkt nicht gefunden",
        },
    },
    "blogPost": {
        "en": {
            "backToBlog": "Back to Blog",
            "ctaTitle": "Need help implementing this?",
            "ctaDesc": "Book a free 30-minute audit and we'll show you exactly where to start.",
            "ctaButton": "Get a Free Audit",
        },
        "el": {
            "backToBlog": "Πίσω στο Blog",
            "ctaTitle": "Χρειάζεστε βοήθεια για την υλοποίηση;",
            "ctaDesc": "Κλείστε δωρεάν 30λεπτό audit και θα σας δείξουμε ακριβώς από πού να ξεκινήσετε.",
            "ctaButton": "Δωρεάν Audit",
        },
        "fr": {
            "backToBlog": "Retour au Blog",
            "ctaTitle": "Besoin d'aide pour la mise en œuvre ?",
            "ctaDesc": "Réservez un audit gratuit de 30 minutes et nous vous montrerons exactement par où commencer.",
            "ctaButton": "Obtenir un Audit Gratuit",
        },
        "de": {
            "backToBlog": "Zurück zum Blog",
            "ctaTitle": "Hilfe bei der Umsetzung?",
            "ctaDesc": "Buchen Sie ein kostenloses 30-minütiges Audit und wir zeigen Ihnen genau, wo Sie anfangen sollen.",
            "ctaButton": "Kostenloses Audit",
        },
    },
}


def main():
    for locale in ["en", "el", "fr", "de"]:
        path = LOCALES_DIR / f"{locale}.json"
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Add meta keys
        for page, translations in META_KEYS.items():
            if page not in data["meta"]:
                data["meta"][page] = translations[locale]

        # Add page-specific UI keys
        for section, translations in PAGE_KEYS.items():
            if section not in data:
                data[section] = translations[locale]

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

        print(f"Updated {locale}.json")

    # Verify parity
    en = json.load(open(LOCALES_DIR / "en.json"))
    for locale in ["el", "fr", "de"]:
        other = json.load(open(LOCALES_DIR / f"{locale}.json"))

        def collect_keys(d, parent="", keys=None):
            if keys is None:
                keys = set()
            if not isinstance(d, dict):
                if parent:
                    keys.add(parent)
                return keys
            for k, v in d.items():
                collect_keys(v, f"{parent}.{k}" if parent else k, keys)
            return keys

        en_keys = collect_keys(en)
        other_keys = collect_keys(other)
        missing = en_keys - other_keys
        extra = other_keys - en_keys
        if missing or extra:
            print(f"  PARITY ERROR ({locale}): missing={missing}, extra={extra}")
            sys.exit(1)
        else:
            print(f"  {locale}: parity OK ({len(en_keys)} keys)")

    print("\nAll locale files updated with parity verified.")


if __name__ == "__main__":
    main()
