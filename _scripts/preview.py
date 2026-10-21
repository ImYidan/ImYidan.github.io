"""Generate a dependency-free preview of the four gold-layout HTML pages."""
from pathlib import Path
import argparse, re, shutil
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='_preview', help='Output directory; excluded from Jekyll')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
output = (root / args.output).resolve()
layout = (root / '_layouts/gold.html').read_text()
for folder in ('home', 'about', 'experience', 'travels'):
    page = root / 'pages' / folder / 'index.html'
    frontmatter, body = page.read_text().split('---', 2)[1:]
    values = dict(re.findall(r'^([a-z_]+):\s*(.*?)\s*$', frontmatter, re.M))
    target = output / values['permalink'].strip('/') / 'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    html = layout.replace('{{ content }}', body)
    for key, value in values.items():
        html = html.replace('{{ page.' + key + ' }}', value)
    target.write_text(html)
shutil.copytree(root / 'assets', output / 'assets', dirs_exist_ok=True)
print(f'Preview generated: {output}')
print(f'Serve with: python3 -m http.server 8765 --bind 127.0.0.1 --directory "{output}"')
