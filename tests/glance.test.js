// Glance lines (header chips, the status line, people's notes), run in Node: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const window = {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'glance.js'), 'utf8'),
    vm.createContext({ window, Date, Math, String }), { filename: 'glance.js' });
  return window.HouseGlance;
}
const G = load();
// Arrays made in the script's context aren't this realm's Array, so compare them as plain lists.
const list = (a) => Array.from(a);
const at = (h) => new Date(2026, 9, 21, h, 30);  // a Wednesday
const lookup = (states) => (id) => states[id];

test('the value, an attribute and any attribute fill the text', () => {
  const look = lookup({ 'sensor.dinner': { s: 'Pierogi', a: { cook: 'Sam', mins: 40 } } });
  assert.strictEqual(G.text({ entity: 'sensor.dinner', text: 'Tonight · {value}' }, look, at(18)), 'Tonight · Pierogi');
  assert.strictEqual(G.text({ entity: 'sensor.dinner', attribute: 'cook' }, look, at(18)), 'Sam');
  assert.strictEqual(G.text({ entity: 'sensor.dinner', text: '{value}, {attr.mins} min, {attr.none}' }, look, at(18)), 'Pierogi, 40 min,');
});

test('missing, unavailable, empty and hidden values say nothing', () => {
  const look = lookup({ 'todo.shop': { s: '0', a: {} }, 'sensor.off': { s: 'unavailable', a: {} }, 'sensor.blank': { s: '', a: {} } });
  assert.strictEqual(G.text({ entity: 'todo.shop', hide: ['0'] }, look, at(12)), '');
  assert.strictEqual(G.text({ entity: 'sensor.off' }, look, at(12)), '');
  assert.strictEqual(G.text({ entity: 'sensor.blank' }, look, at(12)), '');
  assert.strictEqual(G.text({ entity: 'sensor.nowhere' }, look, at(12)), '');
  assert.strictEqual(G.text({}, look, at(12)), '');
});

test('hours: from inclusive, to exclusive', () => {
  const look = lookup({ 'sensor.dinner': { s: 'Soup', a: {} } });
  const g = { entity: 'sensor.dinner', hours: [10, 21] };
  assert.strictEqual(G.text(g, look, at(9)), '');
  assert.strictEqual(G.text(g, look, at(10)), 'Soup');
  assert.strictEqual(G.text(g, look, at(21)), '');
});

test('a date value reads as today, tomorrow or the weekday, and within_days limits it', () => {
  const look = lookup({ 'sensor.bins': { s: '2026-10-22', a: { summary: 'Recycling' } }, 'sensor.far': { s: '2026-10-24T07:00:00', a: {} } });
  const g = { entity: 'sensor.bins', text: '{attr.summary} {day}', within_days: 1 };
  assert.strictEqual(G.text(g, look, at(8)), 'Recycling tomorrow');
  assert.strictEqual(G.text({ entity: 'sensor.far', text: '{day}', within_days: 1 }, look, at(8)), '');
  assert.strictEqual(G.text({ entity: 'sensor.far', text: '{day}' }, look, at(8), 'en-GB'), 'Saturday');
});

test('rotate: everything shows when it fits', () => {
  assert.deepStrictEqual(list(G.rotate(['a', '', 'b'], 3, 7)), [0, 2]);
  assert.deepStrictEqual(list(G.rotate(['a', 'b', 'c'], 0, 1)), [0, 1, 2]);
});

test('rotate: past max, the first max - 1 stay and the rest take turns in the last place', () => {
  const said = ['a', 'b', '', 'c', 'd'];
  assert.deepStrictEqual(list(G.rotate(said, 3, 0)), [0, 1, 3]);
  assert.deepStrictEqual(list(G.rotate(said, 3, 1)), [0, 1, 4]);
  assert.deepStrictEqual(list(G.rotate(said, 3, 2)), [0, 1, 3]);
  assert.deepStrictEqual(list(G.rotate(said, 1, 1)), [1]);
});

test('guests: in while the entity is in one of the states, on by default', () => {
  const look = lookup({ 'input_boolean.guests': { s: 'on', a: {} }, 'input_select.mode': { s: 'Party', a: {} } });
  assert.strictEqual(G.guestsIn({ entity: 'input_boolean.guests' }, look), true);
  assert.strictEqual(G.guestsIn({ entity: 'input_select.mode', states: ['Party', 'Guests'] }, look), true);
  assert.strictEqual(G.guestsIn({ entity: 'input_select.mode' }, look), false);
  assert.strictEqual(G.guestsIn({ entity: 'input_boolean.nope' }, look), false);
  assert.strictEqual(G.guestsIn(null, look), false);
});
