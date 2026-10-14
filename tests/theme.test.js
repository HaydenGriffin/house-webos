// Themes: the default look gets nothing from theme.js, and a chosen theme gets its stylesheet. node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = path.join(__dirname, '..', 'app');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');

/* Runs theme.js as the page would, with a config and a URL query; returns what it did to the document. */
function load(config, search) {
  const head = { children: [], appendChild(c) { this.children.push(c); return c; } };
  const attrs = {};
  const doc = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } },
    body: { style: {} },
    getElementsByTagName: (t) => (t === 'head' ? [head] : []),
    createElement: (tag) => ({ tag }),
  };
  const timers = [];
  const window = { HOUSE_CONFIG: config };
  vm.runInContext(read('theme.js'), vm.createContext({ window, document: doc, location: { search: search || '' },
    setTimeout: (fn) => timers.push(fn) }), { filename: 'theme.js' });
  return { attrs, body: doc.body, links: head.children, timers, api: window.HOUSE_THEME };
}

test('no theme: theme.js leaves the page alone', () => {
  for (const config of [undefined, {}, { theme: '' }, { theme: 'lamplight' }, { theme: 'default' }, { theme: 'nope' }]) {
    const r = load(config);
    assert.deepStrictEqual(r.attrs, {}, JSON.stringify(config));
    assert.deepStrictEqual(r.links, []);
    assert.deepStrictEqual(r.body.style, {});
    assert.strictEqual(r.timers.length, 0);
  }
});

test('theme "afterglow" in the config: its stylesheet, the data-theme attribute, the page held until it loads', () => {
  const r = load({ theme: 'Afterglow' });
  assert.strictEqual(r.attrs['data-theme'], 'afterglow');
  assert.strictEqual(r.links.length, 1);
  assert.strictEqual(r.links[0].rel, 'stylesheet');
  assert.strictEqual(r.links[0].href, 'themes/afterglow/afterglow.css');
  assert.strictEqual(r.body.style.opacity, '0');
  r.links[0].onload();
  assert.strictEqual(r.body.style.opacity, '');
});

test('a sheet that fails to load drops the theme; a slow one shows the page anyway', () => {
  const failed = load({ theme: 'afterglow' });
  failed.links[0].onerror();
  assert.deepStrictEqual(failed.attrs, {});
  assert.strictEqual(failed.body.style.opacity, '');
  const slow = load({ theme: 'afterglow' });
  slow.timers[0]();
  assert.strictEqual(slow.body.style.opacity, '');
  assert.strictEqual(slow.attrs['data-theme'], 'afterglow');
});

test('?theme= in the URL picks a theme, for the demo', () => {
  assert.strictEqual(load(undefined, '?demo&theme=afterglow').attrs['data-theme'], 'afterglow');
  assert.deepStrictEqual(load({ theme: 'afterglow' }, '?demo&theme=nope').attrs, {});
});

test('index.html runs theme.js straight after config.js, and style.css never loads a theme or its fonts', () => {
  assert.match(read('index.html'), /<script src="config.js"><\/script>\n<script src="theme.js"><\/script>\n/);
  const css = read('style.css');
  assert.doesNotMatch(css, /themes\/|archivo|data-theme/i);
});

/* Every rule outside @font-face is scoped to html[data-theme="<name>"], so a theme can't reach the default look. */
function ruleSelectors(css) {
  const out = [];
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{[^{}]*\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    if (!sel.startsWith('@font-face')) out.push(sel);
  }
  return out;
}

test('every theme stylesheet is scoped, ships its fonts and licence, and keeps to the TV\'s Chromium', () => {
  const { themes } = load({}).api;
  for (const [name, file] of Object.entries(themes)) {
    const css = read(file);
    const selectors = ruleSelectors(css);
    assert.ok(selectors.length > 20, name);
    for (const sel of selectors) {
      for (const part of sel.split(',')) assert.ok(part.trim().startsWith(`html[data-theme="${name}"]`), `${name}: ${part.trim()}`);
    }
    const dir = path.dirname(path.join(APP, file));
    const urls = [...css.matchAll(/url\(([^)'"]+)\)/g)].map((u) => u[1]);
    assert.ok(urls.length, name);
    for (const u of urls) assert.ok(fs.existsSync(path.join(dir, u)), `${name}: ${u}`);
    if (urls.some((u) => u.endsWith('.woff2'))) assert.ok(fs.existsSync(path.join(dir, 'fonts', 'OFL.txt')), `${name}: fonts/OFL.txt`);
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(code, /backdrop-filter|:focus-visible|linear-gradient|radial-gradient|\binset:/, name);
    assert.doesNotMatch(code.replace(/filter: none !important/g, ''), /filter:/, name);
  }
});
