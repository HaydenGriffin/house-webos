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
      { name: 'Sam', person: 'person.sam', room: 'sensor.sam_room' },
    ],
    recap: { stats: 'sensor.week_stats' },
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
    'sensor.alex_room': { s: 'living room' },
    'person.sam': { s: 'home' },
    'sensor.sam_room': { s: 'kitchen' },
  };

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

  function recap() {
    var now = new Date(), mon = day(0), sun = day(6);
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
      showers: { alex: { count: 6, avg_min: 9, avg_temp: 41.2 }, sam: { count: 7, avg_min: 14, avg_temp: 43.0 } },
      energy: { week_cost: 29.6, vs_last_week_pct: 12 },
      trends: { energy_cost: [24.1, 25.8, 22.9, 26.4, 23.7, 27.2, 26.4, 29.6] },
      quiz: { question: 'How many thousand steps did you walk between you?', options: ['64', '102', '148'], answer_index: 1,
              reveal: '101,694 steps altogether.', icon: 'shoePrint' },
      watched: { hours: 32, top: [{ title: 'The Bear' }] },
      dinners: { days: [
        { day: 'Mon', meal: 'Chicken katsu curry' }, { day: 'Tue', meal: 'Pierogi with fried onions' },
        { day: 'Wed', meal: 'Roasted sweet potatoes with guacamole' }, { day: 'Thu', meal: 'Beef ragù' },
        { day: 'Fri', meal: 'Pizza night' }, { day: 'Sat', meal: 'Thai green curry' }, { day: 'Sun', meal: 'Roast chicken and greens' },
      ] },
      vacuum: { name: 'Robbie', cleans: 4, m2: 58, line: '58 m², most of a badminton court' },
      records: [{ icon: 'trophy', text: '11,430 steps: Alex’s best day since August' }],
      house_says: { text: 'I opened the front door 15 times this week. Mostly for parcels, I suspect.' },
      next_week: {
        forecast: [
          { day: 'Mon', condition: 'partlycloudy', high: 19, low: 12 }, { day: 'Tue', condition: 'cloudy', high: 18, low: 11 },
          { day: 'Wed', condition: 'rainy', high: 15, low: 10 }, { day: 'Thu', condition: 'partlycloudy', high: 14, low: 8 },
          { day: 'Fri', condition: 'sunny', high: 16, low: 7 }, { day: 'Sat', condition: 'sunny', high: 17, low: 9 },
          { day: 'Sun', condition: 'rainy', high: 13, low: 9 },
        ],
        challenge: 'Next week: beat 100,000 steps between you',
      },
      guess: { question: 'Who’ll take the longer showers this week?', answer: 'sam', guesses: { alex: 'sam', sam: 'alex' }, right: ['alex'] },
      winner: { name: 'sam', categories: [
        { label: 'Steps', who: 'sam' }, { label: 'Best single day', who: 'alex' }, { label: 'Most sleep', who: 'alex' },
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
