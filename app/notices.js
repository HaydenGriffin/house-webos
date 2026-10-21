/* Notices: the house's notices sensor (an `items` attribute of { id, title, message, icon: 'mdi:…', level: info|warn|alert,
   action: { label, service, data } | { label, nav } | null, rooms: [...], at, key }), reduced to what this room should see,
   most urgent first. Pure functions, so they run in Node for the tests. ES5 for the TV. */
(function () {
  'use strict';

  var RANK = { alert: 0, warn: 1, info: 2 };

  /* The live notices for room (its own and 'all'; every notice when room is empty), alert before warn before info, newest
     first within a level; hidden: ids already dismissed here. */
  function pick(items, room, hidden) {
    var list = (items || []).filter(function (n) {
      if (!n || typeof n !== 'object' || !n.title) return false;
      if (hidden && hidden.indexOf(n.id) >= 0) return false;
      if (!room) return true;
      var rooms = Array.isArray(n.rooms) ? n.rooms : ['all'];
      return rooms.indexOf(room) >= 0 || rooms.indexOf('all') >= 0;
    });
    return list.sort(function (a, b) {
      var r = rank(a) - rank(b);
      return r || String(b.at || '').localeCompare(String(a.at || ''));
    });
  }
  function rank(n) { return RANK[n.level] === undefined ? 2 : RANK[n.level]; }

  /* 'mdi:bell-outline' -> 'bellOutline', the name icons.js keys its paths by. */
  function icon(mdi) {
    return String(mdi || '').replace(/^mdi:/, '').replace(/-([a-z0-9])/g, function (m, c) { return c.toUpperCase(); });
  }

  /* The one action a TV can run: a service call (a 'nav' opens a page on a tablet or phone, so it's left out). */
  function action(n) {
    var a = n && n.action;
    return a && a.label && a.service ? { name: String(a.label), service: String(a.service), data: a.data || {} } : null;
  }

  window.HouseNotices = { pick: pick, icon: icon, action: action };
})();
