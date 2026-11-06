"""Read-only favicon coverage for public HTML documents and the active release."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = 'https://tranhoangduc90.github.io/izone-ai-team-pages/'
PREFIX = '/izone-ai-team-pages/'


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.document = False
        self.base = None
        self.icons = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('html', 'head'):
            self.document = True
        if tag == 'base' and self.base is None:
            self.base = attrs.get('href')
        if tag == 'link' and 'icon' in attrs.get('rel', '').lower().split():
            self.icons.append(attrs)

    handle_startendtag = handle_starttag


def normalized(path):
    return path.read_bytes().replace(b'\r\n', b'\n')


def main():
    expected = normalized(ROOT / 'shared/izone-favicon.svg')
    assert expected == normalized(ROOT / 'progress-log/favicon.svg'), 'Brand differs from Progress Log'
    tracked = subprocess.check_output(['git', 'ls-files', '*.html', '*.htm'], cwd=ROOT, text=True).splitlines()
    ordinary = [p for p in tracked if not p.startswith('tests/') and '/releases/' not in p]
    release = json.loads((ROOT / 'progress-log/release.json').read_text(encoding='utf-8'))
    packaged = [a['path'][len(PREFIX):] for a in release['assets'] if a['path'].endswith('.html')]
    counts = {'documents': 0, 'active_release_documents': 0, 'body_fragments': 0}
    failures = []
    for name in ordinary + packaged:
        document = Document((ROOT / name).read_text(encoding='utf-8-sig'))
        if not document.document:
            counts['body_fragments'] += 1
            continue
        try:
            assert len(document.icons) == 1, 'Expected exactly one favicon'
            icon = document.icons[0]
            assert icon.get('type') == 'image/svg+xml', 'Incorrect favicon type'
            base = urljoin(PUBLIC + name, document.base or '')
            url = urlsplit(urljoin(base, icon.get('href', '')))
            assert url.netloc == 'tranhoangduc90.github.io' and url.path.startswith(PREFIX), 'Favicon outside this site'
            path = (ROOT / unquote(url.path[len(PREFIX):])).resolve()
            assert path.is_relative_to(ROOT), 'Favicon outside repository'
            assert normalized(path) == expected, 'Incorrect favicon artwork'
            counts['active_release_documents' if '/releases/' in name else 'documents'] += 1
        except (AssertionError, OSError) as error:
            failures.append({'path': name, 'error': str(error)})
    print(json.dumps({**counts, 'release': release['version'], 'failures': failures}, indent=2))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
