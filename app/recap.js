/* "Your week at home": a Wrapped-style recap as full-screen cards, one idea each: a hero number or picture and at most one
   line. Cards come from one stats object (docs/recap-stats.md) that any producer can write to a sensor attribute; a card
   whose data is missing is left out rather than shown empty. Up to two people face each other in the duels and keep one
   colour each. Reveal cards (intro badge, quiz, guess, winner) hold something back until revealAt; a press of Right
   reveals early, the next press moves on. Chromium 79: ES5, no flex gap. */
(function () {
  'use strict';

  var CARD_MS = 5000, COUNT_MS = 1100, STATS_MAX_AGE_DAYS = 8;
  var ICONS = window.HOUSE_ICONS || {};
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var LOCALE, CURRENCY = 'GBP', P = [];

  function num(v) { return typeof v === 'number' && isFinite(v); }
  function money(v, digits) {
    var d = digits === undefined ? 2 : digits;
    try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
    catch (e) { return CURRENCY + ' ' + v.toFixed(d); }
  }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function andList(list) {
    return list.length < 2 ? (list[0] || '') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }
  function half(v) {
    var h = Math.round(v * 2) / 2, whole = Math.floor(h);
    return h % 1 ? (whole ? whole + '½' : '½') : String(h);
  }
  function svg(name) {
    return ICONS[name] ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>' : '';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function daysAgo(dateStr, now) {
    var d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
    return isNaN(d) ? Infinity : (now - d) / 86400000;
  }
  function thousands(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function str(v) { return typeof v === 'string' && v ? v : ''; }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /* Icon names in the stats are MDI names, camelCase or kebab ("weather-night", "mdi:owl"); unknown ones get a sparkle. */
  function iconFor(name) {
    var key = String(name || '').replace(/^mdi:/, '').replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
    return ICONS[key] ? key : 'starFourPoints';
  }
  /* stats.people: up to two {id, name}. Per-person figures are keyed by id; winners may be given by id or name. */
  function setPeople(list) {
    P = (list || []).filter(function (p) { return p && (p.id || p.name); }).slice(0, 2).map(function (p, n) {
      return { id: String(p.id || p.name).toLowerCase(), name: String(p.name || p.id), cls: 'r-p' + (n + 1), side: 'p' + (n + 1) };
    });
  }
  function person(x) {
    var k = String(x || '').toLowerCase();
    for (var n = 0; n < P.length; n++) if (P[n].id === k || P[n].name.toLowerCase() === k) return P[n];
    return null;
  }
  function who(x) { var p = person(x); return p ? p.cls : ''; }
  function nameOf(x) { var p = person(x); return p ? p.name : String(x || ''); }
  function other(x) { var p = person(x); return p === P[0] ? P[1] : P[0]; }
  function duo() { return P.length === 2; }
  function of2(obj) { return obj ? [obj[P[0].id], obj[P[1].id]] : [undefined, undefined]; }

  function delay(s) { return ' style="transition-delay:' + s.toFixed(2) + 's"'; }
  function hm(m) { return Math.floor(m / 60) + 'h ' + ('0' + Math.round(m % 60)).slice(-2) + 'm'; }
  function labelHtml(icon, label, cls) {
    return '<p class="r-label r-step' + (cls ? ' ' + cls : '') + '"><span class="disc">' + svg(icon) + '</span><span>' + esc(label) + '</span></p>';
  }

  /* ---------- the cards ---------- */

  function freshStats(s, now) {
    if (!s || typeof s !== 'object') return null;
    var made = new Date(s.generated_at);
    return isNaN(made) || (now - made) / 86400000 > STATS_MAX_AGE_DAYS ? null : s;
  }

  /* The intro: the title, then the week's badge revealed in its place. */
  function intro(now, window_, badge) {
    var pre = '<div class="r-phase r-pre">' + labelHtml('calendarWeek', now.toLocaleDateString(LOCALE, { weekday: 'long' })) +
      '<h2 class="r-title r-step">Your week at home</h2>' + '<p class="r-line r-step">' + esc(window_) + '</p></div>';
    if (!badge || !str(badge.title)) return { kind: 'intro', icon: 'calendarWeek', label: 'Your week at home', body: pre, ms: 4500 };
    var post = '<div class="r-phase r-post">' +
      '<p class="r-label r-hold"><span class="disc r-badge-disc">' + svg(iconFor(badge.icon)) + '</span><span>This week you were</span></p>' +
      '<h2 class="r-badge r-hold">' + esc(badge.title) + '</h2>' +
      (str(badge.why) ? '<p class="r-line r-hold">' + esc(badge.why) + '</p>' : '') + '</div>';
    return { kind: 'intro', icon: iconFor(badge.icon), label: 'Your week at home', body: '<div class="r-phases">' + pre + post + '</div>',
             revealAt: 2200, ms: 6000 };
  }

  /* Two people facing each other across a week of paired bars; the belt sits by its holder's name. */
  function sideHtml(p, value, belt) {
    return '<div class="r-side r-side-' + p.side + '"><p class="r-who ' + p.cls + '">' + esc(p.name) +
      (belt ? '<span class="r-belt" title="Belt"><i>' + svg('starFourPoints') + '</i></span>' : '') + '</p>' +
      '<p class="r-side-n">' + esc(value) + '</p></div>';
  }
  function pairBars(rows) {
    var nums = [];
    rows.forEach(function (r) { of2(r).forEach(function (v) { if (num(v)) nums.push(v); }); });
    var top = Math.max.apply(null, nums.concat([1]));
    function bar(v, p, winner) {
      var lost = winner && winner !== p ? ' r-lost' : '';
      return num(v) ? '<span class="r-pbar ' + p.cls + lost + '" style="height:' + Math.max(8, Math.round(v / top * 230)) + 'px"></span>'
        : '<span class="r-pbar r-none"></span>';
    }
    return '<div class="r-pairs">' + rows.map(function (r) {
      var winner = person(r.winner), v = of2(r);
      return '<div class="r-pair"><div class="r-pair-bars">' + bar(v[0], P[0], winner) + bar(v[1], P[1], winner) + '</div>' +
        '<p class="r-pair-day">' + esc(r.day || '') + '</p></div>';
    }).join('') + '</div>';
  }
  function versus(v1, v2, rows, beltHolder) {
    var holder = person(beltHolder);
    return '<div class="r-versus">' + sideHtml(P[0], v1, holder === P[0]) + (rows.length ? pairBars(rows) : '<div class="r-pairs"></div>') +
      sideHtml(P[1], v2, holder === P[1]) + '</div>';
  }
  function vsLabel(what) { return what + ': ' + P[0].name + ' vs ' + P[1].name; }

  function beltLine(b) {
    if (!b || !who(b.holder)) return '';
    var h = nameOf(b.holder);
    if (b.status === 'first') return h + ' takes the first belt';
    if (b.status === 'new') return 'New champion: ' + h + (str(b.previous) ? ' takes the belt from ' + nameOf(b.previous) : ' takes the belt');
    if (b.status === 'defends') return h + ' keeps the belt' + (num(b.weeks) && b.weeks > 1 ? ', ' + b.weeks + ' weeks running' : '');
    return '';
  }

  /* Steps: both totals over the week's paired bars, the score, and the belt. */
  function stepsDuel(d, belt) {
    if (!duo() || !d || !d.wins) return null;
    var w = of2(d.wins), t = of2(d.totals || {});
    if (!num(w[0]) || !num(w[1]) || !(w[0] || w[1])) return null;
    function total(v) { return num(v) ? thousands(v) : '–'; }
    var line = w[0] === w[1] ? 'All square this week, ' + w[0] + '–' + w[1]
      : (w[0] > w[1] ? P[0] : P[1]).name + ' takes the week ' + Math.max(w[0], w[1]) + '–' + Math.min(w[0], w[1]);
    var sub = beltLine(belt);
    return { icon: 'shoePrint', label: vsLabel('Steps'), html: versus(total(t[0]), total(t[1]), (d.days || []).filter(Boolean), sub ? belt.holder : ''),
             line: line, sub: sub, cls: 'r-widecard', ms: 5000 };
  }

  /* Sleep: each average night over the seven nights side by side, and one line: the bedtime race when it was
     lopsided, else who slept longer. */
  function sleepDuel(s) {
    if (!duo() || !s || !s.avg) return null;
    var a = of2(s.avg);
    if (!(num(a[0]) && a[0] > 0 || num(a[1]) && a[1] > 0)) return null;
    function side(m) { return num(m) && m > 0 ? hm(m) : '–'; }
    var race = s.bed_race, line = '';
    if (race && who(race.who) && num(race.nights) && num(race.of)) {
      line = nameOf(race.who) + ' beat ' + other(race.who).name + ' to bed ' + race.nights + ' nights out of ' + race.of;
    } else if (num(a[0]) && num(a[1]) && Math.abs(a[0] - a[1]) >= 5) {
      line = (a[0] > a[1] ? P[0] : P[1]).name + ' slept ' + Math.round(Math.abs(a[0] - a[1])) + ' minutes longer a night';
    }
    return { icon: 'bed', label: vsLabel('Sleep'), html: versus(side(a[0]), side(a[1]), (s.nights || []).filter(Boolean), ''),
             line: line, cls: 'r-widecard', ms: 4500 };
  }

  /* Daily goals: each person's days with their own goal met (rings, steps, anything), a tick pair per day. */
  function goalsDuel(r) {
    if (!duo() || !r) return null;
    var g = of2(r);
    if (!g[0] || !g[1] || !num(g[0].hit) || !num(g[0].of) || !num(g[1].hit) || !num(g[1].of) || g[0].of < 4 || g[1].of < 4) return null;
    var ticks = '<div class="r-pairs r-ticks">' + (r.days || []).filter(Boolean).map(function (d) {
      function dot(v, p) { return '<span class="r-tick ' + p.cls + (v === true ? ' r-on' : v === false ? '' : ' r-none') + '"></span>'; }
      var v = of2(d);
      return '<div class="r-pair"><div class="r-pair-bars">' + dot(v[0], P[0]) + dot(v[1], P[1]) + '</div>' +
        '<p class="r-pair-day">' + esc(d.day || '') + '</p></div>';
    }).join('') + '</div>';
    var html = '<div class="r-versus">' + sideHtml(P[0], g[0].hit + '/' + g[0].of) + ticks + sideHtml(P[1], g[1].hit + '/' + g[1].of) + '</div>';
    var win = person(r.winner), wg = win === P[0] ? g[0] : g[1];
    var line = win ? win.name + ' hit their goal ' + wg.hit + ' days out of ' + wg.of : 'Dead level this week';
    return { icon: 'target', label: str(r.label) || 'Daily goals', html: html, line: line, cls: 'r-widecard', ms: 4500 };
  }

  /* Restless nights: only the notable one, the most restless night or a week nobody got up. */
  function restless(r) {
    if (!r) return null;
    if (r.kind === 'worst' && who(r.who) && num(r.times) && str(r.day)) {
      return { icon: 'weatherNight', label: 'Up in the night', value: r.times, unit: 'times',
               line: nameOf(r.who) + ', ' + r.day + ' night', ms: 4000 };
    }
    if (r.kind === 'calm') return { icon: 'weatherNight', label: 'Up in the night', text: 'Not once', line: 'Nobody got up in the night all week', ms: 4000 };
    return null;
  }

  /* The shower duel: each average shower, and one line: the hotter one, else the quickest single shower. */
  function showerDuel(sh) {
    if (!duo() || !sh) return null;
    var v = of2(sh), h = v[0], e = v[1];
    if (!h || !e || !num(h.avg_min) || !num(e.avg_min) || !h.count || !e.count) return null;
    var line = '', q = sh.quickest;
    if (num(h.avg_temp) && num(e.avg_temp) && Math.abs(h.avg_temp - e.avg_temp) >= 0.5) {
      line = (h.avg_temp > e.avg_temp ? P[0] : P[1]).name + '’s showers run ' + half(Math.abs(h.avg_temp - e.avg_temp)) + '° hotter';
    } else if (q && who(q.who) && num(q.minutes) && str(q.day)) {
      line = 'Quickest: ' + nameOf(q.who) + ', ' + q.minutes + ' ' + plural(q.minutes, 'minute', 'minutes') + ' on ' + q.day;
    }
    var html = '<div class="r-versus">' + sideHtml(P[0], h.avg_min + ' min') + '<p class="r-vs">vs</p>' + sideHtml(P[1], e.avg_min + ' min') + '</div>';
    return { icon: 'showerHead', label: 'The shower duel', html: html, line: line, cls: 'r-widecard', ms: 4500 };
  }

  /* Eight weeks of faint bars, this week lit; gaps where a week has no figure. */
  function spark(values) {
    var nums = (values || []).filter(num);
    if (nums.length < 3) return '';
    var top = Math.max.apply(null, nums), last = values.length - 1;
    return '<div class="r-spark">' + values.map(function (v, n) {
      var h = num(v) && top > 0 ? Math.max(6, Math.round(v / top * 110)) : 6;
      return '<span class="' + (n === last ? 'r-now' : num(v) ? '' : 'r-none') + '" style="height:' + h + 'px"></span>';
    }).join('') + '</div>';
  }

  /* Energy: the week's cost, up or down on last week, and last year only when it differs by 15% or more. */
  function energyStats(e, trends) {
    if (!e || !num(e.week_cost)) return null;
    var total = e.week_cost, vals = trends && trends.energy_cost, pct = e.vs_last_week_pct;
    if (!num(pct) && vals && num(vals[vals.length - 1]) && num(vals[vals.length - 2]) && vals[vals.length - 2] > 0) {
      pct = (vals[vals.length - 1] / vals[vals.length - 2] - 1) * 100;
    }
    var aside = '';
    if (num(pct)) {
      var p = Math.round(pct), dir = p > 0 ? 'r-up' : p < 0 ? 'r-down' : 'r-level';
      aside = '<div class="r-aside">' + spark(vals) + '<p class="r-delta ' + dir + '">' +
        (p ? '<span class="r-tri">' + svg(p > 0 ? 'menuUp' : 'menuDown') + '</span>' + Math.abs(p) + '%' : 'Level') + '</p>' +
        '<p class="r-delta-what">' + (p ? 'vs last week' : 'with last week') + '</p></div>';
    }
    var line = str(e.line), ly = e.last_year_cost;
    if (!line && num(ly) && ly > 0 && Math.abs(total - ly) / ly >= 0.15) {
      line = money(Math.abs(total - ly), 0) + (total > ly ? ' more' : ' less') + ' than this week last year';
    }
    return { icon: 'lightningBolt', label: 'Energy', value: total, format: money, aside: aside, line: line,
             cls: aside ? 'r-widecard r-energycard' : '', ms: 4500 };
  }

  /* The quiz: three tiles, the right one lights up after a pause, then the answer's line. */
  function quiz(q) {
    var opts = q && q.options;
    if (!q || !str(q.question) || !opts || opts.length < 2 || !num(q.answer_index) || !opts[q.answer_index]) return null;
    var tiles = '<div class="r-options">' + opts.slice(0, 3).map(function (o, n) {
      return '<div class="r-step"' + delay(0.5 + n * 0.18) + '><p class="r-option' + (n === q.answer_index ? ' r-correct' : '') + '">' + esc(o) + '</p></div>';
    }).join('') + '</div>';
    var body = labelHtml(iconFor(q.icon), 'Quick question') +
      '<h2 class="r-question r-step">' + esc(q.question) + '</h2>' + tiles +
      (str(q.reveal) ? '<p class="r-line r-hold">' + esc(q.reveal) + '</p>' : '');
    return { icon: iconFor(q.icon), label: 'Quick question', body: body, cls: 'r-widecard r-quizcard', revealAt: 3200, ms: 7500 };
  }

  /* What we watched: TV hours and the title most of them went on. */
  function watched(w, tvHours) {
    var hours = w && num(w.hours) ? w.hours : tvHours;
    if (!num(hours) || hours < 3) return null;
    var h = Math.round(hours), line = '';
    var top = w && (w.top || []).filter(function (t) { return t && t.title; })[0];
    var b = w && w.binge;
    if (top) line = 'Mostly ' + top.title;
    else if (b && b.day && num(b.hours)) line = 'Biggest night ' + b.day + ', ' + half(b.hours) + ' hours';
    return { icon: 'television', label: 'What we watched', value: h, unit: plural(h, 'hour', 'hours'), line: line, ms: 4500 };
  }

  /* What we ate: the week's dinners, Monday to Sunday. */
  function dinners(d) {
    var days = (d && d.days || []).filter(function (x) { return x && str(x.meal); }).slice(0, 7);
    if (!days.length) return null;
    var list = '<div class="r-aside r-meals">' + days.map(function (x, n) {
      return '<p class="r-meal r-step"' + delay(0.4 + n * 0.12) + '><span class="r-meal-day">' + esc(x.day || '') + '</span>' +
        '<span class="r-meal-name">' + esc(x.meal) + '</span></p>';
    }).join('') + '</div>';
    return { icon: 'silverwareForkKnife', label: 'What we ate', value: days.length, unit: plural(days.length, 'dinner', 'dinners'),
             aside: list, cls: 'r-widecard r-mealcard', ms: 5000 };
  }

  /* Highlights: free-form one-number cards for anything else a producer wants to say ("4 home-cooked dinners"). */
  function highlights(list) {
    return (list || []).filter(function (h) { return h && str(h.label) && (num(h.value) || str(h.text)); }).slice(0, 4).map(function (h) {
      return { icon: iconFor(h.icon), label: h.label, value: num(h.value) ? h.value : undefined, text: str(h.text), unit: str(h.unit),
               line: str(h.line), ms: 4500 };
    });
  }

  /* The week on a plate: the week's food pictures dropping in like snaps on a table, and at most one line, the one the
     stats picked as most notable: new recipes, the dish on the most days, or the food diary's leaf days. Names and counts
     of days only, never calories: the TV is a shared screen. photos: the pictures that loaded (app.js). */
  var TILTS = [-3, 2.5, -1.5, 3, -2.5, 1.5, -3.5, 2];
  function plateLine(f) {
    var fresh = (f.new || []).filter(str), top = f.top;
    if (f.pick === 'new' && fresh.length) return fresh.length === 1 ? 'New this week: ' + fresh[0] : fresh.length + ' new recipes tried this week';
    if (f.pick === 'top' && top && str(top.name) && num(top.days)) return 'Most cooked: ' + top.name + ', ' + top.days + ' times';
    if (f.pick === 'leaves' && num(f.leaves) && f.leaves > 0) {
      var whose = who(f.leaves_who) ? nameOf(f.leaves_who) + '’s' : 'The';
      return f.leaves >= 7 ? whose + ' sprig grew a leaf every day' : whose + ' sprig grew ' + f.leaves + ' ' + plural(f.leaves, 'leaf', 'leaves');
    }
    return '';
  }
  function plates(f, photos) {
    var pics = (photos || []).filter(str).slice(0, 8);
    if (!f || pics.length < 3) return null;
    var rows = pics.length > 4 ? 2 : 1, cols = Math.ceil(pics.length / rows);
    var grid = '<div class="r-plates r-plates-' + rows + '">' + pics.map(function (p, n) {
      return '<div class="r-plate" style="width:calc(' + (100 / cols).toFixed(3) + '% - 28px);--tilt:' + TILTS[n % TILTS.length] + 'deg;' +
        'transition-delay:' + (0.3 + n * 0.14).toFixed(2) + 's"><span><img src="' + esc(p) + '" alt=""></span></div>';
    }).join('') + '</div>';
    return { icon: 'silverwareForkKnife', label: 'The week on a plate', html: grid, htmlSteps: true, line: plateLine(f),
             cls: 'r-widecard r-platecard', ms: 6000 };
  }

  /* Guess the week: the question asked at the start of the week and each guess, a drumroll, then the answer and who called it. */
  function guess(g) {
    if (!duo() || !g || !str(g.question) || !str(g.answer) || !g.guesses) return null;
    var guesses = of2(g.guesses), names = P.filter(function (p, n) { return who(guesses[n]); });
    if (!names.length) return null;
    var chips = '<div class="r-chips">' + names.map(function (p, k) {
      var said = g.guesses[p.id];
      return '<div class="r-chip r-step"' + delay(0.5 + k * 0.3) + '><p class="r-chip-label">' + esc(p.name) + ' said</p>' +
        '<p class="r-chip-who ' + who(said) + '">' + esc(nameOf(said)) + '</p></div>';
    }).join('') + '</div>';
    var right = (g.right || []).filter(function (n) { return who(n); });
    var verdict = String(g.answer).toLowerCase() === 'draw' ? 'A dead heat: nobody called it' : right.length === 2 ? 'You both called it'
      : right.length ? nameOf(right[0]) + ' called it' : 'Nobody saw that coming';
    var answer = who(g.answer) ? '<span class="' + who(g.answer) + '">' + esc(nameOf(g.answer)) + '</span>' : '<span class="r-draw">A draw</span>';
    var body = labelHtml('helpCircle', 'Guess the week') + '<h2 class="r-question r-step">' + esc(g.question) + '</h2>' + chips +
      '<div class="r-verdict r-guess-verdict"><p class="r-drum r-step"' + delay(1.4) + '><i></i><i></i><i></i></p>' +
      '<p class="r-winner r-guess-answer r-hold">' + answer + '</p></div>' + '<p class="r-line r-hold">' + esc(verdict) + '</p>';
    return { icon: 'helpCircle', label: 'Guess the week', body: body, cls: 'r-widecard r-winnercard r-guesscard', revealAt: 3400, ms: 7500 };
  }

  /* The robot vacuum's week: the cleans, one line, and its own map of the floor when a camera has a picture. */
  function vacuumCard(m, picture) {
    if (!m || !num(m.cleans) || !m.cleans) return null;
    var label = str(m.name) ? m.name + '’s week' : 'The vacuum’s week';
    var line = str(m.line) || (num(m.m2) ? m.m2 + ' m² cleaned' : '');
    var big = '<p class="r-big"><span class="r-n">' + m.cleans + '</span><span class="r-unit">' + plural(m.cleans, 'clean', 'cleans') + '</span></p>';
    var text = '<div class="r-max-text">' + labelHtml('robotVacuum', label) + '<div class="r-step">' + big + '</div>' +
      (line ? '<p class="r-line r-step">' + esc(line) + '</p>' : '') + '</div>';
    if (!picture) return { icon: 'robotVacuum', label: label, body: text, ms: 4500 };
    return { icon: 'robotVacuum', label: label, body: text + '<div class="r-map r-step"><img src="' + esc(picture) + '" alt=""></div>',
             cls: 'r-widecard r-maxcard', ms: 5000 };
  }

  /* A new record, the first one only, with a burst of sparkles. "Headline: detail" splits into hero and line. */
  function burst() {
    var html = '';
    for (var n = 0; n < 18; n++) {
      html += '<span class="r-ray" style="transform:rotate(' + Math.round(n * 20 + (n % 2) * 7) + 'deg)"><i class="r-spark-' + (n % 3) + '"' +
        ' style="animation-delay:' + (0.45 + (n % 4) * 0.07).toFixed(2) + 's">' + (n % 2 ? '' : svg('starFourPoints')) + '</i></span>';
    }
    return '<div class="r-burst" aria-hidden="true">' + html + '</div>';
  }
  function record(list) {
    var r = (list || []).filter(function (x) { return x && str(x.text); })[0];
    if (!r) return null;
    var cut = r.text.indexOf(': '), hero = cut > 0 ? r.text.slice(0, cut) : r.text, line = cut > 0 ? capital(r.text.slice(cut + 2)) : '';
    var body = labelHtml(iconFor(r.icon), 'New record') + '<h2 class="r-hero-text r-step">' + esc(hero) + '</h2>' +
      (line ? '<p class="r-line r-step">' + esc(line) + '</p>' : '');
    return { icon: 'trophy', label: 'New record', body: body, before: burst(), cls: 'r-recordcard', ms: 4500 };
  }

  /* The house says: one sentence in the house's own voice. */
  function houseSays(h) {
    var text = h && str(h.text);
    if (!text) return null;
    return { icon: 'home', label: 'The house says',
             body: labelHtml('home', 'The house says') + '<p class="r-quote r-step' + (text.length > 120 ? ' r-quote-long' : '') + '">' +
               '<span class="r-quote-mark">' + svg('formatQuoteOpen') + '</span>' + esc(text) + '</p>',
             ms: Math.max(4500, Math.min(6000, 2500 + text.length * 35)) };
  }

  /* Month (or year) in numbers: up to six tiles, one figure each. */
  function tileHtml(label, value, n) {
    return '<div class="r-tile r-step"' + delay(0.3 + n * 0.12) + '><p class="r-tile-label">' + esc(label) + '</p>' + value + '</div>';
  }
  function tileN(text, unit) {
    return '<p class="r-tile-n">' + esc(text) + (unit ? '<span class="r-tile-unit">' + esc(unit) + '</span>' : '') + '</p>';
  }
  function tilePair(v) {
    return '<p class="r-tile-pair r-p1"><span>' + esc(P[0].name) + '</span><b>' + esc(v[0]) + '</b></p>' +
      '<p class="r-tile-pair r-p2"><span>' + esc(P[1].name) + '</span><b>' + esc(v[1]) + '</b></p>';
  }
  function tileWho(text, name) {
    return '<p class="r-tile-n">' + esc(text) + '</p><p class="r-tile-who ' + who(name) + '">' + esc(nameOf(name)) + '</p>';
  }
  function inNumbers(m, isYear) {
    if (!m || !m.label) return null;
    var tiles = [];
    function add(label, value) { tiles.push(tileHtml(label, value, tiles.length)); }
    // either person is enough: one may have joined part-way through
    function pair(obj, f) {
      if (!duo() || !obj) return null;
      var v = of2(obj);
      return num(v[0]) || num(v[1]) ? v.map(function (x) { return num(x) ? f(x) : '–'; }) : null;
    }
    var steps = pair(m.steps, thousands), sleep = pair(m.sleep_avg, hm), duel = pair(m.duel, String);
    if (steps) add('Steps', tilePair(steps));
    if (duel && duel[0] !== '–' && duel[1] !== '–') add('Steps duel', tileN(duel[0] + '–' + duel[1]));
    if (sleep) add('Average night', tilePair(sleep));
    if (num(m.energy_cost)) add('Energy', tileN(money(m.energy_cost, 0)));
    if (m.best_day && m.best_day.who && num(m.best_day.steps)) add('Best day', tileWho(thousands(m.best_day.steps), m.best_day.who));
    if (m.best_night && m.best_night.who && num(m.best_night.minutes)) add('Longest night', tileWho(hm(m.best_night.minutes), m.best_night.who));
    if (num(m.tv_hours)) add('TV', tileN(thousands(m.tv_hours), 'hours'));
    if (num(m.vacuum_cleans) && m.vacuum_cleans) add(str(m.vacuum_name) || 'Vacuum', tileN(String(m.vacuum_cleans), plural(m.vacuum_cleans, 'clean', 'cleans')));
    if (tiles.length < 3) return null;
    return { icon: isYear ? 'partyPopper' : 'calendarMonth', label: m.label + ' in numbers', html: '<div class="r-tiles">' + tiles.slice(0, 6).join('') + '</div>',
             htmlSteps: true, cls: 'r-widecard r-tilecard', ms: 5500 };
  }
  function yearTitle(y) {
    return { kind: 'intro', icon: 'partyPopper', label: 'The year at home',
             body: labelHtml('partyPopper', 'The year at home') + '<h2 class="r-title r-step">' + esc(y.label) + ' Wrapped</h2>', ms: 4500 };
  }

  /* Next week: the forecast strip and the challenge. */
  var WEATHER = { 'sunny': 'weatherSunny', 'clear-night': 'weatherNight', 'partlycloudy': 'weatherPartlyCloudy', 'cloudy': 'weatherCloudy',
                  'rainy': 'weatherRainy', 'pouring': 'weatherPouring', 'fog': 'weatherFog', 'snowy': 'weatherSnowy', 'snowy-rainy': 'weatherSnowyRainy',
                  'hail': 'weatherHail', 'windy': 'weatherWindy', 'windy-variant': 'weatherWindyVariant', 'lightning': 'weatherLightning',
                  'lightning-rainy': 'weatherLightningRainy', 'exceptional': 'alert' };
  function nextWeek(n) {
    if (!n) return null;
    var days = (n.forecast || []).filter(function (d) { return d && d.day && num(d.high); }).slice(0, 7);
    if (!days.length && !str(n.challenge)) return null;
    var strip = days.length ? '<div class="r-forecast">' + days.map(function (d, k) {
      return '<div class="r-day r-step"' + delay(0.3 + k * 0.1) + '><p class="r-day-name">' + esc(d.day) + '</p><span class="r-day-icon">' + svg(WEATHER[d.condition] || 'weatherCloudy') + '</span>' +
        '<p class="r-day-temp">' + Math.round(d.high) + '°' + (num(d.low) ? '<span>' + Math.round(d.low) + '°</span>' : '') + '</p></div>';
    }).join('') + '</div>' : '';
    return { icon: 'calendarArrowRight', label: 'Next week', html: strip, htmlSteps: true, line: str(n.challenge), cls: 'r-widecard r-nextcard', ms: 4500 };
  }

  /* The finale: each category's winner one by one, a drumroll, then the name. */
  function winner(w) {
    if (!w || !str(w.name)) return null;
    var cats = (w.categories || []).filter(function (c) { return c && str(c.label); }).slice(0, 6);
    var draw = !who(w.name);
    var chips = '<div class="r-chips">' + cats.map(function (c, n) {
      return '<div class="r-chip r-step"' + delay(0.6 + n * 0.45) + '><p class="r-chip-label">' + esc(c.label) + '</p>' +
        '<p class="r-chip-who ' + who(c.who) + '">' + esc(c.who ? nameOf(c.who) : 'Draw') + '</p></div>';
    }).join('') + '</div>';
    var drumAt = 0.6 + cats.length * 0.45 + 0.3;
    var name = draw ? '<span class="r-draw">It’s a draw</span>' : '<span class="' + who(w.name) + '">' + esc(nameOf(w.name)) + '</span>';
    var body = labelHtml('crown', 'And the winner of the week is…') + chips +
      '<div class="r-verdict"><p class="r-drum r-step"' + delay(drumAt) + '><i></i><i></i><i></i></p>' +
      '<p class="r-winner r-hold"><span class="r-crown">' + svg('crown') + '</span>' + name + '</p></div>';
    var revealAt = Math.round((drumAt + 1.2) * 1000);
    return { icon: 'crown', label: 'Winner of the week', body: body, cls: 'r-widecard r-winnercard', revealAt: revealAt,
             ms: Math.max(7500, revealAt + 3000) };
  }

  function statsBody(data, s) {
    return [
      stepsDuel(s.duel, s.belt),
      goalsDuel(s.goals),
      sleepDuel(s.sleep),
      restless(s.restless),
      showerDuel(s.showers),
      energyStats(s.energy, s.trends),
      quiz(s.quiz),
      watched(s.watched, data.tvHours),
      dinners(s.dinners),
      plates(s.food, data.foodPhotos),
      vacuumCard(s.vacuum, data.vacuumMap),
      record(s.records),
      houseSays(s.house_says),
      inNumbers(s.month_recap, false),
      nextWeek(s.next_week),
    ].concat(highlights(s.highlights), [guess(s.guess), winner(s.winner)]);
  }

  /* data: { stats (ignored when over 8 days old), tvHours, vacuumMap and foodPhotos (absolute URLs that loaded), locale, now } */
  function build(data) {
    var now = data.now || new Date(), s = freshStats(data.stats, now);
    if (!s) return [];
    LOCALE = data.locale; CURRENCY = s.currency || 'GBP';
    setPeople(s.people);
    var body = statsBody(data, s).filter(function (c) { return c; });
    if (body.length < 2) return [];
    var first = intro(now, s.window || 'The last seven days', s.badge);
    var year = inNumbers(s.year_recap, true);
    return [first].concat(year ? [yearTitle(s.year_recap), year] : [], body);
  }

  /* ---------- the player ---------- */

  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* A card brings its own body, or the usual shape: label, the hero (a number with an optional aside, or a block), a line, a sub. */
  function cardHtml(c) {
    var mark = '<span class="r-mark" aria-hidden="true">' + svg(c.icon) + '</span>' + (c.before || '');
    if (c.body) return mark + '<div class="r-body">' + c.body + '</div>';
    var big = '';
    if (c.text || num(c.value)) big = '<p class="r-big"><span class="r-n">' + esc(c.text || (c.format ? c.format(c.value) : c.value)) + '</span>' +
               (c.unit ? '<span class="r-unit">' + esc(c.unit) + '</span>' : '') + '</p>';
    if (big && c.aside) big = '<div class="r-with">' + big + c.aside + '</div>';
    return mark + '<div class="r-body">' + labelHtml(c.icon, c.label) +
      (big ? '<div class="r-step">' + big + '</div>' : '') +
      (c.html ? '<div class="r-main' + (c.htmlSteps ? '' : ' r-step') + '">' + c.html + '</div>' : '') +
      (c.line ? '<p class="r-line r-step">' + esc(c.line) + '</p>' : '') +
      (c.sub ? '<p class="r-sub r-step">' + esc(c.sub) + '</p>' : '') +
      '</div>';
  }

  function countUp(el, c) {
    if (c.text || !num(c.value) || reduced()) return;
    var start = null, fmt = c.format || function (v) { return String(Math.round(v)); };
    function frame(t) {
      if (!el.parentNode) return;
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / COUNT_MS), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(c.format ? c.value * eased : Math.round(c.value * eased));
      if (p < 1) window.requestAnimationFrame(frame);
    }
    el.textContent = fmt(0);
    window.requestAnimationFrame(frame);
  }

  /* root: the #recap element. opts: { auto, backTo, onEnd(reason) } where reason is 'done' or 'back'.
     In auto mode only the progress bars and the countdown sit above the cards; stepping by hand shows the hint. */
  function play(root, cards, opts) {
    var stage = root.querySelector('.r-stage'), bars = root.querySelector('.r-bars'), hint = root.querySelector('.r-hint');
    var i = -1, timer = 0, ticker = 0, revealTimer = 0, revealed = true, cardStart = 0, stopped = false;
    function ms(c) { return c.ms || CARD_MS; }

    bars.innerHTML = cards.map(function () { return '<span class="r-bar"><span></span></span>'; }).join('');
    root.classList.toggle('r-auto', !!opts.auto);
    root.hidden = false;

    function setBars() {
      Array.prototype.forEach.call(bars.children, function (b, n) {
        var fill = b.firstChild;
        fill.style.transition = 'none';
        fill.style.width = n < i ? '100%' : '0%';
        if (n === i) {
          void fill.offsetWidth;  // restart the fill from empty
          fill.style.transition = 'width ' + ms(cards[i]) + 'ms linear';
          fill.style.width = '100%';
        }
      });
    }
    function setHint() {
      if (!opts.auto) { hint.textContent = 'Left and right to step · Back closes'; return; }
      var left = ms(cards[i]) - (Date.now() - cardStart);
      for (var n = i + 1; n < cards.length; n++) left += ms(cards[n]);
      hint.textContent = Math.max(1, Math.ceil(left / 1000)) + ' s';
    }
    function reveal() {
      if (revealed) return;
      revealed = true;
      clearTimeout(revealTimer);
      var card = stage.querySelector('.r-card:not(.r-out)');
      if (card) card.classList.add('r-revealed');
    }
    function show(n) {
      if (stopped) return;
      if (n >= cards.length) return end('done');
      if (n < 0) n = 0;
      var forward = n >= i;
      i = n; cardStart = Date.now();
      var old = stage.querySelector('.r-card:not(.r-out)');
      if (old) {
        old.classList.add('r-out', forward ? 'r-fwd' : 'r-bwd');
        setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 450);
      }
      var card = document.createElement('article');
      card.className = 'r-card' + (cards[n].kind === 'intro' ? ' r-intro' : '') + (cards[n].cls ? ' ' + cards[n].cls : '');
      card.innerHTML = cardHtml(cards[n]);
      stage.appendChild(card);
      void card.offsetWidth;
      card.classList.add('r-in');
      var numEl = card.querySelector('.r-n');
      if (numEl) countUp(numEl, cards[n]);
      setBars(); setHint();
      clearTimeout(timer); clearTimeout(revealTimer);
      revealed = !cards[n].revealAt;
      if (!revealed) revealTimer = setTimeout(reveal, cards[n].revealAt);
      timer = setTimeout(function () { show(i + 1); }, ms(cards[n]));
    }
    function end(reason) {
      if (stopped) return;
      stop();
      opts.onEnd(reason);
    }
    function stop() {
      stopped = true;
      clearTimeout(timer); clearTimeout(revealTimer); clearInterval(ticker);
      root.hidden = true; stage.innerHTML = '';
    }

    ticker = setInterval(function () { if (!stopped) setHint(); }, 1000);
    show(0);
    return {
      next: function () { if (!revealed) reveal(); else show(i + 1); },
      prev: function () { show(i - 1); },
      reveal: reveal,
      back: function () { end('back'); },
      stop: stop,
    };
  }

  window.HouseRecap = { build: build, play: play };
})();
