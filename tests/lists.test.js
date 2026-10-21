// Shopping lists by aisle and the room's notices (app/lists.js, app/notices.js), run in Node: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, name) {
  const window = {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', file), 'utf8'), vm.createContext({ window, Array, Object, String }), { filename: file });
  return window[name];
}
const L = load('lists.js', 'HouseLists');
const N = load('notices.js', 'HouseNotices');
// Objects made in the script's context aren't this realm's, so compare them as plain JSON.
const plain = (x) => JSON.parse(JSON.stringify(x));
const item = (uid, summary, status) => ({ uid, summary, status: status || 'needs_action' });

test('open items by aisle, in walking order, other shops after the aisles', () => {
  const items = [item('1', 'Eggs'), item('2', 'Bananas'), item('3', 'Sourdough'), item('4', 'PL kabanosy'), item('5', 'Milk', 'completed'),
    item('6', 'Coconut milk'), item('7', 'Makkah: rice')];
  const got = plain(L.group(items, { cupboard: ['coconut milk'] }, true));
  assert.deepStrictEqual(got.map((s) => s.id), ['produce', 'dairy', 'cupboard', 'other', 'shop:polish', 'shop:makkah']);
  assert.deepStrictEqual(got.map((s) => s.items.map((r) => r.name)), [['Bananas'], ['Eggs'], ['Coconut milk'], ['Sourdough'], ['Kabanosy'], ['Rice']]);
  assert.strictEqual(got[0].label, 'Fruit & veg');
  assert.strictEqual(got[4].items[0].uid, '4');
});

test('the remembered aisle wins over the keywords, matched by the normalised name', () => {
  assert.strictEqual(L.aisleOf('Oat milks', { 'oat milk': 'cupboard' }).id, 'cupboard');
  assert.strictEqual(L.aisleOf('Oat milk', {}).id, 'dairy');
  assert.strictEqual(L.aisleOf('Something odd', {}).id, 'other');
  assert.strictEqual(L.normalise('Cherries (ripe)!'), 'cherry');
});

test('without an aisles sensor the list stays one section in its own order', () => {
  const got = plain(L.group([item('a', 'Zebra'), item('b', 'Apple')], null, false));
  assert.deepStrictEqual(got, [{ id: 'all', label: '', icon: '', items: [
    { uid: 'a', name: 'Zebra', item: { uid: 'a', summary: 'Zebra', status: 'needs_action' } },
    { uid: 'b', name: 'Apple', item: { uid: 'b', summary: 'Apple', status: 'needs_action' } }] }]);
  assert.deepStrictEqual(plain(L.group([], null, false)), []);
});

test('notices: this room and all, alerts before warnings before the rest, newest first, dismissed ones gone', () => {
  const items = [
    { id: 'a', title: 'Lights on', level: 'info', rooms: ['living_room'], at: '2026-10-21T21:00:00' },
    { id: 'b', title: 'Kitchen damp', level: 'warn', rooms: ['kitchen'], at: '2026-10-21T21:05:00' },
    { id: 'c', title: 'Door open', level: 'warn', rooms: ['living_room'], at: '2026-10-21T20:00:00' },
    { id: 'd', title: 'Tado login', level: 'alert', rooms: ['all'], at: '2026-10-21T19:00:00' },
    { id: 'e', title: 'Newer info', level: 'info', rooms: ['living_room'], at: '2026-10-21T22:00:00' },
    { id: 'f', title: '', level: 'alert', rooms: ['all'] }, 'junk',
  ];
  assert.deepStrictEqual(N.pick(items, 'living_room').map((n) => n.id), ['d', 'c', 'e', 'a']);
  assert.deepStrictEqual(N.pick(items, 'living_room', ['d', 'e']).map((n) => n.id), ['c', 'a']);
  assert.strictEqual(N.pick(items, '').length, 5);
  assert.deepStrictEqual(N.pick(null, 'x').length, 0);
});

test('a notice icon becomes the icons.js name; only a service action is offered', () => {
  assert.strictEqual(N.icon('mdi:robot-vacuum'), 'robotVacuum');
  assert.strictEqual(N.icon('mdi:lightbulb-group'), 'lightbulbGroup');
  assert.deepStrictEqual(plain(N.action({ action: { label: 'Lights off', service: 'light.turn_off', data: { entity_id: 'light.x' } } })),
    { name: 'Lights off', service: 'light.turn_off', data: { entity_id: 'light.x' } });
  assert.strictEqual(N.action({ action: { label: 'Open', nav: '/lights' } }), null);
  assert.strictEqual(N.action({ action: null }), null);
});
