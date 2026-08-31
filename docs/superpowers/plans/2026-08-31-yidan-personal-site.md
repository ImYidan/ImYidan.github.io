# Yidan Personal Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an English-first personal website for Yidan at `https://imyidan.github.io/` with Home, About, Experience, and Travels pages.

**Architecture:** Keep the existing Jekyll layouts and Markdown content model, add an explicit static content mode, and reduce navigation to four personal-site routes. A source-level test suite verifies configuration and content contracts, while rendered-site tests verify the generated HTML before a GitHub Actions workflow publishes `_site` to GitHub Pages.

**Tech Stack:** Jekyll 4.3, Ruby 3.3, Liquid, Markdown/Kramdown, SCSS, vanilla JavaScript, Minitest, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-31-personal-site-design.md`

## Global Constraints

- Public URL: `https://imyidan.github.io/` with `baseurl: ""`.
- Display name: `Yidan`.
- First-release language: English only.
- Routes: `/`, `/about/`, `/experience/`, and `/travels/` only.
- Primary accent: Cornflower Blue `#4F6FD8` on a warm ivory background.
- Degree labels must remain exactly `MSc AI² EEE` and `BSc CS Computing`.
- Imperial College London must link to `https://www.imperial.ac.uk/`.
- Jinan University must link to `https://www.jnu.edu.cn/`.
- Projects remain nested under Experience; do not create a Projects route.
- Disable all API-backed modules and do not issue `/api` requests.
- Do not show fictional sample content as Yidan's personal content.

---

## File Structure

### New files

- `test/data_source_mode_test.rb` — verifies demo, static, and Cloudflare content-source selection.
- `test/site_config_test.rb` — verifies metadata, routes, feature flags, and backend configuration.
- `test/rendered_site_test.rb` — builds the site once and verifies generated page content and links.
- `test/style_contract_test.rb` — verifies the chosen blue tokens and active-section mappings.
- `test/deployment_workflow_test.rb` — verifies the Pages workflow contract.
- `_data/experience_links.yml` — maps institution names to official external URLs.
- `.github/workflows/deploy-github-pages.yml` — builds and publishes the Jekyll site.
- `docs/CONTENT_GUIDE.md` — explains how Yidan updates About, Experience, and Travels.

### Modified files

- `_plugins/data_source.rb` — supports a static mode that reads `content/` without API behavior.
- `_config.yml` — owns Yidan metadata, reduced navigation, disabled modules, and static backend mode.
- `pages/home/index.html` — owns the English homepage hero and page links.
- `_layouts/home.html` — removes visit counters and uses concise English card descriptions.
- `pages/about/index.md` — owns About headings and avatar initial.
- `content/_about/about.md` — contains the initial English About copy.
- `pages/experience/index.md` — owns Experience page headings.
- `content/_experience/experience.md` — contains the two education entries and interim detail lines.
- `_layouts/experience.html` — renders official institution links safely.
- `pages/travels/index.html` — renders a deliberate empty state when the travel notebook is empty.
- `content/_travels/notebook.md` — starts empty without fictional locations.
- `content/_travels/summary.md` — starts empty without fictional summaries.
- `content/_travels/rankings.md` — starts empty and rankings stay disabled.
- `_sass/_variables.scss` — defines the selected Cornflower Blue tokens.
- `assets/css/main.scss` — maps all active first-release sections to the blue accent.
- `_sass/_layout.scss` — makes the brand mark use the selected blue family.
- `_sass/_components.scss` — aligns timeline and empty-state components with page accent variables.

---

### Task 1: Add an Explicit Static Content Mode

**Files:**
- Create: `test/data_source_mode_test.rb`
- Modify: `_plugins/data_source.rb`

**Interfaces:**
- Consumes: `backend.mode` or `BLOG_BACKEND_MODE`, plus whether `sample_data/` exists.
- Produces: `DataSourceMode.resolve(configured, sample_exists) -> { "backend_mode" => String, "data_source" => String }`.

- [ ] **Step 1: Write the failing mode-selection test**

