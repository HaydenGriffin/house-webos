# Changelog

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
