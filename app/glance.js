/* Glance lines: the one small template language shared by the header chips, the status line on the date and the notes
   under each person. Pure functions over a state lookup, so they run in Node for the tests. ES5 for the TV. */
(function () {
  'use strict';

  /* 'today', 'tomorrow' or the weekday, for a date compared with now. */
  function dayWord(d, now, locale) {
    var today = new Date(now.getTime()); today.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86400000);
    return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : d.toLocaleDateString(locale, { weekday: 'long' });
  }

  /* A list counts its items, or only those matching every key of filter: a list there means one of its values (a
     missing key reads as null), anything else must be equal. */
  function matches(item, filter) {
    if (!filter) return true;
    if (!item || typeof item !== 'object') return false;
    for (var k in filter) {
      if (!Object.prototype.hasOwnProperty.call(filter, k)) continue;
      var want = filter[k], got = item[k] === undefined ? null : item[k];
      if (Array.isArray(want) ? want.indexOf(got) < 0 : got !== want) return false;
    }
    return true;
  }
  function count(list, filter) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (matches(list[i], filter)) n++;
    return n;
  }

  /* g: { entity, attribute?, filter?, text: 'Tonight · {value}', hide?: [values], hours?: [from, to], within_days?: n }.
     {value} is the state (or the attribute; a list becomes the count of its items, see filter above), {attr.x} any
     attribute, {day} the value read as a date (today, tomorrow or the weekday). Empty, unavailable and hidden values say
     nothing, so the line or chip goes away; a count of 0 hides like "0".
     look(id) answers { s, a } for an entity, or undefined when Home Assistant hasn't sent it. */
  function text(g, look, now, locale) {
    var s = g && g.entity ? look(g.entity) : null;
    if (!s || s.s === 'unavailable' || s.s === 'unknown') return '';
    var attrs = s.a || {}, value = g.attribute ? attrs[g.attribute] : s.s;
    if (Array.isArray(value)) value = count(value, g.filter);
    if (value === undefined || value === null || value === '' || (g.hide || []).indexOf(String(value)) >= 0) return '';
    var h = now.getHours();
    if (g.hours && !(h >= g.hours[0] && h < g.hours[1])) return '';
    var day = '';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      var d = new Date(String(value).slice(0, 10) + 'T00:00:00'), today = new Date(now.getTime()); today.setHours(0, 0, 0, 0);
      var diff = Math.round((d - today) / 86400000);
      if (g.within_days !== undefined && (diff < 0 || diff > g.within_days)) return '';
      day = dayWord(d, now, locale);
    }
    return String(g.text || '{value}').replace(/\{(value|day|attr\.([a-z0-9_]+))\}/g, function (m, k, a) {
      var v = k === 'value' ? value : k === 'day' ? day : attrs[a];
      return v === undefined || v === null ? '' : String(v);
    }).replace(/\s+/g, ' ').trim();
  }

  /* Which of the chips that have something to say get a place, when only max fit: the first max - 1 stay put and the
     rest take turns in the last place, one per turn. Returns their indexes in the original list. */
  function rotate(said, max, turn) {
    var shown = [], n;
    for (n = 0; n < said.length; n++) if (said[n]) shown.push(n);
    if (!max || shown.length <= max) return shown;
    var fixed = shown.slice(0, max - 1), rest = shown.slice(max - 1);
    return fixed.concat(rest[turn % rest.length]);
  }

  /* guests: { entity, states? } (states defaults to ['on']); while it holds, anything marked private: true stays off
     screen, so sleep, training and reading stay with the household. */
  function guestsIn(guests, look) {
    var s = guests && guests.entity ? look(guests.entity) : null;
    return !!s && (guests.states || ['on']).indexOf(s.s) >= 0;
  }

  window.HouseGlance = { dayWord: dayWord, text: text, rotate: rotate, guestsIn: guestsIn, count: count };
})();