```ruby
# test/data_source_mode_test.rb
require "minitest/autorun"
require "jekyll"
require_relative "../_plugins/data_source"

class DataSourceModeTest < Minitest::Test
  def test_static_mode_uses_real_content_even_when_sample_data_exists
    result = DataSourceMode.resolve("static", true)
    assert_equal "static", result.fetch("backend_mode")
    assert_equal "content", result.fetch("data_source")
  end

  def test_demo_mode_uses_sample_content
    result = DataSourceMode.resolve("demo", true)
    assert_equal "demo", result.fetch("backend_mode")
    assert_equal "sample", result.fetch("data_source")
  end

  def test_auto_mode_without_samples_uses_cloudflare_content
    result = DataSourceMode.resolve("auto", false)
    assert_equal "cloudflare", result.fetch("backend_mode")
    assert_equal "content", result.fetch("data_source")
  end
end
```

- [ ] **Step 2: Run the test and verify the missing interface**

Run: `bundle exec ruby -Itest test/data_source_mode_test.rb`

Expected: FAIL with `uninitialized constant DataSourceMode`.

- [ ] **Step 3: Extract mode resolution and add static behavior**

```ruby
# At the top of _plugins/data_source.rb, below the comments.
module DataSourceMode
  module_function

  def resolve(configured, sample_exists)
    mode = case configured
           when "demo", "cloudflare", "static" then configured
           else sample_exists ? "demo" : "cloudflare"
           end

    {
      "backend_mode" => mode,
      "data_source" => mode == "demo" ? "sample" : "content"
    }
  end
end
```

Update the `:after_init` hook to call `DataSourceMode.resolve`, assign both returned values, and change `collections_dir` to `sample_data/content` only when `data_source == "sample"`.

- [ ] **Step 4: Run the mode-selection test**

Run: `bundle exec ruby -Itest test/data_source_mode_test.rb`

Expected: 3 runs, 6 assertions, 0 failures.

- [ ] **Step 5: Commit the static content mode**

```bash
git add _plugins/data_source.rb test/data_source_mode_test.rb
git commit -m "feat: add static content mode"
```

---

### Task 2: Configure the English Personal-Site Scope

**Files:**
- Create: `test/site_config_test.rb`
- Modify: `_config.yml`

**Interfaces:**
- Consumes: the `DataSourceMode` interface from Task 1.
- Produces: site metadata and exactly three header navigation entries: `about`, `experience`, and `travels`; Home remains the brand link.

- [ ] **Step 1: Write the failing configuration contract**

```ruby
# test/site_config_test.rb
require "minitest/autorun"
require "yaml"

class SiteConfigTest < Minitest::Test
  CONFIG = YAML.safe_load_file(File.expand_path("../_config.yml", __dir__), aliases: true)

  def test_identity_and_public_url
    assert_equal "Yidan", CONFIG.fetch("title")
    assert_equal "Yidan", CONFIG.dig("author", "name")
    assert_equal "https://imyidan.github.io", CONFIG.fetch("url")
    assert_equal "", CONFIG.fetch("baseurl")
    assert_equal "en", CONFIG.fetch("lang")
  end

  def test_first_release_navigation
    assert_equal %w[about experience travels], CONFIG.fetch("nav").map { |item| item.fetch("key") }
    assert CONFIG.fetch("nav").all? { |item| item.fetch("accent") == "sora" }
  end

  def test_dynamic_features_are_disabled
    assert_equal "static", CONFIG.dig("backend", "mode")
    assert CONFIG.fetch("features").values.none?
  end
end
```

- [ ] **Step 2: Run the test and verify it fails against template metadata**

Run: `bundle exec ruby -Itest test/site_config_test.rb`

Expected: FAIL because the title is `My Blog`, the URL is empty, navigation has extra entries, and features are enabled.

- [ ] **Step 3: Apply the final metadata and scope**

Set these exact values in `_config.yml`:

```yaml
title: Yidan
tagline: Notes on life, learning, and places along the way.
description: Yidan's personal website — experience, travels, and notes from the journey.
baseurl: ""
url: "https://imyidan.github.io"
author:
  name: Yidan
  email: ""
  github: ImYidan
  twitter: ""
  instagram: ""
lang: en
palette: paper
features:
  posts: false
  home_stats: false
  guestbook: false
  guestbook_likes: false
  story_tree: false
  travel_rankings: false
backend:
  mode: static
  api_base: /api
nav:
  - { key: "about", label: "About", path: "/about/", accent: "sora" }
  - { key: "experience", label: "Experience", path: "/experience/", accent: "sora" }
  - { key: "travels", label: "Travels", path: "/travels/", accent: "sora" }
```

