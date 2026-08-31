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
