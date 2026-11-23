# AppFlowy Content Model

AppFlowy Cloud (omv k3s, namespace `appflowy`) is the live CMS for cloudless.gr.
Notion is retired — do not reintroduce Notion admin routes, webhooks, or adapters.

Every content type is a **page-per-record**: one AppFlowy page whose title carries
a `[Prefix]` marker and whose body is markdown with `**Field**: value` lines
(the colon after `**Field**` is required — parsers match `^\*\*Key\*\*:\s*(.+)$`).

## Page prefixes → surfaces

| Prefix | Parser | Renders at |
|---|---|---|
| `[Project] <Name>` | `src/lib/appflowy-projects.ts` | `/[locale]/work` (see lanes below), `/admin/appflowy/projects` |
| `[Task] <Name>` | `src/lib/appflowy-projects.ts` | `/admin/appflowy/tasks` |
| `[CaseStudy] <title>` | `src/lib/appflowy-case-studies.ts` | `/[locale]/case-studies` |
| `[FAQ] <question>` | `src/lib/appflowy-faqs.ts` | FAQ surfaces |
| `[Service] <name>` | `src/lib/appflowy-services.ts` | `/[locale]/services` |
| `[Blog] <title>` / `[Review] <title>` | `src/lib/appflowy-blog.ts` | blog + newsletter queue |
| `[Docs][<Section>] <title>` | `src/lib/appflowy-docs.ts` | docs surfaces |
| `[Testimonial] <name>` | `src/lib/appflowy-testimonials.ts` | homepage, `/store`, `/links`, `/api/testimonials` |

## `/work` page lanes

`src/app/[locale]/work/page.tsx` renders two lanes:

- **Client work** — `[Project]` pages with `**Type**: Client` and
  `**Status**: Completed` or `In Progress`, split into Active / Completed grids.
- **In-house builds** — `[Project]` pages with `**Type**: Internal` (same status
  filter) merged with `staticLabProjects` in `src/lib/cms-static.ts`. The static
  array is the curated floor so the section never renders empty; CMS entries win
  on name collision (case-insensitive dedupe in `mergeLabProjects`).

Project fields parsed from the page body: `Name`, `Status`
(Planning/In Progress/On Hold/Completed/Cancelled), `Priority`
(Critical/High/Medium/Low), `Type` (Client/Internal/Maintenance), `Owner`,
`StartDate`, `DueDate`, `Description`, `Budget`, `Progress` (0–100), `Tags`
(comma-separated), `Url` (live demo link — rendered as an outbound card link).

`Maintenance`-type projects are parsed but not shown on `/work`.

## Static fallbacks

`src/lib/cms-static.ts` holds curated fallbacks (`staticCaseStudies`,
`staticServices`, `staticFaqs`, `staticTestimonials`, `staticLabProjects`) used
when AppFlowy is unconfigured or unreachable. Public surfaces must degrade to
these — never 500 on CMS outage.

## Creating content

1. **Preferred — AppFlowy admin UI**: create the page with the right `[Prefix]`
   title and `**Field**: value` body. No deploy needed; pages render on next
   ISR cycle (`revalidate = 3600` on `/work`).
2. **Scripted**: `scripts/appflowy-upload-md.mjs <file.md> --title "[Project] X"`
   needs `APPFLOWY_EMAIL`, `APPFLOWY_PASSWORD`, `APPFLOWY_BASE_URL`,
   `APPFLOWY_WORKSPACE_ID` (Infisical-synced into `cu130-slim/.env`).

### Gotcha: Cloudflare Access

`appflowy.cloudless.gr` sits behind Cloudflare Access — anonymous POSTs to
`/gotrue/token` get a 302 to the Access login (HTML), which breaks the upload
script's JSON parse. The Next.js app reaches AppFlowy from inside the cluster.
For scripted writes, port-forward the in-cluster services instead:

```bash
kubectl port-forward -n appflowy svc/gotrue 19999:9999 &
kubectl port-forward -n appflowy svc/appflowy-cloud 18000:8000 &
APPFLOWY_BASE_URL=http://localhost:18000 \
APPFLOWY_GOTRUE_URL=http://localhost:19999 \
APPFLOWY_API_URL=http://localhost:18000 \
node scripts/appflowy-upload-md.mjs <file.md> --title "[Project] X"
```

(`svc/nginx :80` also fronts the API but returns 405 on gotrue POST — use the
direct services.)

## Write path status

`src/app/api/admin/appflowy/**` project/task write routes are intentional 501
stubs (`appflowyWriteNotImplemented`) — do not route CMS writes through them.
AppFlowy-Cloud's HTTP API has no page-delete endpoint (405); retire a page by
renaming it out of the `[Prefix]` namespace (e.g. `archived-…`).

## Example: in-house build entry

`[Project] Mobile Price Intelligence` (created 2026-11-23) — Type=Internal,
links to `https://matlab-nuxt-app.vercel.app`. Mirrors `staticLabProjects[0]`
in `cms-static.ts`; the static copy is the fallback if the CMS page is removed.
