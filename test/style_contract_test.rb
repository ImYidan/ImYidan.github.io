# encoding: UTF-8
require "minitest/autorun"
class StyleContractTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  def source(path)
    File.read(File.join(ROOT, path))
  end
  def test_gold_theme_has_readable_foreground_and_black_background
    css = source("assets/css/blackgold.css")
    assert_includes css, "--bg:#090a09"
    assert_includes css, "--ink:#eee9dd"
    assert_includes css, "--gold:#ceb17a"
    assert_includes css, "a:focus-visible,button:focus-visible"
  end
  def test_page_backgrounds_are_scoped_and_noninteractive
    css = source("assets/css/blackgold.css")
    %w[about-landscape experience-rose-window travel-star-chart].each do |name|
      assert_match(/\.#{name}\{display:none\}/, css)
    end
    assert_includes css, 'body[data-page="about"] .about-landscape'
    assert_includes css, 'body[data-page="experience"] .experience-rose-window'
    assert_includes css, 'body[data-page="travels"] .travel-star-chart'
    assert_includes css, "pointer-events:none"
  end
  def test_reduced_motion_disables_decorative_animation
    css = source("assets/css/blackgold.css")
    assert_includes css, "@media(prefers-reduced-motion:reduce)"
    assert_includes css, "animation:none!important"
    script = source("assets/js/travel-atlas.js")
    assert_includes script, "spinning = !reduced.matches"
    assert_includes script, "document.hidden || !stageVisible"
  end
  def test_small_screen_and_no_javascript_navigation_are_supported
    css = source("assets/css/blackgold.css")
    assert_includes css, "@media(max-width:700px)"
    assert_includes css, ".no-js .header nav{display:flex"
    assert_includes css, ".academic-project summary::-webkit-details-marker{display:none}"
  end
end
