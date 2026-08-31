# Yidan Personal Site Design

Date: 2026-08-31

## Goal

Turn the existing Jekyll personal-blog template into an English-first personal website for Yidan, published at `https://imyidan.github.io/`. The first release should feel personal rather than academic and should be easy to update through Markdown.

## Scope

The first release contains four routes:

- `/` — Home
- `/about/` — About
- `/experience/` — Experience
- `/travels/` — Travels

An independent Projects page, bilingual content, journal posts, bookshelf, recipes, friends, guestbook, likes, visit statistics, collaborative stories, and other database-backed modules are out of scope for this release.

## Visual Direction

The site keeps the template's warm editorial character:

- Display name: `Yidan`
- Warm ivory background and dark neutral text
- Primary accent: Cornflower Blue `#4F6FD8`
- Soft blue backgrounds for pills, cards, and selected states
- Serif display headings paired with a clean sans-serif body face
- Spacious layouts, rounded cards, and restrained shadows

Blue is an accent rather than a full-page fill. It appears in navigation state, links, timeline markers, degree pills, buttons, and travel-map highlights. The same design tokens must be used across desktop and mobile layouts.

## Information Architecture

### Home

The homepage introduces Yidan with a large editorial hero and three cards linking to About, Experience, and Travels. Initial copy is concise placeholder English that can be replaced without modifying layouts.

### About

The About page contains a short English placeholder introduction and a small contact area. It should clearly indicate that more information will be added later without reading like an error or unfinished build.

### Experience

The Experience page uses a vertical timeline. Entries appear newest first.

1. `2025–2026` — [Imperial College London](https://www.imperial.ac.uk/)
   - Degree label: `MSc AI² EEE`
   - Two brief English placeholder detail lines
2. `2021–2025` — [Jinan University](https://www.jnu.edu.cn/)
   - Degree label: `BSc CS Computing`
   - Two brief English placeholder detail lines

School names are external links, visually marked with an arrow, and open safely in a new tab. Future projects belong as nested items under the relevant institution rather than on a separate Projects page.

### Travels

The Travels page retains the template's map-led experience but starts with a polished English empty state. It must not present fictional sample trips as Yidan's real travel history. When real locations are added later, the existing Markdown-driven country and city structure will render them without layout changes.

## Content and Component Boundaries

- `_config.yml` owns site metadata, active navigation, feature flags, URL settings, and the palette selection.
- Page front matter owns page-level headings, descriptions, and links.
- Markdown under `content/` owns About, Experience, and future Travels content.
- SCSS variables own the Cornflower Blue palette and shared visual tokens.
- Layouts and includes own presentation only; personal content should not be duplicated inside them.
- A GitHub Actions workflow owns the reproducible Jekyll build and GitHub Pages deployment.

The template's current demo/content switch must be adjusted so the production static build reads `content/` without enabling Cloudflare APIs. Optional dynamic modules will be disabled in configuration and omitted from navigation.

## Build and Deployment

The target repository is `ImYidan/ImYidan.github.io`, which produces `https://imyidan.github.io/`. The site uses an empty `baseurl` and the final GitHub Pages URL in `url`.

Because the template contains custom Jekyll plugins, deployment uses a GitHub Actions workflow that installs the locked Ruby dependencies, runs the Jekyll production build, and publishes the generated `_site` artifact to GitHub Pages. GitHub remains the source of truth; every push to `main` triggers a fresh deployment.

## Failure Handling

- The build must fail when Jekyll reports invalid front matter or a rendering error.
- External school links remain normal links if their sites are temporarily unavailable; deployment does not depend on fetching them.
- Empty About or Travels data renders an intentional placeholder rather than a blank page or JavaScript error.
- Disabled dynamic modules must not make `/api` requests or show broken counters.
- Navigation must continue to work without JavaScript.

## Verification

Before release:

1. Install dependencies from `Gemfile.lock` and run a clean production Jekyll build.
2. Confirm Home, About, Experience, and Travels generate at the intended paths.
3. Confirm removed modules are absent from navigation and do not issue API requests.
4. Check Imperial College London and Jinan University links and external-link attributes.
5. Inspect representative desktop and mobile renders for overflow, spacing, contrast, and readable typography.
6. Check internal links and static assets under an empty `baseurl`.
7. Confirm the GitHub Pages workflow syntax and artifact path.

## Future Extensions

The structure should allow later additions without redesign:

- Replace placeholder Markdown with real About and Travels content.
- Add projects as nested Experience items.
- Add English/Chinese paired routes and a language switcher.
- Enable selected interactive modules on a separate backend if they become useful.

These extensions are explicitly deferred and will not add complexity to the first release.
