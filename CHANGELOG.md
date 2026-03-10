# Fashion Magazine Polish — Changelog

CSS refinements + 3 HTML edits to bring the site in line with fashion magazine conventions while preserving all unique DNA elements.

**No JavaScript was changed.**

---

## Files Modified

### 1. `css/tokens.css`

- **`--text-body`**: bumped floor from `1rem` to `1.0625rem`, ceiling from `1.125rem` to `1.1875rem`
- **`--text-caption`**: bumped from `0.75rem` to `0.875rem`
- Added **`--font-serif-italic`**: `'Source Serif 4', Georgia, serif`
- Added **`--grid-gap-lg`**: `clamp(2rem, 3vw, 3rem)`
- Added **`--space-section`**: `clamp(5rem, 10vw, 10rem)`
- Added **`--duration-hover`**: `400ms` (between the 300ms normal and 600ms slow)

### 2. `css/typography.css`

- Removed `text-transform: uppercase` from `.display-xl`, `.display`, `.display-sm`
- **Pull-quote**: changed `padding-left` to full padding with vertical breathing room (`var(--space-lg) 0 var(--space-lg) var(--space-md)`)
- Added **`.byline`** class (serif italic for meta/attribution)
- Mobile pull-quote: updated to match new padding style

### 3. `css/components.css`

- **Masthead**: thinner default padding (`--space-sm` → `--space-xs`)
- **Scrolled masthead**: even thinner padding (`calc(var(--space-xs) * 0.75)`) + subtle `border-bottom: 1px solid var(--gray-800)`
- **Logo**: slightly smaller font size (`clamp(1rem, 1.5vw, 1.25rem)` → `clamp(0.875rem, 1.25vw, 1.125rem)`)
- **Stream headlines**: hover transition uses `--duration-hover` (400ms) instead of `--duration-normal` (300ms)
- **Stream header**: more bottom padding (`--space-md` → `--space-lg`) + added `margin-bottom: var(--space-md)`
- **Reading progress bar**: height `3px` → `2px`
- Added **`.stream-divider`** class (thin horizontal rule with section spacing)

### 4. `css/layout.css`

- **Stream gap**: `--space-xl` → `--space-section` (generous white space between items)
- **Feature content padding**: `--space-lg` → `--space-xl`
- **Text break padding**: inline padding `--space-lg` → `--space-xl`
- **Spread margins**: `--space-xl` → `--space-section`
- Added **1024px tablet breakpoint**: intermediate layout for stream features and dual-read

### 5. `css/animations.css`

- **Reveal**: `translateY(30px)` → `translateY(18px)`
- **Stagger children**: `translateY(20px)` → `translateY(12px)`
- **Reveal-left**: `translateX(-40px)` → `translateX(-24px)`
- **Reveal-right**: `translateX(40px)` → `translateX(24px)`
- **Hover-scale images**: transition uses `--duration-hover` instead of `--duration-slow`

### 6. `css/cover.css`

- **Cover title**: removed `text-transform: uppercase`, reduced `letter-spacing` from `0.08em` to `0.04em`
- **Headline text**: removed `text-transform: uppercase`, hover uses `--duration-hover`
- **Featured-now**: top padding uses `--space-section` for more breathing room
- **Lead image**: aspect-ratio `4/5` → `3/4`
- **Lead title**: removed `text-transform: uppercase`, hover uses `--duration-hover`
- **Side story titles**: removed `text-transform: uppercase`, hover uses `--duration-hover`
- **Fade-up keyframe**: `translateY(20px)` → `translateY(12px)`
- Added **1024px tablet breakpoint**: featured-now grid becomes `1fr 1fr` with larger gap

### 7. `css/editorial.css`

- **Article hero**: height `70vh` → `75vh`
- **Hero title**: removed `text-transform: uppercase`
- **Hero meta**: switched from `--font-secondary` to `--font-serif-italic` with italic style
- **Paragraph spacing**: `1.5em` → `1.75em`
- **Editorial grid row-gap**: `--space-lg` → `--space-xl`
- **Article pull-quote**: larger font (`--text-h1` → `--text-display-sm`), removed `text-transform: uppercase`, added vertical padding, increased margins
- **Wide/full-bleed image margins**: `--space-lg` → `--space-xl`
- **Article h2 headings**: removed `text-transform: uppercase`, added `border-top: 1px solid var(--gray-200)` with `padding-top`
- **Dual-read h2**: removed `text-transform: uppercase`
- Added **1024px tablet breakpoint**: article hero `65vh`, smaller title

### 8. `css/collection.css`

- **Collection hero title**: removed `text-transform: uppercase`
- **Lookbook section spacing**: `margin-bottom` uses `--space-section` instead of `--space-2xl`
- **Look numbers**: lighter weight (`600` → `400`), larger size (`--text-overline` → `--text-caption`), softer color (`--gray-400` → `--gray-300`), tighter letter-spacing
- **Designer notes**: more padding (`--space-xl` → `--space-2xl` vertical, `--space-md` → `--space-lg` horizontal)
- **Full-bleed images**: added `--space-section` margin top and bottom for breathing room

### 9. `css/about.css`

- **Profile hero name**: removed `text-transform: uppercase`
- **Paragraph spacing**: `1.5em` → `1.75em`
- **Editorial grid row-gap**: `--space-lg` → `--space-xl`
- **Facts sidebar border**: `3px` → `1px`
- **Facts sidebar h3 weight**: `700` → `500`
- **Facts sidebar dt weight**: `600` → `500`
- **Wide/full-bleed image margins**: `--space-lg` → `--space-xl`

### 10. `index.html`

- Removed `text-transform:uppercase` from 3 inline styles on text-break blockquotes:
  - "Fashion has to do with ideas..." quote
  - "76% of fashion leaders..." statistic
  - "Creating is the most honest thing..." quote

---

## What Did NOT Change (DNA preserved)

- Loading screen with CRT effect and progress bar
- Sound system (clicks, hovers, transitions, music)
- Custom cursor
- Visitor counter and "UNDER CONSTRUCTION" badge
- "BORED?" easter egg
- Anna Wintour game
- Warm color palette (`#f5f2ed` paper, `#c4462a` accent)
- Custom WillieAustin font (now displayed in mixed case)
- Marquee ticker
- Folio page number
- All JavaScript modules