- [ ] **Step 4: Run configuration and mode tests**

Run:

```bash
bundle exec ruby -Itest -e 'ARGV.each { |file| require File.expand_path(file) }' \
  test/data_source_mode_test.rb test/site_config_test.rb
```

Expected: all tests pass.

- [ ] **Step 5: Commit the site scope**

```bash
git add _config.yml test/site_config_test.rb
git commit -m "feat: configure Yidan personal site"
```

---

### Task 3: Implement Home, About, Experience, and Travels Content

**Files:**
- Create: `test/rendered_site_test.rb`
- Create: `_data/experience_links.yml`
- Modify: `pages/home/index.html`
- Modify: `_layouts/home.html`
- Modify: `pages/about/index.md`
- Modify: `content/_about/about.md`
- Modify: `pages/experience/index.md`
- Modify: `content/_experience/experience.md`
- Modify: `_layouts/experience.html`
- Modify: `pages/travels/index.html`
- Modify: `content/_travels/notebook.md`
- Modify: `content/_travels/summary.md`
- Modify: `content/_travels/rankings.md`

**Interfaces:**
- Consumes: `_config.yml` navigation and `DataSourceMode` static content selection.
- Produces: four generated routes and `site.data.experience_links[org] -> URL | nil` for linked timeline institutions.

- [ ] **Step 1: Write the failing rendered-site contract**

```ruby
# test/rendered_site_test.rb
require "fileutils"
require "minitest/autorun"
require "open3"

class RenderedSiteTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  DESTINATION = File.join(ROOT, "_site_test")

  def self.build_site
    return if defined?(@built) && @built
    FileUtils.rm_rf(DESTINATION)
    stdout, stderr, status = Open3.capture3(
      { "JEKYLL_ENV" => "production", "BLOG_BACKEND_MODE" => "static" },
      "bundle", "exec", "jekyll", "build", "--destination", DESTINATION,
      chdir: ROOT
    )
    raise "Jekyll build failed:\n#{stdout}\n#{stderr}" unless status.success?
    @built = true
  end

  def page(path)
    self.class.build_site
    File.read(File.join(DESTINATION, path))
  end

  def test_home_has_only_first_release_sections
    html = page("index.html")
    assert_includes html, "A small corner of my world."
    %w[About Experience Travels].each { |label| assert_includes html, label }
    %w[Guestbook Bookshelf Recipes Journal].each { |label| refute_includes html, label }
  end

  def test_experience_has_exact_degrees_and_safe_school_links
    html = page("experience/index.html")
    assert_includes html, "MSc AI² EEE"
    assert_includes html, "BSc CS Computing"
    assert_match(/href="https:\/\/www\.imperial\.ac\.uk\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, html)
    assert_match(/href="https:\/\/www\.jnu\.edu\.cn\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, html)
  end

  def test_about_and_travels_have_intentional_interim_copy
    assert_includes page("about/index.html"), "This page is taking shape."
    travels = page("travels/index.html")
    assert_includes travels, "Travel notes are coming soon."
    refute_includes travels, "Paris"
    refute_includes travels, "/api"
  end
end
```

- [ ] **Step 2: Run the rendered-site test and verify current template copy fails**

Run: `bundle exec ruby -Itest test/rendered_site_test.rb`

Expected: FAIL on the new hero, degree labels, institution links, and empty-state copy.

- [ ] **Step 3: Write the homepage and About content**

Use this front matter in `pages/home/index.html`:

```yaml
---
layout: home
section: home
permalink: /
hero_eyebrow: Hello, welcome
hero_title: A small corner of my world.
hero_lead: Notes on the places I have been, the things I have learned, and what I am building along the way.
hero_links:
  - { label: About me, path: /about/, accent: sora }
  - { label: My experience, path: /experience/, accent: sora }
---
```

Update `_layouts/home.html` so its three card descriptions are exactly:

```liquid
{% when 'about' %}{% assign card_desc = 'A short introduction' %}
{% when 'experience' %}{% assign card_desc = 'Study, projects, and what comes next' %}
{% when 'travels' %}{% assign card_desc = 'Places visited and memories kept' %}
```

Remove the `home-stats__visits` element because statistics are disabled.

