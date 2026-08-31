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


  def test_feed_and_developer_trees_are_not_published
    refute_includes CONFIG.fetch("plugins", []), "jekyll-feed"
    excludes = CONFIG.fetch("exclude")
    %w[functions/ test/ docs/].each { |path| assert_includes excludes, path }
    assert_includes excludes, "assets/data/story_tree.json"
  end
end
