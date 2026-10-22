# Week recap stats

The recap reads one JSON object from an attribute of a Home Assistant entity (`recap.stats` and `recap.attribute` in
the config; the attribute defaults to `stats`). Anything can produce it: a template sensor, an automation that calls
`python_script`, AppDaemon, Node-RED, or a script outside Home Assistant that posts to the REST API.

Every section is optional. A card whose data is missing or incomplete is left out, and the recap only plays when at
least two cards are ready. The recap plays stats up to eight days old (by `generated_at`); the home screen offers them
for six days.

[`app/demo.js`](../app/demo.js) has a complete example: the `recap()` function returns the object behind every card in
the README.

## Top level

| Key | Type | Notes |
| --- | --- | --- |
| `generated_at` | ISO 8601 string | Required. |
| `window` | string | Shown on the first card, e.g. `"Mon 28 Sep to Sun 4 Oct"`. |
| `currency` | ISO 4217 code | For money figures. Defaults to `GBP`. |
| `people` | `[{ "id": "alex", "name": "Alex" }, …]` | Up to two. The duels need exactly two. Per-person figures below are keyed by `id`; a winner or `who` may be given as an id or a name. |

## Another producer's shape

If the stats already exist in a different shape, reshape them on the TV instead of in the producer: a script passed to
`push_config.py --adapter` that sets `window.HOUSE_STATS_ADAPTER = function (stats) { …; return stats; }`. It gets a
copy of the attribute and returns the object described here. If it throws, the stats are used as they came.

## Cards, in the order they play

