# HIT THE NOSE

A one-screen satirical arcade game for **Android, iOS and the web**.
Concept by Daniel Astudillo Estrella.

He leans toward the next line. You have seconds to stop him. Every line he takes
feeds the machine behind him: more generals, more money, more meat for the devil.
Every line you stop makes generals go *puff*, reverses the baby conveyor and lets
people escape through the EXIT.

## How to play

| Action | Points | Keys |
|---|---|---|
| **PUNCH** | +5 | `1` / `J` / `←` |
| **SLAP** | +1 | `2` / `K` / `↓` |
| **BLOW** | joker | `3` / `L` / `→` / `Space` |

Every line comes with a **TARGET**. As in darts, you must hit it **exactly**
before the NEXT LINE timer runs out:

- **Target 12** = PUNCH + PUNCH + SLAP + SLAP.
- **Exact hit:** generals and politicians vanish, the money and meat piles shrink, the conveyor reverses, the devil's laugh cuts off and people run out.
- **Over the target (BUST) or too slow:** he snorts. More generals march in, laughing, money and meat pile up, the devil laughs and the conveyor advances.
- **Fast hits** (more than 45% of the time left) and **combos** do more damage and free more people.
- **BLOW:** each exact hit charges one pip (max 3). Spend 2 pips to blow the line off the table. The cloud freezes the machine, the generals grin, freeze and collapse into dust, and the exit opens wide.
- The **MACHINE** meter at the top is the whole game. Empty it to win (*THEY WOKE UP. THEY GOT OUT.*), fill it and you lose. Babies that reach the devil also feed the machine.
- Lines come faster and targets get bigger as you play. **NEXT ROUND** keeps your PEOPLE OUT score and raises the difficulty.

The main score is **PEOPLE OUT**. Your best score is saved on the device and
unlocks the BEST SCORE AWARD screen.

### Open design questions from the concept, as decided here
- **Does SLAP remove money stacks?** Money and meat piles track the machine meter, so every exact hit, whether it ends on a slap or a punch, removes them.
- **Is BLOW always available?** No. It is charged by exact hits, which makes it a reward and an emergency joker.

Both are single constants or functions in `www/js/game.js` (`BLOW_COST`, `MAX_PIPS`, `PTS`, `resolve()`).

## Run it on the web

```bash
npm start            # serves www/ at http://localhost:8080
```

`www/` is a plain static site with no build step and no runtime dependencies. You can upload it to any static host (GitHub Pages, Netlify and so on). It also works as an installable PWA.

## Build for Android and iOS (Capacitor)

```bash
npm install
npx cap add android          # once
npx cap add ios              # once (macOS + Xcode required)
npm run android              # sync + open in Android Studio, then Run / Build APK/AAB
npm run ios                  # sync + open in Xcode, then Run / Archive
```

After changing anything in `www/`, run `npx cap sync`. On phones, haptic feedback goes through `@capacitor/haptics` when it is installed. Otherwise the game falls back to `navigator.vibrate`.

## STATS window

The STATS screen (title → STATS) shows a pixel world map of where people are playing, TOP COUNTRIES, PLAYERS, AVG. PLAY TIME and a DOWNLOADS pie chart.

No tracking backend is connected yet, so it shows **sample figures labelled DEMO STATS**. To show real data, set the endpoint in `www/index.html`:

```js
window.HTN_CONFIG = { statsEndpoint: 'https://your-api.example.com/htn/stats' };
```

The endpoint must return JSON in this shape. The label then switches to **LIVE**:

```json
{
  "playingNow": 2481,
  "players": 84206,
  "avgPlayTimeSec": 402,
  "downloads": 128540,
  "topCountries": [{ "name": "USA", "players": 582, "lon": -98, "lat": 39 }],
  "hotspots": [[2, 46, 110]],
  "downloadsByRegion": [{ "label": "USA", "value": 52300, "color": "#e8242a" }]
}
```

`hotspots` entries are `[lon, lat, players]`. Any field you leave out falls back to the demo value. Collecting these numbers needs your own analytics or backend and, in most stores, a privacy disclosure.

## Art

- **Style:** the game is drawn in the style of the HIT THE NOSE poster. It has inked caricatures, painted shading, a red-lit devil, the baby conveyor, a yellow-lit EXIT with silhouetted crowds, a taped fist, film grain and a worn poster frame. The type is Anton for body text and Bungee for the 3D titles. Both fonts are bundled under the SIL Open Font License, in `www/fonts/`.
- **How it's drawn:** everything is drawn in code (`www/js/paint.js`) at your screen's resolution, so it stays sharp on every phone.
- **The man:** he is an invented caricature. The game does not depict any real person.
- **Your own painted art:** you can drop in hand-painted or generated art for any layer. See [docs/ART_GUIDE.md](docs/ART_GUIDE.md).
- **Disclaimer image:** `www/assets/political-satire.jpg` is shown at launch and from the title screen.
- **Award image:** `www/assets/best-score-award.jpg` is shown on a new best score.
- **STATS window:** it keeps the pixel-art look of `design/stats-reference.jpg`.

## Project layout

```
www/
  index.html, css/style.css, manifest.webmanifest
  js/type.js    poster typography (Anton / Bungee, 3D extruded titles)
  js/paint.js   painted poster-style renderer + optional art overrides
  js/audio.js   synthesised music loop (gets brighter as people escape) + SFX + laughter
  js/font.js, js/art.js, js/stats.js   pixel-art STATS window
  fonts/        bundled OFL fonts
  assets/art/   optional painted art overrides (art-manifest.js)
  js/game.js    rules, game loop, screens, touch/keyboard input
tests/smoke.mjs headless Playwright test: plays exact hits, a bust, BLOW, a full win, STATS
capacitor.config.json, package.json
```

## Test

```bash
npm test     # needs Playwright + Chromium; screenshots land in tests/out/
```
