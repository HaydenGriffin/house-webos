"""Build the House IPK from app/. The package never contains a config or a credential, so it's the same for every
home and safe to share; the config goes onto the TV separately, after installing (tools/push_config.py).

    python3 tools/package.py                         # writes dist/<id>_<version>_all.ipk
    python3 tools/package.py --app-id com.example.house --version 1.6.0

Install with the webOS CLI in Developer Mode:

    ares-install -d <device> dist/<id>_<version>_all.ipk
"""
import argparse
import io
import json
import pathlib
import re
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / 'app'
# Only these go into the package. config.js is written on the TV by push_config.py; anything else in app/ (an editor
# backup, a config copy, a token file) is left out rather than shipped.
KINDS = {'.html', '.js', '.css', '.png', '.woff2', '.txt', '.json'}
NEVER = re.compile(r'(^|/)(config\.[a-z]+|.*token.*|.*secret.*|\..*)$', re.I)
# A Home Assistant long-lived token is a JWT: three base64url parts, the first two starting with eyJ ('{"').
JWT = re.compile(rb'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}')


class PackageError(SystemExit):
    pass


def app_files(app=APP):
    files = {}
    for p in sorted(app.rglob('*')):
        rel = p.relative_to(app).as_posix()
        if not p.is_file() or NEVER.search(rel) or p.suffix.lower() not in KINDS:
            continue
        if p.suffix == '.json' and rel != 'appinfo.json':
            continue
        data = p.read_bytes()
        if JWT.search(data):
            raise PackageError(f'{rel} contains what looks like an access token; the package never carries one')
        files[rel] = data
    if 'index.html' not in files or 'appinfo.json' not in files:
        raise PackageError(f'{app} has no index.html or appinfo.json')
    return files


def tar_bytes(files):
    stream = io.BytesIO()
    parents = {str(p) for n in files for p in pathlib.PurePosixPath(n).parents if str(p) != '.'}
    with tarfile.open(fileobj=stream, mode='w:gz', format=tarfile.USTAR_FORMAT) as archive:
        for name in sorted(parents):  # explicit directory entries, so the installer never has to infer fonts/
            item = tarfile.TarInfo(name)
            item.type, item.mode = tarfile.DIRTYPE, 0o755
            archive.addfile(item)
        for name, content in sorted(files.items()):
            item = tarfile.TarInfo(name)
            item.size, item.mode = len(content), 0o644
            archive.addfile(item, io.BytesIO(content))
    return stream.getvalue()


def ar(members):
    # Plain ar headers: some webOS package verifiers reject GNU-style ones.
    out = bytearray(b'!<arch>\n')
    for name, data in members:
        out.extend(f'{name + "/":<16}{0:<12}{0:<6}{0:<6}{"100644":<8}{len(data):<10}`\n'.encode())
        out.extend(data)
        if len(data) % 2:
            out.extend(b'\n')
    return bytes(out)


def build(app=APP, dist=None, app_id=None, version=None, title=None):
    files = app_files(pathlib.Path(app))
    info = json.loads(files['appinfo.json'])
    info.update({k: v for k, v in (('id', app_id), ('version', version), ('title', title)) if v})
    if not re.fullmatch(r'[a-z0-9]+(\.[a-z0-9_]+)+', info['id']) or not re.fullmatch(r'\d+\.\d+\.\d+', info['version']):
        raise PackageError(f'bad app id or version: {info["id"]!r} {info["version"]!r}')
    files['appinfo.json'] = (json.dumps(info, indent=2) + '\n').encode()
    app_id, version = info['id'], info['version']
    base = f'usr/palm/applications/{app_id}'
    data = {f'{base}/{rel}': content for rel, content in files.items()}
    data[f'usr/palm/packages/{app_id}/packageinfo.json'] = json.dumps(
        {'id': app_id, 'version': version, 'app': app_id, 'vendor': info.get('vendor', ''), 'loc_name': info['title']}).encode()
    control = (f'Package: {app_id}\nVersion: {version}\nArchitecture: all\n'
               f'Maintainer: local\nDescription: {info["title"]} for Home Assistant\n').encode()
    dist = pathlib.Path(dist) if dist else ROOT / 'dist'
    dist.mkdir(parents=True, exist_ok=True)
    path = dist / f'{app_id}_{version}_all.ipk'
    path.write_bytes(ar([('debian-binary', b'2.0\n'), ('control.tar.gz', tar_bytes({'control': control})),
                         ('data.tar.gz', tar_bytes(data))]))
    return path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--app', default=str(APP), help='the app folder (default: app/)')
    parser.add_argument('--dist', help='where to write the IPK (default: dist/)')
    parser.add_argument('--app-id', help='install under another id, e.g. to keep an existing install')
    parser.add_argument('--version', help='override appinfo.json\'s version')
    parser.add_argument('--title', help='override appinfo.json\'s title')
    a = parser.parse_args()
    print(build(a.app, a.dist, a.app_id, a.version, a.title))
