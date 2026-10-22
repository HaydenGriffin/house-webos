# Changelog

## 1.6.0

- Recap: "Out and about" draws each route on a street map: OpenStreetMap tiles through Home Assistant's map tiles proxy
  (2026.10 and later), with the token HA hands out for it, darkened to match. They are fetched before the recap starts;
  a map shows only when all its tiles came, else the line is drawn alone as before. `recap.street_maps: false` turns
  them off.
- Recap: `month_routes`, "Where we went": the last four weeks' routes together on one map, in each person's colour,
  with how many routes and how far each.
- Recap: one energy card (the twelve weeks, with the week, last week and a year ago in its line) instead of two that
  could disagree; `heating` gets its own card, the gas a week as bars with how cold it was.
- Recap: Showers replaces the shower duel: each person's minutes a day as paired bars (`showers.days`), nobody winning.
- Recap: What we watched shows where the hours went as one split bar, and each day's hours; the week on a plate captions
  each photo with its day and dish (`food.photos` items may be `{ picture, day, name }`); Next week is a calendar, a
  column a day; Max's path pictures are shown tall with the robot app's header cropped off.
- Recap: the next card waits for the last one to go, so two never show at once.
- Home: the header is one row (the room, the chips, the clock) with the date and what's next on one line under it, so
  neither is cut short; a chip you can't press has no pill; `tv.players` puts what's playing on the TV card.

## 1.5.0

- Home follows the house's living-room tablet: the room's name and a short line, one notice row (`notices`) with its
  actions, the TV as the main card (what's on, quick actions, sources, Movie time), a `scenes` row, lamp tiles with a
  `warmth` tile, and the speakers on one row. `music.toggle` is gone.
- Lists: `lists` and a chip's `open: "list:0"` open the shopping list grouped by aisle (`aisles`); OK ticks an item off,
  with Undo for six seconds, and Back closes it.
- Recap: "What we did" (the week's activities) and "Out and about" (routes drawn from GPS points), a detailed "What we
  watched" (shows, days, inputs), a card per new recipe, "Energy over time" (12 weeks, electricity and gas, last year),
  bad news as "Worth knowing" instead of a record, both floors' cleaning maps, and next week's events.

## 1.4.0

- Recap: `gym`, the week's days at the gym for each person with a dot a day, after the goals card; the line is the
  longest run of weeks that reached the goal ("Sam: 6 weeks without a zero week"), else who went more.
- Recap: `reading`, "What we read": up to three books, finished first, then the ones being read with a progress bar,
  covers loaded like the food photos; the line is the year's count.
- Glance chips, status parts and people's notes count a list: `{value}` is how many items it has, or with `filter` how
  many match (e.g. today's parcels still to come).

## 1.3.0

- Lights: CH + and CH − brighten and dim the light in focus (`step`, default 10%), and `action` runs instead of the
  plain toggle, e.g. a script that follows Adaptive Lighting.
- `status`: one line under the title, after the next event, made of glance-style parts ("Heating to 20° · 1 parcel
  coming").
- `glance_max` (default 3): past it, the extra chips take turns in the last place, so a long dinner name can't push the
  clock off screen.
- `people[].notes`: glance-style lines after the room ("At work", "Gym today"). The people chips give way with an
  ellipsis before the footer runs off screen.
- `guests` and `private: true`: while guests are in, private chips, notes, actions and the recap stay hidden.
- The glance template rules live in `app/glance.js`, with tests.

- `theme` in the config: `"afterglow"` sets House in the poster style of the Afterglow TV music app (ink and paper,
  Archivo, hairlines, square corners, focus inverts to paper, chosen is ticked), home screen and week recap. The default
  look is unchanged; the theme's stylesheet and fonts load only when it's chosen. Try it with `?demo&theme=afterglow`.

## 1.2.0

- Recap: the shower duel says whose showers used more water this week, with the extra energy to heat it, or both
  shower counts when they differ.
- Recap: a quiz answer outside the three tiles shown leaves the card out instead of lighting nothing.
- The IPK carries the full Apache 2.0 and SIL OFL 1.1 texts for the bundled icons and fonts.

## 1.1.0

- The package never contains the config: `tools/push_config.py` writes it to the TV after installing, and
  `tools/package.py` builds from an allow-list and stops on anything that looks like a token.
- Recap: an optional stats adapter in `config.js` reshapes another producer's stats.
- Recap: Play, Pause and Down hold a card; it ends on completion, Back, or a long idle pause, and `recap.done` reports
  why. The food photos replace the dinners list when they load; month tiles need both people.
- Home: glance chips beside the clock, quick actions first, footer actions, two-press confirm on any action,
  `action_on`/`action_off` on the toggle row, and fresh recap stats offered on the home screen.

## 1.0.0

- Initial public release.
