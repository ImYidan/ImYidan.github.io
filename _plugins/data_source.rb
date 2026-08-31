# frozen_string_literal: true

# Resolve the content/backend mode before Jekyll reads collections. A checked-in
# sample_data directory makes the repository a self-contained demo; removing it
# turns the same build into a normal content + API deployment.
module DataSourceMode
  module_function

  def resolve(configured, sample_exists)
    mode = case configured
           when "demo", "cloudflare", "static" then configured
           else sample_exists ? "demo" : "cloudflare"
           end

    {
      "backend_mode" => mode,
      "data_source" => mode == "demo" ? "sample" : "content"
    }
  end
end

Jekyll::Hooks.register :site, :after_init do |site|
  sample_root = site.in_source_dir("sample_data")
  configured = ENV.fetch("BLOG_BACKEND_MODE", site.config.dig("backend", "mode").to_s)
  resolved = DataSourceMode.resolve(configured, Dir.exist?(sample_root))
  mode = resolved.fetch("backend_mode")
  data_source = resolved.fetch("data_source")

  site.config["backend"] ||= {}
  site.config["backend"]["mode"] = mode
  site.config["data_source"] = data_source

  sample_content = File.join(sample_root, "content")
  site.config["collections_dir"] = "sample_data/content" if data_source == "sample" && Dir.exist?(sample_content)
end

Jekyll::Hooks.register :site, :post_read do |site|
  # The sample directory is a build input, not a public asset directory.
  site.static_files.reject! { |file| file.relative_path.start_with?("/sample_data/") }
end