| Key | Card | Shape |
| --- | --- | --- |
| `badge` | The intro reveals "This week you were…" | `{ title, why?, icon? }` |
| `year_recap` | Straight after the intro: a "<label> Wrapped" title, then up to six tiles | Same shape as `month_recap`; needs 3+ tiles |
| `duel` | Steps, two people over the week's paired bars | `{ wins: {id: n}, totals: {id: n}, days: [{ day, <id>: steps, winner? }] }` |
| `belt` | A line under the steps duel | `{ holder, status: "first" \| "new" \| "defends", previous?, weeks? }` |
| `goals` | Days each person met their own goal | `{ label?, <id>: { hit, of }, days: [{ day, <id>: true \| false \| null }], winner? }` (needs `of` ≥ 4) |
| `gym` | Days at the gym each, a dot a day | `{ days: [{ day, <id>: true \| false \| null }], <id>: { days, minutes?, streak? }, goal?, line? }`. Shown when someone went at least once; a person with no entry is left out, so one person gets a card of their own. `goal` is the days a week needs to count (default 2) and `streak` the weeks in a row, this one included, that reached it. The line is `line` if given, else the longest streak of 2 or more ("Sam: 6 weeks without a zero week", only for someone who reached the goal this week), else who went more, else "Both made it N times"; a person alone gets their minutes. |
| `activities` | What we did: the week's activities as rows, oldest first, each person's totals beside them | `{ items: [{ who: <id>, kind: "run" \| "walk" \| "cycle" \| "swim" \| "gym" \| "strength" \| "class" \| "other", name, day: "Mon", date: "YYYY-MM-DD", start?: "HH:MM", minutes?, km?, kcal?, route?: [[lat, lon], …] }], totals?: { <id>: { count, minutes?, km? } } }`. An item needs a known person, `day` and a `name` or `kind`; seven rows show, then "And N more". Without `totals` they are added up from the items. |
| `activities` (routes) | Out and about: up to two routes, the longest first, each on a street map | From the same items: those with a `route` of two or more points (up to 200 is plenty), drawn north up in the person's colour, with the day, km and time. The street map is OpenStreetMap through Home Assistant's map tiles proxy (2026.10 and later; see `recap.street_maps`); without it, or if a tile doesn't load, the line is drawn alone. |
| `month_routes` | Where we went: the last four weeks' routes together on one street map, with each person's count and km | `{ first?: "YYYY-MM-DD", last?: "YYYY-MM-DD", items: [{ who: <id>, kind, date, km?, route: [[lat, lon], …] }] }`. Needs three routes of known people; 60 points a route is plenty at this size. |
| `sleep` | Average night each | `{ avg: {id: minutes}, nights: [{ day, <id>: minutes }], bed_race?: { who, nights, of } }` |
| `restless` | Up in the night | `{ kind: "worst", who, times, day }` or `{ kind: "calm" }` |
| `showers` | The shower duel | `{ <id>: { count, avg_min, avg_temp?, litres?, kwh? }, quickest?: { who, minutes, day } }`. `litres` (whole) and `kwh` (1 dp) are complete week totals, each optional on its own; leave one out if any shower lacks a value. With both people's litres, a gap of at least 10 L and 15% of the larger becomes the line: with equal counts it adds the extra kWh to heat when that is 0.5 or more, with unequal counts it names them instead ("Sam’s 7 showers used 280 more litres than Alex’s 1 this week"). |
| `energy` | The week's energy cost | `{ week_cost, vs_last_week_pct?, last_year_cost?, line? }` |
| `energy.series` | Energy over time: a bar a week, electricity under gas, this week lit | `{ labels: ["W31", …], elec: [cost \| null], gas?: [cost \| null], last_year?: [cost \| null] }`, oldest first, the last twelve shown. Needs four weeks with a figure. `last_year` draws a tick on each bar; the line gives this week's total against the week before. |
| `trends` | The sparkline beside energy | `{ energy_cost: [eight weekly values, oldest first, null for gaps] }` |
| `quiz` | Up to three tiles, one lights up | `{ question, options: [2+], answer_index, reveal?, icon? }`. The first three options show; `answer_index` must be one of them. |
| `records` (tone "bad") | Worth knowing: a record nobody wanted, said plainly | A record with `tone: "bad"` (e.g. the priciest week) plays here, after energy, in the warning colour and without sparkles; "Headline: detail" shows the detail as the headline. |
| `watched` | TV hours, or what we watched in detail | `{ hours?, top?: [{ title, hours? }], apps?: [{ name, hours }], inputs?: [{ name, hours }], days?: [{ day, hours }], binge?: { day, hours } }`. Without `hours`, the TV entity's history is used. With two shows that have hours, or three days, the card shows the shows as bars (up to five), a bar a day, and a line of the inputs (two or more) or else the apps; otherwise the hours and "Mostly <title>". |
| `dinners` | The week's dinners | `{ days: [{ day, meal }] }` |
| `food` | The week on a plate, in place of `dinners` | `{ photos: [paths or URLs], pick: "new" \| "top" \| "leaves", new?: [names], top?: { name, days }, leaves?, leaves_who? }`. Replaces the `dinners` card when 3+ of its photos load. |
| `food.recipes` | New recipe: a card each for up to three tried for the first time | `[{ name, image?, minutes?, servings?, source?, had?, day?, first: true }]`. Only `first: true` ones play. `image` loads like the food photos; without it the name takes the card. |
| `reading` | What we read: up to three books side by side | `{ finished: [{ title, author?, cover?, who? }], current: [{ title, author?, cover?, percent, who? }], year?: {id: n} }`. Finished books (this week) come first, then the ones being read, which need a `percent`. `cover` is an https URL or a Home Assistant path, loaded like the food photos; a book whose cover doesn't load gets a plain one. The line is the year's count (`year`), else "N books finished this week" for two or more. |
| `vacuum` | The robot vacuum's week | `{ name?, cleans, m2?, line?, map_entity?, maps?: [{ floor, picture, when?, m2? }] }`. With `maps` whose pictures load (e.g. the cleaning-path pictures of the week's cleans, a Home Assistant path or URL), up to two floors show side by side; otherwise the map is a camera's picture (`recap.vacuum_map` or `map_entity`). |
| `records` | A new record, with sparkles | `[{ text: "Headline: detail", icon?, tone?: "good" \| "bad" }]`; the first good one is shown here, the first bad one after energy. |
| `house_says` | One sentence in the house's voice | `{ text }` |
| `month_recap` | Up to six tiles | Needs 3+ tiles: `{ label, steps?: {id: n}, duel?: {id: n}, sleep_avg?: {id: minutes}, energy_cost?, best_day?: { who, steps }, best_night?: { who, minutes }, tv_hours?, vacuum_cleans?, vacuum_name? }` |
| `next_week` | Forecast, what's on and a challenge | `{ forecast: [{ day, condition, high, low? }], events?: [{ day: "Tue", date?, time?: "18:30", title }], bins?: { day, what? }, challenge? }`. `condition` uses Home Assistant's weather conditions. Up to five events and the bins show under the forecast in day order. |
| `highlights` | Free-form one-number cards | `[{ label, value? \| text?, unit?, line?, icon? }]`, up to four |
| `guess` | Who called it | `{ question, answer: <id> \| "draw", guesses: {id: <id>}, right: [ids] }` |
| `winner` | The finale | `{ name: <id> \| "draw", categories: [{ label, who? }] }` (up to six) |

Icons are [Material Design Icons](https://pictogrammers.com/library/mdi/) names in camelCase or kebab-case
(`"weather-night"`, `"mdi:owl"`), from the set in [`app/icons.js`](../app/icons.js). Unknown names fall back to a
sparkle.

## Playing it automatically

Set `recap.cue` to a script. When that script starts, an open House plays the recap without a remote and closes when
it ends. Start the script from an automation, for example on Sunday evening once the TV is on and House has been
opened on it. Its running state is the signal, because a non-admin user can't subscribe to custom events.

The recap has no time limit. It ends when the last card finishes or the viewer leaves; Play, Pause and Down on the
remote hold a card for as long as needed, and a held card with no press for `recap.idle_minutes` (default 10) ends it.
Set `recap.done` to an action, and House calls it with `reason` (`done`, `back`, `idle` or `left`) as the recap ends,
if the cue started it or the cue script was running when it began; a recap started from the remote alone calls nothing.
The cue script can wait for that instead of guessing how long the recap runs:

```yaml
house_tv_recap_done:
  fields: { reason: {} }
  sequence:
    - event: house_tv_recap_done
      event_data: { reason: "{{ reason }}" }
tv_week_recap:
  sequence:
    # ... open House on the TV ...
    - wait_for_trigger:
        - trigger: event
          event_type: house_tv_recap_done
      timeout: "00:30:00"   # only if House went away without saying
```