Use `initial: "Y"`, `lead: A few words about me.`, and `accent: sora` in `pages/about/index.md`. Replace `content/_about/about.md` with:

```markdown
---
title: about
section: about
---

## This page is taking shape.

I am Yidan. This is a small space for the experiences, ideas, and places I want to remember.

More about me will be added here soon.

# Contact

Contact details will be added soon.
```

- [ ] **Step 4: Add linked Experience entries**

Create `_data/experience_links.yml`:

```yaml
Imperial College London: https://www.imperial.ac.uk/
Jinan University: https://www.jnu.edu.cn/
```

Replace `content/_experience/experience.md` with:

```markdown
---
title: experience
section: experience
---

# Imperial College London [2025 - 2026] MSc AI² EEE

Exploring ideas across artificial intelligence and engineering.

Selected projects and highlights will be added here soon.

# Jinan University [2021 - 2025] BSc CS Computing

Built a foundation in computing, software, and problem solving.

Selected experiences and projects will be added here soon.
```

Set `eyebrow: My journey`, `subtitle: A timeline of the places where I have studied, learned, and built.`, and `accent: sora` in `pages/experience/index.md`.

In `_layouts/experience.html`, replace the organization span with this exact Liquid branch:

```liquid
{% assign org_url = site.data.experience_links[org] %}
<span class="timeline__org">
  {% if org_url %}
    <a href="{{ org_url }}" target="_blank" rel="noopener noreferrer">{{ org }} <span aria-hidden="true">↗</span></a>
  {% else %}
    {{ org }}
  {% endif %}
</span>
```

- [ ] **Step 5: Add a real-content Travels empty state**

Leave only front matter in `content/_travels/notebook.md`, `summary.md`, and `rankings.md`; no country, city, or ranking headings.

In `pages/travels/index.html`, add the assignments and empty branch immediately after the front matter:

```liquid
{% assign travel_notebook = site.travels | where: "slug", "notebook" | first %}
{% assign travel_content = travel_notebook.content | default: "" | strip %}
{% if travel_content == "" %}
  <section class="empty-state travel-empty-state">
    <div class="empty-state__icon" aria-hidden="true">⌖</div>
    <h2>Travel notes are coming soon.</h2>
    <p>This map will grow with the places and moments worth remembering.</p>
  </section>
{% else %}
{% endif %}
```

Move the existing markup beginning with `<div class="travel-page-loading"` between the `{% else %}` and `{% endif %}` lines. Place the closing `{% endif %}` after the last existing conditional script include. This makes the empty branch contain no toolbar, map, templates, or travel scripts. Change all visible headings and controls retained in the non-empty branch to English.

- [ ] **Step 6: Run content, configuration, and rendered-site tests**

Run:

```bash
bundle exec ruby -Itest -e 'ARGV.each { |file| require File.expand_path(file) }' \
  test/data_source_mode_test.rb \
  test/site_config_test.rb \
  test/rendered_site_test.rb
```

Expected: all tests pass and `_site_test/` contains the four intended routes.

- [ ] **Step 7: Commit the page content**

```bash
git add _data/experience_links.yml pages _layouts/home.html _layouts/experience.html content test/rendered_site_test.rb
git commit -m "feat: add Yidan personal site content"
```

---

### Task 4: Apply the Cornflower Blue Editorial System

**Files:**
- Create: `test/style_contract_test.rb`
- Modify: `_sass/_variables.scss`
- Modify: `assets/css/main.scss`
- Modify: `_sass/_layout.scss`
- Modify: `_sass/_components.scss`

**Interfaces:**
- Consumes: the `sora` accent named by all first-release navigation and page front matter.
- Produces: CSS variables `--sora`, `--sora-soft`, `--sora-ink`, `--accent`, and `--accent-soft` shared across all four pages.

- [ ] **Step 1: Write the failing style contract**

