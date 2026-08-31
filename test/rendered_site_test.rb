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

  def generated_html_routes
    self.class.build_site
    Dir.glob(File.join(DESTINATION, "**", "*.html")).map do |path|
      "/#{path.delete_prefix("#{DESTINATION}/").sub(%r{index\.html\z}, "")}"
    end.sort
  end

  def generated_artifacts
    self.class.build_site
    Dir.glob(File.join(DESTINATION, "**", "*"), File::FNM_DOTMATCH).filter_map do |path|
      next unless File.file?(path)
      path.delete_prefix("#{DESTINATION}/")
    end.sort
  end

  def test_home_has_only_first_release_sections
    html = page("index.html")
    assert_includes html, "A small corner of my world."
    %w[About Experience Travels].each { |label| assert_includes html, label }
    %w[Guestbook Bookshelf Recipes Journal].each { |label| refute_includes html, label }
  end

  def test_home_uses_the_sora_accent
    html = page("index.html")
    assert_includes html, "<style>:root { --accent: var(--sora); --accent-soft: var(--sora-soft); }</style>"
  end

  def test_generated_html_routes_are_only_the_first_release_pages
    assert_equal %w[/ /about/ /experience/ /travels/], generated_html_routes
  end

  def test_generated_artifact_is_the_exact_first_release_surface
    expected = %w[
      about/index.html
      assets/css/main.css
      assets/data/world.geojson
      assets/favicon.png
      assets/js/bubble-pack.js
      assets/js/experience.js
      assets/js/main.js
      assets/js/travels-map.js
      assets/js/travels-summary.js
      assets/js/travels.js
      experience/index.html
      index.html
      travels/index.html
    ]
    assert_equal expected, generated_artifacts

    forbidden_prefixes = %w[docs/ functions/ test/]
    forbidden_names = %w[feed.xml]
    generated_artifacts.each do |artifact|
      refute forbidden_prefixes.any? { |prefix| artifact.start_with?(prefix) }, artifact
      refute_includes forbidden_names, artifact
    end
  end

  def test_browser_tab_uses_the_penguin_png_favicon
    html = page("index.html")
    assert_includes html, '<link rel="icon" href="/assets/favicon.png" type="image/png">'
    assert File.size(File.join(DESTINATION, "assets/favicon.png")).positive?
  end

  def test_navigation_is_progressively_enhanced
    html = page("index.html")
    assert_match(/<html[^>]*class="no-js"/, html)
    assert_includes html, 'document.documentElement.classList.replace("no-js", "js");'
    assert_match(/<button[^>]*class="site-nav__toggle"[^>]*aria-expanded="false"[^>]*aria-controls="site-nav__list"/, html)
    assert_match(/<ul class="site-nav__list" id="site-nav__list">/, html,
                 "navigation links must not be hidden in server-rendered markup")

    css = page("assets/css/main.css")
    assert_match(/\.site-nav__toggle\{display:none\}/, css)
    assert_match(/@media\(max-width:\s*1100px\).*?\.js \.site-nav__toggle\{display:inline-flex/m, css)

    script = page("assets/js/main.js")
    assert_includes script, "list.hidden = isMobile && !isOpen;"
    assert_includes script, 'toggle.setAttribute("aria-expanded", String(isOpen));'
    assert_includes script, 'list.classList.toggle("is-open", isOpen);'
  end

  def test_experience_has_exact_degrees_and_safe_school_links
    html = page("experience/index.html")
    assert_includes html, "MSc AI² EEE"
    assert_includes html, "BSc CS Computing"
    assert_match(/href="https:\/\/www\.imperial\.ac\.uk\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, html)
    assert_match(/href="https:\/\/www\.jnu\.edu\.cn\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, html)
  end

  def test_footer_identifies_github_pages_hosting_without_rss
    html = page("index.html")
    assert_includes html, "Hosted on"
    assert_includes html, "GitHub Pages"
    assert_includes html, 'href="https://pages.github.com/"'
    refute_includes html, ">RSS<"
    refute_includes html, "application/atom+xml"
  end

  def test_about_and_travels_have_intentional_interim_copy
    assert_includes page("about/index.html"), "This page is taking shape."
    travels = page("travels/index.html")
    assert_includes travels, "Travel notes are coming soon."
    refute_includes travels, "Paris"
    refute_includes travels, "/api"
  end

  def test_theme_control_labels_are_english
    script = File.read(File.join(ROOT, "assets/js/main.js"))
    [
      "Switch to warm paper theme",
      "Switch to dark theme",
      "Disable automatic theme",
      "Enable automatic theme",
      "Following system theme",
      "Use system theme"
    ].each { |label| assert_includes script, label }

    %w[切换为暖纸配色 切换为暗色配色 取消自动配色 启用自动配色 正在跟随系统配色 启用系统配色].each do |label|
      refute_includes script, label
    end
  end
end
