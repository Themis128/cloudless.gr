# Cloudless favicon kit

Modern minimal set (5 files), per [Evil Martians 2026 guidance](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) and [favicon.io 2026](https://favicon.io/tutorials/favicon-sizes/).

## Files

| File | Format | Size | Purpose |
|---|---|---|---|
| `favicon.svg` | SVG | scalable | Primary favicon. Has `@media (prefers-color-scheme: dark)` so it inverts cleanly in dark UI. Crisp on all DPIs. |
| `favicon.ico` | ICO multi-size | 16/32/48 | Legacy browsers (IE / older Safari / Outlook). |
| `apple-touch-icon.png` | PNG | 180×180 | iOS "Add to Home Screen" icon. Apple ignores SVG here. |
| `favicon-192.png` | PNG | 192×192 | Android home-screen icon (referenced from manifest). |
| `favicon-512.png` | PNG | 512×512 | PWA install dialog + Android splash screen. |
| `favicon-maskable-512.png` | PNG | 512×512 | Android maskable icon — has safe-zone padding so the OS can crop into circles/squircles. |
| `site.webmanifest` | JSON | — | PWA manifest. References 192/512 icons. |
| `HEAD-SNIPPET.html` | HTML | — | The 5 `<head>` tags to paste into `src/app/layout.tsx`. |

## Generating the PNGs from `favicon.svg`

Use any of:

```bash
# rsvg-convert (apt install librsvg2-bin)
rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 favicon.svg -o favicon-192.png
rsvg-convert -w 512 -h 512 favicon.svg -o favicon-512.png
rsvg-convert -w 512 -h 512 favicon.svg -o favicon-maskable-512.png   # apply 10% inner padding for maskable

# ImageMagick (fallback)
magick favicon.svg -resize 180x180 apple-touch-icon.png

# favicon.ico (multi-size)
magick favicon.svg \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  -delete 0 favicon.ico
```

## Deploy

Drop all PNGs + `favicon.ico` + `favicon.svg` + `site.webmanifest` into `cloudless.gr/public/`. Paste `HEAD-SNIPPET.html` contents into the `<head>` of `src/app/layout.tsx` (or the matching layout file).

Next.js 14+ App Router auto-serves files in `public/` at the URL root — no other config needed.
