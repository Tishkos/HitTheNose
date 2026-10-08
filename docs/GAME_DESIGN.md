# HIT THE NOSE: Gameplay and Requirements

Concept by Daniel Astudillo Estrella. This document describes the game as it is built in this repository. It covers the gameplay, the exact rules and numbers, and every requirement from the concept with its status.

---

## 1. The game in one paragraph

HIT THE NOSE is a one-screen satirical arcade game for Android, iOS and the web. A man sits at a table with a line of cocaine in front of him. Behind him stands the machine he feeds: generals carrying meat, politicians carrying cash, piles of money and meat, a conveyor carrying babies toward a laughing devil, and an EXIT that people can escape through. The player has three actions, **PUNCH, SLAP and BLOW**, and one goal: **stop him before he takes the next line.** Every line he takes makes the machine stronger. Every line the player stops weakens it and lets people get out. The score is **PEOPLE OUT**.

---

## 2. Controls

| Action | Points | Touch | Keyboard |
|---|---|---|---|
| **PUNCH** | **+5** | red button | `1`, `J`, `←` |
| **SLAP** | **+1** | yellow button | `2`, `K`, `↓` |
| **BLOW** | joker (no points) | cream button | `3`, `L`, `→`, `Space` |
| Pause | – | ❚❚ in the top bar | `Esc`, `P` |

There is no movement, no inventory and no other attack. The challenge is timing and counting.

---

## 3. The core rule: hit the target exactly, like darts

Every line comes with a **TARGET** number and a **NEXT LINE** timer.

- The player must reach the target **exactly** before the timer runs out.
- PUNCH adds 5 and SLAP adds 1, so **TARGET 12 = PUNCH + PUNCH + SLAP + SLAP**.
- **Exact hit:** he misses the line. The player succeeds.
- **Over the target (BUST):** the player loses the advantage at once and he snorts. This is the darts "bust" rule from Daniel's message.
- **Under the target when time runs out (TOO SLOW):** he snorts.

The panel under the scene always shows **TARGET / YOU / LEFT**, so the player only has to finish LEFT. Fast players punch while LEFT is 5 or more and slap to finish. Careful players can slap all the way, but slowly.

While the timer runs, the man visibly **leans down toward the line**. When he gets there, he snorts.

---

## 4. What happens behind him

The machine has a meter (**MACHINE**, top of the screen, 0–100). It **starts at 55**. Everything behind the man follows it.

| Machine meter | Generals and politicians | Money and meat pile | Babies on the belt |
|---|---|---|---|
| goes **up** | more march in, laughing | grows | more come, belt moves faster |
| goes **down** | vanish one by one with a *PUFF* | shrinks with puffs of dust | belt stops, then runs backwards |

- Up to **6 figures**: 3 generals with meat on the left, 3 politicians with cash on the right. The count shown is `ceil(meter / 100 × 6)`.
- The pile has up to **10 bricks** of money and meat. The count shown is `round(meter / 100 × 10)`.
- **The devil gets meat:** a baby that reaches the devil's mouth is swallowed (*GULP*), and the machine gains **+3**.

### On a success (exact hit)
- The machine **loses 11**. A **fast** hit (45% or more of the time left) loses **6 more**. A **combo** of successes in a row loses up to **8 more** (+2 per streak step, up to 4 steps).
- **2 people** wake up and run out. A fast hit frees **+1**, and a combo of 3 or more frees **+1**.
- The EXIT lights up for 2.4 s, the belt **jerks to a stop and reverses**, and the devil's and generals' **laughter cuts off**.
- Text pops up: **BULLSEYE!**, **FAST!**, **COMBO X3**.

### On a failure (bust or too slow)
- The machine **gains 16** on a bust and **14** when too slow.
- He **snorts** (*SNOOORT!*), then grins with a powdered nose.
- The generals and the devil **laugh** (*HA HA HA!*), and new generals arrive.
- The belt **jumps forward**, and a new baby is added.
- The EXIT **locks** for 1.6 s, so escaping people stop (*LOCKED!*).
- The combo resets, and BLOW loses one charge.

---

## 5. BLOW: the dust cloud

- Every exact hit charges **1 pip** (maximum 3). Every failure removes 1 pip.
- With **2 pips**, BLOW can be used while a line is on the table.
- BLOW **blows the cocaine off the table** and counts as a success:
  - The machine **loses 24**.
  - The cloud spreads through the room. Generals and politicians **grin, freeze (turn pale), then collapse into dust**, and the devil goes silent and grey.
  - The belt reverses for a long time, the EXIT opens wide for 3.5 s and **6 people** escape.
