/* House for webOS: a Home Assistant panel for LG TVs (webOS 6 = Chromium 79: no optional chaining, no ??, no flex gap).
   Everything shown comes from config.js (see config.example.json), which holds the websocket URL and a token and is
   written at install time, never committed. Arrows move, OK presses, Back closes, and a minute without a press closes
   it too. Opened with ?demo (or with demo: true in the config) it runs on demo.js's states with no Home Assistant. */
(function () {
  'use strict';

  var DEMO = window.HOUSE_DEMO || null;
  var useDemo = !!DEMO && (/[?&]demo\b/.test(location.search) || (window.HOUSE_CONFIG || {}).demo);
  var CONFIG = useDemo ? DEMO.config : window.HOUSE_CONFIG || {};
  var ICONS = window.HOUSE_ICONS || {};
  var LOCALE = CONFIG.locale || undefined;
  var IDLE_MS = (CONFIG.idle_seconds || 60) * 1000, WARN_MS = 10000;
  var LIGHTS = CONFIG.lights || [], TILES = CONFIG.tiles || [], PEOPLE = CONFIG.people || [];
  var TV = CONFIG.tv || null, MUSIC = CONFIG.music || null, RECAP = CONFIG.recap || null;
  var CALENDARS = CONFIG.calendars || [];
  var GLANCE = CONFIG.glance || [], QUICK = CONFIG.quick || [], FOOTER = CONFIG.footer || [];
  var ARM_MS = 5000;

  var states = {}, sock = null, nextId = 1, pending = {}, connected = false, everConnected = false, retry = 0;
  var lastPress = Date.now(), closing = false, toastTimer = 0, nextEvent = null, armed = null;
  var recap = null, recapStarting = false, cueSeen = null;

  function $(id) { return document.getElementById(id); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function st(id) { return states[id] || { s: 'unavailable', a: {} }; }
  function attr(id, key) { var a = st(id).a || {}; return a[key]; }
  function dead(id) { var s = st(id).s; return s === 'unavailable' || s === 'unknown'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function setIcon(el, name) {
    var path = ICONS[name]; if (!path || el.getAttribute('data-drawn') === name) return;
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
    el.setAttribute('data-drawn', name);
  }

  /* ---------- building the page from the config ---------- */
  function tileHtml(kind, n, item, icon) {
    return '<button class="tile" data-' + kind + '="' + n + '"><span class="disc" data-icon="' + esc(item.icon || icon) + '"></span>' +
      '<span class="name">' + esc(item.name) + '</span><span class="state">' + esc(item.sub || '–') + '</span></button>';
  }
  function pillHtml(cls, n, item) {
    return '<button class="pill ' + cls + '" data-tile="' + n + '"><span class="ico' + (item.confirm ? '' : ' warm') + '" data-icon="' +
      esc(item.icon || 'play') + '"></span><span class="label">' + esc(item.name) + '</span></button>';
  }
  function switchRowHtml(t) {
    return '<button class="row" id="toggle-row" role="switch" aria-checked="false"><span class="disc" data-icon="' + esc(t.icon || 'speakers') + '"></span>' +
      '<span class="text"><span class="name">' + esc(t.name) + '</span><span class="state" id="toggle-state">–</span></span>' +
      '<span class="switch" aria-hidden="true"><span></span></span></button>';
  }
  /* Tiles, sources and the wide buttons share one list of actions, indexed by data-tile. */
  var actions = [];
  function addAction(item) { actions.push(item); return actions.length - 1; }
  function build() {
    document.title = $('title').textContent = CONFIG.title || 'House';
    // Quick actions (Pause, Lights up) lead the grid, so they're the first row and the first focus while they show.
    $('rooms').innerHTML = QUICK.map(function (q) { return tileHtml('tile', addAction(q), q, 'gestureTap').replace('<button ', '<button data-quick '); }).join('') +
      LIGHTS.map(function (l, n) { return tileHtml('light', n, l, 'lightbulb'); }).join('') +
      TILES.map(function (t) { return tileHtml('tile', addAction(t), t, 'gestureTap'); }).join('');
    if (TV) {
      $('tv').hidden = false;
      $('tv-h').textContent = TV.title || 'TV';
      var sources = TV.sources || [];
      $('sources').style.gridTemplateColumns = 'repeat(' + Math.max(1, sources.length) + ', minmax(0, 1fr))';
      $('sources').innerHTML = sources.map(function (s) {
        return '<button class="seg" data-source="' + esc(s.name) + '" data-tile="' + addAction(s) + '"><span class="ico" data-icon="' +
          esc(s.icon || 'television') + '"></span>' + esc(s.name) + '</button>';
      }).join('');
      if (TV.wide) $('tv-wide').innerHTML = pillHtml('wide', addAction(TV.wide), TV.wide);
    }
    if (MUSIC && MUSIC.player) {
      $('music').hidden = false;
      $('music-h').textContent = MUSIC.title || 'Speakers';
      if (MUSIC.extra) $('play').parentNode.insertAdjacentHTML('beforeend', pillHtml('grow', addAction(MUSIC.extra), MUSIC.extra));
      if (MUSIC.toggle && MUSIC.toggle.entity) $('music-toggle').innerHTML = switchRowHtml(MUSIC.toggle);
    }
    $('people').innerHTML = PEOPLE.map(function (p, n) {
      return '<p class="chip person" data-person="' + n + '"><span class="disc initial" aria-hidden="true">' + esc(String(p.name || '?').charAt(0)) +
        '</span><span><b>' + esc(p.name) + '</b> <span class="where">–</span></span></p>';
    }).join('');
    $('chips').innerHTML = GLANCE.map(function (g, n) {
      return '<p class="chip" data-glance="' + n + '" hidden><span class="disc" data-icon="' + esc(g.icon || 'information') + '"></span><span></span></p>';
    }).join('');
    $('footer-actions').innerHTML = FOOTER.map(function (f) { return pillHtml('', addAction(f), f); }).join('');
    $('week').hidden = !(RECAP && RECAP.stats);
    all('[data-icon]').forEach(function (el) { setIcon(el, el.getAttribute('data-icon')); });
    all('button').forEach(function (b) { b.addEventListener('click', function () { lastPress = Date.now(); press(b); }); });
  }
  function entities() {
    var list = LIGHTS.map(function (l) { return l.entity; });
    TILES.forEach(function (t) { if (t.entity) list.push(t.entity); });
    if (CONFIG.door) list.push(CONFIG.door);
    if (TV && TV.source_sensor) list.push(TV.source_sensor);
    if (MUSIC && MUSIC.player) list.push(MUSIC.player);
    if (MUSIC && MUSIC.toggle && MUSIC.toggle.entity) list.push(MUSIC.toggle.entity);
    PEOPLE.forEach(function (p) { if (p.person) list.push(p.person); if (p.room) list.push(p.room); });
    if (RECAP) ['stats', 'cue', 'vacuum_map'].forEach(function (k) { if (RECAP[k]) list.push(RECAP[k]); });
    GLANCE.forEach(function (g) { list.push(g.entity); });
    QUICK.concat(FOOTER, TILES).forEach(function (t) { if (t.entity) list.push(t.entity); if (t.visible) list.push(t.visible.entity); });
    return list.filter(function (id, n) { return id && list.indexOf(id) === n; });
  }

  /* ---------- connection ---------- */
  function connect() {
    if (useDemo) return startDemo();
    if (!CONFIG.url || !CONFIG.token) return banner('House isn’t set up on this TV yet. Reinstall it with a config file.');
    try { sock = new WebSocket(CONFIG.url); } catch (e) { return reconnectLater(); }
    sock.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'auth_required') sock.send(JSON.stringify({ type: 'auth', access_token: CONFIG.token }));
      else if (m.type === 'auth_invalid') { banner('Home Assistant turned this TV’s token down. Reinstall House with a new one.'); sock.onclose = null; sock.close(); }
      else if (m.type === 'auth_ok') { retry = 0; send({ type: 'subscribe_entities', entity_ids: entities() }); }
      else if (m.type === 'event' && m.event) {
        var first = !connected;
        apply(m.event);
        if (first) { connected = everConnected = true; banner(''); loadAgenda(); }
        render();
        checkRecapCue();
        if (first && (!document.activeElement || document.activeElement === document.body)) focusFirst();
      }
      else if (m.type === 'result' && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    };
    sock.onclose = function () {
      connected = false; sock = null;
      Object.keys(pending).forEach(function (id) { pending[id]({ success: false, error: { message: 'Lost Home Assistant' } }); });
      pending = {};
      if (everConnected) banner('Reconnecting to Home Assistant…');
      render(); reconnectLater();
    };
  }
  function reconnectLater() { setTimeout(connect, [1000, 2000, 5000, 10000][Math.min(retry++, 3)]); }
  function send(msg, done) {
    msg.id = nextId++;
    if (done) pending[msg.id] = done;
    sock.send(JSON.stringify(msg));
  }
  /* subscribe_entities sends compressed states: a = added, c = changed (+ merge / - removed attrs), r = removed. */
  function apply(ev) {
    var id;
    if (ev.a) for (id in ev.a) states[id] = { s: ev.a[id].s, a: ev.a[id].a || {}, lc: ev.a[id].lc || ev.a[id].lu };
    if (ev.c) for (id in ev.c) {
      var cur = states[id] || { s: 'unknown', a: {} }, plus = ev.c[id]['+'], minus = ev.c[id]['-'];
      if (plus) {
        if (plus.s !== undefined) cur.s = plus.s;
        if (plus.lc) cur.lc = plus.lc; else if (plus.s !== undefined && plus.lu) cur.lc = plus.lu;
        if (plus.a) for (var k in plus.a) cur.a[k] = plus.a[k];
      }
      if (minus && minus.a) minus.a.forEach(function (key) { delete cur.a[key]; });
      states[id] = cur;
    }
    if (ev.r) ev.r.forEach(function (rid) { delete states[rid]; });
  }
  /* "domain.service" with optional data and target, as in a Home Assistant action. */
  function call(service, data, target) {
    var parts = String(service).split('.');
    if (useDemo) return demoCall(parts[0], parts[1], data, target);
    return new Promise(function (resolve, reject) {
      if (!connected) return reject(new Error('Home Assistant is offline. Try again when it’s back.'));
      send({ type: 'call_service', domain: parts[0], service: parts[1], service_data: data || {}, target: target }, function (m) {
        if (m.success) resolve(); else reject(new Error('That didn’t work: ' + ((m.error && m.error.message) || 'no reason given') + '.'));
      });
    });
  }
  function ask(service, data, target) {
    var parts = String(service).split('.');
    return new Promise(function (resolve, reject) {
      if (!connected || useDemo) return reject(new Error('offline'));
      send({ type: 'call_service', domain: parts[0], service: parts[1], service_data: data, target: target, return_response: true }, function (m) {
        if (m.success && m.result) resolve(m.result.response || {}); else reject(new Error('no response'));
      });
    });
  }

  /* ---------- demo mode ---------- */
  /* The page is laid out for a 1920×1080 TV; in a browser window the demo scales to fit. */
  function fitWindow() {
    document.documentElement.style.zoom = Math.min(1, window.innerWidth / 1920, window.innerHeight / 1080);
  }
  function startDemo() {
    var now = Date.now() / 1000;
    fitWindow(); window.addEventListener('resize', fitWindow);
    Object.keys(DEMO.states).forEach(function (id) {
      var s = DEMO.states[id];
      states[id] = { s: s.s, a: JSON.parse(JSON.stringify(s.a || {})), lc: now - (s.ago || 0) };
    });
    if (DEMO.recap && RECAP && RECAP.stats) {
      var stats = DEMO.recap();
      states[RECAP.stats] = { s: 'ok', a: { stats: stats }, lc: now };
    }
    nextEvent = DEMO.nextEvent ? DEMO.nextEvent() : null;
    connected = everConnected = true;
    banner(''); render(); focusFirst();
    if (/[?&]recap\b/.test(location.search)) setTimeout(function () { openRecap(/[?&]auto\b/.test(location.search)); }, 300);
  }
  /* Demo calls change the demo states the way Home Assistant would, so the page answers presses. */
  function demoCall(domain, service, data, target) {
    var ids = [].concat((target && target.entity_id) || (data && data.entity_id) || []);
    ids.forEach(function (id) {
      var s = states[id]; if (!s) return;
      if (service === 'toggle') s.s = s.s === 'on' ? 'off' : 'on';
      if (service === 'media_play_pause') s.s = s.s === 'playing' ? 'paused' : 'playing';
      if (service === 'turn_on' && data && data.brightness_step_pct) {
        var bri = Math.max(0, Math.min(255, (s.s === 'on' ? s.a.brightness || 255 : 0) + Math.round(data.brightness_step_pct * 2.55)));
        s.s = bri ? 'on' : 'off'; s.a.brightness = bri || undefined;
      }
      if (/light\./.test(id) && s.s === 'on' && !s.a.brightness) s.a.brightness = 191;
    });
    if (domain === 'script' && TV && TV.source_sensor) {
      (TV.sources || []).forEach(function (src) {
        var tid = src.action && src.action.target && src.action.target.entity_id;
        if (ids.length && [].concat(tid || []).indexOf(ids[0]) >= 0) states[TV.source_sensor].s = src.name;
      });
    }
    return new Promise(function (resolve) { setTimeout(resolve, 250); });
  }

  /* ---------- the agenda: the next event in the configured calendars over the coming week ---------- */
  function loadAgenda() {
    if (!CALENDARS.length) return;
    ask('calendar.get_events', { duration: { days: 7 } }, { entity_id: CALENDARS }).then(function (res) {
      var now = Date.now(), best = null;
      Object.keys(res).forEach(function (cal) {
        ((res[cal] && res[cal].events) || []).forEach(function (e) {
          var allDay = String(e.start).length <= 10, start = allDay ? new Date(e.start + 'T00:00:00') : new Date(e.start);
          var end = allDay ? new Date(e.end + 'T00:00:00') : new Date(e.end);
          if (end.getTime() <= now || (!allDay && start.getTime() < now)) return;
          if (!best || start < best.start) best = { start: start, allDay: allDay, title: e.summary || 'Event' };
        });
      });
      nextEvent = best; render();
    }, function () { nextEvent = null; render(); });
  }
  function dayWord(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86400000);
    return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : d.toLocaleDateString(LOCALE, { weekday: 'long' });
  }
  function sentence(t) { t = String(t); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); }
  function hhmm(d) { return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }); }

  /* ---------- rendering ---------- */
  function onText(id, item) {
    if (dead(id)) return 'Unavailable';
    if (st(id).s !== 'on') return item.off || 'Off';
    var bri = attr(id, 'brightness');
    return item.on || (bri ? 'On · ' + Math.max(1, Math.round(bri / 2.55)) + '%' : 'On');
  }
  function render() {
    $('house').setAttribute('aria-busy', connected ? 'false' : 'true');
    all('button').forEach(function (b) { if (b.id !== 'close' && !b.hasAttribute('aria-busy')) b.disabled = !connected; });

    all('[data-light]').forEach(function (b) {
      var l = LIGHTS[+b.getAttribute('data-light')], on = st(l.entity).s === 'on';
      b.classList.toggle('on', on);
      b.querySelector('.state').textContent = onText(l.entity, l);
      if (dead(l.entity)) b.disabled = true;
    });
    all('.tile[data-tile]').forEach(function (b) {
      var t = actions[+b.getAttribute('data-tile')];
      if (!t.entity) return;
      b.classList.toggle('on', st(t.entity).s === 'on');
      b.querySelector('.state').textContent = t.sub && st(t.entity).s !== 'on' ? t.sub : onText(t.entity, t);
    });

    // The door only takes space when it needs a look.
    var door = $('door');
    door.hidden = !CONFIG.door || st(CONFIG.door).s !== 'on';
    if (CONFIG.door) door.lastChild.textContent = (CONFIG.door_name || 'Door open') + since(st(CONFIG.door).lc);

    PEOPLE.forEach(function (p, n) {
      var chip = document.querySelector('[data-person="' + n + '"]'), ps = st(p.person).s, room = p.room ? st(p.room).s : '';
      var home = ps === 'home', where = home ? (!p.room || dead(p.room) || /away|not_home|unknown/i.test(room) ? 'Home' : sentence(room))
        : ps === 'not_home' ? 'Out' : dead(p.person) ? '–' : ps;
      chip.classList.toggle('out', !home);
      chip.querySelector('.where').textContent = where;
    });

    $('date').textContent = new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
    var next = $('next'), ready = weekReady();
    next.hidden = !nextEvent && !ready;
    next.classList.toggle('ask', !!ready);
    if (ready) next.textContent = 'Your week at home is ready · This week, below';
    else if (nextEvent) next.textContent = 'Next ' + sentence(dayWord(nextEvent.start)) + (nextEvent.allDay ? '' : ' ' + hhmm(nextEvent.start)) + ' · ' + nextEvent.title;

    GLANCE.forEach(function (g, n) {
      var chip = document.querySelector('[data-glance="' + n + '"]'), text = glanceText(g);
      chip.hidden = !text;
      if (text) chip.lastChild.textContent = text;
    });
    all('#footer-actions [data-tile], .tile[data-tile]').forEach(function (b) {
      b.hidden = !visibleNow(actions[+b.getAttribute('data-tile')]);
    });

    if (TV) {
      var src = TV.source_sensor, source = src ? st(src).s : '';
      $('tv-line').textContent = !src ? '' : dead(src) ? 'TV status unavailable' : (attr(src, 'line') || source);
      all('[data-source]').forEach(function (b) {
        var sel = b.getAttribute('data-source') === source;
        b.classList.toggle('selected', sel); b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      });
    }

    if (MUSIC && MUSIC.player) {
      var p = MUSIC.player, sp = st(p), playing = sp.s === 'playing', title = attr(p, 'media_title'), shown = title && (playing || sp.s === 'paused');
      $('track').textContent = dead(p) ? 'Speakers unavailable' : shown ? title : 'Nothing playing';
      $('artist').textContent = shown ? (attr(p, 'media_artist') || '') + (sp.s === 'paused' ? ' · paused' : '') : '';
      setIcon($('play').querySelector('.ico'), playing ? 'pause' : 'play');
      $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
      if (dead(p)) all('#music button').forEach(function (b) { b.disabled = true; });
      var t = MUSIC.toggle, row = $('toggle-row');
      if (row) {
        var inc = st(t.entity).s === 'on';
        row.classList.toggle('on', inc); row.setAttribute('aria-checked', inc ? 'true' : 'false');
        $('toggle-state').textContent = dead(t.entity) ? 'Unavailable' : inc ? (t.on || 'On') : (t.off || 'Off');
        if (dead(t.entity)) row.disabled = true;
      }
    }
  }
  /* visible: { entity, states: [...] } shows an action only while the entity is in one of those states. */
  function visibleNow(item) {
    var v = item && item.visible;
    return !v || !v.entity || (v.states || ['on']).indexOf(st(v.entity).s) >= 0;
  }
  /* A glance chip: { entity, attribute?, text: 'Tonight · {value}', icon?, hide?: [values], hours?: [from, to],
     within_days?: n }. {value} is the state (or the attribute), {attr.x} any attribute, {day} the value read as a date
     (today, tomorrow or the weekday). Empty, unavailable and hidden values show no chip. */
  function glanceText(g) {
    if (!g.entity || dead(g.entity)) return '';
    var value = g.attribute ? attr(g.entity, g.attribute) : st(g.entity).s;
    if (value === undefined || value === null || value === '' || (g.hide || []).indexOf(String(value)) >= 0) return '';
    var h = new Date().getHours();
    if (g.hours && !(h >= g.hours[0] && h < g.hours[1])) return '';
    var day = '';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      var d = new Date(String(value).slice(0, 10) + 'T00:00:00'), today = new Date(); today.setHours(0, 0, 0, 0);
      var diff = Math.round((d - today) / 86400000);
      if (g.within_days !== undefined && (diff < 0 || diff > g.within_days)) return '';
      day = dayWord(d);
    }
    return String(g.text || '{value}').replace(/\{(value|day|attr\.([a-z0-9_]+))\}/g, function (m, k, a) {
      var v = k === 'value' ? value : k === 'day' ? day : attr(g.entity, a);
      return v === undefined || v === null ? '' : String(v);
    }).replace(/\s+/g, ' ').trim();
  }
  function since(lc) {
    if (!lc) return '';
    var min = Math.floor((Date.now() / 1000 - lc) / 60);
    return min < 1 ? '' : ' · ' + min + ' min';
  }
  function banner(text) { $('banner').textContent = text; $('banner').hidden = !text; }
  function toast(text, error) {
    var t = $('toast'); t.textContent = text; t.className = error ? 'error' : ''; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, error ? 6000 : 2500);
  }

  /* ---------- week recap ---------- */
  /* Hours the TV was on over the last 7 days, from its own history; null if that can't be read. */
  function tvHours(done) {
    var end = new Date(), start = new Date(end.getTime() - 7 * 86400000), answered = false, tv = RECAP.tv;
    function once(v) { if (!answered) { answered = true; done(v); } }
    setTimeout(function () { once(null); }, 4000);
    if (!connected || useDemo || !tv) return once(null);
    send({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
           entity_ids: [tv], minimal_response: true, no_attributes: true }, function (m) {
      var rows = m.success && m.result ? m.result[tv] || [] : null;
      if (!rows) return once(null);
      var on = 0, endS = end.getTime() / 1000;
      rows.forEach(function (r, n) {
        var from = Math.max(r.lu || r.lc || 0, start.getTime() / 1000), next = rows[n + 1], to = next ? (next.lu || next.lc) : endS;
        if (r.s === 'on' && to > from) on += to - from;
      });
      once(on / 3600);
    });
  }
  function backTo() {
    var s = TV && TV.source_sensor ? st(TV.source_sensor).s : '';
    return (TV && (TV.sources || []).some(function (x) { return x.name === s; })) ? s : 'the TV';
  }
  /* Home Assistant's own address, from the websocket's (ws://host:8123/api/websocket → http://host:8123). */
  function haBase() { return String(CONFIG.url || '').replace(/^ws/, 'http').replace(/\/api\/websocket\/?$/, ''); }
  /* A camera's picture as an absolute URL: entity_picture is /api/camera_proxy/<id>?token=…, and the subscription keeps
     the rotating token current. */
  function cameraPicture(id) {
    var pic = id && attr(id, 'entity_picture');
    if (!pic || dead(id)) return '';
    return /^(https?:|data:)/.test(pic) || useDemo ? pic : haBase() + pic;
  }
  /* Food pictures, loaded before the recap starts so the collage never shows a gap; done(urls) gets the ones that loaded,
     in order, within 5 s. Paths under /api/ need a signed-in user, so auth/sign_path signs each for 10 minutes instead of
     anything being made public. */
  function foodPhotos(paths, done) {
    var list = (paths || []).filter(function (p) { return typeof p === 'string' && p; }).slice(0, 8);
    var got = [], left = list.length, answered = false;
    function once() { if (!answered) { answered = true; done(got.filter(Boolean)); } }
    function settle() { if (--left <= 0) once(); }
    function load(n, url) {
      var img = new Image();
      img.onload = function () { got[n] = url; settle(); };
      img.onerror = settle;
      img.src = url;
    }
    if (!left) return once();
    setTimeout(once, 5000);
    list.forEach(function (p, n) {
      if (/^(https:\/\/|data:)/.test(p) || useDemo) return load(n, p);
      if (p.charAt(0) !== '/') return settle();
      if (p.indexOf('/api/') !== 0) return load(n, haBase() + p);
      if (!connected) return settle();
      send({ type: 'auth/sign_path', path: p, expires: 600 }, function (m) {
        if (m.success && m.result && m.result.path) load(n, haBase() + m.result.path); else settle();
      });
    });
  }
  /* A producer whose stats don't follow docs/recap-stats.md can be reshaped by window.HOUSE_STATS_ADAPTER, a function
     defined in config.js (push_config.py --adapter). A failing adapter leaves the stats as they came. */
  function adaptStats(stats) {
    var fn = window.HOUSE_STATS_ADAPTER;
    if (!stats || typeof fn !== 'function') return stats;
    try { return fn(JSON.parse(JSON.stringify(stats))) || stats; } catch (e) { return stats; }
  }
  /* auto: started by the cue script with nobody at the remote; House closes when it ends. */
  function openRecap(auto) {
    if (recapStarting || !RECAP) return;
    if (recap) { recap.stop(); recap = null; }
    recapStarting = true;
    var rawStats = attr(RECAP.stats, RECAP.attribute || 'stats'), stats = adaptStats(rawStats), hours = null, photos = [], waiting = 2;
    tvHours(function (h) { hours = h; ready(); });
    foodPhotos(stats && stats.food && stats.food.photos, function (p) { photos = p; ready(); });
    function ready() {
      if (--waiting) return;
      recapStarting = false;
      var vac = stats && stats.vacuum;
      var cards = window.HouseRecap.build({ stats: stats, tvHours: hours, foodPhotos: photos, locale: LOCALE,
        vacuumMap: useDemo ? DEMO.vacuumMap : cameraPicture((vac && vac.map_entity) || RECAP.vacuum_map), backTo: backTo(), now: useDemo && DEMO.now ? DEMO.now() : null });
      if (!cards.length) {
        if (auto) return close();
        return toast('The week recap isn’t ready yet.');
      }
      lastPress = Date.now();
      var cueRunning = RECAP.cue && st(RECAP.cue).s === 'on';
      recap = window.HouseRecap.play($('recap'), cards, { auto: auto, idleMs: (RECAP.idle_minutes || 10) * 60000, onEnd: function (reason) {
        recap = null; lastPress = Date.now();
        if (auto || cueRunning) recapDone(reason);
        markSeen(rawStats);
        if (auto) return close();
        $('week').focus();
      } });
    }
  }
  /* recap.done: the action that tells Home Assistant the recap is over and why ('done', 'back', 'idle', 'left'), so the
     cue script can finish at once instead of waiting out a timer. */
  function recapDone(reason) {
    var d = RECAP && RECAP.done;
    if (!d || !d.service || useDemo) return;
    var data = {}, k;
    for (k in d.data || {}) data[k] = d.data[k];
    data.reason = reason;
    call(d.service, data, d.target).then(null, function () {});
  }
  /* The cue script stays running while the recap plays, so its run (by last_triggered) is the cue, once per run. A
     non-admin user can't subscribe to custom events, so the script's own state is the signal. */
  function checkRecapCue() {
    if (!RECAP || !RECAP.cue) return;
    var cue = st(RECAP.cue), when = attr(RECAP.cue, 'last_triggered');
    if (cue.s !== 'on' || !when || when === cueSeen) return;
    cueSeen = when;
    if (Date.now() - new Date(String(when).replace(/(\.\d{3})\d+/, '$1')).getTime() < 180000) openRecap(true);
  }

  /* ---------- presses ---------- */
  function run(item) {
    if (item.action && item.action.service) return call(item.action.service, item.action.data, item.action.target);
    if (item.entity) return call('homeassistant.toggle', {}, { entity_id: item.entity });
    return null;
  }
  function press(b) {
    if (b.id === 'close') return close();
    if (b.id === 'week') return openRecap(false);
    if (b.disabled || b.hasAttribute('aria-busy')) return;
    if (armed && armed !== b) disarm();
    var job = null, done = '';
    if (b.hasAttribute('data-light')) job = run(LIGHTS[+b.getAttribute('data-light')]);
    else if (b.hasAttribute('data-tile')) {
      var item = actions[+b.getAttribute('data-tile')];
      if (item.confirm && armed !== b) return arm(b, item);
      disarm();
      job = run(item); done = item.toast || '';
    }
    else if (b.id === 'toggle-row') {
      var t = MUSIC.toggle, a = st(t.entity).s === 'on' ? t.action_off : t.action_on;
      job = a && a.service ? call(a.service, a.data, a.target) : call('homeassistant.toggle', {}, { entity_id: t.entity });
    }
    else if (b.getAttribute('data-act') === 'music_toggle') job = call('media_player.media_play_pause', {}, { entity_id: MUSIC.player });
    else if (b.getAttribute('data-act') === 'music_next') job = call('media_player.media_next_track', {}, { entity_id: MUSIC.player });
    if (!job) return;
    b.setAttribute('aria-busy', 'true');
    job.then(function () { if (done) toast(done); }, function (e) { toast(e.message, true); })
      .then(function () { b.removeAttribute('aria-busy'); render(); });
  }

  /* A light's step (default 10%) up or down; down on a light that's off does nothing, up turns it on at one step. */
  function dim(b, dir) {
    if (!b || !b.hasAttribute('data-light') || b.disabled) return;
    var l = LIGHTS[+b.getAttribute('data-light')];
    if (dir < 0 && st(l.entity).s !== 'on') return;
    call('light.turn_on', { brightness_step_pct: dir * (l.step || 10) }, { entity_id: l.entity })
      .then(render, function (e) { toast(e.message, true); });
  }

  /* The one confirm pattern for risky actions: the first press arms the button ("Tap again to …", red) for 5 s. */
  function arm(b, item) {
    disarm();
    armed = b;
    b.classList.add('armed');
    labelOf(b).textContent = typeof item.confirm === 'string' ? item.confirm : 'Press again';
    armed.timer = setTimeout(disarm, ARM_MS);
  }
  function disarm() {
    if (!armed) return;
    var b = armed; armed = null;
    clearTimeout(b.timer);
    b.classList.remove('armed');
    labelOf(b).textContent = actions[+b.getAttribute('data-tile')].name;
  }
  function labelOf(b) { return b.querySelector('.label') || b.querySelector('.name'); }

  /* ---------- the week recap, asked for rather than sprung: fresh stats nobody has played yet ---------- */
  function statsId(stats) { return stats && stats.generated_at ? String(stats.generated_at) : ''; }
  function weekReady() {
    if (!RECAP || !RECAP.stats || RECAP.ask === false || recap) return false;
    var stats = attr(RECAP.stats, RECAP.attribute || 'stats'), id = statsId(stats);
    if (!id || (Date.now() - new Date(id).getTime()) / 86400000 > 6) return false;
    try { return window.localStorage.getItem('house.recap.seen') !== id; } catch (e) { return false; }
  }
  function markSeen(stats) {
    try { if (statsId(stats)) window.localStorage.setItem('house.recap.seen', statsId(stats)); } catch (e) { /* private mode */ }
  }

  /* ---------- remote: arrows move by geometry, OK presses, Back closes ---------- */
  function focusables() { return all('button').filter(function (b) { return !b.disabled && b.offsetParent !== null; }); }
  function focusFirst() {
    var quick = focusables().filter(function (b) { return b.hasAttribute('data-quick'); })[0];
    var f = quick || (weekReady() && !$('week').hidden ? $('week') : null) || focusables()[0];
    if (f) f.focus();
  }
  /* Nearest control in the pressed direction by edge distance; one that overlaps the current control across the
     direction of travel wins over a closer diagonal one, so Down from Pause lands on the row under it. */
  function move(key) {
    var from = document.activeElement, list = focusables();
    if (!from || list.indexOf(from) < 0) return list[0] && list[0].focus();
    var o = from.getBoundingClientRect(), vertical = key === 38 || key === 40, best = null, score = Infinity;
    list.forEach(function (b) {
      if (b === from) return;
      var r = b.getBoundingClientRect(), ahead;
      if (key === 37) ahead = o.left - r.right; else if (key === 39) ahead = r.left - o.right;
      else if (key === 38) ahead = o.top - r.bottom; else ahead = r.top - o.bottom;
      if (ahead < -8) return;
      var across = vertical ? Math.max(0, r.left - o.right, o.left - r.right) : Math.max(0, r.top - o.bottom, o.top - r.bottom);
      var s = Math.max(0, ahead) + (across > 0 ? 1000 + across * 2 : 0);
      if (s < score) { score = s; best = b; }
    });
    if (best) best.focus();
  }
  document.addEventListener('keydown', function (e) {
    lastPress = Date.now();
    // 461 is the LG remote's Back key.
    // In the recap: Play (415), Pause (19), Play/Pause (463, 179) and Down hold or resume the card; OK resumes a held card
    // and otherwise steps on like Right. These are the app's own key handlers; nothing on the TV is remapped.
    if (recap) {
      e.preventDefault();
      var k = e.keyCode;
      if (k === 461 || k === 27 || k === 8) recap.back();
      else if (k === 415) recap.resume();
      else if (k === 19) recap.pause();
      else if (k === 463 || k === 179 || k === 40 || k === 32) recap.toggle();
      else if (k === 37) recap.prev();
      else if (k === 13 && recap.paused()) recap.resume();
      else if (k === 39 || k === 13) recap.next();
      return;
    }
    if (e.keyCode === 461 || e.keyCode === 27 || e.keyCode === 8) { e.preventDefault(); return close(); }
    if (e.keyCode >= 37 && e.keyCode <= 40) { e.preventDefault(); return move(e.keyCode); }
    // CH + and CH − (Page Up and Page Down in a browser) brighten and dim the light in focus.
    if (e.keyCode === 33 || e.keyCode === 34) { e.preventDefault(); return dim(document.activeElement, e.keyCode === 33 ? 1 : -1); }
    if (e.keyCode === 13) {
      e.preventDefault();
      var a = document.activeElement;
      if (a && a.tagName === 'BUTTON') press(a); else move(40);
    }
  });
  $('recap').addEventListener('click', function () { lastPress = Date.now(); if (recap) recap.next(); });
  // The Magic Remote pointer jitters while the remote lies on the sofa, so only a real movement counts as a press.
  var pointer = null;
  document.addEventListener('mousemove', function (e) {
    if (pointer && Math.abs(e.screenX - pointer[0]) + Math.abs(e.screenY - pointer[1]) > 24) lastPress = Date.now();
    pointer = [e.screenX, e.screenY];
  });
  document.addEventListener('wheel', function () { lastPress = Date.now(); });

  /* ---------- closing ---------- */
  function close() {
    if (useDemo) return;
    if (closing) return; closing = true;
    // Paint black first so a slow close never shows a stale frame.
    document.body.style.visibility = 'hidden';
    window.close();
    setTimeout(function () { closing = false; document.body.style.visibility = ''; }, 3000);
  }
  // A relaunch (the app's shortcut again while open) is a fresh visit.
  document.addEventListener('webOSRelaunch', function () { lastPress = Date.now(); closing = false; document.body.style.visibility = ''; });
  // webOS freezes a hidden app's timers, so a timed close never runs once another input has the screen: close as it
  // goes instead of staying suspended in the TV's memory.
  document.addEventListener('visibilitychange', function () {
    if (useDemo) return;
    if (document.hidden) { if (recap) { recap.end('left'); recap = null; } closing = false; close(); return; }
    lastPress = Date.now(); closing = false; document.body.style.visibility = '';
  });

  function tick() {
    if (recap || recapStarting || useDemo) lastPress = Date.now();  // the recap times itself; the demo never closes
    var now = new Date(), left = IDLE_MS - (Date.now() - lastPress);
    $('clock').textContent = useDemo && DEMO.clock ? DEMO.clock : now.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
    var idle = $('idle'), soon = left <= WARN_MS && !recap;
    idle.hidden = !soon;
    if (soon) idle.textContent = 'Closing in ' + Math.max(0, Math.ceil(left / 1000)) + ' s · press any button to stay';
    if (!closing && left <= 0) close();
    if (now.getSeconds() === 0 || (CONFIG.door && st(CONFIG.door).s === 'on')) render();
  }

  build();
  render(); tick(); setInterval(tick, 1000);
  banner('');
  $('track').textContent = 'Connecting to Home Assistant…';
  connect();
  focusFirst();
})();