```ruby
# test/style_contract_test.rb
require "minitest/autorun"

class StyleContractTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)

  def source(path)
    File.read(File.join(ROOT, path))
  end

  def test_cornflower_blue_tokens
    variables = source("_sass/_variables.scss")
    assert_includes variables, "$sora:         #4F6FD8;"
    assert_includes variables, "$sora-soft:    #E8EDFF;"
    assert_includes variables, "$sora-ink:     #304DA8;"
  end

  def test_first_release_pages_share_the_blue_accent
    main = source("assets/css/main.scss")
    %w[about experience travels].each do |section|
      assert_match(/body\.page--#{section}\s*\{[^}]*--accent:\s*var\(--sora\)/, main)
    end
  end

  def test_timeline_uses_page_accent_not_sakura
    components = source("_sass/_components.scss")
    timeline = components[/\.timeline__item\s*\{.*?\.timeline__projects/sm]
    refute_nil timeline
    refute_includes timeline, "var(--sakura)"
    refute_includes timeline, "var(--sakura-ink)"
  end
end
```

- [ ] **Step 2: Run the style test and verify the current palette fails**

Run: `bundle exec ruby -Itest test/style_contract_test.rb`

Expected: FAIL because the current `sora` token is `#9DC1E0` and the timeline still uses Sakura variables.

- [ ] **Step 3: Define the selected blue tokens**

Set these exact values in `_sass/_variables.scss`:

```scss
$sora:         #4F6FD8;
$sora-soft:    #E8EDFF;
$sora-ink:     #304DA8;
```

Keep the warm neutral values (`$cream: #FAF6F0`, `$ink: #2E2A28`) unchanged.

- [ ] **Step 4: Map the first-release pages and components to blue**

In `assets/css/main.scss`, set the root default accent to `sora` and map `about`, `experience`, and `travels` to `var(--sora)`/`var(--sora-soft)`.

In `_sass/_layout.scss`, replace the brand-mark Sakura/Sora gradient with:

```scss
background: linear-gradient(135deg, var(--sora-ink) 0%, var(--sora) 100%);
```

In the Experience block of `_sass/_components.scss`, replace hard-coded Sakura references with `var(--accent)`, `var(--accent-soft)`, and `var(--sora-ink)`. Add a visible linked-organization treatment:

```scss
.timeline__org a {
  color: inherit;
  border-bottom: 2px solid var(--accent);
  text-decoration: none;
  text-underline-offset: 0.18em;
}

.timeline__org a:hover {
  background: var(--accent-soft);
}
```

Style `.travel-empty-state` as a centered editorial card using `var(--accent-soft)`, `var(--accent)`, the existing spacing tokens, and the existing responsive breakpoints.

- [ ] **Step 5: Run style and production-build checks**

Run:

```bash
bundle exec ruby -Itest test/style_contract_test.rb
JEKYLL_ENV=production BLOG_BACKEND_MODE=static bundle exec jekyll build --destination _site_test
```

Expected: style tests pass and Jekyll exits 0 without Sass errors.

- [ ] **Step 6: Commit the visual system**

```bash
git add _sass/_variables.scss _sass/_layout.scss _sass/_components.scss assets/css/main.scss test/style_contract_test.rb
git commit -m "feat: apply cornflower editorial theme"
```

---

### Task 5: Add GitHub Pages Deployment and Editing Documentation

**Files:**
- Create: `test/deployment_workflow_test.rb`
- Create: `.github/workflows/deploy-github-pages.yml`
- Create: `docs/CONTENT_GUIDE.md`

**Interfaces:**
- Consumes: a successful Jekyll production build from Tasks 1–4.
- Produces: a GitHub Pages artifact from `_site` and a deployment on every push to `main`.

- [ ] **Step 1: Write the failing workflow contract**

```ruby
# test/deployment_workflow_test.rb
require "minitest/autorun"

class DeploymentWorkflowTest < Minitest::Test
  WORKFLOW = File.expand_path("../.github/workflows/deploy-github-pages.yml", __dir__)

  def test_pages_workflow_has_required_contract
    assert File.file?(WORKFLOW), "GitHub Pages workflow is missing"
    yaml = File.read(WORKFLOW)
    assert_includes yaml, "branches: [main]"
    assert_includes yaml, "pages: write"
    assert_includes yaml, "id-token: write"
    assert_includes yaml, "BLOG_BACKEND_MODE: static"
    assert_includes yaml, "actions/configure-pages@v5"
    assert_includes yaml, "actions/upload-pages-artifact@v3"
    assert_includes yaml, "actions/deploy-pages@v5"
  end
end
```

- [ ] **Step 2: Run the workflow test and verify the file is missing**

