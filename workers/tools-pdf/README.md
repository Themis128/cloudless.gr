# tools-pdf

Pipeline document API — LOA and audit-worksheet PDFs on demand.

- `POST /loa {client, date?, amount?}` → `pipeline-assets/loa-<client>-<date>.pdf` in R2.
- `POST /worksheet {client, contact?, date?}` → worksheet PDF.
- `GET /health`. Bearer `TOOLS_TOKEN` (`wrangler secret put TOOLS_TOKEN`).

Decision: pdf-lib in-Worker, **no Container** — free-first; container minutes
are billed, pdf-lib costs nothing per doc. Revisit Containers only if the
docs outgrow single-page text layout.

Secret: `TOOLS_TOKEN`. Binding: R2 `ASSETS` (`cloudless-pipeline-assets`).
