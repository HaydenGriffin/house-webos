"""Build the House IPK from app/, with config.js generated from a config file.

    python3 tools/package.py config.json        # writes dist/<id>_<version>_all.ipk

The config (see config.example.json) holds the Home Assistant URL and a long-lived token, so the IPK it produces is
private: install it, don't share it. Install with the webOS CLI in Developer Mode:

    ares-install -d <device> dist/<id>_<version>_all.ipk
"""
import argparse
import io
import json
import pathlib
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / 'app'
SKIP = {'config.js', '.DS_Store'}


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


def config_js(path):
    config = json.loads(pathlib.Path(path).read_text())
    for key in ('url', 'token'):
        if not config.get(key):
            raise SystemExit(f'{path} needs "{key}"')
    return ('window.HOUSE_CONFIG = ' + json.dumps(config, ensure_ascii=False) + ';\n').encode()


def build(config_path):
    info = json.loads((APP / 'appinfo.json').read_text())
    app_id, version = info['id'], info['version']
    base = f'usr/palm/applications/{app_id}'
    files = {f'{base}/{p.relative_to(APP).as_posix()}': p.read_bytes()
             for p in APP.rglob('*') if p.is_file() and p.name not in SKIP}
    files[f'{base}/config.js'] = config_js(config_path)
    files[f'usr/palm/packages/{app_id}/packageinfo.json'] = json.dumps(
        {'id': app_id, 'version': version, 'app': app_id, 'vendor': info.get('vendor', ''), 'loc_name': info['title']}).encode()
    control = (f'Package: {app_id}\nVersion: {version}\nArchitecture: all\n'
               f'Maintainer: local\nDescription: {info["title"]} for Home Assistant\n').encode()
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    path = dist / f'{app_id}_{version}_all.ipk'
    path.write_bytes(ar([('debian-binary', b'2.0\n'), ('control.tar.gz', tar_bytes({'control': control})),
                         ('data.tar.gz', tar_bytes(files))]))
    return path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('config', help='your config file (see config.example.json)')
    print(build(parser.parse_args().config))