Run: `bundle exec ruby -Itest test/deployment_workflow_test.rb`

Expected: FAIL with `GitHub Pages workflow is missing`.

- [ ] **Step 3: Create the GitHub Pages workflow**

Create `.github/workflows/deploy-github-pages.yml` from GitHub's current official Jekyll Pages pattern:

```yaml
name: Deploy Jekyll site to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Ruby
        uses: ruby/setup-ruby@4a9ddd6f338a97768b8006bf671dfbad383215f4
        with:
          ruby-version: "3.3"
          bundler-cache: true
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5
      - name: Build with Jekyll
        run: bundle exec jekyll build --baseurl "${{ steps.pages.outputs.base_path }}"
        env:
          JEKYLL_ENV: production
          BLOG_BACKEND_MODE: static
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 4: Document the content update workflow**

Create `docs/CONTENT_GUIDE.md` with these exact sections and paths:

```markdown
# Updating Yidan's Website

## About
Edit `content/_about/about.md`.

## Experience
Edit `content/_experience/experience.md`.
Use `# Institution [year - year] Degree` for a timeline entry and `## Project title` for a nested project.
Add a new institution URL to `_data/experience_links.yml`.

## Travels
Edit `content/_travels/notebook.md`.
Use `# Country`, `## City (duration)`, and paragraphs below the city heading.

## Publish
Commit the Markdown changes and push `main`. GitHub Actions rebuilds and publishes the site automatically.
```

- [ ] **Step 5: Run the complete automated test suite**

Run:

```bash
bundle exec ruby -Itest -e 'ARGV.each { |file| require File.expand_path(file) }' \
  test/data_source_mode_test.rb \
  test/site_config_test.rb \
  test/rendered_site_test.rb \
  test/style_contract_test.rb \
  test/deployment_workflow_test.rb
```

Expected: all tests pass.

- [ ] **Step 6: Commit deployment and editing documentation**

```bash
git add .github/workflows/deploy-github-pages.yml docs/CONTENT_GUIDE.md test/deployment_workflow_test.rb
git commit -m "ci: deploy site to GitHub Pages"
```

---

### Task 6: Perform Final Release Verification

**Files:**
- Verify: `_site_test/index.html`
- Verify: `_site_test/about/index.html`
- Verify: `_site_test/experience/index.html`
- Verify: `_site_test/travels/index.html`

**Interfaces:**
- Consumes: the complete site and workflow from Tasks 1–5.
- Produces: release evidence that the site builds, links correctly, and renders at desktop and mobile widths.

- [ ] **Step 1: Start from a clean generated-site directory**

Run:

```bash
bundle exec jekyll clean
JEKYLL_ENV=production BLOG_BACKEND_MODE=static bundle exec jekyll build --trace --destination _site_test
```

Expected: exit 0, with no Liquid, front-matter, or Sass errors.

- [ ] **Step 2: Run all tests from clean state**

Run:

```bash
bundle exec ruby -Itest -e 'ARGV.each { |file| require File.expand_path(file) }' \
  test/data_source_mode_test.rb \
  test/site_config_test.rb \
  test/rendered_site_test.rb \
  test/style_contract_test.rb \
  test/deployment_workflow_test.rb
```

Expected: all tests pass with 0 failures and 0 errors.

- [ ] **Step 3: Serve the production output locally**

Run: `ruby -run -e httpd _site_test -p 4000`

Expected: `http://127.0.0.1:4000/` serves the generated homepage.

- [ ] **Step 4: Inspect desktop and mobile layouts**

Check `/`, `/about/`, `/experience/`, and `/travels/` at approximately 1440×900 and 390×844. Verify:

- no horizontal overflow;
- header navigation remains usable;
- Cornflower Blue is visibly blue and consistent;
- timeline dates, institution links, and degree labels remain readable;
- About and Travels interim states look intentional;
- keyboard focus is visible on navigation and external links.

- [ ] **Step 5: Inspect browser requests and external links**

Verify that no request path begins with `/api`. Open each institution link and confirm it resolves to the intended official homepage in a new tab.

- [ ] **Step 6: Review the final diff and repository state**

Run:

```bash
git diff --check
git status --short
git log --oneline --decorate -8
```

Expected: no whitespace errors, no uncommitted source changes, and the planned task commits appear above the design and plan commits.
