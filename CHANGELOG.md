# Changelog

## Unreleased

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
