// HIT THE NOSE: game loop, rules, screens and input.
//
// Core rule (darts-style checkout): every line comes with a TARGET. PUNCH adds
// 5, SLAP adds 1. Hit the target EXACTLY before time runs out and he misses
// the line. Go over (BUST) or run out of time and he snorts: the machine grows.
// BLOW is a charged joker that blows the line away and paralyses the machine.
(function () {
  const P = Paint;
  const W = 240, H = 426;
  const display = document.getElementById('game');
  const ctx = display.getContext('2d');
  let K = 1; // device pixels per logical unit

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const COL = { cream: '#efdcb0', red: '#d6201c', darkRed: '#7a0a0a', yellow: '#f5c518', ink: '#150b07', panel: '#110a08', olive: '#55602c' };

  // ---------- tuning ----------
  const PTS = { punch: 5, slap: 1 };
  const COOLDOWN = { punch: 0.17, slap: 0.08 };
  const BLOW_COST = 2, MAX_PIPS = 3;
  const START_HEALTH = 55;
  // generals (left, with meat) and politicians (right, with money); index = order of arrival
  const SLOTS = [
    { x: 2, y: 112, kind: 'gen' }, { x: 198, y: 112, kind: 'pol' },
    { x: 34, y: 104, kind: 'gen' }, { x: 166, y: 104, kind: 'pol' },
    { x: 14, y: 90, kind: 'gen' }, { x: 186, y: 90, kind: 'pol' },
  ];
  const DRAW_ORDER = [4, 5, 2, 3, 0, 1];
  // pile of money and meat on the floor, bottom right
  const PILE = [[178, 226], [192, 226], [206, 226], [220, 226], [185, 218], [199, 218], [213, 218], [192, 210], [206, 210], [199, 202]];
  const QUEUE = [[32, 216], [40, 216], [48, 216], [36, 212], [44, 212]];
  const BELT = { x0: 246, y0: 58, x1: 146, y1: 88 };
  const DOOR = { x: 7, y: 190 };
  const SHIRTS = ['#d6201c', '#f5c518', '#3aa0c8', '#efdcb0', '#7ab040', '#ff8a1a'];

  let best = 0;
  try { best = parseInt(localStorage.getItem('htn-best') || '0', 10) || 0; } catch (e) { /* ignore */ }

  // ---------- game state ----------
  function newGame(opts = {}) {
    const G = {
      ai: !!opts.ai, silent: !!opts.ai, round: opts.round || 1, out: opts.out || 0,
      health: START_HEALTH, streak: 0, bestStreak: 0, pips: 0, lines: 0, snorts: 0, saved: 0,
      t: 0, lean: 0, nose: 0.2, head: { rx: 0, ry: 0, dir: 1 }, face: null,
      slots: SLOTS.map(() => ({ present: false, a: 0, puffAt: -1 })),
      piles: 0, babies: [], beltPhase: 0, beltRev: 0, beltStop: 0, spawnT: 0,
      people: [], exitOpen: 0, exitShut: 0, laughT: 0, freeze: 0, devilOpen: 0,
      parts: [], texts: [], fist: null, shake: 0, flash: null, cooldown: 0,
      line: null, ending: null, endT: 0, machineA: 1, aiT: 0, pressed: {},
    };
    for (let i = 0; i < QUEUE.length; i++) addSleeper(G, true);
    for (let i = 0; i < 3; i++) G.babies.push({ u: 0.15 + i * 0.25 });
    syncMachine(G, true);
    newLine(G);
    return G;
  }

  function sfx(G, name, ...a) { if (!G.silent && Sound[name]) Sound[name](...a); }
  function buzz(G, ms, heavy) {
    if (G.silent) return;
    const hp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (hp) hp.impact({ style: heavy ? 'HEAVY' : 'LIGHT' }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(ms);
  }

  function addSleeper(G, instant) {
    const sleepers = G.people.filter((p) => p.state === 'sleep');
    if (sleepers.length >= QUEUE.length) return;
    const used = new Set(sleepers.map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const [qx, qy] = QUEUE[slot];
    G.people.push({ x: instant ? qx : 52, y: qy, slot, state: 'sleep', seed: Math.random() * 10, color: SHIRTS[randi(0, SHIRTS.length - 1)], awake: false });
  }

  function wake(G, n) {
    const sleepers = G.people.filter((p) => p.state === 'sleep').sort((a, b) => a.x - b.x);
    for (let i = 0; i < n; i++) {
      let p = sleepers[i];
      if (!p) { p = { x: 52, y: 216, seed: Math.random() * 10, color: SHIRTS[randi(0, SHIRTS.length - 1)] }; G.people.push(p); }
      p.state = 'run'; p.awake = true; p.delay = i * 0.14;
    }
  }

  // ---------- lines (rounds) ----------
  function newLine(G) {
    G.lines++;
    const d = G.lines - 1 + (G.round - 1) * 6;
    const T = Math.max(4.2, 10 - d * 0.3);
    const lo = Math.min(22, 6 + Math.floor(d / 2)), hi = Math.min(34, 13 + d);
    let target = randi(lo, hi);
    if (G.line && target === G.line.target) target = target === hi ? lo : target + 1;
    G.line = { phase: 'ready', t: 0.9, T, timeLeft: T, target, pts: 0, result: null, rt: 0, aiFail: Math.random() < 0.3 };
  }

  function hint(G) {
    const L = G.line, left = L.target - L.pts;
    if (G.ai || G.round > 1 || G.lines > 3 || left <= 0) return null;
    const p = Math.floor(left / 5), s = left % 5, parts = [];
    if (p) parts.push(p + (p > 1 ? ' PUNCHES' : ' PUNCH'));
    if (s) parts.push(s + (s > 1 ? ' SLAPS' : ' SLAP'));
    return parts.join(' + ');
  }

  const headY = (G) => 108 + G.lean * 58 + G.head.ry;
  const nosePt = (G) => [120 + G.head.rx, headY(G) + 47];

  function act(G, kind) {
    const L = G.line;
    if (G.ending) return;
    if (kind === 'blow') {
      if (L.phase !== 'live') return;
      if (G.pips < BLOW_COST) { sfx(G, 'whiff'); popup(G, 'CHARGE IT FIRST!', 120, 150, '#9fd8f0', 1.2); return; }
      G.pips -= BLOW_COST;
      G.pressed.blow = 0.12;
      blowCloud(G);
      sfx(G, 'blow'); buzz(G, 40, true);
      resolve(G, 'blow');
      return;
    }
    if (L.phase !== 'live' || G.cooldown > 0) { if (L.phase !== 'live') sfx(G, 'whiff'); return; }
    G.cooldown = COOLDOWN[kind];
    G.pressed[kind] = 0.1;
    L.pts += PTS[kind];
    G.head.dir *= -1;
    const [nx, ny] = nosePt(G);
    if (kind === 'punch') {
      G.head.rx = 26 * G.head.dir; G.head.ry = -8;
      G.face = { f: 'hit', t: 0.28 };
      G.fist = { kind, t: 0, side: -G.head.dir, tx: nx, ty: ny };
      G.shake = 4; G.nose = Math.min(1, G.nose + 0.06);
      burst(G, nx, ny, '#f5c518', 10);
      popup(G, 'POW!', nx + rand(-20, 20), ny - 44, '#f5c518', 2);
      sfx(G, 'punch'); buzz(G, 25, true);
    } else {
      G.head.rx = 12 * G.head.dir;
      G.face = { f: 'hit', t: 0.14 };
      G.fist = { kind, t: 0, side: G.head.dir, tx: nx, ty: ny };
      G.shake = 1.5; G.nose = Math.min(1, G.nose + 0.02);
      burst(G, nx, ny, '#ffffff', 5);
      popup(G, 'SLAP!', nx + rand(-24, 24), ny - 40, '#efdcb0', 1.6);
      sfx(G, 'slap'); buzz(G, 10);
    }
    if (L.pts === L.target) resolve(G, 'exact');
    else if (L.pts > L.target) resolve(G, 'bust');
  }

  function resolve(G, kind) {
    const L = G.line;
    L.phase = 'resolve'; L.result = kind; L.rt = 0;
    const win = kind === 'exact' || kind === 'blow';
    if (win) {
      const fast = kind === 'exact' && L.timeLeft / L.T >= 0.45;
      G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
      if (kind === 'exact') G.pips = Math.min(MAX_PIPS, G.pips + 1);
      const dmg = kind === 'blow' ? 24 : 11 + (fast ? 6 : 0) + Math.min(G.streak - 1, 4) * 2;
      G.health = Math.max(0, G.health - dmg);
      wake(G, kind === 'blow' ? 6 : 2 + (fast ? 1 : 0) + (G.streak >= 3 ? 1 : 0));
      G.exitOpen = kind === 'blow' ? 3.5 : 2.4; G.exitShut = 0;
      G.beltStop = 0.15; G.beltRev = kind === 'blow' ? 2.6 : 1.1 + (fast ? 0.6 : 0) + G.streak * 0.1;
      G.laughT = 0; Sound.stopLaugh();
      if (kind === 'blow') { G.freeze = 2.2; popup(G, 'WHOOOSH!', 120, 112, '#ffffff', 2.4); }
      else {
        sfx(G, 'bullseye');
        popup(G, 'BULLSEYE!', 120, 96, '#f5c518', 2.6);
        if (fast) popup(G, 'FAST!', 120, 122, '#9fd8f0', 1.6, 0.15);
      }
      if (G.streak >= 2) popup(G, 'COMBO X' + G.streak, 120, 152, '#ff8a1a', 1.5, 0.3);
    } else {
      G.streak = 0; G.snorts++;
      G.pips = Math.max(0, G.pips - 1);
      G.health = Math.min(100, G.health + (kind === 'bust' ? 16 : 14));
      G.exitOpen = 0; G.exitShut = 1.6;
      G.babies.forEach((b) => (b.u += 0.1));
      G.babies.push({ u: 0 });
      G.beltRev = 0;
      if (kind === 'bust') { sfx(G, 'bust'); popup(G, 'TOO MUCH!', 120, 96, '#ff3a30', 2.6); }
      else popup(G, 'TOO SLOW!', 120, 96, '#ff3a30', 2.6);
      setTimeout(() => { if (G.line === L) { sfx(G, 'snort'); popup(G, 'SNOOORT!', 120, 196, '#f6f4ee', 1.8); } }, 250);
      setTimeout(() => { if (G.line === L) { G.laughT = 2.4; sfx(G, 'laugh', true); } }, 700);
      G.flash = { c: '#ff1a00', a: 0.35 };
      G.shake = 3;
      buzz(G, 120, true);
    }
    syncMachine(G, false);
    if (G.health <= 0) startEnding(G, 'win');
    else if (G.health >= 100) startEnding(G, 'lose');
  }

  // Generals/politicians and the pile of money and meat follow the machine's health.
  function syncMachine(G, instant) {
    const n = G.health <= 0 ? 0 : Math.ceil((G.health / 100) * SLOTS.length);
    let k = 0;
    G.slots.forEach((s, i) => {
      if (i < n && !s.present) { s.present = true; s.a = instant ? 1 : 0; s.puffAt = -1; }
      else if (i >= n && s.present && s.puffAt < 0) s.puffAt = G.t + (G.freeze > 0 ? 0.6 : 0.05) + k++ * 0.2;
    });
    const piles = Math.round((G.health / 100) * PILE.length);
    if (!instant && piles < G.piles) for (let i = piles; i < G.piles; i++) puff(G, PILE[i][0] + 7, PILE[i][1] + 4, 6);
    G.piles = piles;
  }

  function startEnding(G, kind) {
    G.ending = kind; G.endT = 0;
    if (kind === 'win') {
      G.slots.forEach((s, i) => { if (s.present && s.puffAt < 0) s.puffAt = G.t + 0.4 + i * 0.2; });
      G.beltRev = 99; G.exitOpen = 99; G.exitShut = 0;
      wake(G, G.people.filter((p) => p.state === 'sleep').length + 5);
      G.laughT = 0; Sound.stopLaugh();
      sfx(G, 'win');
      popup(G, 'MACHINE BROKEN!', 120, 104, '#f5c518', 2.4, 0.6);
    } else {
      G.exitOpen = 0; G.exitShut = 99; G.laughT = 99;
      sfx(G, 'lose');
      popup(G, 'THE MACHINE WON', 120, 104, '#ff3a30', 2.4, 0.6);
    }
  }

  // ---------- effects ----------
  function popup(G, text, x, y, color, size, delay = 0) { G.texts.push({ text, x, y, color, size, life: 1.1 + delay, delay }); }
  function burst(G, x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), s = rand(50, 140);
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, size: 1.4, color, drag: 4, spark: true });
    }
  }
  function puff(G, x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), s = rand(10, 40);
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4), color: i % 3 ? '#d8cbb8' : '#8a7c70', drag: 3, grow: 6 });
    }
  }
  function blowCloud(G) {
    for (let i = 0; i < 70; i++) {
      const a = rand(-3.0, -0.15), s = rand(40, 150);
      G.parts.push({ x: rand(105, 135), y: 222, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(1, 1.8), max: 1.8, size: rand(2, 5), color: i % 4 ? '#f6f4ee' : '#d8e6f0', drag: 1.4, grow: 5 });
    }
  }

  // ---------- update ----------
  const isWin = (L) => L.result === 'exact' || L.result === 'blow';

  function update(G, dt) {
    G.t += dt;
    const L = G.line;
    G.cooldown = Math.max(0, G.cooldown - dt);
    for (const k in G.pressed) G.pressed[k] = Math.max(0, G.pressed[k] - dt);
    G.freeze = Math.max(0, G.freeze - dt);
    G.laughT = Math.max(0, G.laughT - dt);
    G.exitOpen = Math.max(0, G.exitOpen - dt);
    G.exitShut = Math.max(0, G.exitShut - dt);
    G.shake = Math.max(0, G.shake - dt * 20);
    if (G.flash) { G.flash.a -= dt * 1.2; if (G.flash.a <= 0) G.flash = null; }
    if (G.face) { G.face.t -= dt; if (G.face.t <= 0) G.face = null; }
    if (G.fist) { G.fist.t += dt; if (G.fist.t > 0.2) G.fist = null; }
    G.head.rx *= Math.exp(-dt * 9); G.head.ry *= Math.exp(-dt * 9);
    G.nose = Math.max(0.2, G.nose - dt * 0.01);

    if (!G.ending) {
      if (L.phase === 'ready') {
        L.t -= dt;
        if (L.t <= 0) { L.phase = 'live'; sfx(G, 'go'); }
      } else if (L.phase === 'live') {
        const before = Math.ceil(L.timeLeft);
        L.timeLeft -= dt;
        if (Math.ceil(L.timeLeft) !== before && L.timeLeft < 3 && L.timeLeft > 0) sfx(G, 'tick');
        if (L.timeLeft <= 0) { L.timeLeft = 0; resolve(G, 'slow'); }
        if (G.ai) aiThink(G, dt);
      } else if (L.phase === 'resolve') {
        L.rt += dt;
        if (L.rt > (isWin(L) ? 1.0 : 1.6)) newLine(G);
      }
    } else {
      G.endT += dt;
      if (G.ending === 'win') G.machineA = Math.max(0, G.machineA - dt * 0.5);
      if (G.ending === 'lose' && Math.random() < dt * 3) G.shake = 2;
    }

    // lean: he bends toward the line as time runs out
    let target = 0;
    if (G.ending === 'lose') target = 0.5 + 0.5 * Math.abs(Math.sin(G.t * 3));
    else if (!G.ending && L.phase === 'live') target = Math.pow(1 - L.timeLeft / L.T, 1.3) * 0.9;
    else if (!G.ending && L.phase === 'resolve' && !isWin(L) && L.rt < 0.75) target = 1;
    G.lean += (target - G.lean) * Math.min(1, dt * (target > G.lean ? 6 : 10));

    G.slots.forEach((s, i) => {
      if (s.present && s.a < 1) s.a = Math.min(1, s.a + dt * 3);
      if (s.puffAt >= 0 && G.t >= s.puffAt) {
        s.present = false; s.a = 0; s.puffAt = -1;
        const p = SLOTS[i];
        puff(G, p.x + 20, p.y + 26, 18);
        popup(G, 'PUFF!', p.x + 20, p.y + 4, '#efdcb0', 1.3);
        sfx(G, 'puff', i);
      }
    });

    // conveyor
    const speed = G.freeze > 0 || G.beltStop > 0 ? 0 : G.beltRev > 0 ? -0.32 : 0.018 + G.health * 0.0004;
    G.beltStop = Math.max(0, G.beltStop - dt);
    if (G.beltStop <= 0) G.beltRev = Math.max(0, G.beltRev - dt);
    G.beltPhase += speed * dt * 110;
    for (const b of G.babies) b.u += speed * dt;
    for (let i = G.babies.length - 1; i >= 0; i--) {
      const b = G.babies[i];
      if (b.u >= 1) {
        G.babies.splice(i, 1);
        G.devilOpen = 1;
        if (!G.ending) { G.health = Math.min(100, G.health + 3); syncMachine(G, false); if (G.health >= 100) startEnding(G, 'lose'); }
        popup(G, 'GULP', 150, 80, '#ff3a30', 1.3);
        sfx(G, 'chomp');
      } else if (b.u < -0.04) { G.babies.splice(i, 1); G.saved++; }
    }
    G.spawnT -= dt;
    const want = G.ending === 'win' ? 0 : 2 + Math.floor(G.health / 22);
    if (G.babies.length < want && G.spawnT <= 0 && speed >= 0) { G.babies.push({ u: 0 }); G.spawnT = 1.6; }
    G.devilOpen = Math.max(0, G.devilOpen - dt * 2);

    // people
    const blocked = G.exitShut > 0;
    for (let i = G.people.length - 1; i >= 0; i--) {
      const p = G.people[i];
      if (p.state === 'sleep') {
        p.x += clamp(QUEUE[p.slot][0] - p.x, -10 * dt, 10 * dt);
      } else if (p.state === 'run') {
        if (p.delay > 0) { p.delay -= dt; continue; }
        if (blocked) continue;
        p.x -= 44 * dt;
        p.y += (216 - p.y) * Math.min(1, dt * 8);
        if (p.x <= DOOR.x + 6) {
          G.people.splice(i, 1);
          G.out++;
          sfx(G, 'out', G.out);
          popup(G, '+1', DOOR.x + 13, DOOR.y - 30, '#f5c518', 1.6);
          G.exitOpen = Math.max(G.exitOpen, 0.4);
        }
      }
    }
    if (G.ending !== 'win' && G.people.filter((p) => p.state === 'sleep').length < QUEUE.length && Math.random() < dt * 1.5) addSleeper(G, false);
    if (!G.silent) Sound.setLayers(G.out >= 30 ? 3 : G.out >= 15 ? 2 : G.out >= 4 ? 1 : 0);

    for (let i = G.parts.length - 1; i >= 0; i--) {
      const p = G.parts[i];
      p.life -= dt;
      if (p.life <= 0) { G.parts.splice(i, 1); continue; }
      const k = Math.exp(-dt * (p.drag || 0));
      p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
    }
    for (let i = G.texts.length - 1; i >= 0; i--) {
      const t = G.texts[i];
      t.life -= dt;
      if (t.delay > 0) { t.delay -= dt; continue; }
      t.y -= 14 * dt;
      if (t.life <= 0) G.texts.splice(i, 1);
    }
  }

  function aiThink(G, dt) {
    G.aiT -= dt;
    if (G.aiT > 0) return;
    G.aiT = rand(0.2, 0.45);
    const L = G.line, left = L.target - L.pts;
    if (G.pips >= BLOW_COST && Math.random() < 0.08) return act(G, 'blow');
    if (L.aiFail && L.timeLeft < L.T * 0.5) { if (Math.random() < 0.5) act(G, 'punch'); return; }
    act(G, left >= 5 ? 'punch' : 'slap');
  }

  // ---------- UI helpers ----------
  let ui = [];
  function button(x, y, w, h, fn, draw) { ui.push({ x, y, w, h, fn }); if (draw) draw(); }

  function panelBox(x, y, w, h, o = {}) {
    P.rrect(ctx, x, y, w, h, o.r == null ? 1.5 : o.r);
    P.fill(ctx, o.bg || COL.panel);
    P.ink(ctx, 0.8, o.border || 'rgba(239,220,176,0.7)');
  }

  function posterButton(label, x, y, w, h, fn, o = {}) {
    button(x, y, w, h, fn, () => {
      const down = o.down ? 2 : 0;
      P.rrect(ctx, x, y + 2.5, w, h, 2); P.fill(ctx, '#000');
      P.rrect(ctx, x, y + down, w, h, 2);
      P.fill(ctx, P.lg(ctx, 0, y, 0, y + h, o.grad || [[0, '#e8352a'], [0.6, '#b8160f'], [1, '#7a0a0a']]));
      P.ink(ctx, 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 2, y + down + 1.5, w - 4, 1.2);
      Font.text(ctx, label, x + w / 2, y + down + h / 2 - (o.size || 2) * 3.5, { size: o.size || 2, color: o.color || COL.yellow, align: 'center', outline: COL.ink, font: o.font || 'body', maxW: w - 8 });
    });
  }
  const GREY = [[0, '#3a322c'], [1, '#1a1410']];
  const CYANISH = [[0, '#2a6a80'], [1, '#0e3040']];

  // ---------- scene ----------
  function drawScene(G) {
    const L = G.line;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 26, W, 236); ctx.clip();
    if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    P.background(ctx);

    const frozen = G.freeze > 0;
    const laughing = (G.laughT > 0 || G.ending === 'lose') && !frozen;
    P.devil(ctx, 120, 72, { t: G.t, laugh: laughing, frozen, alpha: G.machineA, open: laughing ? 0.35 + 0.65 * Math.abs(Math.sin(G.t * 14)) : G.devilOpen });
    P.belt(ctx, BELT, G.beltPhase, frozen, G.machineA);
    for (const b of G.babies) {
      const u = clamp(b.u, 0, 1);
      P.baby(ctx, BELT.x0 + (BELT.x1 - BELT.x0) * u - 8, BELT.y0 + (BELT.y1 - BELT.y0) * u - 15, G.t + b.u * 9, u > 0.65);
    }
    if (laughing && G.machineA > 0 && Math.floor(G.t * 4) % 2) Font.text(ctx, 'HA HA HA!', 120, 30, { size: 1.3, color: '#ff4a3a', align: 'center', outline: COL.ink });

    for (const i of DRAW_ORDER) {
      const s = G.slots[i];
      if (!s.present) continue;
      const p = SLOTS[i];
      P.figure(ctx, p.x, p.y - (1 - s.a) * 18, { kind: p.kind, t: G.t, seed: i, laugh: laughing, frozen, alpha: s.a });
      if (laughing && Math.floor(G.t * 3 + i) % 3 === 0) Font.text(ctx, 'HA!', p.x + 20, p.y - 8, { size: 1.1, color: COL.yellow, align: 'center', outline: COL.ink });
    }

    for (let i = 0; i < G.piles; i++) (i % 3 === 1 ? P.meatBlock : P.moneyBrick)(ctx, PILE[i][0], PILE[i][1]);

    const open = (G.exitOpen > 0 || G.people.some((p) => p.state === 'run')) && G.exitShut <= 0;
    P.exitDoor(ctx, DOOR.x, DOOR.y, open, G.t);
    for (const p of [...G.people].sort((a, b) => a.y - b.y)) {
      P.person(ctx, p.x, p.y, { awake: p.awake, run: p.state === 'run' && !(G.exitShut > 0) && !(p.delay > 0), t: G.t, seed: p.seed, color: p.color });
    }
    if (G.exitShut > 0 && G.people.some((p) => p.state === 'run')) Font.text(ctx, 'LOCKED!', 15, 244, { size: 1.1, color: '#ff3a30', align: 'center', outline: COL.ink });

    // the man at the table
    let face = 'idle';
    if (G.ending === 'win' && G.endT > 1.5) face = 'alone';
    else if (G.ending === 'lose') face = 'high';
    else if (G.face) face = G.face.f;
    else if (L.phase === 'resolve') face = isWin(L) ? 'dazed' : L.rt < 0.75 ? 'snort' : 'high';
    else if (L.phase === 'live' && G.lean > 0.5) face = 'lean';
    P.table(ctx, 52, 214);
    P.body(ctx, 50, 150);
    if (L.phase !== 'resolve' && G.ending !== 'win') P.cokeLine(ctx, 120, 223, 1, G.t);
    const hx = 120 + G.head.rx, hy = headY(G);
    P.head(ctx, hx, hy, face, G.t, G.nose);

    // the player's strike
    if (G.fist) {
      const f = G.fist, k = f.t < 0.06 ? f.t / 0.06 : Math.max(0, 1 - (f.t - 0.06) / 0.14);
      if (f.kind === 'punch') P.fist(ctx, f.tx, f.ty, k, f.side); else P.palm(ctx, f.tx, f.ty, k, f.side);
      if (f.t < 0.12) P.impact(ctx, f.tx, f.ty, f.kind === 'punch' ? 1 : 0.6, G.t);
    }

    for (const p of G.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.spark ? 1 : 0.85);
      ctx.fillStyle = p.color;
      if (p.spark) { ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); continue; }
      P.ell(ctx, p.x, p.y, p.size, p.size); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of G.texts) {
      if (t.delay > 0 || G.ai) continue;
      ctx.globalAlpha = clamp(t.life / 0.3, 0, 1);
      if (t.size >= 2) Font.title(ctx, t.text, t.x, t.y, { size: t.size, color: t.color === COL.yellow ? null : t.color, maxW: 220 });
      else Font.text(ctx, t.text, t.x, t.y, { size: t.size, color: t.color, align: 'center', outline: COL.ink });
    }
    ctx.globalAlpha = 1;

    if (!G.ending && L.phase === 'ready' && !G.ai) {
      const pop = Math.min(1, (1 - L.t / 0.9) * 3);
      ctx.fillStyle = 'rgba(10,5,4,0.82)'; ctx.fillRect(30, 88, 180, 50);
      ctx.fillStyle = COL.red; ctx.fillRect(30, 88, 180, 1.5); ctx.fillRect(30, 136.5, 180, 1.5);
      Font.text(ctx, 'NEXT LINE!  HIT EXACTLY:', 120, 93, { size: 1.1, color: COL.cream, align: 'center' });
      Font.title(ctx, String(L.target), 120, 106 - (1 - pop) * 6, { size: 3.2 });
    }
    if (G.flash) { ctx.globalAlpha = Math.max(0, G.flash.a); ctx.fillStyle = G.flash.c; ctx.fillRect(0, 26, W, 236); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawHud(G, playing) {
    const L = G.line;
    ctx.fillStyle = '#0b0605'; ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = COL.red; ctx.fillRect(0, 25, W, 1);
    Font.text(ctx, 'PEOPLE OUT', 7, 4, { size: 0.9, color: COL.cream });
    Font.text(ctx, G.out, 7, 13, { size: 1.5, color: COL.yellow, font: 'title', outline: COL.ink });
    Font.text(ctx, 'INCOMING', 233, 4, { size: 0.9, color: '#ff5a4a', align: 'right' });
    Font.text(ctx, G.babies.length, 233, 13, { size: 1.5, color: COL.yellow, font: 'title', align: 'right', outline: COL.ink });
    Font.text(ctx, 'ROUND ' + G.round, 128, 3.5, { size: 0.8, color: COL.cream, align: 'center' });
    P.rrect(ctx, 78, 12, 100, 10, 1.5); P.fill(ctx, '#200606'); P.ink(ctx, 0.8);
    const hw = (G.health / 100) * 98;
    if (hw > 0) { P.rrect(ctx, 79, 13, hw, 8, 1); P.fill(ctx, P.lg(ctx, 0, 13, 0, 21, [[0, '#ff5a40'], [0.5, '#d6201c'], [1, '#7a0a0a']])); }
    Font.text(ctx, 'MACHINE', 128, 14, { size: 0.85, color: COL.cream, align: 'center', outline: COL.ink });
    if (playing) button(62, 0, 16, 26, () => pause(), () => { ctx.fillStyle = COL.cream; ctx.fillRect(66, 12, 2.4, 9); ctx.fillRect(71, 12, 2.4, 9); });

    // target panel
    ctx.fillStyle = '#0b0605'; ctx.fillRect(0, 262, W, 76);
    ctx.fillStyle = COL.red; ctx.fillRect(0, 262, W, 1);
    const boxes = [['TARGET', L.target, COL.yellow], ['YOU', L.pts, COL.cream], ['LEFT', L.target - L.pts, '#ff4a3a']];
    boxes.forEach(([label, val, col], i) => {
      const x = 6 + i * 77;
      panelBox(x, 267, 74, 40, { border: i === 0 ? COL.yellow : 'rgba(239,220,176,0.55)' });
      Font.text(ctx, label, x + 37, 270, { size: 0.9, color: COL.cream, align: 'center' });
      let v = String(val), c = col;
      if (i === 2 && val < 0) { v = 'BUST'; c = '#ff3a30'; }
      if (i === 2 && val === 0 && L.result === 'exact') { v = 'OK!'; c = '#9ad050'; }
      Font.text(ctx, v, x + 37, 281, { size: 2.6, color: c, align: 'center', font: 'title', outline: COL.ink, maxW: 66 });
    });
    Font.text(ctx, 'NEXT LINE', 7, 312, { size: 1, color: COL.cream });
    const frac = L.phase === 'live' ? L.timeLeft / L.T : L.phase === 'ready' ? 1 : 0;
    P.rrect(ctx, 48, 311, 160, 9, 1.5); P.fill(ctx, '#200606'); P.ink(ctx, 0.8);
    if (frac > 0) { P.rrect(ctx, 49, 312, 158 * frac, 7, 1); P.fill(ctx, frac > 0.5 ? '#d6201c' : frac > 0.25 ? '#ff6a1a' : (Math.floor(G.t * 8) % 2 ? '#ff2a1a' : '#f5c518')); }
    Font.text(ctx, (L.phase === 'live' ? L.timeLeft : L.phase === 'ready' ? L.T : 0).toFixed(1), 233, 312, { size: 1, color: COL.yellow, align: 'right' });
    const h = hint(G);
    if (h && L.phase !== 'resolve') Font.text(ctx, 'TIP: ' + h, 120, 326, { size: 0.95, color: '#a8d860', align: 'center' });
    else if (G.streak >= 1) Font.text(ctx, 'COMBO X' + G.streak + (G.streak >= 3 ? '  -  BELT REVERSING!' : ''), 120, 326, { size: 0.95, color: '#ff8a1a', align: 'center' });
  }

  function drawControls(G) {
    const defs = [
      ['punch', 'PUNCH', '+5', [[0, '#e8352a'], [0.6, '#b8160f'], [1, '#6a0808']], COL.yellow, COL.cream],
      ['slap', 'SLAP', '+1', [[0, '#ffd640'], [0.6, '#e0a818'], [1, '#8a6008']], COL.ink, '#fff4d0'],
      ['blow', 'BLOW', 'WIPE', [[0, '#f6ecd0'], [0.6, '#dccaa0'], [1, '#8a7a5a']], '#b8160f', '#ffffff'],
    ];
    ctx.fillStyle = '#0b0605'; ctx.fillRect(0, 336, W, H - 336);
    defs.forEach(([k, label, sub, grad, fg, ic], i) => {
      const x = 6 + i * 77, y0 = 338, w = 74, h = 82;
      const down = (G.pressed[k] || 0) > 0 ? 3 : 0;
      const disabled = k === 'blow' && G.pips < BLOW_COST;
      button(x, y0, w, h, () => act(G, k), () => {
        const y = y0 + down;
        P.rrect(ctx, x, y0 + 4, w, h - 4, 3); P.fill(ctx, '#000');
        P.rrect(ctx, x, y, w, h - 4, 3);
        P.fill(ctx, P.lg(ctx, 0, y, 0, y + h, disabled ? [[0, '#5a524a'], [1, '#2a2420']] : grad));
        P.ink(ctx, 1.3);
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 3, y + 2, w - 6, 1.4);
        const col = disabled ? '#8a8278' : fg;
        P.icon(ctx, k, x + 16, y + 20, 0.95, disabled ? '#8a8278' : ic);
        Font.text(ctx, label, x + 46, y + 11, { size: 1.6, color: col, align: 'center', font: 'title', maxW: 42 });
        Font.text(ctx, sub, x + w / 2, y + 36, { size: sub.length > 2 ? 2 : 2.8, color: col, align: 'center', font: 'title', outline: disabled ? null : (k === 'slap' ? '#fff4d0' : COL.ink) });
        if (k === 'blow') {
          for (let p = 0; p < MAX_PIPS; p++) { P.rrect(ctx, x + 19 + p * 13, y + 63, 10, 6, 1); P.fill(ctx, p < G.pips ? '#b8160f' : 'rgba(0,0,0,0.35)'); P.ink(ctx, 0.6); }
          if (!disabled && Math.floor(G.t * 4) % 2) { P.rrect(ctx, x - 1, y - 1, w + 2, h - 2, 3.5); P.ink(ctx, 1.2, '#ffffff'); }
        } else {
          Font.text(ctx, k === 'punch' ? 'KEY 1 / J' : 'KEY 2 / K', x + w / 2, y + 64, { size: 0.75, color: col, align: 'center' });
        }
      });
    });
  }

  // ---------- screens ----------
  let screen = 'title', game = null, demo = newGame({ ai: true }), paused = false, howto = false, result = null;

  function startGame(next) {
    Sound.init(); Sound.startMusic(); Sound.stopLaugh();
    game = next ? newGame({ round: game.round + 1, out: game.out }) : newGame();
    screen = 'play'; paused = false;
  }
  function toTitle() { screen = 'title'; paused = false; Sound.stopLaugh(); demo = newGame({ ai: true }); }
  function pause() { if (screen === 'play' && !game.ending) { paused = true; Sound.stopLaugh(); } }

  function finishGame(G) {
    const won = G.ending === 'win';
    const newBest = G.out > best;
    if (newBest) { best = G.out; try { localStorage.setItem('htn-best', String(best)); } catch (e) { /* ignore */ } }
    result = { won, out: G.out, round: G.round, bestStreak: G.bestStreak, snorts: G.snorts };
    screen = 'result';
    if (newBest) showAward(G.out);
  }

  // The four comic panels from the bottom of the poster.
  function miniPanels(t) {
    const caps = [['PUNCH!'], ['STOP', 'THE GENERALS!'], ['GET THEM OUT!'], ['FIGHT', 'THE DEVIL!']];
    caps.forEach((c, i) => {
      const x = 6 + i * 57.5, y = 268, w = 54, h = 54;
      panelBox(x, y, w, h, { bg: '#0b0605', border: 'rgba(239,220,176,0.8)', r: 0.8 });
      c.forEach((s, j) => Font.text(ctx, s, x + w / 2, y + 3 + j * 7 + (c.length === 1 ? 3 : 0), { size: 0.75, color: COL.cream, align: 'center', maxW: w - 4 }));
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 1, y + 17, w - 2, 28); ctx.clip();
      if (i === 0) {
        P.icon(ctx, 'punch', x + 18 + Math.sin(t * 8) * 3, y + 32, 1, '#d8a07a');
        P.ell(ctx, x + 38, y + 31, 6, 6); P.fill(ctx, P.rg(ctx, x + 38, y + 31, 0.5, 6, [[0, '#ff8a70'], [1, '#a00808']])); P.ink(ctx, 0.8);
        if (Math.floor(t * 4) % 2) { P.impact(ctx, x + 31, y + 30, 0.4, t); }
      } else if (i === 1) {
        for (let g = 0; g < 3; g++) { ctx.save(); ctx.translate(x + 4 + g * 16, y + 18); ctx.scale(0.5, 0.5); P.figure(ctx, 0, 0, { kind: 'gen', t, seed: g, laugh: false, frozen: false }); ctx.restore(); }
      } else if (i === 2) {
        ctx.save(); ctx.translate(x + 30, y + 15); ctx.scale(0.6, 0.6); P.exitDoor(ctx, 0, 14, true, t); ctx.restore();
        for (let p = 0; p < 3; p++) P.person(ctx, x + 4 + ((p * 9 + t * 10) % 24), y + 25, { awake: true, run: true, t, seed: p, color: '#d6201c' });
      } else {
        ctx.save(); ctx.translate(x + 27, y + 32); ctx.scale(0.3, 0.3); P.devil(ctx, 0, 0, { t, laugh: true, frozen: false, open: 0.6 }); ctx.restore();
      }
      ctx.restore();
      ctx.fillStyle = '#200606'; ctx.fillRect(x + 4, y + 47, w - 8, 3.5);
      ctx.fillStyle = COL.red; ctx.fillRect(x + 4, y + 47, (w - 8) * (0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.5 + i))), 3.5);
    });
  }

  function drawTitle(t) {
    drawScene(demo);
    ctx.fillStyle = P.lg(ctx, 0, 0, 0, 132, [[0, 'rgba(8,4,3,1)'], [0.55, 'rgba(8,4,3,0.85)'], [1, 'rgba(8,4,3,0)']]);
    ctx.fillRect(0, 0, W, 132);
    ['SAVE', 'THE', 'PEOPLE'].forEach((s, i) => Font.text(ctx, s, 8, 8 + i * 13, { size: 1.5, color: COL.cream }));
    ['STOP', 'THE', 'SYSTEM'].forEach((s, i) => Font.text(ctx, s, 232, 8 + i * 13, { size: 1.5, color: COL.cream, align: 'right' }));
    ['MEAT', 'MONEY', 'BABIES', 'GENERALS', 'POLITICIANS', 'THE DEVIL'].forEach((s, i) => Font.text(ctx, s, 8, 52 + i * 8.5, { size: 0.85, color: '#e8352a', outline: COL.ink, outlineW: 1 }));
    ['PUNCH', 'AGAIN.', 'BUY', 'TIME.'].forEach((s, i) => Font.text(ctx, s, 232, 52 + i * 10, { size: 1.1, color: '#e8352a', align: 'right', outline: COL.ink, outlineW: 1 }));
    Font.title(ctx, 'HIT', 120, 6, { size: 5.6, maxW: 118 });
    Font.title(ctx, 'THE NOSE', 120, 50, { size: 3.6, maxW: 150 });
    if (best > 0) Font.text(ctx, 'BEST: ' + best + ' PEOPLE OUT', 120, 86, { size: 1, color: COL.yellow, align: 'center', outline: COL.ink });

    ctx.fillStyle = '#0b0605'; ctx.fillRect(0, 262, W, H - 262);
    ctx.fillStyle = COL.red; ctx.fillRect(0, 262, W, 1);
    miniPanels(t);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    button(20, 328, 200, 36, () => startGame(false), () => {
      ctx.fillStyle = `rgba(214,32,28,${0.12 + pulse * 0.12})`; ctx.fillRect(20, 328, 200, 36);
      Font.title(ctx, 'PLAY NOW', 120, 332, { size: 3.4, color: '#d6201c', side: '#5a0606', sideDark: '#1a0202', maxW: 190 });
    });
    posterButton('HOW TO PLAY', 8, 370, 74, 20, () => { howto = true; }, { size: 1.1, grad: GREY, color: COL.cream });
    posterButton('STATS', 86, 370, 68, 20, () => { screen = 'stats'; Stats.load(); }, { size: 1.1, grad: CYANISH, color: COL.yellow });
    posterButton(Sound.muted ? 'SOUND: OFF' : 'SOUND: ON', 158, 370, 74, 20, () => { Sound.init(); Sound.setMuted(!Sound.muted); }, { size: 1.1, grad: GREY, color: COL.cream });
    button(6, 396, 100, 24, () => showDisclaimer(), () => {
      Font.text(ctx, 'POLITICAL SATIRE.', 9, 399, { size: 0.85, color: '#9a8a70' });
      Font.text(ctx, 'FICTIONAL. TAP TO READ.', 9, 408, { size: 0.75, color: '#7a6a58' });
    });
    ['AN ARCADE GAME', 'FOR A BETTER', 'TOMORROW?'].forEach((s, i) => Font.text(ctx, s, 232, 395 + i * 7.5, { size: 0.85, color: COL.cream, align: 'right' }));
    ctx.fillStyle = COL.red; ctx.fillRect(170, 418, 62, 1.5);
  }

  function drawHowto() {
    ctx.fillStyle = 'rgba(8,4,3,0.94)'; ctx.fillRect(0, 0, W, H);
    Font.title(ctx, 'HOW TO PLAY', 120, 12, { size: 2.4, maxW: 200 });
    const lines = [
      ['HE WANTS THE NEXT LINE.', COL.cream], ['STOP HIM BEFORE THE TIME RUNS OUT.', COL.cream], null,
      ['EVERY LINE HAS A TARGET.', COL.yellow], ['HIT IT EXACTLY - LIKE DARTS!', COL.yellow], null,
      ['PUNCH = 5 POINTS     SLAP = 1 POINT', '#ff5a4a'], ['TARGET 12  =  PUNCH + PUNCH + SLAP + SLAP', COL.cream], null,
      ['TOO MANY OR TOO SLOW: HE SNORTS.', '#ff5a4a'], ['MORE GENERALS, MORE MONEY, MORE MEAT.', COL.cream], ['THE DEVIL LAUGHS AND EATS.', COL.cream], null,
      ['EXACT HIT: GENERALS GO PUFF,', '#a8d860'], ['THE BELT REVERSES, PEOPLE ESCAPE.', COL.cream], ['FAST HITS AND COMBOS DO MORE.', COL.cream], null,
      ['BLOW: EACH EXACT HIT CHARGES ONE PIP.', '#9fd8f0'], ['2 PIPS BLOW THE LINE AWAY AND', COL.cream], ['FREEZE THE WHOLE MACHINE.', COL.cream], null,
      ['EMPTY THE MACHINE TO WIN.', COL.yellow], ['FILL IT AND YOU LOSE.', '#ff5a4a'],
    ];
    let y = 46;
    lines.forEach((l) => { if (!l) { y += 5; return; } Font.text(ctx, l[0], 120, y, { size: 1.05, color: l[1], align: 'center', maxW: 220 }); y += 11.5; });
    posterButton('GOT IT', 70, 378, 100, 28, () => { howto = false; }, { size: 1.8, font: 'title' });
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(8,4,3,0.82)'; ctx.fillRect(0, 0, W, H);
    Font.title(ctx, 'PAUSED', 120, 120, { size: 4 });
    posterButton('RESUME', 50, 190, 140, 32, () => { paused = false; }, { size: 2, font: 'title' });
    posterButton('MENU', 50, 232, 140, 28, () => toTitle(), { size: 1.6, grad: GREY, color: COL.cream, font: 'title' });
  }

  function drawResult() {
    drawScene(game);
    ctx.fillStyle = 'rgba(8,4,3,0.8)'; ctx.fillRect(0, 0, W, H);
    const r = result;
    if (r.won) {
      Font.title(ctx, 'PEOPLE OUT:', 120, 48, { size: 3, maxW: 210 });
      Font.title(ctx, String(r.out), 120, 82, { size: 7 });
      Font.text(ctx, 'THEY WOKE UP.', 120, 150, { size: 2.4, color: COL.cream, align: 'center', outline: COL.ink, shadow: '#7a0a0a' });
      Font.text(ctx, 'THEY GOT OUT.', 120, 174, { size: 2.4, color: COL.cream, align: 'center', outline: COL.ink, shadow: '#7a0a0a' });
    } else {
      Font.title(ctx, 'HE KEPT', 120, 34, { size: 3.2, color: '#ff4a3a', side: '#6a0606', sideDark: '#1a0202' });
      Font.title(ctx, 'SNORTING', 120, 64, { size: 3.2, color: '#ff4a3a', side: '#6a0606', sideDark: '#1a0202', maxW: 210 });
      Font.text(ctx, 'PEOPLE OUT:', 120, 106, { size: 2, color: COL.cream, align: 'center' });
      Font.title(ctx, String(r.out), 120, 126, { size: 5.5 });
      Font.text(ctx, 'THE MACHINE KEPT GOING.', 120, 178, { size: 1.4, color: COL.cream, align: 'center' });
    }
    Font.text(ctx, 'ROUND ' + r.round + '     BEST COMBO X' + r.bestStreak, 120, 204, { size: 1.1, color: '#9fd8f0', align: 'center' });
    Font.text(ctx, 'BEST EVER: ' + best, 120, 218, { size: 1.1, color: COL.yellow, align: 'center' });
    posterButton(r.won ? 'NEXT ROUND' : 'TRY AGAIN', 30, 240, 180, 34, () => startGame(r.won), { size: 2.2, font: 'title' });
    posterButton('STATS', 30, 284, 88, 26, () => { screen = 'stats'; Stats.load(); }, { size: 1.5, grad: CYANISH, font: 'title' });
    posterButton('MENU', 122, 284, 88, 26, () => toTitle(), { size: 1.5, grad: GREY, color: COL.cream, font: 'title' });
  }

  // ---------- DOM overlays (disclaimer + award images) ----------
  const disclaimerEl = document.getElementById('disclaimer');
  const awardEl = document.getElementById('award');
  function showDisclaimer() { disclaimerEl.hidden = false; }
  function showAward(n) { document.getElementById('award-score').textContent = 'PEOPLE OUT: ' + n; awardEl.hidden = false; }
  document.getElementById('disclaimer-ok').addEventListener('click', () => { disclaimerEl.hidden = true; Sound.init(); });
  document.getElementById('award-ok').addEventListener('click', () => { awardEl.hidden = true; });

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    const t = now / 1000;
    last = now;
    ui = [];
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#0b0605'; ctx.fillRect(0, 0, W, H);
    if (screen === 'title') {
      update(demo, dt);
      if (demo.ending && demo.endT > 3) demo = newGame({ ai: true });
      drawTitle(t);
      if (howto) { ui = []; drawHowto(); }
    } else if (screen === 'play') {
      if (!paused && disclaimerEl.hidden) update(game, dt);
      drawScene(game);
      drawHud(game, !paused);
      drawControls(game);
      if (paused) { ui = []; drawPause(); }
      if (game.ending && game.endT > (game.ending === 'win' ? 4 : 3)) finishGame(game);
    } else if (screen === 'result') {
      update(game, dt);
      drawResult();
    } else if (screen === 'stats') {
      ctx.imageSmoothingEnabled = false;
      const r = Stats.draw(ctx, t);
      ctx.imageSmoothingEnabled = true;
      button(...r.back, () => { screen = result ? 'result' : 'title'; });
    }
    P.post(ctx, t);
    requestAnimationFrame(frame);
  }

  function resize() {
    const stage = document.getElementById('stage');
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const s = Math.min(sw / W, sh / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    display.style.width = cw + 'px'; display.style.height = ch + 'px';
    display.width = Math.round(cw * dpr); display.height = Math.round(ch * dpr);
    K = display.width / W;
    P.setScale(K);
  }

  // ---------- input ----------
  function hit(x, y) {
    for (let i = ui.length - 1; i >= 0; i--) {
      const b = ui[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) { b.fn(); return; }
    }
  }
  display.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.init();
    if (screen === 'play' || screen === 'title') Sound.startMusic();
    const r = display.getBoundingClientRect();
    hit(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  });
  display.addEventListener('contextmenu', (e) => e.preventDefault());

  const KEYS = { 1: 'punch', j: 'punch', arrowleft: 'punch', 2: 'slap', k: 'slap', arrowdown: 'slap', 3: 'blow', l: 'blow', arrowright: 'blow', ' ': 'blow' };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    Sound.init();
    if (!disclaimerEl.hidden) { if (key === 'enter' || key === ' ') disclaimerEl.hidden = true; return; }
    if (!awardEl.hidden) { if (key === 'enter' || key === ' ') awardEl.hidden = true; return; }
    if (screen === 'play') {
      if (key === 'escape' || key === 'p') { paused ? (paused = false) : pause(); return; }
      if (!paused && KEYS[key]) { e.preventDefault(); act(game, KEYS[key]); }
    } else if (screen === 'title' && (key === 'enter' || key === ' ')) { howto ? (howto = false) : startGame(false); }
    else if (screen === 'result' && key === 'enter') startGame(result.won);
    else if (screen === 'stats' && key === 'escape') screen = result ? 'result' : 'title';
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume();
  });
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  // debug/testing hook
  window.HTN = { get game() { return game; }, get screen() { return screen; }, act: (k) => game && act(game, k), startGame, newGame };
})();
