# Known Design Issues — cloudless.gr

Audited: 2026-04-19

## Priority 1: Layout Gaps

### Homepage: Excessive whitespace between sections
- **Location**: Between services card grid and "Meet the founder" section
- **Symptom**: Nearly a full viewport of blank dark space
- **Likely cause**: Section padding (`py-20 lg:py-28`) combined with container min-heights
- **Fix approach**: Reduce padding on the section wrapper, or check if there's a hidden element with large height

### Store page: Blank gap after product grid
- **Location**: Between last product row and testimonials section
- **Symptom**: Full viewport of empty space
- **Fix approach**: Same as homepage — check section padding and hidden spacers

### Homepage hero: Content below the fold
- **Location**: Hero section (first `<section>` on homepage)
- **Structure**: 2-col grid (`lg:grid-cols-2`), left=text+CTA, right=terminal animation
- **Issue**: The terminal column uses `animate-fade-in-up hidden delay-300 lg:block`, so on first load the right side appears blank. The subtitle and CTA buttons require scrolling to see.
- **Hero section height**: 816px total, content div is 741px
- **Fix approach**: Reduce hero vertical padding (`py-24 md:py-32 lg:py-40` is very generous). Consider making the terminal visible faster or showing a placeholder.

## Priority 2: Missing/Broken Content

### Blog page hero
- **Location**: `/blog` page top
- **Symptom**: Only shows faint `[ BLOG ]` label. No heading, no description, no visual. Looks broken.
- **Fix approach**: Add an H1 ("Insights & Guides" or similar) and a brief description paragraph below the label

### Services "Our Promise" section
- **Location**: `/services` page, below the Full-Stack Growth Engine pricing
- **Symptom**: Only 1 card visible ("Results in 14 Days"), expected 3 cards matching homepage value props
- **Fix approach**: Check if the other cards are being rendered but positioned off-screen, or if the data source is incomplete

## Priority 3: Polish

### Contact page title
- **Symptom**: Browser tab shows same title as homepage ("Cloudless — Cloud Computing...")
- **Fix**: Update `metadata.title` in `contact/page.tsx` to "Contact Us | Cloudless"

### Homepage locale URL
- **Symptom**: `/en` redirects to `/` (root without locale prefix)
- **Impact**: Could confuse hreflang tags and canonical URLs
- **Note**: This may be intentional for default locale — verify i18n config

### Blog content volume
- **Observation**: Only 2 posts (March 2026). Not a bug, but more content would help SEO.

## What Works Well (don't break these)

- Dark void theme with cyan/magenta accents — distinctive and on-brand
- Terminal CLI animations on services page — excellent visual proof
- Services page structure (side-by-side CLI + feature lists) is well-designed
- Store product cards with category badges and pricing look professional
- Footer is clean and complete (nav, legal, newsletter, social)
- Contact form with "What happens next?" sidebar is well thought out
- FAQ accordions on services and store pages work correctly
- No JS console errors from the site
