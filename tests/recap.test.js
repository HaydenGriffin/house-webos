// The recap's card rules and its player, run in Node with a minimal stand-in for the DOM: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = path.join(__dirname, '..', 'app');

/* Just enough DOM for play(): elements with classList, style, children and the two selectors the player uses. */
function el(tag) {
  const e = {
    tag, children: [], style: {}, hidden: true, offsetWidth: 1, parentNode: null, _html: '', _cls: new Set(),
    classList: {
      add: (...c) => c.forEach((x) => e._cls.add(x)),
      remove: (...c) => c.forEach((x) => e._cls.delete(x)),
      toggle: (c, on) => { (on === undefined ? !e._cls.has(c) : on) ? e._cls.add(c) : e._cls.delete(c); },
      contains: (c) => e._cls.has(c),
    },
    set className(v) { e._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get className() { return [...e._cls].join(' '); },
    set innerHTML(v) {
      e._html = v;
      e.children = [];
      if (e.isBars) (v.match(/r-bar"/g) || []).forEach(() => { const b = el('span'); b.firstChild = el('span'); e.children.push(b); });
    },
    get innerHTML() { return e._html; },
    textContent: '',
    appendChild(c) { c.parentNode = e; e.children.push(c); return c; },
    removeChild(c) { e.children = e.children.filter((x) => x !== c); c.parentNode = null; },
    querySelector(sel) {
      if (sel === '.r-card:not(.r-out)') return e.children.filter((c) => c._cls.has('r-card') && !c._cls.has('r-out')).pop() || null;
      if (sel === '.r-n') return null;
      return e.parts ? e.parts[sel] : null;
    },
  };
  return e;
}

function load() {
  const window = {};
  const ctx = vm.createContext({ window, document: { createElement: el }, Intl, Date, Math, JSON, String, Array, isFinite, setTimeout, clearTimeout, setInterval, clearInterval });
  for (const f of ['icons.js', 'recap.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx, { filename: f });
  return window.HouseRecap;
}

function stats(extra) {
  return Object.assign({ generated_at: new Date().toISOString(), people: [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }],
    energy: { week_cost: 21.5 }, house_says: { text: 'A quiet week.' } }, extra);
}
const labels = (cards) => cards.map((c) => c.label);

test('restless says 1 time, not 1 times', () => {
  const R = load();
  const card = R.build({ stats: stats({ restless: { kind: 'worst', who: 'sam', times: 1, day: 'Tuesday' } }) }).find((c) => c.label === 'Up in the night');
  assert.strictEqual(card.unit, 'time');
});

const showerLine = (showers) => load().build({ stats: stats({ showers }) }).find((c) => c.label === 'The shower duel').line;

test('the shower duel says who used more water, with the energy, when the gap is worth saying', () => {
  assert.strictEqual(showerLine({ alex: { count: 5, avg_min: 8, avg_temp: 41, litres: 210, kwh: 6.1 }, sam: { count: 6, avg_min: 12, avg_temp: 44, litres: 340, kwh: 9.8 } }),
    'Sam’s showers used 130 more litres, 3.7 kWh more to heat');
  assert.strictEqual(showerLine({ alex: { count: 5, avg_min: 8, litres: 300 }, sam: { count: 6, avg_min: 12, litres: 210 } }),
    'Alex’s showers used 90 more litres');
});

test('a small water gap, or one side without litres, falls back to the hotter showers', () => {
  const hot = { alex: { count: 5, avg_min: 8, avg_temp: 41 }, sam: { count: 6, avg_min: 12, avg_temp: 44 } };
  assert.strictEqual(showerLine({ alex: Object.assign({ litres: 300 }, hot.alex), sam: Object.assign({ litres: 290 }, hot.sam) }), 'Sam’s showers run 3° hotter');
  assert.strictEqual(showerLine({ alex: Object.assign({ litres: 300 }, hot.alex), sam: hot.sam }), 'Sam’s showers run 3° hotter');
});

test('a month tile pair needs both people', () => {
  const R = load();
  const month = { label: 'September', steps: { alex: 250000 }, sleep_avg: { alex: 420, sam: 450 }, duel: { alex: 12 }, energy_cost: 90, tv_hours: 1 };
  const card = R.build({ stats: stats({ month_recap: month }) }).find((c) => c.label === 'September in numbers');
  assert.ok(card, 'three tiles still make the card');
  assert.ok(!/Steps duel|>Steps</.test(card.html), 'no half-empty steps or duel tile');
  assert.ok(!card.html.includes('–'), 'no dash for a missing side');
  assert.ok(card.html.includes('Average night'));
  assert.ok(/>1<span class="r-tile-unit">hour</.test(card.html));
});

test('food is one card: the plates when their pictures loaded, else the dinners', () => {
  const R = load();
  const s = stats({ dinners: { days: [{ day: 'Mon', meal: 'Soup' }, { day: 'Tue', meal: 'Pasta' }] }, food: { photos: ['a', 'b', 'c'], pick: 'top', top: { name: 'Soup', days: 1 } } });
  const withPics = labels(R.build({ stats: s, foodPhotos: ['/a.jpg', '/b.jpg', '/c.jpg'] }));
  assert.ok(withPics.includes('The week on a plate') && !withPics.includes('What we ate'), withPics.join());
  const noPics = labels(R.build({ stats: s, foodPhotos: [] }));
  assert.ok(noPics.includes('What we ate') && !noPics.includes('The week on a plate'), noPics.join());
  const plate = R.build({ stats: s, foodPhotos: ['/a.jpg', '/b.jpg', '/c.jpg'] }).find((c) => c.label === 'The week on a plate');
  assert.ok(JSON.stringify(plate).includes('Soup, 1 time'));
});

/* ---------- the player, on mocked timers ---------- */
function player(t, nCards, opts) {
  if (!t.timersOn) { t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] }); t.timersOn = true; }
  const R = load();
  const root = el('section'), stage = el('div'), bars = el('div'), hint = el('p');
  bars.isBars = true;
  root.parts = { '.r-stage': stage, '.r-bars': bars, '.r-hint': hint };
  const cards = Array.from({ length: nCards }, (_, n) => ({ icon: 'home', label: 'Card ' + n, text: String(n), ms: 5000 }));
  const ended = [];
  const p = R.play(root, cards, Object.assign({ auto: true, onEnd: (r) => ended.push(r) }, opts));
  const shown = () => (stage.querySelector('.r-card:not(.r-out)') || {}).innerHTML || '';
  return { p, ended, shown, hint, root, tick: (ms) => t.mock.timers.tick(ms) };
}

test('it ends on completion, not on a clock', (t) => {
  const r = player(t, 3);
  // the mocked clock runs one card's timer per tick
  r.tick(5000); r.tick(5000); r.tick(4999);
  assert.deepStrictEqual(r.ended, []);
  assert.ok(r.shown().includes('Card 2'));
  r.tick(1);
  assert.deepStrictEqual(r.ended, ['done']);
});

test('pause holds the card past five minutes, then carries on with the time it had left', (t) => {
  const r = player(t, 2);
  r.tick(3000);
  r.p.pause();
  assert.ok(r.root.classList.contains('r-paused'));
  r.tick(6 * 60000);
  assert.deepStrictEqual(r.ended, []);
  assert.ok(r.shown().includes('Card 0'));
  assert.match(r.hint.textContent, /Paused/);
  r.p.resume();
  r.tick(1999);
  assert.ok(r.shown().includes('Card 0'), 'two seconds were left on the first card');
  r.tick(1);
  assert.ok(r.shown().includes('Card 1'));
  r.tick(5000);
  assert.deepStrictEqual(r.ended, ['done']);
});

test('stepping while held keeps it held', (t) => {
  const r = player(t, 3);
  r.p.toggle();
  r.p.next();
  assert.ok(r.shown().includes('Card 1'));
  r.tick(60000);
  assert.ok(r.shown().includes('Card 1') && r.p.paused());
  r.p.prev();
  assert.ok(r.shown().includes('Card 0') && r.p.paused());
});

test('a pause left behind ends after the idle limit, a press restarts the wait', (t) => {
  const r = player(t, 2, { idleMs: 10 * 60000 });
  r.p.pause();
  r.tick(9 * 60000);
  r.p.next();  // someone pressed a key: still held, the wait starts again
  r.tick(9 * 60000);
  assert.deepStrictEqual(r.ended, []);
  r.tick(60000 + 1000);
  assert.deepStrictEqual(r.ended, ['idle']);
});

test('back and end report their reason once; stop is silent', (t) => {
  const r = player(t, 3);
  r.p.back();
  r.p.back();
  assert.deepStrictEqual(r.ended, ['back']);
  const s = player(t, 3);
  s.p.stop();
  s.tick(60000);
  assert.deepStrictEqual(s.ended, []);
  const u = player(t, 3);
  u.p.end('left');
  assert.deepStrictEqual(u.ended, ['left']);
});
