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

test('the shower duel says who used more water this week, with the energy, when the gap is worth saying', () => {
  assert.strictEqual(showerLine({ alex: { count: 6, avg_min: 8, avg_temp: 41, litres: 210, kwh: 6.1 }, sam: { count: 6, avg_min: 12, avg_temp: 44, litres: 340, kwh: 9.8 } }),
    'Sam’s showers used 130 more litres this week, 3.7 kWh more to heat');
  assert.strictEqual(showerLine({ alex: { count: 5, avg_min: 8, litres: 300 }, sam: { count: 5, avg_min: 12, litres: 210 } }),
    'Alex’s showers used 90 more litres this week');
});

const litres = (a, b, extra) => showerLine({ alex: Object.assign({ count: 4, avg_min: 8, litres: a }, extra && extra.alex),
  sam: Object.assign({ count: 4, avg_min: 9, litres: b }, extra && extra.sam) });

test('the water gap needs 10 litres and 15% of the larger, both inclusive', () => {
  assert.strictEqual(litres(60, 50), 'Alex’s showers used 10 more litres this week');
  assert.strictEqual(litres(59, 50), '');
  assert.strictEqual(litres(100, 85), 'Alex’s showers used 15 more litres this week');
  assert.strictEqual(litres(100, 86), '');
});

test('the energy clause rounds to tenths before the 0.5 kWh threshold', () => {
  assert.strictEqual(litres(300, 200, { alex: { kwh: 2.3 }, sam: { kwh: 1.8 } }), 'Alex’s showers used 100 more litres this week, 0.5 kWh more to heat');
  assert.strictEqual(litres(300, 200, { alex: { kwh: 2.2 }, sam: { kwh: 1.8 } }), 'Alex’s showers used 100 more litres this week');
});

test('unequal shower counts are named, and the energy left out', () => {
  assert.strictEqual(litres(50, 330, { alex: { count: 1, kwh: 1 }, sam: { count: 7, kwh: 9 } }), 'Sam’s 7 showers used 280 more litres than Alex’s 1 this week');
  assert.strictEqual(litres(120, 90, { alex: { count: 1 }, sam: { count: 3 } }), 'Alex’s 1 shower used 30 more litres than Sam’s 3 this week');
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
