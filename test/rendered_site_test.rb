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
