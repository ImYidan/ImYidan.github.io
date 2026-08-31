# encoding: UTF-8

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

  def test_root_default_accent_is_sora
    main = source("assets/css/main.scss")
    root = main[/:root\s*\{\n.*?^\}/m]
    refute_nil root
    assert_match(/--accent:\s*var\(--sora\)/, root)
    assert_match(/--accent-soft:\s*var\(--sora-soft\)/, root)
  end

  def test_timeline_uses_page_accent_not_sakura
    components = source("_sass/_components.scss")
    timeline = components[/\.timeline__item\s*\{.*?\.timeline__projects/m]
    refute_nil timeline
    refute_includes timeline, "var(--sakura)"
    refute_includes timeline, "var(--sakura-ink)"
  end
end
