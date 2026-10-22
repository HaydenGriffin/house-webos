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

test('showers: a bar a day each, no contest; each person\'s count and length, the house\'s week in the line', () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, n) => ({ day, alex: n % 2 ? 8 : 0, sam: n < 5 ? 19 : 0 }));
  const sh = { alex: { count: 3, avg_min: 8, litres: 150 }, sam: { count: 5, avg_min: 19, litres: 380 }, total: 8, total_min: 119, days };
  const card = find({ showers: sh }, 'Showers');
  assert.strictEqual((card.html.match(/r-pbar r-p/g) || []).length, 14);
  assert.ok(!card.html.includes('r-lost'), 'nobody wins a day');
  assert.ok(card.html.includes('3 × 8 min') && card.html.includes('5 × 19 min'));
  assert.strictEqual(card.line, '8 showers, 1h 59m in all · 530 litres');
  assert.strictEqual(card.sub, 'Minutes a day');
  assert.strictEqual(find({ showers: sh }, 'The shower duel'), undefined);
  const plain = find({ showers: { alex: { count: 1, avg_min: 9 }, sam: { count: 2, avg_min: 12 } } }, 'Showers');
  assert.strictEqual(plain.line, '3 showers, 33 min in all');
  assert.strictEqual(find({ showers: { alex: { count: 1, avg_min: 9 } } }, 'Showers'), undefined);
});

