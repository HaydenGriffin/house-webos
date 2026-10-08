<p align="center">
  <img src="docs/images/hero.png" alt="House for webOS: a Home Assistant panel on an LG TV, with lights, TV sources, music and who's home" width="100%">
</p>

# House for webOS

A Home Assistant panel for LG TVs, built to be read from the sofa and driven with the remote. It shows the lights,
the TV's sources, what's playing and who's home, and every Sunday it can play a Wrapped-style recap of the week at home.

**[Try the demo in a browser →](https://haydengriffin.github.io/house-webos/)** It runs on made-up data. Use the
arrow keys and Enter; add `&recap` to the URL for the week recap.

## What it does

- **One screen, the whole house.** Light tiles with brightness, any number of action tiles (scripts, scenes, any
  Home Assistant action), TV sources with the current one lit, the speakers with play, skip and a playlist button, and
  a chip for each person with the room they're in.
- **Made for a remote.** Arrows move by on-screen geometry, so the nearest control in that direction always gets focus.
  OK presses, Back closes, the Magic Remote pointer works, and it closes itself after a minute idle. A door left open
  and the next calendar event show at the top.
- **Live.** It holds one websocket to Home Assistant and subscribes to only the entities it shows, using the compressed
  `subscribe_entities` stream, so a 2021 TV keeps up.
- **Your week at home.** Full-screen cards with count-ups, paired bar charts, a quiz, a guess-the-week reveal and a
  winner with a drumroll. The cards come from one JSON object that any automation can produce; see
  [`docs/recap-stats.md`](docs/recap-stats.md). An automation can start it on the TV with nobody at the remote.

<img src="docs/images/recap.png" alt="Six recap cards: a steps duel, a quiz, the week's dinners, the energy bill, the robot vacuum's week and the winner" width="100%">

## Requirements

- An LG TV running webOS. It was built on a 2021 C1 (webOS 6, Chromium 79), so the code is ES5 with no build step.
- The TV in [Developer Mode](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) and the
  [webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-installation) (`ares-*`) on your computer.
- A Home Assistant user for the TV. Make it non-admin, ideally "local access only", and create a long-lived access
  token for it from its profile page.

## Install

The package never contains your config or token, so the same IPK works for every home and is safe to share. The
config goes onto the TV separately, next to the installed app.

1. Build the package and install it on the TV:

   ```bash
   python3 tools/package.py
   ares-setup-device            # once, to add the TV
   ares-install -d <tv> dist/io.github.haydengriffin.house_1.1.0_all.ipk
   ```

2. Copy `config.example.json` to `config.json` and fill in the websocket URL, the token and your entities. Everything
   except `url` and `token` is optional; leave out a section and its panel disappears. `--token-file` keeps the token
   in its own file instead.

3. Put the config on the TV over SSH, then open House:

   ```bash
   python3 tools/push_config.py config.json --ssh root@<tv>                                  # rooted TV
   python3 tools/push_config.py config.json --ssh "-p 9922 -i ~/.ssh/tv_webos prisoner@<tv>"   # Developer Mode
   ```

   It writes `config.js` into the app's folder through SSH's stdin, so the token never appears in a command line.
   Reinstalling the IPK removes it, so push the config again after every install. The rooted route is the tested
   one; whether Developer Mode's SSH user may write into the app folder depends on the firmware.

To open House quickly, pin it to the TV's home row or put it on a Quick Access number. Home Assistant can also open it
with the LG webOS integration's `media_player.select_source`, or `webostv.command` with
`system.launcher/launch` and `{"id": "io.github.haydengriffin.house"}`.

Developer Mode sessions run out unless they're extended; the Developer Mode app on the TV shows the time left.

## Configuration

| Key | What it is |
| --- | --- |
| `url`, `token` | `ws://<home assistant>:8123/api/websocket` and the TV user's token. |
| `title`, `locale`, `idle_seconds` | The heading, the date and time format (e.g. `en-GB`), and the auto-close delay. |
| `lights` | `[{ name, entity }]`. A press toggles the entity. |
| `tiles` | `[{ name, sub?, icon?, toast?, entity?, action?, confirm?, visible? }]`. `action` is `{ service: "domain.service", data?, target? }`; with only `entity`, a press toggles it. `confirm: true` (or the armed label) makes it a two-press action: the first press arms it red for 5 s. `visible: { entity, states }` shows it only while the entity is in one of those states. |
| `door` | A `binary_sensor`; a chip appears while it's on, with how long for. |
| `glance` | Header chips: `[{ entity, text?, icon?, attribute?, hide?, hours?, within_days? }]`. `text` takes `{value}`, `{attr.x}` and `{day}` (the value read as a date: today, tomorrow or the weekday), e.g. `"Tonight · {value}"`. A chip shows only while there's something to say. |
| `quick` | Actions that lead the lights grid and take the first focus, e.g. Pause and Lights up while something plays. Same shape as `tiles`. |
| `footer` | Pill buttons after This week, same shape as `tiles`, e.g. Everything off. |
| `calendars` | Calendar entities for the "Next" line. |
| `tv` | `{ title?, source_sensor?, sources: [{ name, icon?, action }], wide? }`. The source whose `name` matches the sensor's state is lit; the sensor's `line` attribute, if any, shows beside the title. |
| `music` | `{ title?, player, extra?, toggle? }`. `extra` is a pill button with an `action`; `toggle` is a switch row for an `input_boolean` with `on`/`off` labels, and optional `action_on`/`action_off` to run instead of toggling it. |
| `people` | `[{ name, person, room? }]`. `room` is any sensor whose state is the room name. |
| `recap` | `{ stats, attribute?, cue?, done?, idle_minutes?, ask?, tv?, vacuum_map? }`. `done` is an action called with `reason` when the recap ends. Fresh stats nobody has played on this TV are offered on the home screen ("Your week at home is ready") unless `ask` is false. See [`docs/recap-stats.md`](docs/recap-stats.md). |

Icons are [Material Design Icons](https://pictogrammers.com/library/mdi/) names in camelCase, from the set in
[`app/icons.js`](app/icons.js); add any path you need there.

## Development

Open `app/index.html?demo` in Chrome. The layout is fixed at 1920×1080, the TV's resolution; in a smaller window the
demo scales to fit. `app/demo.js` holds the demo home and the full recap stats. The README images are rendered from the
demo by [`tools/showcase`](tools/showcase). To try it against your own Home Assistant, write the config into the
app folder with `python3 tools/push_config.py config.json --out app/config.js` (git ignores it, and the package leaves it
out). Tests: `python3 -m unittest discover -s tests` and `node --test`.

## Licence

[MIT](LICENSE). Bundled icons are Apache 2.0 and the fonts are SIL OFL 1.1; see [NOTICE](NOTICE).
