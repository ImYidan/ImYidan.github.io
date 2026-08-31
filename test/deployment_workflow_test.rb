require "minitest/autorun"

class DeploymentWorkflowTest < Minitest::Test
  WORKFLOW = File.expand_path("../.github/workflows/deploy-github-pages.yml", __dir__)
  LOCKFILE = File.expand_path("../Gemfile.lock", __dir__)

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
    refute_match(/^permissions:/, yaml)
    assert_match(/build:\n    permissions:\n      contents: read\n      pages: read/, yaml)
    assert_match(/deploy:\n    permissions:\n      pages: write\n      id-token: write/, yaml)
  end

  def test_lockfile_declares_linux_platform_for_pages_build
    assert_includes File.read(LOCKFILE), "x86_64-linux"
  end
end