test('the quiz answer must be one of the three tiles shown', () => {
  const R = load();
  const quiz = (options, answer_index) => R.build({ stats: stats({ quiz: { question: 'Who?', options, answer_index } }) }).find((c) => c.label === 'Quick question');
  assert.strictEqual(quiz(['a', 'b', 'c', 'd'], 3), undefined);
  assert.strictEqual(quiz(['a', 'b'], 2), undefined);
  const card = quiz(['a', 'b', 'c', 'd'], 2);
  assert.match(card.body, /r-correct">c</);
  assert.ok(!card.body.includes('>d<'), 'only three tiles');
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

/* ---------- the gym ---------- */
const week = (a, s) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, n) => ({ day, alex: a[n], sam: s[n] }));
const gymCard = (gym) => load().build({ stats: stats({ gym }) }).find((c) => c.label === 'The gym');

test('the gym: shown when someone went, left out when nobody did or there is no entry', () => {
  assert.ok(gymCard({ days: week([1, 0, 0, 0, 0, 0, 0].map(Boolean), Array(7).fill(false)), alex: { days: 1 }, sam: { days: 0 } }));
  assert.strictEqual(gymCard({ alex: { days: 0 }, sam: { days: 0 } }), undefined);
  assert.strictEqual(gymCard({ days: [] }), undefined);
  assert.strictEqual(gymCard(null), undefined);
});

test('the gym: the producer’s line first, then the longest streak of two or more weeks', () => {
  assert.strictEqual(gymCard({ alex: { days: 2 }, sam: { days: 3 }, line: 'A busy week at the rack' }).line, 'A busy week at the rack');
  assert.strictEqual(gymCard({ alex: { days: 2, streak: 3 }, sam: { days: 3, streak: 6 } }).line, 'Sam: 6 weeks without a zero week');
  assert.strictEqual(gymCard({ alex: { days: 2, streak: 4 }, sam: { days: 2, streak: 4 } }).line, 'Alex and Sam: 4 weeks without a zero week');
});

test('the gym: a streak under the week’s goal is not bragged about; then who went more, or both the same', () => {
  assert.strictEqual(gymCard({ alex: { days: 1, streak: 5 }, sam: { days: 3 } }).line, 'Sam went 3 times to 1');
  assert.strictEqual(gymCard({ alex: { days: 1, streak: 5 }, sam: { days: 3 }, goal: 1 }).line, 'Alex: 5 weeks without a zero week');
  assert.strictEqual(gymCard({ alex: { days: 2 }, sam: { days: 2 } }).line, 'Both made it 2 times');
});

test('the gym: one person alone gets their own card, with their minutes as the line', () => {
  const card = gymCard({ days: week(Array(7).fill(null), [true, false, true, false, false, false, false]), sam: { days: 2, minutes: 95 } });
  assert.ok(/r-solo/.test(card.html));
  assert.ok(!/Alex/.test(card.html));
  assert.strictEqual(card.line, '1h 35m at the gym in all');
  assert.strictEqual(gymCard({ sam: { days: 1, minutes: 40 } }).line, '40 min at the gym in all');
});

test('the gym plays after the goals card and before sleep', () => {
  const cards = load().build({ stats: stats({ gym: { alex: { days: 2 }, sam: { days: 1 } }, sleep: { avg: { alex: 420, sam: 450 } },
    goals: { alex: { hit: 4, of: 7 }, sam: { hit: 5, of: 7 } } }) });
  const l = labels(cards);
  assert.ok(l.indexOf('Daily goals') < l.indexOf('The gym') && l.indexOf('The gym') < l.indexOf('Sleep: Alex vs Sam'), l.join(' | '));
});

/* ---------- what we read ---------- */
const readCard = (reading, covers) => load().build({ stats: stats({ reading }), bookCovers: covers }).find((c) => c.label === 'What we read');

test('reading: needs a finished book or one being read with a percent', () => {
  assert.ok(readCard({ finished: [{ title: 'A' }] }));
  assert.ok(readCard({ current: [{ title: 'B', percent: 10 }] }));
  assert.strictEqual(readCard({ current: [{ title: 'B' }] }), undefined);
  assert.strictEqual(readCard({ finished: [{ author: 'No title' }], current: [] }), undefined);
  assert.strictEqual(readCard(null), undefined);
});

test('reading: finished books first, then the ones being read, three at most', () => {
  const card = readCard({ current: [{ title: 'C1', percent: 30 }, { title: 'C2', percent: 60 }], finished: [{ title: 'F1' }, { title: 'F2' }] });
  const order = card.html.match(/r-book-title">([^<]+)/g).map((m) => m.split('>')[1]);
  assert.deepStrictEqual(order, ['F1', 'F2', 'C1']);
  assert.ok(/Finished/.test(card.html) && /30%/.test(card.html));
});

test('reading: a cover shows only when it loaded; the line is the year, else two or more finished', () => {
  const card = readCard({ finished: [{ title: 'F', cover: '/api/x.jpg' }, { title: 'G', cover: '/api/y.jpg' }] }, { '/api/x.jpg': 'http://ha/x.jpg' });
  assert.ok(/<img src="http:\/\/ha\/x.jpg"/.test(card.html));
  assert.strictEqual((card.html.match(/r-nocover/g) || []).length, 1);
  assert.strictEqual(card.line, '2 books finished this week');
  assert.strictEqual(readCard({ finished: [{ title: 'F' }], year: { sam: 1 } }).line, 'Sam has read 1 book this year');
  assert.strictEqual(readCard({ finished: [{ title: 'F' }], year: { alex: 4, sam: 19 } }).line, 'Books this year: Alex 4, Sam 19');
  assert.strictEqual(readCard({ current: [{ title: 'C', percent: 140, who: 'alex' }] }).line, '');
  assert.ok(/100%/.test(readCard({ current: [{ title: 'C', percent: 140, who: 'alex' }] }).html));
});

/* ---------- what we did, and the routes ---------- */
const find = (s, label, extra) => load().build(Object.assign({ stats: stats(s) }, extra)).find((c) => c.label === label);
const act = (who, kind, day, date, extra) => Object.assign({ who, kind, name: kind, day, date }, extra);

test('what we did: rows oldest first, totals worked out when not given, and the overflow said', () => {
  const items = [act('sam', 'run', 'Wed', '2026-10-21', { minutes: 30, km: 5 }), act('alex', 'gym', 'Mon', '2026-10-19', { minutes: 60 }),
    act('alex', 'walk', 'Tue', '2026-10-20', { minutes: 45, km: 3.25 })];
  const card = find({ activities: { items } }, 'What we did');
  assert.ok(card.html.indexOf('Mon') < card.html.indexOf('Tue') && card.html.indexOf('Tue') < card.html.indexOf('Wed'), 'sorted by date');
  assert.ok(card.html.includes('1h 45m · 3.3 km'), 'Alex: 105 min and 3.25 km, km to one place');
  assert.ok(card.html.includes('30 min · 5 km'));
  assert.strictEqual(card.sub, '');
  const many = Array.from({ length: 9 }, (_, n) => act('sam', 'run', 'Mon', '2026-10-1' + n));
  assert.strictEqual(find({ activities: { items: many } }, 'What we did').sub, 'And 2 more');
});

test('what we did: an item needs a known person, a day and a name or kind; given totals win', () => {
  assert.strictEqual(find({ activities: { items: [act('kim', 'run', 'Mon', '2026-10-19'), { who: 'alex', kind: 'run' }] } }, 'What we did'), undefined);
  assert.strictEqual(find({ activities: { items: [] } }, 'What we did'), undefined);
  const card = find({ activities: { items: [act('alex', 'run', 'Mon', '2026-10-19')], totals: { alex: { count: 3, minutes: 90, km: 12 } } } }, 'What we did');
  assert.ok(card.html.includes('>3<span class="r-side-unit">activities') && card.html.includes('1h 30m · 12 km'));
  assert.ok(!card.html.includes('r-who r-p2'), 'nobody with nothing done');
});

test('routeMap: fits every line in the box in Web Mercator, north up, with the tiles under it; null without a line', () => {
  const R = load();
  const m = R.routeMap([[[51.5, -0.1], [51.51, -0.1], [51.51, -0.08]]], 800, 500, 40);
  const xy = (p) => p.split(/[ML]/).filter(Boolean).map((q) => q.split(',').map(Number));
  const pts = xy(m.lines[0].d);
  pts.forEach(([x, y]) => assert.ok(x >= 39.9 && x <= 760.1 && y >= 39.9 && y <= 460.1, 'inside the padding: ' + x + ',' + y));
  assert.ok(pts[1][1] < pts[0][1], 'north is up');
  assert.ok(pts[2][0] > pts[1][0], 'east is right');
  assert.deepStrictEqual(Array.from(m.lines[0].start), pts[0]);
  assert.deepStrictEqual(Array.from(m.lines[0].end), pts[2]);
  // the tiles cover the whole box, at the zoom whose tiles show near 256 px, and a point sits on its own tile
  const covers = (x, y) => m.tiles.some((t) => t.left <= x && x <= t.left + t.size && t.top <= y && y <= t.top + t.size);
  [[0, 0], [800, 0], [0, 500], [800, 500]].forEach(([x, y]) => assert.ok(covers(x, y), x + ',' + y));
  const z = Number(m.tiles[0].key.split('/')[0]);
  assert.strictEqual(z, 15);
  const n = 2 ** z, tx = (-0.1 + 180) / 360 * n, t = m.tiles.find((k) => k.key.split('/')[1] === String(Math.floor(tx)));
  assert.ok(Math.abs(t.left + (tx - Math.floor(tx)) * (t.size - 0.4) - pts[0][0]) < 0.3, 'the start sits on its tile');
  // two lines share one fit
  const two = R.routeMap([[[51.5, -0.1], [51.51, -0.1]], [[51.5, -0.2], [51.49, -0.21]]], 800, 500, 40);
  assert.strictEqual(two.lines.length, 2);
  assert.ok(xy(two.lines[1].d)[0][0] < xy(two.lines[0].d)[0][0], 'the western one is left');
  assert.strictEqual(Number(R.routeMap([[[51.5, -0.1], [51.50001, -0.10001]]], 800, 500, 40).tiles[0].key.split('/')[0]), 17, 'never past 17');
  assert.strictEqual(R.routeMap([[[51.5, -0.1]]], 800, 500, 40), null);
  assert.strictEqual(R.routeMap([[[51.5, -0.1], [51.5, -0.1]]], 800, 500, 40), null);
  assert.strictEqual(R.routeMap([[['a', 1], null, [51.5, -0.1]]], 800, 500, 40), null);
});

test('out and about: only with a route, two at most, the longest first', () => {
  const loop = (d) => [[51.5, -0.1], [51.5 + d, -0.1], [51.5 + d, -0.1 + d], [51.5, -0.1]];
  assert.strictEqual(find({ activities: { items: [act('alex', 'run', 'Mon', '2026-10-19', { km: 5 })] } }, 'Out and about'), undefined);
  const items = [act('alex', 'walk', 'Mon', '2026-10-19', { name: 'Short', km: 2, route: loop(0.01) }),
    act('sam', 'run', 'Tue', '2026-10-20', { name: 'Long', km: 10, route: loop(0.02) }),
    act('alex', 'cycle', 'Wed', '2026-10-21', { name: 'Middle', km: 6, route: loop(0.03) })];
  const card = find({ activities: { items } }, 'Out and about');
  assert.ok(card.html.indexOf('Long') < card.html.indexOf('Middle') && !card.html.includes('Short'));
  assert.ok(!card.html.includes('r-map-tiles') && !card.html.includes('OpenStreetMap'), 'no tiles given: the lines alone');
});

test('out and about: a street map under each route when every tile came, none when one is missing', () => {
  const R = load();
  const items = [act('sam', 'run', 'Tue', '2026-10-20', { name: 'Long', km: 10, route: [[51.5, -0.1], [51.52, -0.1], [51.52, -0.07]] })];
  const keys = R.mapTiles(stats({ activities: { items } }));
  assert.ok(keys.length >= 4 && keys.every((k) => /^\d+\/\d+\/\d+$/.test(k)));
  const all = Object.fromEntries(keys.map((k) => [k, 'http://ha/api/map_tiles/raster/' + k + '.png?token=t']));
  const card = find({ activities: { items } }, 'Out and about', { tiles: all });
  assert.strictEqual((card.html.match(/<img /g) || []).length, keys.length);
  assert.ok(card.html.includes('r-on-map') && card.html.includes('© OpenStreetMap contributors') && card.html.includes('r-route-halo'));
  delete all[keys[0]];
  assert.ok(!find({ activities: { items } }, 'Out and about', { tiles: all }).html.includes('<img '));
});

test('where we went: the last four weeks on one map, from three routes, with each person\'s count and km', () => {
  const R = load();
  const r = (d) => [[51.5 + d, -0.1], [51.51 + d, -0.1 + d]];
  const month = { first: '2026-09-28', last: '2026-10-25', items: [
    { who: 'alex', kind: 'run', date: '2026-10-02', km: 5, route: r(0) }, { who: 'sam', kind: 'walk', date: '2026-10-10', km: 3.2, route: r(0.01) },
    { who: 'alex', kind: 'walk', date: '2026-10-21', km: 7.13, route: r(0.02) }, { who: 'nobody', kind: 'walk', date: '2026-10-22', route: r(0.03) }] };
  const card = find({ month_routes: month }, 'Where we went');
  assert.strictEqual(card.sub, 'The last four weeks');
  assert.strictEqual((card.html.match(/<path class="r-p\d"/g) || []).length, 3, 'an unknown person is left out');
  assert.ok(/Alex<\/b> 2 routes · 12\.1 km/.test(card.html) && /Sam<\/b> 1 route · 3\.2 km/.test(card.html), card.html);
  assert.strictEqual(find({ month_routes: { items: month.items.slice(0, 2) } }, 'Where we went'), undefined);
  const keys = R.mapTiles(stats({ month_routes: month }));
  const tiles = Object.fromEntries(keys.map((k) => [k, 'x/' + k]));
  assert.ok(find({ month_routes: month }, 'Where we went', { tiles }).html.includes('r-map-tiles'));
});

/* ---------- what we watched ---------- */
test('what we watched: the detail with two shows or three days, else the plain card', () => {
  const plain = find({ watched: { hours: 12, top: [{ title: 'The Bear' }] } }, 'What we watched');
  assert.strictEqual(plain.value, 12);
  assert.strictEqual(plain.line, 'Mostly The Bear');
  const w = { hours: 20, top: [{ title: 'A', hours: 6 }, { title: 'B', hours: 3 }], inputs: [{ name: 'Shield', hours: 15 }, { name: 'PS5', hours: 4.5 }],
              apps: [{ name: 'Netflix', hours: 9 }, { name: 'YouTube', hours: 3 }] };
  const detail = find({ watched: w }, 'What we watched');
  assert.ok(detail.html.includes('r-shows') && detail.html.includes('6 h'));
  // where the hours went: the apps when there are two, else the inputs, as one split bar with a key
  assert.ok(/Netflix <b>9 h<\/b>/.test(detail.html) && /YouTube <b>3 h<\/b>/.test(detail.html) && !detail.html.includes('PS5'), detail.html);
  assert.ok(detail.html.includes('style="width:75.00%"'));
  const oneApp = Object.assign({}, w, { apps: [{ name: 'Netflix', hours: 9 }] });
  assert.ok(/PS5 <b>4½ h<\/b>/.test(find({ watched: oneApp }, 'What we watched').html));
  const days = find({ watched: { hours: 9, days: [{ day: 'Mon', hours: 2 }, { day: 'Tue', hours: 3 }, { day: 'Wed', hours: 4 }] } }, 'What we watched');
  assert.ok(days.html.includes('r-tvdays') && days.html.includes('<b>4</b>'), 'each day says its hours');
});

/* ---------- new recipes ---------- */
test('new recipes: a card each for the first-time ones, three at most, the picture when it loaded', () => {
  const recipes = [{ name: 'Chana masala', image: '/a.jpg', minutes: 40, servings: 4, source: 'BBC Good Food', day: 'Tuesday', first: true },
    { name: 'Old favourite', first: false }, { name: 'Pad Thai', had: 2, first: true }, { name: 'C', first: true }, { name: 'D', first: true }];
  const cards = load().build({ stats: stats({ food: { recipes } }), pictures: { '/a.jpg': 'http://ha/a.jpg' } }).filter((c) => c.label === 'New recipe');
  assert.strictEqual(cards.length, 3);
  assert.ok(cards[0].body.includes('http://ha/a.jpg') && cards[0].body.includes('First time · Tuesday'));
  assert.ok(cards[0].body.includes('40 min') && cards[0].body.includes('Serves 4') && cards[0].body.includes('BBC Good Food'));
  assert.ok(cards[1].cls.includes('r-nopic') && cards[1].body.includes('had 2 times'));
  assert.ok(!JSON.stringify(cards).includes('Old favourite'));
});

/* ---------- energy over time, and records ---------- */
const series = (n) => ({ labels: Array.from({ length: n }, (_, k) => 'W' + (30 + k)), elec: Array(n).fill(15), gas: Array(n).fill(5) });
test('energy: one card, the twelve weeks with the week, last week and last year in the line', () => {
  assert.strictEqual(find({ energy: { week_cost: 20, series: series(3) } }, 'Energy').html, undefined, 'too few weeks: the plain card');
  const s = series(14);
  s.elec[13] = 25;
  const cards = load().build({ stats: stats({ energy: { week_cost: 30, vs_last_week_pct: 12, last_year_cost: 34, series: s } }) });
  assert.strictEqual(cards.filter((c) => /Energy/.test(c.label)).length, 1, 'energy once');
  const card = cards.find((c) => c.label === 'Energy');
  assert.strictEqual((card.html.match(/r-ecol/g) || []).length, 12);
  assert.ok(!card.html.includes('>W30<') && card.html.includes('>W43<'));
  assert.strictEqual(card.line, '£30.00 this week · 12% more than last week · £4 less than a year ago');
  assert.ok(!card.html.includes('Same week last year'), 'no key for a missing last year');
  assert.ok(find({ energy: { week_cost: 20 } }, 'Energy'), 'the old card stays');
});

test('heating and hot water: the weeks as bars with the cold under each; a highlight saying the same is left out', () => {
  const weeks = ['31 Aug', '7 Sep', '14 Sep', '21 Sep', '28 Sep', '5 Oct', '12 Oct', '19 Oct'].map((label, n) => ({ label, gbp: n < 2 ? null : 6 + n, temp: 18 - n }));
  const h = { gas_gbp: 13, prev_gbp: 12, weeks, line: '£1 more than last week' };
  const extra = { highlights: [{ label: 'Heating and hot water', text: '£13' }, { label: 'Ewa’s kitchen', value: 4 }] };
  const cards = load().build({ stats: stats(Object.assign({ heating: h }, extra)) });
  const card = cards.find((c) => c.label === 'Heating and hot water');
  assert.strictEqual(cards.filter((c) => c.label === 'Heating and hot water').length, 1);
  assert.ok(cards.some((c) => c.label === 'Ewa’s kitchen'), 'other highlights stay');
  assert.strictEqual((card.html.match(/r-hcol/g) || []).length, 8);
  assert.ok(card.html.includes('>£13<') && card.html.includes('>11°<') && card.html.includes('class="r-none"'));
  assert.strictEqual(card.line, '£13.00 on gas this week · £1 more than last week');
  assert.strictEqual(find({ heating: { gas_gbp: 13, weeks: weeks.slice(0, 4) } }, 'Heating and hot water').value, 13, 'two weeks: the one number');
});

test('a bad record is said plainly, with no sparkles; a good one still celebrates', () => {
  const records = [{ text: '£38.76 on energy: the priciest week in 22 weeks', tone: 'bad' }, { text: '11,430 steps: best since August' }];
  const cards = load().build({ stats: stats({ records }) });
  const bad = cards.find((c) => c.label === 'Worth knowing'), good = cards.find((c) => c.label === 'New record');
  assert.ok(bad.body.includes('>The priciest week in 22 weeks<') && bad.body.includes('£38.76 on energy'));
  assert.ok(!bad.before, 'no burst');
  assert.ok(good.before && good.body.includes('11,430 steps'));
  assert.strictEqual(find({ records: [records[0]] }, 'New record'), undefined);
});

/* ---------- the vacuum's maps ---------- */
test('the vacuum shows its floors when their pictures loaded, else the one map', () => {
  const vacuum = { name: 'Max', cleans: 2, maps: [{ floor: 'Downstairs', picture: '/d.png', when: 'Tue 22:53', m2: 23 }, { floor: 'Upstairs', picture: '/u.png' }] };
  const two = find({ vacuum }, 'Max’s week', { pictures: { '/d.png': 'http://d', '/u.png': 'http://u' } });
  assert.ok(two.body.includes('r-floors-2') && two.body.includes('Downstairs · Tue 22:53 · 23 m²'));
  const one = find({ vacuum }, 'Max’s week', { pictures: { '/u.png': 'http://u' } });
  assert.ok(one.body.includes('r-floors-1') && !one.body.includes('Downstairs'));
  const none = find({ vacuum }, 'Max’s week', { vacuumMap: 'http://map' });
  assert.ok(!none.body.includes('r-floors') && none.body.includes('http://map'));
});

/* ---------- next week ---------- */
test('next week: a calendar, a column a day from the forecast\'s first, its weather and what\'s on, the bins too', () => {
  const next = { forecast: [{ day: 'Mon', condition: 'rainy', high: 14, low: 9 }, { day: 'Tue', condition: 'sunny', high: 16 }],
                 events: [{ day: 'Sat', time: '10:00', title: 'Boiler' }, { day: 'Tue', time: '18:30', title: 'Dinner' }, { day: 'Tue', title: 'Birthday' }],
                 bins: { day: 'Monday', what: 'Garden' } };
  const card = find({ next_week: next }, 'Next week');
  const cols = card.html.split('r-calday').slice(1);
  assert.strictEqual(cols.length, 7);
  assert.ok(cols[0].includes('>Mon<') && cols[0].includes('Garden bin') && cols[0].includes('14°'));
  assert.ok(cols[1].indexOf('Birthday') < cols[1].indexOf('Dinner') && cols[1].includes('<b>18:30</b>'), cols[1]);
  assert.ok(cols[5].includes('>Sat<') && cols[5].includes('Boiler') && cols[5].includes('r-busy'));
  assert.ok(!cols[2].includes('r-busy') && !cols[2].includes('°'), 'no forecast, nothing on: an empty day');
  const fri = find({ next_week: { forecast: [{ day: 'Fri', high: 12 }], events: [{ day: 'Thu', title: 'Party' }] } }, 'Next week');
  assert.ok(fri.html.split('r-calday')[7].includes('Party'), 'the week runs from the forecast\'s first day');
  assert.strictEqual(find({ next_week: { bins: { day: 'Monday' } } }, 'Next week').html.includes('Bins bin'), true, 'the bins make a card');
});

test('a week without restless, goals or house_says still builds', () => {
  const labels_ = labels(load().build({ stats: stats({ restless: null, goals: null, house_says: null, records: [{ text: 'A: b' }] }) }));
  assert.ok(!labels_.includes('Up in the night') && !labels_.includes('The house says'));
  assert.ok(labels_.includes('Energy'));
});

test('the week on a plate: each photo says its day and what it was; plain URLs still work', () => {
  const photos = [{ url: 'a.jpg', day: 'Mon', name: 'Chana masala' }, { url: 'b.jpg', day: 'Tue' }, 'c.jpg'];
  const card = find({ food: { photos: [], pick: null } }, 'The week on a plate', { foodPhotos: photos });
  assert.ok(card.html.includes('<b class="r-plate-name">Mon · Chana masala</b>') && card.html.includes('>Tue</b>'));
  assert.strictEqual((card.html.match(/r-plate-name/g) || []).length, 2, 'no caption without a day or a name');
  assert.ok(card.html.includes('src="c.jpg"'));
});