- When BLOW is ready, its button flashes white.

---

## 6. People and score

- Sleeping people stand by the EXIT as grey, drooping silhouettes (*z z z*).
- Woken people are lit in yellow and run into the light of the EXIT.
- **PEOPLE OUT** goes up only when someone actually walks through the EXIT.
- The music adds brighter phrases as PEOPLE OUT grows (at 4, 15 and 30).
- **INCOMING** (top right) shows how many babies are on the belt.
- **NEXT LINE** (the timer bar) shows the time left before he can snort.

---

## 7. One round: start to end

1. **NEXT LINE! HIT EXACTLY: 12** appears in the middle of the scene for 0.9 s, then *GO*.
2. The timer runs and he leans toward the line. The player punches and slaps.
3. The line is resolved (exact, bust, too slow or BLOW) and the scene reacts for 1–1.6 s.
4. The next line arrives, **faster and with a bigger target**.

### Difficulty curve
Let `d` be the number of lines already played, plus 6 for every round after the first.

- **Time per line:** `10 − 0.3·d` seconds, never below **4.2 s**.
- **Target range:** from `6 + d/2` (max 22) to `13 + d` (max 34).
- A target never repeats twice in a row.
- A **TIP** (for example *TIP: 1 PUNCH + 3 SLAPS*) is shown for the first 3 lines of round 1 only.

### Win: breaking the machine
When the machine meter reaches **0**:
- The remaining generals puff away and the pile disappears.
- The belt reverses completely, the devil fades and everyone left walks out.
- The man stays **alone at an empty table**.
- The final screen reads: **PEOPLE OUT: [number] / THEY WOKE UP. THEY GOT OUT.**
- **NEXT ROUND** keeps the PEOPLE OUT score and starts a harder round.

### Lose
When the machine meter reaches **100**:
- The end screen reads **HE KEPT SNORTING / PEOPLE OUT: [number] / THE MACHINE KEPT GOING.**
- **TRY AGAIN** starts over.

### Best score
The best PEOPLE OUT is saved on the device. Beating it shows the **BEST SCORE AWARD** image.

---

## 8. Screens

| Screen | Contents |
|---|---|
| **Disclaimer** (at launch) | The POLITICAL SATIRE image and an I UNDERSTAND button. It can be opened again from the title screen. |
| **Title** | Poster layout: SAVE THE PEOPLE / STOP THE SYSTEM, the red list (MEAT, MONEY, BABIES, GENERALS, POLITICIANS, THE DEVIL), PUNCH AGAIN. BUY TIME., the HIT THE NOSE lettering, the four comic panels (PUNCH! / STOP THE GENERALS! / GET THEM OUT! / FIGHT THE DEVIL!), PLAY NOW, HOW TO PLAY, STATS, SOUND, and AN ARCADE GAME FOR A BETTER TOMORROW?. A computer-played demo runs behind it. |
| **How to play** | All the rules above in short lines. |
| **Game** | The scene, the top bar (PEOPLE OUT, ROUND, MACHINE, INCOMING, pause), the TARGET/YOU/LEFT panel, the NEXT LINE timer, tips and combo, and the three buttons. |
| **Pause** | RESUME and MENU. The game also pauses by itself when the app goes to the background. |
| **Result** | Win or lose text, round, best combo, best ever, NEXT ROUND or TRY AGAIN, STATS and MENU. |
| **Best score award** | The BEST SCORE AWARD image with PEOPLE OUT: n. |
| **Stats** | See section 10. |

---

## 9. Look and sound

- **Visual style:** the HIT THE NOSE poster. That means inked caricatures, painted shading, a red burning skyline, a horned devil with glowing eyes, generals with meat, politicians with cash, a baby conveyor under an "A BRIGHTER TOMORROW (TM)" billboard, a yellow-lit EXIT with silhouetted crowds, a taped fist striking from the bottom of the screen, film grain and a worn poster frame. The colours are black, red, mustard yellow, olive and cream.
- **Type:** Bungee for the 3D block titles and Anton for the condensed poster text.
- **The man:** an invented caricature with a big red nose. He is deliberately **not** a real person.
- **Music:** an aggressive electronic loop that gets brighter as people escape.
- **Sound effects:** punch, slap, blow, puff, coin-like escape blips, snort, bust buzzer, devil chomp, countdown ticks, and win and lose jingles.
- **Laughter:** generals and the devil laugh on a failure. The laughter **stops abruptly** on a success or when BLOW freezes them.
- **Vibration:** on punch, slap, blow and failure. It uses Capacitor Haptics in the apps and the browser's vibration on the web.

