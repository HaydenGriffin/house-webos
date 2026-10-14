"""The IPK never carries a config or a credential; the config reaches the TV only through push_config.py.

    python3 -m unittest discover -s tests
"""
import io
import json
import pathlib
import shutil
import sys
import tarfile
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))

import package  # noqa: E402
import push_config  # noqa: E402

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIxMjM0NTY3ODkwYWJjZGVmIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ'


def members(ipk):
    """{name: bytes} of an IPK's data.tar.gz, plus its control file under 'control'."""
    raw, pos, parts = ipk.read_bytes(), 8, {}
    while pos < len(raw):
        name, size = raw[pos:pos + 16].decode().strip().rstrip('/'), int(raw[pos + 48:pos + 58].decode().strip())
        parts[name] = raw[pos + 60:pos + 60 + size]
        pos += 60 + size + (size % 2)
    out = {}
    for part in ('data.tar.gz', 'control.tar.gz'):
        with tarfile.open(fileobj=io.BytesIO(parts[part]), mode='r:gz') as t:
            for m in t.getmembers():
                if m.isfile():
                    out[m.name] = t.extractfile(m).read()
    return out


class PackageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.app = self.tmp / 'app'
        shutil.copytree(ROOT / 'app', self.app, ignore=shutil.ignore_patterns('config.js'))
        self.dist = self.tmp / 'dist'

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def build(self, **kw):
        return members(package.build(self.app, self.dist, **kw))

    def test_config_and_secrets_in_app_folder_stay_out(self):
        (self.app / 'config.js').write_text(f'window.HOUSE_CONFIG = {{"url": "ws://x", "token": "{TOKEN}"}};')
        (self.app / 'config.json').write_text(json.dumps({'url': 'ws://x', 'token': TOKEN}))
        (self.app / 'house-tv-token').write_text(TOKEN)
        (self.app / '.DS_Store').write_bytes(b'\0')
        (self.app / 'app.js.bak').write_text('old')
        files = self.build()
        names = [n.rsplit('/', 1)[-1] for n in files]
        for bad in ('config.js', 'config.json', 'house-tv-token', '.DS_Store', 'app.js.bak'):
            self.assertNotIn(bad, names)
        self.assertFalse(any(TOKEN.encode() in v for v in files.values()))
        self.assertIn('index.html', names)
        self.assertIn('woff2', ' '.join(names))

    def test_a_token_inside_an_app_file_stops_the_build(self):
        with open(self.app / 'app.js', 'a') as f:
            f.write(f'\nvar leaked = "{TOKEN}";\n')
        with self.assertRaises(package.PackageError):
            package.build(self.app, self.dist)
        self.assertFalse(self.dist.exists() and any(self.dist.iterdir()))

    def test_index_loads_config_from_beside_the_app(self):
        html = (self.app / 'index.html').read_text()
        self.assertIn('<script src="config.js"></script>', html)

    def test_id_and_version_overrides(self):
        files = self.build(app_id='com.example.house', version='2.3.4', title='Home')
        info = json.loads(files['usr/palm/applications/com.example.house/appinfo.json'])
        self.assertEqual((info['id'], info['version'], info['title']), ('com.example.house', '2.3.4', 'Home'))
        self.assertIn(b'Package: com.example.house\nVersion: 2.3.4', files['control'])
        self.assertTrue((self.dist / 'com.example.house_2.3.4_all.ipk').exists())
        with self.assertRaises(package.PackageError):
            package.build(self.app, self.dist, version='latest')

    def test_the_afterglow_theme_ships_with_its_fonts_and_licence(self):
        names = [n.split('/', 4)[-1] for n in self.build()]
        for part in ('theme.js', 'themes/afterglow/afterglow.css', 'themes/afterglow/fonts/archivo-latin.woff2',
                     'themes/afterglow/fonts/archivo-latin-ext.woff2', 'themes/afterglow/fonts/OFL.txt'):
            self.assertIn(part, names)

    def test_the_real_app_folder_builds_clean(self):
        files = members(package.build(dist=self.dist))
        self.assertFalse([n for n in files if n.endswith(('config.js', 'config.json'))])
        self.assertFalse(any(b'eyJ' in v and package.JWT.search(v) for v in files.values()))


class PushConfigTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.cfg = self.tmp / 'config.json'

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_needs_url_and_token(self):
        self.cfg.write_text(json.dumps({'url': 'ws://ha:8123/api/websocket'}))
        with self.assertRaises(SystemExit):
            push_config.config_js(self.cfg)
        self.cfg.write_text(json.dumps({'url': 'http://ha:8123', 'token': TOKEN}))
        with self.assertRaises(SystemExit):
            push_config.config_js(self.cfg)

    def test_token_file_and_adapter(self):
        self.cfg.write_text(json.dumps({'url': 'ws://ha:8123/api/websocket', 'title': 'Hus'}))
        (self.tmp / 'token').write_text(TOKEN + '\n')
        (self.tmp / 'adapter.js').write_text('window.HOUSE_STATS_ADAPTER = function (s) { return s; };')
        js = push_config.config_js(self.cfg, self.tmp / 'token', self.tmp / 'adapter.js').decode()
        self.assertTrue(js.startswith('window.HOUSE_CONFIG = {'))
        self.assertIn(f'"token": "{TOKEN}"', js)
        self.assertIn('"title": "Hus"', js)
        self.assertTrue(js.rstrip().endswith('return s; };'))

    def test_push_sends_the_config_on_stdin_only(self):
        seen = {}

        def run(cmd, input, capture_output, timeout):
            seen['cmd'], seen['input'] = cmd, input
            return type('R', (), {'returncode': 0, 'stderr': b''})()

        path = push_config.push(b'window.HOUSE_CONFIG = {"token": "' + TOKEN.encode() + b'"};\n', '-p 9922 prisoner@tv',
                                'com.example.house', run=run)
        self.assertEqual(path, '/media/developer/apps/usr/palm/applications/com.example.house/config.js')
        self.assertNotIn(TOKEN, ' '.join(seen['cmd']))
        self.assertIn(TOKEN.encode(), seen['input'])
        self.assertEqual(seen['cmd'][:2], ['ssh', '-T'])
        self.assertIn('prisoner@tv', seen['cmd'])
        self.assertTrue(seen['cmd'][-1].endswith('mv ' + path + '.new ' + path))

    def test_push_failure_is_reported(self):
        def run(cmd, input, capture_output, timeout):
            return type('R', (), {'returncode': 1, 'stderr': b'Permission denied'})()
        with self.assertRaises(SystemExit) as e:
            push_config.push(b'x', 'root@tv', run=run)
        self.assertIn('Permission denied', str(e.exception))


if __name__ == '__main__':
    unittest.main()
