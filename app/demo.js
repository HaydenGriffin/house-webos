/* Demo mode: a made-up home for trying House in a browser (open index.html?demo, add &recap for the week recap) and for
   the README screenshots. Nothing here talks to Home Assistant. */
(function () {
  'use strict';

  var config = {
    title: 'House',
    locale: 'en-GB',
    lights: [
      { name: 'Living room', entity: 'light.living_room' },
      { name: 'Kitchen', entity: 'light.kitchen' },
      { name: 'Hallway', entity: 'light.hallway' },
      { name: 'Bedroom', entity: 'light.bedroom' },
      { name: 'Study', entity: 'light.study' },
    ],
    tiles: [
      { name: 'Warm living room', sub: 'For 2 hours', icon: 'radiator', toast: 'Warming the living room for 2 hours',
        action: { service: 'script.turn_on', target: { entity_id: 'script.warm_living_room' } } },
    ],
    door: 'binary_sensor.front_door',
    tv: {
      source_sensor: 'sensor.tv_source',
      sources: [
        { name: 'Streamer', icon: 'televisionPlay', action: { service: 'script.turn_on', target: { entity_id: 'script.tv_streamer' } } },
        { name: 'Console', icon: 'gamepadVariant', action: { service: 'script.turn_on', target: { entity_id: 'script.tv_console' } } },
        { name: 'Music', icon: 'televisionSpeaker', action: { service: 'script.turn_on', target: { entity_id: 'script.tv_music' } } },
      ],
      wide: { name: 'Movie time', icon: 'movieOpenPlay', toast: 'Movie time', action: { service: 'scene.turn_on', target: { entity_id: 'scene.movie_time' } } },
    },
    music: {
      title: 'Home speakers',
      player: 'media_player.home_speakers',
      extra: { name: 'Evening mix', icon: 'playlist', toast: 'Playing the evening mix',
               action: { service: 'script.turn_on', target: { entity_id: 'script.evening_mix' } } },
      toggle: { name: 'TV joins the speakers', entity: 'input_boolean.tv_in_speaker_group', on: 'Joins when music plays', off: 'Stays out' },
    },
    people: [
      { name: 'Alex', person: 'person.alex', room: 'sensor.alex_room' },
      { name: 'Sam', person: 'person.sam', room: 'sensor.sam_room',
        notes: [{ entity: 'sensor.sam_gym', attribute: 'trained_today', text: 'Gym today', hide: ['false'], private: true }] },
    ],
    guests: { entity: 'input_boolean.guests' },
    status: [
      { entity: 'sensor.heating', text: '{value}' },
      { entity: 'sensor.parcels', attribute: 'items', filter: { today: true, status: ['expected', 'out_for_delivery'] },
        text: '{value} parcel coming', hide: ['0'] },
    ],
    recap: { stats: 'sensor.week_stats' },
    glance: [
      { entity: 'sensor.dinner_tonight', icon: 'silverwareForkKnife', text: 'Tonight · {value}' },
      { entity: 'todo.shopping', icon: 'cartOutline', text: 'Shopping · {value}', hide: ['0'] },
      { entity: 'sensor.bins_next', icon: 'trashCanOutline', text: '{attr.summary} {day}', within_days: 1 },
    ],
    glance_max: 2,
    quick: [
      { name: 'Pause', sub: 'The streamer', icon: 'pause', toast: 'Paused', visible: { entity: 'media_player.streamer', states: ['playing'] },
        action: { service: 'media_player.media_pause', target: { entity_id: 'media_player.streamer' } } },
      { name: 'Lights up', sub: 'Living room to 40%', icon: 'lightbulbOn', toast: 'Lights up', visible: { entity: 'media_player.streamer', states: ['playing', 'paused'] },
        action: { service: 'light.turn_on', target: { entity_id: 'light.living_room' }, data: { brightness_pct: 40 } } },
    ],
    footer: [
      { name: 'Everything off', icon: 'power', confirm: true, toast: 'Everything off',
        action: { service: 'script.turn_on', target: { entity_id: 'script.everything_off' } } },
    ],
  };

  var states = {
    'light.living_room': { s: 'on', a: { brightness: 166 } },
    'light.kitchen': { s: 'on', a: { brightness: 255 } },
    'light.hallway': { s: 'off' },
    'light.bedroom': { s: 'off' },
    'light.study': { s: 'on', a: { brightness: 102 } },
    'binary_sensor.front_door': { s: 'off' },
    'sensor.tv_source': { s: 'Streamer', a: { line: 'Streamer · The Bear, S3 E4' } },
    'media_player.home_speakers': { s: 'playing', a: { media_title: 'Strawberry Letter 23', media_artist: 'The Brothers Johnson' } },
    'input_boolean.tv_in_speaker_group': { s: 'on' },
    'person.alex': { s: 'home' },
    'sensor.alex_room': { s: 'study' },
    'person.sam': { s: 'home' },
    'sensor.sam_room': { s: 'kitchen' },
    'sensor.dinner_tonight': { s: 'Chicken katsu curry' },
    'todo.shopping': { s: '8' },
    'media_player.streamer': { s: 'playing' },
    'sensor.bins_next': { s: tomorrow(), a: { summary: 'Recycling' } },
    'sensor.heating': { s: 'Heating to 20°' },
    'sensor.parcels': { s: '3', a: { items: [
      { name: 'Running shoes', today: true, status: 'out_for_delivery' },
      { name: 'Coffee beans', today: true, status: 'delivered' },
      { name: 'Picture frame', today: false, status: 'expected' },
    ] } },
    'sensor.sam_gym': { s: 'ok', a: { trained_today: true } },
    'input_boolean.guests': { s: 'off' },
  };
  function tomorrow() {
    var t = new Date(); t.setDate(t.getDate() + 1);
    return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  }

  function day(offset) {
    var d = new Date(); d.setDate(d.getDate() - d.getDay() - 6 + offset);  // Monday of the week just gone, + offset
    return d;
  }
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function rows(a, s, extra) {
    return DAYS.map(function (name, n) {
      var r = { day: name, alex: a[n], sam: s[n] };
      if (extra) r.winner = a[n] === null || s[n] === null ? null : a[n] > s[n] ? 'alex' : 'sam';
      return r;
    });
  }
  var MAP = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#16181d"/>' +
    '<g fill="#2e3239" stroke="#8ab4ff" stroke-width="3"><path d="M30 30h190v120H30z"/><path d="M220 30h150v90H220z"/>' +
    '<path d="M30 150h110v120H30z"/><path d="M140 150h230v120H140z"/></g>' +
    '<path d="M60 60h120M60 80h120M60 100h120M60 120h120M250 55h90M250 75h90M250 95h90M170 180h170M170 200h170M170 220h170M170 240h170" ' +
    'stroke="#ffc76b" stroke-width="10" stroke-linecap="round" opacity=".55" fill="none"/>' +
    '<circle cx="85" cy="215" r="14" fill="#ffc76b"/></svg>');

  /* Two made-up book covers, drawn so the demo needs no network. */
  function cover(ground, ink, title, author) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">' +
      '<rect width="200" height="300" fill="' + ground + '"/><circle cx="150" cy="70" r="46" fill="' + ink + '" opacity=".85"/>' +
      '<rect x="0" y="196" width="200" height="104" fill="' + ink + '" opacity=".18"/>' +
      '<text x="18" y="232" font-family="Georgia, serif" font-size="25" font-weight="700" fill="' + ink + '">' + title + '</text>' +
      '<text x="18" y="268" font-family="Georgia, serif" font-size="15" fill="' + ink + '">' + author + '</text></svg>');
  }

  /* A made-up route: a loose loop of n points around a park, rx by ry metres, wobbling so it reads as a real one. */
  function loop(lat, lon, rx, ry, n, seed) {
    var pts = [], k = Math.cos(lat * Math.PI / 180);
    for (var i = 0; i < n; i++) {
      var a = i / (n - 1) * Math.PI * 2, w = 1 + 0.12 * Math.sin(a * 5 + seed) + 0.06 * Math.cos(a * 9 + seed * 2);
      pts.push([lat + Math.sin(a) * ry * w / 111320, lon + Math.cos(a) * rx * w / (111320 * k)]);
    }
    return pts;
  }
  /* A floor of the house with the vacuum's path over it, drawn so the demo needs no camera. */
  function floor(rooms, path) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">' +
      '<g fill="#2e3239" stroke="#8ab4ff" stroke-width="3">' + rooms.map(function (r) { return '<path d="' + r + '"/>'; }).join('') + '</g>' +
      '<path d="' + path + '" stroke="#ffc76b" stroke-width="4" stroke-linejoin="round" fill="none" opacity=".85"/></svg>');
  }
  /* A made-up dish: a plate on a table, in two colours. */
  function dish(table, food) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360">' +
      '<rect width="400" height="360" fill="' + table + '"/><circle cx="200" cy="180" r="140" fill="#f4f2ee"/>' +
      '<circle cx="200" cy="180" r="108" fill="' + food + '"/><circle cx="160" cy="150" r="22" fill="#f4f2ee" opacity=".5"/>' +
      '<circle cx="236" cy="206" r="16" fill="#3e6b2f" opacity=".8"/><circle cx="214" cy="140" r="10" fill="#3e6b2f" opacity=".8"/></svg>');
  }
  var ZIG = function (x0, y0, x1, y1, step) {
    var d = 'M' + x0 + ' ' + y0, y = y0, right = true;
    while (y <= y1) { d += 'H' + (right ? x1 : x0); y += step; if (y <= y1) d += 'V' + y; right = !right; }
    return d;
  };

  function recap() {
    var now = new Date(), mon = day(0), sun = day(6);
    function iso(n) { var x = day(n); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
    function act(who, kind, name, n, start, minutes, km, route) {
      var a = { who: who, kind: kind, name: name, day: DAYS[n], date: iso(n), start: start, minutes: minutes };
      if (km) a.km = km;
      if (route) a.route = route;
      return a;
    }
    function d(x) { return x.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }
    return {
      generated_at: now.toISOString(),
      window: d(mon) + ' to ' + d(sun),
      currency: 'GBP',
      people: [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }],
      badge: { title: 'Sofa Squad', why: 'The living room got 38% of the action', icon: 'sofa' },
      duel: {
        wins: { alex: 3, sam: 4 }, totals: { alex: 50249, sam: 51445 },
        days: rows([6120, 9840, 5210, 7790, 4980, 11430, 4880], [8200, 7650, 6400, 8920, 6100, 7310, 6865], true),
      },
      belt: { holder: 'sam', status: 'new', previous: 'alex' },
      sleep: {
        avg: { alex: 515, sam: 486 },
        nights: rows([492, 530, 601, 455, 512, 548, 467], [470, 455, 498, 470, 501, 489, 520]),
        bed_race: { who: 'sam', nights: 5, of: 7 },
      },
      showers: { alex: { count: 6, avg_min: 9, avg_temp: 41.2, litres: 280, kwh: 8.4 }, sam: { count: 7, avg_min: 14, avg_temp: 43.0, litres: 470, kwh: 14.6 } },
      energy: { week_cost: 29.6, vs_last_week_pct: 12, series: {
        labels: ['W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38', 'W39', 'W40', 'W41', 'W42'],
        elec: [17.2, 16.8, 18.1, 17.5, 16.2, 17.9, 15.8, 17.4, 15.6, 17.1, 16.2, 17.8],
        gas: [4.1, 3.9, 4.6, 5.2, 7.9, 7.9, 7.1, 9.0, 8.1, 10.1, 10.2, 11.8],
        last_year: [22.4, 21.0, 23.5, 22.8, 24.1, 25.3, 24.6, 26.0, 27.9, 28.4, 30.1, 31.5],
      } },
      trends: { energy_cost: [24.1, 25.8, 22.9, 26.4, 23.7, 27.2, 26.4, 29.6] },
      quiz: { question: 'How many thousand steps did you walk between you?', options: ['64', '102', '148'], answer_index: 1,
              reveal: '101,694 steps altogether.', icon: 'shoePrint' },
      watched: { hours: 32, top: [{ title: 'The Bear', hours: 9.5 }, { title: 'Slow Horses', hours: 6 }, { title: 'Match of the Day', hours: 3.5 },
                                  { title: 'Paddington 2', hours: 2 }, { title: 'Bluey', hours: 1.5 }],
                 apps: [{ name: 'Netflix', hours: 14 }, { name: 'BBC iPlayer', hours: 9 }, { name: 'YouTube', hours: 5 }],
                 inputs: [{ name: 'Streamer', hours: 26 }, { name: 'TV apps', hours: 4 }, { name: 'Console', hours: 2 }],
                 days: [{ day: 'Mon', hours: 3 }, { day: 'Tue', hours: 2.5 }, { day: 'Wed', hours: 4 }, { day: 'Thu', hours: 3.5 },
                        { day: 'Fri', hours: 7 }, { day: 'Sat', hours: 6.5 }, { day: 'Sun', hours: 5.5 }],
                 binge: { day: 'Friday', hours: 7 } },
      activities: { items: [
        act('alex', 'run', 'Morning run', 0, '07:10', 31, 5.2, loop(51.5072, -0.1657, 520, 330, 160, 1)),
        act('sam', 'class', 'Yoga', 1, '18:30', 45),
        act('alex', 'gym', 'The gym', 2, '19:05', 62),
        act('sam', 'gym', 'The gym', 3, '07:40', 55),
        act('alex', 'walk', 'Walk to the market', 3, '12:20', 48, 3.4),
        act('sam', 'run', 'parkrun', 5, '09:00', 29, 5.0, loop(51.4613, -0.1156, 380, 450, 140, 3)),
        act('alex', 'cycle', 'Ride out to Richmond', 6, '10:15', 64, 18.6),
      ] },
      gym: {
        days: DAYS.map(function (name, n) { return { day: name, alex: n === 1 || n === 5, sam: n === 0 || n === 3 || n === 5 }; }),
        alex: { days: 2, minutes: 105, streak: 3 }, sam: { days: 3, minutes: 170, streak: 6 },
      },
      reading: {
        finished: [{ title: 'The Salt Orchard', author: 'Mara Ellis', who: 'sam', cover: cover('#e8d9b5', '#3b2a1a', 'The Salt', 'Mara Ellis') }],
        current: [{ title: 'Northern Lines', author: 'Tom Achebe-Price', who: 'alex', percent: 64, cover: cover('#1f3a4d', '#f2e6c9', 'Northern', 'T. Achebe-Price') },
                  { title: 'A Year of Small Gardens', author: 'Ines Okafor', who: 'sam', percent: 22 }],
        year: { sam: 19 },
      },
      dinners: { days: [
        { day: 'Mon', meal: 'Chicken katsu curry' }, { day: 'Tue', meal: 'Pierogi with fried onions' },
        { day: 'Wed', meal: 'Roasted sweet potatoes with guacamole' }, { day: 'Thu', meal: 'Beef ragù' },
        { day: 'Fri', meal: 'Pizza night' }, { day: 'Sat', meal: 'Thai green curry' }, { day: 'Sun', meal: 'Roast chicken and greens' },
      ] },
      food: { recipes: [
        { name: 'Chana masala', image: dish('#3a2a20', '#c8792e'), minutes: 40, servings: 4, source: 'BBC Good Food', day: 'Tuesday', first: true },
        { name: 'Pad Thai', image: dish('#1f2b33', '#d9a441'), minutes: 25, servings: 2, source: 'Cookidoo', day: 'Thursday', had: 2, first: true },
      ] },
      vacuum: { name: 'Robbie', cleans: 4, m2: 58, line: '58 m², most of a badminton court', maps: [
        { floor: 'Downstairs', when: 'Tue 10:40', m2: 34, picture: floor(['M20 20h200v130H20z', 'M220 20h160v100H220z', 'M20 150h140v90H20z', 'M160 120h220v120H160z'],
          ZIG(34, 34, 206, 136, 14) + 'M234 34' + ZIG(234, 34, 366, 106, 14).slice(ZIG(234, 34, 366, 106, 14).indexOf('H'))) },
        { floor: 'Upstairs', when: 'Thu 11:05', m2: 24, picture: floor(['M20 20h170v110H20z', 'M190 20h190v110H190z', 'M20 130h120v110H20z', 'M140 130h240v110H140z'],
          ZIG(204, 34, 366, 116, 14) + 'M154 144' + ZIG(154, 144, 366, 226, 14).slice(ZIG(154, 144, 366, 226, 14).indexOf('H'))) },
      ] },
      records: [{ icon: 'trophy', text: '11,430 steps: Alex’s best day since August' },
                { icon: 'lightningBolt', text: '£29.60 on energy: the priciest week in 9 weeks', tone: 'bad' }],
      house_says: { text: 'I opened the front door 15 times this week. Mostly for parcels, I suspect.' },
      next_week: {
        forecast: [
          { day: 'Mon', condition: 'partlycloudy', high: 19, low: 12 }, { day: 'Tue', condition: 'cloudy', high: 18, low: 11 },
          { day: 'Wed', condition: 'rainy', high: 15, low: 10 }, { day: 'Thu', condition: 'partlycloudy', high: 14, low: 8 },
          { day: 'Fri', condition: 'sunny', high: 16, low: 7 }, { day: 'Sat', condition: 'sunny', high: 17, low: 9 },
          { day: 'Sun', condition: 'rainy', high: 13, low: 9 },
        ],
        challenge: 'Next week: beat 100,000 steps between you',
        events: [{ day: 'Tue', time: '18:30', title: 'Dinner with Jo and Priya' }, { day: 'Thu', title: 'Sam’s birthday' },
                 { day: 'Sat', time: '10:00', title: 'Boiler service' }],
        bins: { day: 'Monday', what: 'Garden' },
      },
      guess: { question: 'Who’ll take the longer showers this week?', answer: 'sam', guesses: { alex: 'sam', sam: 'alex' }, right: ['alex'] },
      winner: { name: 'sam', categories: [
        { label: 'Steps', who: 'sam' }, { label: 'Best single day', who: 'alex' }, { label: 'Gym days', who: 'sam' }, { label: 'Most sleep', who: 'alex' },
        { label: 'Early bird', who: 'sam' }, { label: 'Quickest showers', who: 'alex' },
      ] },
      highlights: [{ icon: 'chefHat', label: 'The kitchen', value: 6, unit: 'dinners cooked at home', line: 'And a loaf of five-seed bread' }],
    };
  }

  window.HOUSE_DEMO = {
    config: config,
    states: states,
    recap: recap,
    clock: '20:41',
    nextEvent: function () { var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(18, 30, 0, 0); return { start: t, allDay: false, title: 'Dinner with Jo and Priya' }; },
    vacuumMap: MAP,
  };
})();
