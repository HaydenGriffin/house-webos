"""Put House's config on the TV, next to the installed app. The IPK never carries it (tools/package.py), so this runs
after every install and whenever the config changes.

    python3 tools/push_config.py config.json --ssh root@tv                  # a rooted TV
    python3 tools/push_config.py config.json --ssh "-p 9922 -i ~/.ssh/tv_webos prisoner@tv"   # Developer Mode
    python3 tools/push_config.py config.json --out app/config.js            # for trying the app in a browser

The config goes over SSH's stdin, so the token never appears in a command line, a log or this script's output.
--token-file keeps the token out of config.json; --adapter adds a script that reshapes recap stats (docs/recap-stats.md).
Then relaunch House on the TV.
"""
import argparse
import json
import pathlib
import shlex
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP_ID = json.loads((ROOT / 'app' / 'appinfo.json').read_text())['id']
APPS = '/media/developer/apps/usr/palm/applications'


def config_js(config_path, token_file=None, adapter=None):
    config = json.loads(pathlib.Path(config_path).read_text())
    if token_file:
        config['token'] = pathlib.Path(token_file).read_text().strip()
    for key in ('url', 'token'):
        if not config.get(key):
            raise SystemExit(f'{config_path} needs "{key}"' + (' (or --token-file)' if key == 'token' else ''))
    if not str(config['url']).startswith(('ws://', 'wss://')):
        raise SystemExit('"url" is the websocket address: ws://<home assistant>:8123/api/websocket')
    out = 'window.HOUSE_CONFIG = ' + json.dumps(config, ensure_ascii=False) + ';\n'
    if adapter:
        out += pathlib.Path(adapter).read_text()
        if not out.endswith('\n'):
            out += '\n'
    return out.encode()


def push(data, ssh, app_id=APP_ID, run=subprocess.run):
    path = f'{APPS}/{app_id}/config.js'
    cmd = ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'LogLevel=ERROR', *shlex.split(ssh),
           f'test -d {APPS}/{app_id} && cat > {path}.new && chmod 644 {path}.new && mv {path}.new {path}']
    r = run(cmd, input=data, capture_output=True, timeout=60)
    if r.returncode:
        raise SystemExit(f'could not write {path} (is House installed as {app_id}?): {r.stderr.decode(errors="replace").strip()}')
    return path


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('config', help='your config file (see config.example.json)')
    where = p.add_mutually_exclusive_group(required=True)
    where.add_argument('--ssh', help='ssh arguments that reach the TV, e.g. root@tv')
    where.add_argument('--out', help='write config.js here instead')
    p.add_argument('--app-id', default=APP_ID, help=f'the installed app id (default {APP_ID})')
    p.add_argument('--token-file', help='read the token from this file instead of config.json')
    p.add_argument('--adapter', help='a script appended to config.js, e.g. one that sets window.HOUSE_STATS_ADAPTER')
    a = p.parse_args(argv)
    data = config_js(a.config, a.token_file, a.adapter)
    if a.out:
        pathlib.Path(a.out).write_bytes(data)
        print(f'wrote {a.out}')
    else:
        print(f'wrote {push(data, a.ssh, a.app_id)}; relaunch House to use it')


if __name__ == '__main__':
    sys.exit(main())
