## ♿ A11y Live Audit

Base: `http://localhost:4000` · generated 2026-08-06T08:31:24.013Z

| Route | Total | Critical | Serious | Moderate | Minor | Status |
|-------|-------|----------|---------|----------|-------|--------|
| / | 1 | 0 | 0 | 1 | 0 | ✅ |
| /en | 2 | 0 | 1 | 1 | 0 | ⚠️ regression |
| /en/services | 1 | 0 | 0 | 1 | 0 | ✅ |
| /en/contact | 2 | 0 | 0 | 2 | 0 | ✅ |
| /en/store | 1 | 0 | 0 | 1 | 0 | ✅ |
| /en/blog | 1 | 0 | 0 | 1 | 0 | ✅ |
| /en/case-studies | 4 | 0 | 0 | 4 | 0 | ✅ |

<details><summary>Top violations per route</summary>

### /

- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

### /en

- **serious** `color-contrast` — Elements must meet minimum color contrast ratio thresholds (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright)
- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

### /en/services

- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

### /en/contact

- **moderate** `heading-order` — Heading levels should only increase by one (1 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/heading-order?application=playwright)
- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

### /en/store

- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

### /en/blog

- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

### /en/case-studies

- **moderate** `landmark-main-is-top-level` — Main landmark should not be contained in another landmark (1 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/landmark-main-is-top-level?application=playwright)
- **moderate** `landmark-no-duplicate-main` — Document should not have more than one main landmark (1 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/landmark-no-duplicate-main?application=playwright)
- **moderate** `landmark-unique` — Landmarks should have a unique role or role/label/title (i.e. accessible name) combination (1 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/landmark-unique?application=playwright)
- **moderate** `region` — All page content should be contained by landmarks (2 nodes) — [docs](https://dequeuniversity.com/rules/axe/4.12/region?application=playwright)

</details>
