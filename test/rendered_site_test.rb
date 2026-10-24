require "fileutils"
require "minitest/autorun"
require "open3"
require "json"
class RenderedSiteTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  DESTINATION = File.join(ROOT, "_site_test")
  def self.build_site
    return if defined?(@built) && @built
    FileUtils.rm_rf(DESTINATION)
    stdout, stderr, status = Open3.capture3(
      { "JEKYLL_ENV" => "production", "BLOG_BACKEND_MODE" => "static" },
      "bundle", "exec", "jekyll", "build", "--destination", DESTINATION, chdir: ROOT)
    raise "Jekyll build failed:\n#{stdout}\n#{stderr}" unless status.success?
    @built = true
  end
  def page(path)
    self.class.build_site
    File.read(File.join(DESTINATION, path))
  end
  def generated_artifacts
    self.class.build_site
    Dir.glob(File.join(DESTINATION, "**", "*"), File::FNM_DOTMATCH).filter_map do |path|
      path.delete_prefix("#{DESTINATION}/") if File.file?(path)
    end.sort
  end
  def test_only_four_public_html_routes_are_generated
    self.class.build_site
    routes = Dir.glob(File.join(DESTINATION, "**", "*.html")).map do |path|
      "/#{path.delete_prefix("#{DESTINATION}/").sub(%r{index\.html\z}, "")}"
    end.sort
    assert_equal %w[/ /about/ /experience/ /travels/], routes
  end
  def test_home_uses_approved_identity_signature_and_navigation
    html = page("index.html")
    assert_includes html, "我是王怡丹，也可以叫我 Eden"
    refute_includes html, 'class="hero"'
    refute_includes html, 'class="experience-preview section"'
    refute_includes html, 'class="travel-preview section"'
    assert_includes html, '<span class="brand-emblem">W<span>'
    assert_includes html, "signature-original.png"
    %w[/ /experience/ /travels/].each { |path| assert_includes html, "href=\"#{path}\"" }
    assert_includes html, 'lang="zh-CN"'
    refute_includes html, "A small corner of my world."
    assert_includes html, 'class="theme-toggle"'
    assert_includes html, 'aria-label="切换到浅色模式"'
  end
  def test_navigation_supports_javascript_and_no_javascript
    html = page("index.html")
    assert_includes html, '<html class="no-js" lang="zh-CN">'
    assert_includes html, 'document.documentElement.classList.replace("no-js","js");'
    assert_includes html, 'aria-controls="navigation" aria-expanded="false"'
    assert_includes html, '<nav id="navigation" aria-label="主导航">'
    script = page("assets/js/blackgold.js")
    assert_includes script, "button.setAttribute('aria-expanded', String(open));"
    assert_includes script, "event.key === 'Escape'"
  end
  def test_about_contains_biography_safe_advisor_links_and_contacts
    html = page("index.html")
    assert_includes html, "我是王怡丹，也可以叫我 Eden"
    assert_includes html, "我总会想起八月的伦敦。"
    assert_includes html, "循此苦旅"
    assert_includes html, "以达繁星"
    %w[https://the-duck-lab.github.io/members/Eleonora_Giunchiglia.html https://cuilin.antlab.network/ https://x.com/Eden_SJTU https://www.instagram.com/yidannwang/].each do |url|
      assert_match(/href="#{Regexp.escape(url)}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, html)
    end
    assert_includes html, 'href="mailto:wangyidan752@gmail.com"'
    assert_includes html, "yidan-portrait-blackgold-v1.png"
  end
  def test_experience_preserves_degrees_links_and_folded_projects
    html = page("experience/index.html")
    ["MSc AI² EEE", "BSc CS Computing", "GUANGZHOU, CHINA", "行至，<em>此间。</em>"].each { |text| assert_includes html, text }
    %w[https://www.imperial.ac.uk/ https://www.jnu.edu.cn/].each do |url|
      assert_match(/href="#{Regexp.escape(url)}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, html)
    end
    assert_equal 4, html.scan('name="imperial-projects"').length
    assert_equal 5, html.scan('name="jinan-projects"').length
    refute_match(/<details[^>]*\bopen\b/, html)
    assert_includes html, "big-ben-gold-line.svg"
    assert_includes html, "canton-tower-gold-line.svg"
    assert_includes html, "2026.02 — 2026.03"
  end
  def test_travel_has_eight_countries_and_fourteen_provincial_regions
    html = page("travels/index.html")
    data = JSON.parse(page("assets/data/travel-footprints.json"))
    assert_equal 8, data.fetch("countries").length
    assert_equal 14, data.fetch("provinces").length
    assert_equal %w[江苏 浙江 上海 香港 广东], data.fetch("provinces").first(5).map { |p| p.fetch("name") }
    assert_equal %w[黑龙江 吉林 辽宁], data.fetch("provinces").last(3).map { |p| p.fetch("name") }
    assert_includes html, "布鲁塞尔"
    assert_includes html, "里斯本"
    assert_includes html, 'id="atlas-flat"'
    assert_includes html, 'id="atlas-rotation"'
    assert_includes html, 'aria-label="地图区域"'
    assert_includes html, "<noscript>"
    refute_match(/<details class="travel-record-group" open>/, html)
    refute_includes html, "/api"
  end
  def test_assets_exist_and_private_development_files_are_not_published
    required = %w[assets/css/blackgold.css assets/js/blackgold.js assets/js/travel-atlas.js assets/vendor/d3.min.js assets/vendor/d3.LICENSE assets/data/atlas-world.geojson assets/data/china-provinces.geojson assets/data/travel-footprints.json assets/images/signature-original.png assets/images/yidan-portrait-blackgold-v1.png assets/images/about-gilded-landscape-v1.png assets/images/big-ben-gold-line.svg assets/images/canton-tower-gold-line.svg assets/images/experience-rose-window.svg assets/images/experience-rose-window-glass-v1.png assets/images/about-mineral-landscape-light-v1.png assets/images/travel-gilded-star-chart.svg]
    required.each { |path| assert_includes generated_artifacts, path }
    generated_artifacts.each do |path|
      refute_match(%r{\A(?:docs/|functions/|test/|sample_data/|_scripts/|vendor/|\.git/)}, path)
      refute_match(/(?:\.env|\.local|\.log)\z/, path)
    end
  end
  def test_public_script_dependencies_are_not_excluded_from_git
    skip "Source archive has no Git checkout" unless File.directory?(File.join(ROOT, ".git"))
    scripts = %w[index.html about/index.html experience/index.html travels/index.html].flat_map do |path|
      page(path).scan(/<script[^>]+src="(\/assets\/[^"?]+)(?:\?[^" ]*)?"/).flatten
    end.uniq.map { |path| path.delete_prefix("/") }
    ignored, stderr, status = Open3.capture3("git", "check-ignore", "--no-index", "--stdin", stdin_data: scripts.join("\n") + "\n", chdir: ROOT)
    assert_includes [0, 1], status.exitstatus, stderr
    assert_empty ignored, "Public scripts must be included in the release: #{ignored}"
  end
  def test_previous_about_url_returns_to_the_about_landing_page
    html = page("about/index.html")
    assert_includes html, '<meta http-equiv="refresh" content="0;url=/">'
    assert_includes html, '<a href="/">'
  end
  def test_png_favicon_and_absence_of_rss_are_preserved
    html = page("index.html")
    assert_includes html, '<link rel="icon" href="/assets/favicon-gold.png" type="image/png">'
    assert File.size(File.join(DESTINATION, "assets/favicon-gold.png")).positive?
    refute_includes html, ">RSS<"
    refute_includes html, "application/atom+xml"
  end
end
