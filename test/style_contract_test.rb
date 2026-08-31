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

  def test_dark_theme_keeps_sora_cornflower_blue
    main = source("assets/css/main.scss")
    dark_theme_blocks = main.scan(/\[data-theme="cool"\]\s*\{\n.*?^\}/m)
    assert_operator dark_theme_blocks.length, :>=, 1
    dark_theme_blocks.each do |block|
      assert_match(/--sora:\s*#4F6FD8;/, block)
    end
  end

  def test_timeline_uses_page_accent_not_sakura
    components = source("_sass/_components.scss")
    timeline = components[/\.timeline::before\s*\{.*?\.project__content/m]
    refute_nil timeline
    assert_match(/\.timeline::before\s*\{[^}]*var\(--accent\)[^}]*var\(--accent-soft\)/m, timeline)
    assert_match(/\.timeline__role\s*\{[^}]*background:\s*var\(--sora-soft\)[^}]*color:\s*var\(--sora-ink\)/m, timeline)
    assert_match(/\.project\s*\{[^}]*var\(--project-accent, var\(--sora\)\)/m, timeline)
    refute_includes timeline, "var(--sakura)"
    refute_includes timeline, "var(--sakura-ink)"
  end


  def test_runtime_project_accents_remain_sora
    script = source("assets/js/experience.js")
    assert_includes script, 'project.style.setProperty("--project-accent", "var(--sora)")'
    assert_includes script, 'project.style.setProperty("--project-ink", "var(--sora-ink)")'
    refute_includes script, "--sakura"
    refute_includes script, "--matcha"
    refute_includes script, "--yuzu"
    refute_includes script, "--sumire"
  end

  def test_travels_geo_lookup_skips_static_backend
    script = source("assets/js/travels-map.js")
    assert_match(/data-backend-mode.*?static.*?callback\(null\).*?return/m, script)
  end
end
