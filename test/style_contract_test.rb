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

  def test_timeline_uses_page_accent_not_sakura
    components = source("_sass/_components.scss")
    components = components.encode(Encoding::Windows_31J, invalid: :replace, undef: :replace)
    timeline = components[/\.timeline__item\s*\{.*?\.timeline__projects/sm]
    refute_nil timeline
    refute_includes timeline, "var(--sakura)"
    refute_includes timeline, "var(--sakura-ink)"
  end
end
