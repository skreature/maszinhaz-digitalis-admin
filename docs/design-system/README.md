> **Copy in this repo:** only `README.md`, `styles.css`, `tokens/` and `guidelines/` were copied from the Claude Design export. The React components, UI kit and website screenshots listed below are not included. The live app stylesheet is `src/layout.js`, which uses the same values under the app's own class names (`.card`, `.btn`, `.badge` …) instead of `msz-*`.

# MáSzínház Admin — Design System

Design system for **MáSzínház admin**, the internal web app of MáSzínház (AppArt Egyesület, 1092 Budapest, Bakáts tér 3.). MáSzínház is an inclusive performing-arts community that works with people with intellectual disabilities. The admin brings together monthly dues payments, members, ticket sales collected from other channels, revenue, and a de-duplicated contact master list. The current build is a hackathon MVP. It is used mainly on desktop, with phone support for logging payments and checking people in at the door.

## Sources
- GitHub: https://github.com/skreature/maszinhaz-digitalis-admin (branch `main`). All tokens, components and screens come from `src/layout.js` (the only stylesheet) and `src/routes/*.js`. Explore the repo further when you need the business rules behind a screen (`src/lib/tickets.js`, `src/lib/dues.js`, `src/lib/match.js`).
- Public website: https://www.mas-zinhaz.hu/ — **source of the visual identity**. Colours were sampled from user-supplied screenshots (header, hero, team cards, footer, contact form, group timetable). The site's CSS and logo files were not accessible.

## Index
- `styles.css` — entry point; imports `tokens/colors.css`, `typography.css`, `spacing.css`, `base.css`, `components.css` (the `msz-*` classes ported from layout.js)
- `components/` — React primitives (see below), each with `.d.ts` and `.prompt.md`
- `ui_kits/admin/` — click-through recreation of the admin (index.html)
- `guidelines/` — foundation specimen cards
- `thumbnail.html`, `SKILL.md`, `github.md`

## Components
All of these mirror classes in `src/layout.js`:
- core: **Button** (primary, secondary, accent, small), **Tag** (`.tag`), **Badge** (`.badge.st-*`), **StatusText** (`.status-*`)
- feedback: **Flash** (`.flash`, `.flash.err`), **Meter** (`.meter`)
- layout: **AppHeader** (`header` + nav), **Card**, **StatCard** (card + muted + `.big`), **CardGrid** (`.grid`)
- forms: **Field** (label + input/select/textarea), **Checkbox** (`label.check`), **FormStack** (`form.stack`), **SearchBar** (`.search`)
- data: **DataTable** (`table`, `.num`, `table.entry`), **ComparePair** (`.pair` + `.diff`), **EntryTick** (`button.tick`)

Intentional additions: Button `accent` variant (the website's orange pill CTA) and the StatCard `brand` look (the website's card). StatCard, CardGrid, FormStack and SearchBar are named wrappers around class patterns the repo repeats on many pages.

## Content fundamentals
- **Language:** Hungarian throughout. Sentence case for headings, buttons and labels ("Befizetés rögzítése", "Lista feltöltése"). Status values are lowercase words: *nyitott, fizetve, elengedve, elérhető, teltház, utolsó előadás, lezárt*.
- **Voice:** plain, practical and calm. The UI addresses one admin informally in the singular "te" ("Válassz ki egy fájlt.", "Havonta egyszer töltsd le…"). When describing what the system does, it uses "mi" ("A döntést megjegyezzük…").
- **Labels carry their own help** in parentheses: "Kapacitás (fő, üresen: nincs megadva)", "Ár (Ft, lehet 0)".
- **Messages report concrete results with numbers:** "12 000 Ft befizetés rögzítve (készpénz).", "Kész: 5 új, 2 összevonva, 2 ellenőrzésre vár." Errors say what to do next: "Adj meg nevet és árat (0 Ft is lehet)."
- **Muted footnotes explain boundaries**, for example "Csak nyilvántartás: a rendszer nem kezel bankkártyát…" and "Az admin nem árul jegyet…".
- **Formatting:** money as "12 000 Ft" (hu-HU grouping, space separator). Dates as 2026-11-19 or "2026. november". Empty values as "–". Hungarian quotes „…”.
- **Emoji:** almost never. Only 🎉 ("Senki nem tartozik.") and ✔ appear, each in a single empty state. Unicode ✉ ☐ ☑ ! are used as functional glyphs.

## Visual foundations
The look comes from **mas-zinhaz.hu**, using colours sampled from screenshots of the site. Page structure and behaviour come from the repo. Brand wins over the repo MVP wherever the two differ.
- **Palette:** purple #8e2680 is the primary colour, for headings, primary buttons, links, active and brand cards, and the footer band. Orange #f29321 is the accent, for pill CTAs ("Tovább", "Támogatás") and the active nav underline. Navy #272b5b is used for body text and nav. The website's confetti colours, red #d40f2f and yellow #ffdd00, appear only in thumbnails and illustrations, never as admin UI chrome. The page is light grey #f5f5f5 with white cards. Brand cards are #f9f5f8 with a 2px purple border, like the website's team cards.
- **Admin semantics:** paid/ok is green #1d6b3a, warning is dark orange #a85f05 on an orange tint, and open/debt is red #c40e2b. These colours sit on top of the brand palette.
- **Type:** Roboto (Google Fonts) 400/500/700. Headings use Roboto 400 in purple, with h1 at 2rem, as on the website. Body text is 16px/1.5 navy. Table headers are .8rem uppercase muted. Big numbers are 2rem/400 purple.
- **Layout (desktop first):** a white header bar 64px tall: wordmark on the left, navy nav links, the active link in purple with a 3px orange underline, and the user on the right. Content sits in a centred container up to 1280px wide with 1.5rem gutters. Each page follows the same order: h1, a grid of stat cards, then h2 sections holding a table or a form.
- **Cards:** white, 1px #dee2e6 border, 16px radius, no shadow. Stat cards use the brand variant (tint fill and 2px purple border).
- **Tables:** sit in a white rounded container, with hairline rows, a #fafafa header row, a purple-tint hover row, and tabular numbers.
- **Buttons:** primary is purple with a 4px radius (the website's "Küldés"). Secondary is white with a purple outline. Accent is an orange pill, at most one per screen. All have a 44px minimum height except `small`.
- **Inputs:** Bootstrap-like, with a 1px #dee2e6 border and 6px radius. On focus the border turns purple with a soft purple ring. Checkboxes use the purple accent colour.
- **Hover/press:** buttons darken (#741f69 for purple, #d97c0c for orange) with a 150ms transition. Links are purple, and turn orange on hover.
- **Backgrounds and imagery:** flat colour only inside the admin. The website's hand-drawn face illustrations and confetti dots are brand assets that weren't supplied, so they aren't used.
- **Radii:** 4px buttons, 6px inputs and ticks, 8px flash messages, 16px cards and tables, 999px pills (tags, badges, the accent button and meters).

## Iconography
The app has **no icon set**: no icon font, no SVGs and no PNGs. Navigation and actions are text only. A few Unicode glyphs act as icons: ✉ (newsletter consent, inside a Tag), ☐/☑ (check-in), ✓ (column header), ! (eligibility must be checked), → (in result rows). Keep it that way. If an icon becomes unavoidable, use Unicode first and flag any icon set as a new addition.

## Brand mark
The website logo (logo--main.svg and logo--white.svg) was not supplied, and it is not redrawn here. The header shows "MáSzínház admin" in Roboto as a placeholder. Add the SVGs to `assets/` and swap them into AppHeader.
