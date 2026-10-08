// HIT THE NOSE: game loop, rules, screens and input.
//
// Core rule (darts-style checkout): every line comes with a TARGET. PUNCH adds
// 5, SLAP adds 1. Hit the target EXACTLY before time runs out and he misses
// the line. Go over (BUST) or run out of time and he snorts: the machine grows.
// BLOW is a charged joker that blows the line away and paralyses the machine.
(function () {
  const { W, H, C, R } = Art;
  const display = document.getElementById('game');
  const dctx = display.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const ctx = buf.getContext('2d');

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- tuning ----------
  const PTS = { punch: 5, slap: 1 };
  const COOLDOWN = { punch: 0.17, slap: 0.08 };
  const BLOW_COST = 2, MAX_PIPS = 3;
  const START_HEALTH = 55;
  const SLOTS = [
    { x: 8, y: 114, kind: 'gen' }, { x: 200, y: 114, kind: 'pol' },
    { x: 28, y: 126, kind: 'gen' }, { x: 180, y: 126, kind: 'pol' },
    { x: 48, y: 112, kind: 'gen' }, { x: 220, y: 128, kind: 'pol' },
  ];
  const MONEY = [[190, 230], [203, 230], [216, 230], [196, 225], [209, 225], [203, 220]];
  const MEAT = [[4, 170], [18, 170], [32, 170], [11, 164], [25, 164], [18, 158]];
  const QUEUE = [[32, 238], [39, 238], [46, 238], [53, 238], [35, 231], [42, 231], [49, 231]];
  const BELT = { x0: 244, y0: 40, x1: 142, y1: 80 };
  const DOOR = { x: 4, y: 206 };
  const SHIRTS = ['#e8242a', '#ffd21f', '#2ec5e8', '#f3e3c0', '#7ad04a', '#ff8a1a', '#c070e0'];

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
    for (let i = 0; i < 7; i++) addSleeper(G, true);
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
    G.people.push({
      x: instant ? qx : 62, y: qy, slot, state: 'sleep', seed: Math.random() * 10,
      color: SHIRTS[randi(0, SHIRTS.length - 1)], awake: false,
    });
  }

  function wake(G, n) {
    const sleepers = G.people.filter((p) => p.state === 'sleep').sort((a, b) => a.x - b.x);
    for (let i = 0; i < n; i++) {
      let p = sleepers[i];
      if (!p) { p = { x: 62, y: 238, seed: Math.random() * 10, color: SHIRTS[randi(0, 6)] }; G.people.push(p); }
      p.state = 'run'; p.awake = true; p.delay = i * 0.12; p.y = 238;
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

  function act(G, kind) {
    const L = G.line;
    if (G.ending) return;
    if (kind === 'blow') {
      if (L.phase !== 'live') return;
      if (G.pips < BLOW_COST) { sfx(G, 'whiff'); popup(G, 'CHARGE IT!', 120, 140, '#2ec5e8', 1); return; }
      G.pips -= BLOW_COST;
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
    const nx = 120 + G.head.rx, ny = 128 + G.lean * 58 + 26;
    if (kind === 'punch') {
      G.head.rx = 26 * G.head.dir; G.head.ry = -8;
      G.face = { f: 'hit', t: 0.28 };
      G.fist = { kind, t: 0 };
      G.shake = 4; G.nose = Math.min(1, G.nose + 0.06);
      burst(G, nx, ny, '#ffd21f', 10);
      popup(G, 'POW!', nx + rand(-20, 20), ny - 30, '#ffd21f', 2);
      sfx(G, 'punch'); buzz(G, 25, true);
    } else {
      G.head.rx = 11 * G.head.dir;
      G.face = { f: 'hit', t: 0.14 };
      G.fist = { kind, t: 0 };
      G.shake = 1.5; G.nose = Math.min(1, G.nose + 0.02);
      burst(G, nx, ny, '#ffffff', 5);
      popup(G, 'SLAP!', nx + rand(-24, 24), ny - 26, '#f3e3c0', 1);
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
      if (kind === 'blow') { G.freeze = 2.2; popup(G, 'WHOOOSH!', 120, 150, '#ffffff', 2); }
      else {
        sfx(G, 'bullseye');
        popup(G, 'BULLSEYE!', 120, 104, '#ffd21f', 2);
        if (fast) popup(G, 'FAST!', 120, 124, '#2ec5e8', 1, 0.15);
      }
      if (G.streak >= 2) popup(G, 'COMBO X' + G.streak, 120, 136, '#ff8a1a', 1, 0.3);
      L.rt = kind === 'blow' ? -0.6 : 0;
    } else {
      G.streak = 0; G.snorts++;
      G.pips = Math.max(0, G.pips - 1);
      G.health = Math.min(100, G.health + (kind === 'bust' ? 16 : 14));
      G.exitOpen = 0; G.exitShut = 1.6;
      G.babies.forEach((b) => (b.u += 0.1));
      G.babies.push({ u: 0 });
      G.beltRev = 0;
      if (kind === 'bust') { sfx(G, 'bust'); popup(G, 'TOO MUCH!', 120, 104, '#ff3030', 2); }
      else popup(G, 'TOO SLOW!', 120, 104, '#ff3030', 2);
      setTimeout(() => { if (G.line === L) { sfx(G, 'snort'); popup(G, 'SNOOORT', 120, 190, '#f7f7f2', 1); } }, 250);
      setTimeout(() => { if (G.line === L) { G.laughT = 2.4; sfx(G, 'laugh', true); } }, 700);
      G.flash = { c: '#ff0000', a: 0.35 };
      G.shake = 3;
      buzz(G, 120, true);
    }
    syncMachine(G, false);
    if (G.health <= 0) startEnding(G, 'win');
    else if (G.health >= 100) startEnding(G, 'lose');
  }

  // Generals/politicians and piles of money and meat follow the machine's health.
  function syncMachine(G, instant) {
    const n = G.health <= 0 ? 0 : Math.ceil((G.health / 100) * SLOTS.length);
    let k = 0;
    G.slots.forEach((s, i) => {
      if (i < n && !s.present) {
        s.present = true; s.a = instant ? 1 : 0; s.puffAt = -1;
      } else if (i >= n && s.present && s.puffAt < 0) {
        s.puffAt = G.t + (G.freeze > 0 ? 0.6 : 0.05) + k++ * 0.2;
      }
    });
    const piles = Math.round((G.health / 100) * MONEY.length);
    if (!instant && piles < G.piles) {
      for (let i = piles; i < G.piles; i++) {
        puff(G, MONEY[i][0] + 6, MONEY[i][1] + 2, 5);
        puff(G, MEAT[i][0] + 6, MEAT[i][1] + 3, 5);
      }
    }
    G.piles = piles;
  }

  function startEnding(G, kind) {
    G.ending = kind; G.endT = 0;
    if (kind === 'win') {
      G.slots.forEach((s, i) => { if (s.present && s.puffAt < 0) s.puffAt = G.t + 0.4 + i * 0.2; });
      G.beltRev = 99; G.exitOpen = 99; G.exitShut = 0;
      const sleepers = G.people.filter((p) => p.state === 'sleep').length;
      wake(G, sleepers + 5);
      G.laughT = 0; Sound.stopLaugh();
      sfx(G, 'win');
      popup(G, 'MACHINE BROKEN!', 120, 112, '#ffd21f', 2, 0.6);
    } else {
      G.exitOpen = 0; G.exitShut = 99; G.laughT = 99;
      sfx(G, 'lose');
      popup(G, 'THE MACHINE WON', 120, 112, '#ff3030', 2, 0.6);
    }
  }

  // ---------- effects ----------
  function popup(G, text, x, y, color, size, delay = 0) {
    G.texts.push({ text, x, y, color, size, life: 1.1 + delay, delay, max: 1.1 });
  }
  function burst(G, x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), s = rand(40, 120);
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, size: 2, color, drag: 4 });
    }
  }
  function puff(G, x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), s = rand(10, 40);
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: rand(0.4, 0.8), max: 0.8, size: randi(3, 6), color: i % 3 ? '#d8d0c8' : '#9a908a', drag: 3, grow: 6 });
    }
  }
  function blowCloud(G) {
    for (let i = 0; i < 70; i++) {
      const a = rand(-3.0, -0.15), s = rand(40, 150);
      G.parts.push({ x: rand(105, 135), y: 226, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(1, 1.8), max: 1.8, size: randi(3, 8), color: i % 4 ? '#f7f7f2' : '#d0e8f0', drag: 1.4, grow: 5 });
    }
  }

  // ---------- update ----------
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

    // line flow
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
        if (L.rt > (L.result === 'exact' || L.result === 'blow' ? 1.0 : 1.6)) newLine(G);
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

    // generals / politicians
    G.slots.forEach((s, i) => {
      if (s.present && s.a < 1) s.a = Math.min(1, s.a + dt * 3);
      if (s.puffAt >= 0 && G.t >= s.puffAt) {
        s.present = false; s.a = 0; s.puffAt = -1;
        const p = SLOTS[i];
        puff(G, p.x + 8, p.y + 14, 16);
        popup(G, 'PUFF', p.x + 8, p.y - 4, '#d8d0c8', 1);
        sfx(G, 'puff', i);
      }
    });

    // conveyor
    const speed = G.freeze > 0 ? 0 : G.beltStop > 0 ? 0 : G.beltRev > 0 ? -0.32 : 0.018 + G.health * 0.0004;
    G.beltStop = Math.max(0, G.beltStop - dt);
    if (G.beltStop <= 0) G.beltRev = Math.max(0, G.beltRev - dt);
    G.beltPhase += speed * dt * 110;
    for (const b of G.babies) b.u += speed * dt;
    for (let i = G.babies.length - 1; i >= 0; i--) {
      const b = G.babies[i];
      if (b.u >= 1) {
        G.babies.splice(i, 1);
        G.devilOpen = 0.5;
        if (!G.ending) { G.health = Math.min(100, G.health + 3); syncMachine(G, false); if (G.health >= 100) startEnding(G, 'lose'); }
        popup(G, 'GULP', 150, 70, '#ff3030', 1);
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
        const [qx] = QUEUE[p.slot];
        p.x += clamp(qx - p.x, -10 * dt, 10 * dt);
      } else if (p.state === 'run') {
        if (p.delay > 0) { p.delay -= dt; continue; }
        if (blocked) continue;
        p.x -= 46 * dt;
        p.y += (238 - p.y) * Math.min(1, dt * 8);
        if (p.x <= DOOR.x + 8) {
          G.people.splice(i, 1);
          G.out++;
          sfx(G, 'out', G.out);
          popup(G, '+1', DOOR.x + 11, DOOR.y - 22, '#ffd21f', 1);
          G.exitOpen = Math.max(G.exitOpen, 0.4);
        }
      }
    }
    if (!G.ending || G.ending === 'lose') {
      if (G.people.filter((p) => p.state === 'sleep').length < QUEUE.length && Math.random() < dt * 1.5) addSleeper(G, false);
    }
    if (!G.silent) Sound.setLayers(G.out >= 30 ? 3 : G.out >= 15 ? 2 : G.out >= 4 ? 1 : 0);

    // particles & texts
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

  const isWin = (L) => L.result === 'exact' || L.result === 'blow';

  function aiThink(G, dt) {
    G.aiT -= dt;
    if (G.aiT > 0) return;
    G.aiT = rand(0.2, 0.45);
    const L = G.line, left = L.target - L.pts;
    if (G.pips >= BLOW_COST && Math.random() < 0.08) return act(G, 'blow');
    if (L.aiFail && L.timeLeft < L.T * 0.5) { if (Math.random() < 0.5) act(G, 'punch'); return; }
    act(G, left >= 5 ? 'punch' : 'slap');
  }

  // ---------- drawing ----------
  let ui = [];
  function button(x, y, w, h, fn, draw) { ui.push({ x, y, w, h, fn }); draw && draw(); }

  function menuButton(label, x, y, w, h, fn, o = {}) {
    button(x, y, w, h, fn, () => {
      R(ctx, x, y + 2, w, h, '#000');
      R(ctx, x, y, w, h, o.bg || '#d81e1e');
      R(ctx, x + 2, y + 2, w - 4, 2, o.hi || '#ff5a4a');
      R(ctx, x, y + h - 3, w, 3, o.lo || '#7a0a0a');
      Font.text(ctx, label, x + w / 2, y + h / 2 - (o.size || 2) * 3.5, { size: o.size || 2, color: o.color || '#ffd21f', align: 'center', shadow: '#000' });
    });
  }

  function drawScene(G) {
    const L = G.line;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 26, W, 236); ctx.clip();
    if (G.shake > 0) ctx.translate(Math.round(rand(-G.shake, G.shake)), Math.round(rand(-G.shake, G.shake)));
    ctx.drawImage(Art.backdrop(), 0, 0);

    const frozen = G.freeze > 0;
    const laughing = G.laughT > 0 && !frozen;
    Art.devil(ctx, 120, 70, { t: G.t, laugh: laughing, frozen, alpha: G.machineA, open: laughing ? 0.4 + 0.6 * Math.abs(Math.sin(G.t * 14)) : G.devilOpen });
    if (G.machineA > 0) {
      ctx.globalAlpha = G.machineA;
      Art.belt(ctx, BELT.x0, BELT.y0, BELT.x1, BELT.y1, G.beltPhase, frozen);
      ctx.globalAlpha = 1;
    }
    for (const b of G.babies) {
      const u = clamp(b.u, 0, 1);
      Art.baby(ctx, BELT.x0 + (BELT.x1 - BELT.x0) * u - 4, BELT.y0 + (BELT.y1 - BELT.y0) * u - 8, G.t + b.u * 9, u > 0.7);
    }

    // shelf of meat (left) and piles of money (right)
    R(ctx, 2, 177, 50, 3, '#2a1410');
    for (let i = 0; i < G.piles; i++) { Art.meat(ctx, MEAT[i][0], MEAT[i][1]); Art.money(ctx, MONEY[i][0], MONEY[i][1]); }

    G.slots.forEach((s, i) => {
      if (!s.present) return;
      const p = SLOTS[i];
      Art.figure(ctx, p.x, p.y - (1 - s.a) * 18, { kind: p.kind, t: G.t, seed: i, laugh: laughing || G.ending === 'lose', frozen, alpha: s.a });
      if ((laughing || G.ending === 'lose') && Math.floor(G.t * 3 + i) % 3 === 0) Font.text(ctx, 'HA', p.x + 8, p.y - 9, { color: '#ffd21f', align: 'center', shadow: '#000' });
    });
    if (laughing && G.machineA > 0 && Math.floor(G.t * 4) % 2) Font.text(ctx, 'HAHAHA', 120, 30, { size: 1, color: '#ff4040', align: 'center', shadow: '#000' });

    Art.exitDoor(ctx, DOOR.x, DOOR.y, (G.exitOpen > 0 || G.people.some((p) => p.state === 'run')) && G.exitShut <= 0, G.t);
    for (const p of G.people) Art.person(ctx, p.x, p.y, { awake: p.awake, run: p.state === 'run' && !(G.exitShut > 0) && !(p.delay > 0), t: G.t, seed: p.seed, color: p.color });
    if (G.exitShut > 0 && G.people.some((p) => p.state === 'run')) Font.text(ctx, 'LOCKED', 15, 252, { color: '#ff3030', align: 'center', shadow: '#000' });

    // the man
    Art.manBody(ctx, 120);
    let face = 'idle';
    if (G.ending === 'win' && G.endT > 1.5) face = 'alone';
    else if (G.ending === 'lose') face = 'high';
    else if (G.face) face = G.face.f;
    else if (L.phase === 'resolve') face = isWin(L) ? 'dazed' : L.rt < 0.75 ? 'snort' : 'high';
    else if (L.phase === 'live' && G.lean > 0.5) face = 'lean';
    const showLine = !(L.phase === 'resolve') && !(G.ending === 'win');
    Art.table(ctx, showLine ? 1 : 0, G.t);
    Art.manHands(ctx, 120, L.phase === 'resolve' && !isWin(L));
    const hx = 120 + G.head.rx, hy = 128 + G.lean * 58 + G.head.ry;
    Art.manHead(ctx, hx, hy, face, G.t, G.nose);

    // player's fist / open hand
    if (G.fist) drawHand(G, hx, hy + 26);

    for (const p of G.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      const s = Math.round(p.size);
      R(ctx, p.x - s / 2, p.y - s / 2, s, s, p.color);
    }
    ctx.globalAlpha = 1;
    for (const t of G.texts) {
      if (t.delay > 0 || G.ai) continue;
      ctx.globalAlpha = clamp(t.life / 0.3, 0, 1);
      if (t.size >= 2) Font.title(ctx, t.text, t.x, Math.round(t.y), { size: t.size, depth: 2, color: t.color, side: t.color === '#ffd21f' ? '#d01818' : '#000' });
      else Font.text(ctx, t.text, t.x, t.y, { size: t.size, color: t.color, align: 'center', shadow: '#000' });
    }
    ctx.globalAlpha = 1;

    // "get ready" target announcement
    if (!G.ending && L.phase === 'ready') {
      const pop = 1 - L.t / 0.9;
      R(ctx, 40, 92, 160, 46, 'rgba(0,0,0,0.75)');
      Font.text(ctx, 'NEXT LINE! HIT EXACTLY', 120, 97, { color: '#2ec5e8', align: 'center' });
      Font.title(ctx, String(L.target), 120, 108 + Math.round((1 - Math.min(1, pop * 3)) * -6), { size: 3, depth: 3 });
    }
    if (G.flash) { ctx.globalAlpha = Math.max(0, G.flash.a); R(ctx, 0, 26, W, 236, G.flash.c); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawHand(G, nx, ny) {
    const f = G.fist, k = f.t < 0.06 ? f.t / 0.06 : 1 - (f.t - 0.06) / 0.14;
    if (f.kind === 'punch') {
      const x = Math.round(nx + (G.head.dir > 0 ? -10 : 10)), y = Math.round(262 - (262 - ny + 8) * k);
      R(ctx, x - 15, y - 1, 30, 24, C.black);
      R(ctx, x - 14, y, 28, 22, C.skin);
      for (let i = 0; i < 4; i++) { R(ctx, x - 13 + i * 7, y + 1, 6, 6, '#f0b888'); R(ctx, x - 7 + i * 7, y + 1, 1, 9, C.skinDark); }
      R(ctx, x - 14, y + 12, 28, 2, C.skinDark);
      R(ctx, x - 12, y + 22, 24, 6, '#e8e0d0');
      R(ctx, x - 12, y + 24, 24, 1, '#a89880');
      R(ctx, x - 13, y + 28, 26, 262 - y, '#1a1a1a');
    } else {
      const side = G.head.dir > 0 ? 1 : -1;
      const x = Math.round(nx + side * (90 - 70 * k)), y = Math.round(ny - 6);
      const dx = side > 0 ? 0 : -24;
      R(ctx, x + dx - 1, y - 1, 26, 18, C.black);
      R(ctx, x + dx, y, 24, 16, C.skin);
      for (let i = 0; i < 4; i++) R(ctx, x + dx, y + 1 + i * 4, 24, 1, C.skinDark);
      R(ctx, x + (side > 0 ? 24 : -60), y + 2, 36, 12, '#1a1a1a');
    }
  }

  function drawHud(G, playing) {
    const L = G.line;
    R(ctx, 0, 0, W, 26, '#080404');
    R(ctx, 0, 25, W, 1, '#2ec5e8');
    Font.text(ctx, 'PEOPLE OUT', 4, 3, { color: '#2ec5e8' });
    Font.text(ctx, G.out, 4, 11, { size: 2, color: '#ffd21f', shadow: '#000' });
    Font.text(ctx, 'INCOMING', 236, 3, { color: '#ff4a3a', align: 'right' });
    Font.text(ctx, G.babies.length, 236, 11, { size: 2, color: '#ffd21f', align: 'right', shadow: '#000' });
    Font.text(ctx, 'ROUND ' + G.round, 128, 3, { color: '#f3e3c0', align: 'center' });
    // machine meter
    R(ctx, 76, 12, 104, 10, '#000'); R(ctx, 77, 13, 102, 8, '#2a0a0a');
    const hw = Math.round((G.health / 100) * 102);
    R(ctx, 77, 13, hw, 8, G.health > 75 ? '#ff2020' : '#c01818');
    R(ctx, 77, 13, hw, 2, '#ff7a6a');
    Font.text(ctx, 'MACHINE', 128, 14, { color: '#fff', align: 'center', shadow: '#000' });
    if (playing) {
      button(66, 0, 10, 26, () => pause(), () => { R(ctx, 67, 12, 2, 9, '#f3e3c0'); R(ctx, 71, 12, 2, 9, '#f3e3c0'); });
    }

    // target panel
    R(ctx, 0, 262, W, 72, '#080404');
    R(ctx, 0, 262, W, 1, '#2ec5e8');
    const boxes = [['TARGET', L.target, '#ffd21f'], ['YOU', L.pts, '#2ec5e8'], ['LEFT', L.target - L.pts, '#ff4a3a']];
    boxes.forEach(([label, val, col], i) => {
      const x = 4 + i * 79;
      R(ctx, x, 266, 74, 40, '#120a0a');
      ctx.strokeStyle = i === 0 ? '#ffd21f' : '#3a2020'; ctx.strokeRect(x + 0.5, 266.5, 73, 39);
      Font.text(ctx, label, x + 37, 269, { color: '#f3e3c0', align: 'center' });
      let v = String(val), c = col;
      if (i === 2 && val < 0) { v = 'BUST'; c = '#ff3030'; }
      if (i === 2 && val === 0 && L.result === 'exact') { v = 'OK!'; c = '#7ad04a'; }
      const size = v.length > 3 ? 2 : 3;
      Font.text(ctx, v, x + 37, size === 3 ? 280 : 284, { size, color: c, align: 'center', shadow: '#000' });
    });
    // next line timer
    Font.text(ctx, 'NEXT LINE', 4, 311, { color: '#f3e3c0' });
    const frac = L.phase === 'live' ? L.timeLeft / L.T : L.phase === 'ready' ? 1 : 0;
    R(ctx, 60, 309, 146, 10, '#000'); R(ctx, 61, 310, 144, 8, '#2a0a0a');
    const tw = Math.round(144 * frac);
    R(ctx, 61, 310, tw, 8, frac > 0.5 ? '#ffd21f' : frac > 0.25 ? '#ff8a1a' : '#ff2020');
    R(ctx, 61, 310, tw, 2, '#fff4a0');
    Font.text(ctx, (L.phase === 'live' ? L.timeLeft : L.phase === 'ready' ? L.T : 0).toFixed(1), 236, 311, { color: '#ffd21f', align: 'right' });
    const h = hint(G);
    if (h && L.phase !== 'resolve') Font.text(ctx, 'TIP: ' + h, 120, 323, { color: '#7ad04a', align: 'center' });
    else if (G.streak >= 1) Font.text(ctx, 'COMBO X' + G.streak + (G.streak >= 3 ? '  BELT REVERSING!' : ''), 120, 323, { color: '#ff8a1a', align: 'center' });
  }

  function drawControls(G) {
    const defs = [
      ['punch', 'PUNCH', '+5', '#d81e1e', '#ff5a4a', '#7a0a0a', '#ffd21f'],
      ['slap', 'SLAP', '+1', '#e8b818', '#fff060', '#8a6a08', '#1a0f0c'],
      ['blow', 'BLOW', 'WIPE', '#1aa0c8', '#7ae0f8', '#0a5068', '#ffffff'],
    ];
    R(ctx, 0, 334, W, H - 334, '#080404');
    defs.forEach(([k, label, sub, bg, hi, lo, fg], i) => {
      const x = 4 + i * 79, y0 = 338, w = 74, h = 84;
      const down = (G.pressed[k] || 0) > 0;
      const disabled = k === 'blow' && G.pips < BLOW_COST;
      const ready = k === 'blow' && !disabled;
      button(x, y0, w, h, () => act(G, k), () => {
        const y = y0 + (down ? 3 : 0);
        R(ctx, x, y0 + 4, w, h - 4, '#000');
        R(ctx, x, y, w, h - 4, disabled ? '#2a3a40' : bg);
        R(ctx, x + 3, y + 3, w - 6, 3, disabled ? '#3a4a50' : hi);
        R(ctx, x, y + h - 8, w, 4, disabled ? '#1a2428' : lo);
        if (ready && Math.floor(G.t * 4) % 2) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 5); }
        Font.text(ctx, label, x + w / 2, y + 12, { size: 2, color: disabled ? '#6a7a80' : fg, align: 'center', shadow: disabled ? null : '#000' });
        Font.text(ctx, sub, x + w / 2, y + 36, { size: sub.length > 2 ? 2 : 3, color: disabled ? '#6a7a80' : fg, align: 'center', shadow: disabled ? null : '#000' });
        if (k === 'blow') {
          for (let p = 0; p < MAX_PIPS; p++) R(ctx, x + 22 + p * 11, y + 62, 8, 6, p < G.pips ? '#ffffff' : '#0a2a38');
        } else {
          Font.text(ctx, k === 'punch' ? '1 / J' : '2 / K', x + w / 2, y + 64, { color: disabled ? '#6a7a80' : fg, align: 'center' });
        }
      });
    });
  }

  // ---------- screens ----------
  let screen = 'title', game = null, demo = newGame({ ai: true }), paused = false, howto = false;
  let result = null;

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

  function drawTitle(t) {
    drawScene(demo);
    ctx.globalAlpha = 0.55; R(ctx, 0, 0, W, H, '#000'); ctx.globalAlpha = 0.35; R(ctx, 0, 26, W, 120, '#000'); ctx.globalAlpha = 1;
    R(ctx, 0, 0, W, 26, '#080404');
    Font.text(ctx, 'SAVE THE PEOPLE', 6, 9, { color: '#f3e3c0' });
    Font.text(ctx, 'STOP THE SYSTEM', 234, 9, { color: '#f3e3c0', align: 'right' });
    Font.title(ctx, 'HIT', 120, 34, { size: 7, depth: 5 });
    Font.title(ctx, 'THE NOSE', 120, 90, { size: 4, depth: 4 });
    Font.text(ctx, 'PUNCH AGAIN. BUY TIME.', 120, 128, { color: '#ff4a3a', align: 'center', shadow: '#000' });
    if (best > 0) Font.text(ctx, 'BEST: ' + best + ' PEOPLE OUT', 120, 140, { color: '#ffd21f', align: 'center', shadow: '#000' });
    R(ctx, 0, 262, W, H - 262, '#080404');
    R(ctx, 0, 262, W, 1, '#2ec5e8');
    const pulse = Math.floor(t * 2.5) % 2;
    menuButton('PLAY', 30, 272, 180, 34, () => startGame(false), { size: 3, color: pulse ? '#ffd21f' : '#fff' });
    menuButton('HOW TO PLAY', 30, 314, 180, 24, () => { howto = true; }, { bg: '#1a1a1a', hi: '#3a3a3a', lo: '#000', color: '#f3e3c0' });
    menuButton('STATS', 30, 344, 88, 24, () => { screen = 'stats'; Stats.load(); }, { bg: '#0e3a4a', hi: '#2ec5e8', lo: '#06202a', color: '#ffd21f' });
    menuButton(Sound.muted ? 'SOUND OFF' : 'SOUND ON', 122, 344, 88, 24, () => { Sound.init(); Sound.setMuted(!Sound.muted); }, { bg: '#1a1a1a', hi: '#3a3a3a', lo: '#000', color: '#f3e3c0', size: 1 });
    button(30, 380, 180, 30, () => showDisclaimer(), () => {
      Font.text(ctx, 'A FICTIONAL WORK OF', 120, 384, { color: '#8a7a6a', align: 'center' });
      Font.text(ctx, 'POLITICAL SATIRE  (TAP)', 120, 394, { color: '#8a7a6a', align: 'center' });
    });
    Font.text(ctx, 'AN ARCADE GAME FOR A BETTER TOMORROW?', 120, 414, { color: '#d81e1e', align: 'center' });
  }

  function drawHowto() {
    R(ctx, 0, 0, W, H, 'rgba(0,0,0,0.92)');
    Font.title(ctx, 'HOW TO PLAY', 120, 10, { size: 2, depth: 2 });
    const lines = [
      ['HE WANTS THE NEXT LINE.', '#f3e3c0'],
      ['STOP HIM BEFORE TIME RUNS OUT.', '#f3e3c0'],
      ['', ''],
      ['EVERY LINE HAS A TARGET.', '#2ec5e8'],
      ['HIT IT EXACTLY - LIKE DARTS!', '#2ec5e8'],
      ['', ''],
      ['PUNCH = 5 POINTS', '#ff4a3a'],
      ['SLAP  = 1 POINT', '#ffd21f'],
      ['', ''],
      ['TARGET 12 =', '#f3e3c0'],
      ['PUNCH + PUNCH + SLAP + SLAP', '#ffd21f'],
      ['', ''],
      ['TOO MANY OR TOO SLOW:', '#ff4a3a'],
      ['HE SNORTS. MORE GENERALS,', '#f3e3c0'],
      ['MORE MONEY, MORE MEAT.', '#f3e3c0'],
      ['THE DEVIL LAUGHS AND EATS.', '#f3e3c0'],
      ['', ''],
      ['EXACT HIT:', '#7ad04a'],
      ['GENERALS GO PUFF, THE BELT', '#f3e3c0'],
      ['REVERSES, PEOPLE ESCAPE.', '#f3e3c0'],
      ['FAST HITS AND COMBOS DO MORE.', '#f3e3c0'],
      ['', ''],
      ['BLOW: EACH EXACT HIT CHARGES', '#2ec5e8'],
      ['ONE PIP. 2 PIPS BLOW THE LINE', '#2ec5e8'],
      ['AWAY AND FREEZE THE MACHINE.', '#2ec5e8'],
      ['', ''],
      ['EMPTY THE MACHINE TO WIN.', '#ffd21f'],
      ['FILL IT AND YOU LOSE.', '#ff4a3a'],
    ];
    lines.forEach(([s, c], i) => s && Font.text(ctx, s, 120, 34 + i * 11, { color: c, align: 'center' }));
    menuButton('GOT IT', 60, 382, 120, 30, () => { howto = false; });
  }

  function drawPause() {
    R(ctx, 0, 0, W, H, 'rgba(0,0,0,0.8)');
    Font.title(ctx, 'PAUSED', 120, 120, { size: 4, depth: 3 });
    menuButton('RESUME', 50, 190, 140, 32, () => { paused = false; });
    menuButton('MENU', 50, 232, 140, 28, () => toTitle(), { bg: '#1a1a1a', hi: '#3a3a3a', lo: '#000', color: '#f3e3c0' });
  }

  function drawResult(t) {
    drawScene(game);
    R(ctx, 0, 0, W, H, 'rgba(0,0,0,0.78)');
    const r = result;
    if (r.won) {
      Font.title(ctx, 'PEOPLE OUT:', 120, 60, { size: 3, depth: 3 });
      Font.title(ctx, String(r.out), 120, 96, { size: 6, depth: 5 });
      Font.text(ctx, 'THEY WOKE UP.', 120, 160, { size: 2, color: '#f3e3c0', align: 'center', shadow: '#a01010' });
      Font.text(ctx, 'THEY GOT OUT.', 120, 180, { size: 2, color: '#f3e3c0', align: 'center', shadow: '#a01010' });
    } else {
      Font.title(ctx, 'HE KEPT', 120, 40, { size: 3, depth: 3, color: '#ff4a3a', side: '#5a0000' });
      Font.title(ctx, 'SNORTING', 120, 68, { size: 3, depth: 3, color: '#ff4a3a', side: '#5a0000' });
      Font.text(ctx, 'PEOPLE OUT:', 120, 112, { size: 2, color: '#f3e3c0', align: 'center' });
      Font.title(ctx, String(r.out), 120, 132, { size: 5, depth: 4 });
      Font.text(ctx, 'THE MACHINE KEPT GOING.', 120, 180, { color: '#f3e3c0', align: 'center' });
    }
    Font.text(ctx, 'ROUND ' + r.round + '   BEST COMBO X' + r.bestStreak, 120, 204, { color: '#2ec5e8', align: 'center' });
    Font.text(ctx, 'BEST EVER: ' + best, 120, 216, { color: '#ffd21f', align: 'center' });
    if (r.won) menuButton('NEXT ROUND', 30, 240, 180, 34, () => startGame(true));
    else menuButton('TRY AGAIN', 30, 240, 180, 34, () => startGame(false));
    menuButton('STATS', 30, 284, 88, 26, () => { screen = 'stats'; Stats.load(); }, { bg: '#0e3a4a', hi: '#2ec5e8', lo: '#06202a' });
    menuButton('MENU', 122, 284, 88, 26, () => toTitle(), { bg: '#1a1a1a', hi: '#3a3a3a', lo: '#000', color: '#f3e3c0' });
  }

  // ---------- DOM overlays (disclaimer + award images) ----------
  const disclaimerEl = document.getElementById('disclaimer');
  const awardEl = document.getElementById('award');
  function showDisclaimer() { disclaimerEl.hidden = false; }
  function showAward(n) { document.getElementById('award-score').textContent = 'PEOPLE OUT: ' + n; awardEl.hidden = false; }
  document.getElementById('disclaimer-ok').addEventListener('click', () => { disclaimerEl.hidden = true; Sound.init(); });
  document.getElementById('award-ok').addEventListener('click', () => { awardEl.hidden = true; });

  // ---------- main loop ----------
  let last = performance.now(), statsBack = null;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ui = [];
    if (screen === 'title') {
      update(demo, dt);
      if (demo.ending && demo.endT > 3) demo = newGame({ ai: true });
      drawTitle(now / 1000);
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
      drawResult(now / 1000);
    } else if (screen === 'stats') {
      const r = Stats.draw(ctx, now / 1000);
      statsBack = r.back;
      button(...statsBack, () => { screen = result ? 'result' : 'title'; });
      button(0, 0, W, H, () => {});
    }
    present();
    requestAnimationFrame(frame);
  }

  function present() {
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(buf, 0, 0, display.width, display.height);
  }

  function resize() {
    const stage = document.getElementById('stage');
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const s = Math.min(sw / W, sh / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    display.style.width = cw + 'px'; display.style.height = ch + 'px';
    display.width = Math.round(cw * dpr); display.height = Math.round(ch * dpr);
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