---

## 10. STATS window

It is built from the STATS reference image, in pixel art.

- **Header:** HIT THE NOSE, then **STATS**.
- **Pixel world map** that lights up where people are playing. **PLAYING NOW** is shown under it.
- **TOP COUNTRIES:** rank, country and player count.
- **PLAYERS**, **AVG. PLAY TIME** and **DOWNLOADS**. DOWNLOADS is a pixel pie chart by region, with the total in the centre.
- **Data:** there is no tracking server yet, so it shows clearly labelled **DEMO STATS** with sample figures. When `statsEndpoint` is set in `www/index.html`, it shows real data and the label changes to **LIVE**. The data format is in the README.

---

## 11. Requirements checklist

| # | Requirement (from the concept and Daniel's messages) | Status |
|---|---|---|
| 1 | One-screen satirical arcade game | ✅ |
| 2 | Man at a table with lines of cocaine; goal is to stop the next line | ✅ |
| 3 | Behind him: generals, politicians, money, baby conveyor, laughing devil, exit | ✅ |
| 4 | Exactly three actions: PUNCH, SLAP, BLOW. No movement or inventory | ✅ |
| 5 | PUNCH = 5 points, SLAP = 1 point | ✅ |
| 6 | Reach an exact number of points in a set time ("12 points in 10 seconds, not more, not less") | ✅ TARGET + NEXT LINE timer |
| 7 | Too many points = fail, like darts | ✅ BUST |
| 8 | Fail: more generals, more money, more meat; the devil gets meat | ✅ |
| 9 | Succeed: fewer generals, less money, less meat; more people escape | ✅ |
| 10 | You must be fast | ✅ shrinking timer, fast bonus, combos |
| 11 | Too slow: he snorts, generals laugh, the devil laughs, the conveyor advances | ✅ |
| 12 | Punches stop and reverse the conveyor; generals vanish one by one in puffs | ✅ |
| 13 | BLOW blows the line away; generals grin, freeze, collapse into dust; exit opens | ✅ |
| 14 | Lines come faster as the game goes on | ✅ |
| 15 | Main score PEOPLE OUT, counted only at the exit | ✅ |
| 16 | NEXT LINE and INCOMING indicators, plus a combo indicator | ✅ |
| 17 | Breaking the machine: man alone at an empty table, final screen with PEOPLE OUT and "THEY WOKE UP. THEY GOT OUT." | ✅ |
| 18 | Loud seventies arcade style, black, red and yellow, comic puffs, poster look | ✅ |
| 19 | Aggressive music loop, brighter with each escape; laughter cuts off on success | ✅ |
| 20 | A new player understands it within 30 seconds | ✅ tips, how-to screen, comic panels. Still needs testing with real players |
| 21 | STATS window with all requested labels, world map and pie chart; DEMO STATS when not connected | ✅ |
| 22 | Use the provided art: satire disclaimer, best score award, stats reference, poster style | ✅ |
| 23 | Android, iOS and web | ✅ web runs now. Android and iOS projects are set up with Capacitor and must be built on a computer with Android Studio or Xcode |

### Open questions from the concept, and how they were decided
- **Does SLAP also remove money stacks?** The money and meat pile follows the machine meter, so every exact hit removes stacks, whether the last blow was a slap or a punch.
- **Is BLOW always available, or does it build up?** It builds up: exact hits charge it, and it costs 2 charges.

All the numbers in this document are constants in `www/js/game.js` (`PTS`, `START_HEALTH`, `BLOW_COST`, `MAX_PIPS`, `newLine()`, `resolve()`), so they are easy to tune.

### Deliberately not included
- **The poster's real face:** a real, recognisable politician's face is not used for the man. He is an invented caricature.
- **The Atari logo:** it is another company's trademark.
- **Live stats:** these need a tracking server, which does not exist yet.

### Next steps
1. **Play-test:** test with new players. Do they understand within 30 seconds that stopping the line weakens the machine?
2. **Tune difficulty:** adjust timer length and target range based on the play-tests.
3. **Build the apps:** build and sign them in Android Studio and Xcode, then submit to the stores.
4. **Live stats:** connect a stats server to the STATS window.
