// Procedural pixel art. Every sprite is drawn with filled rectangles so the
// game ships with no image dependencies for its characters.
(function () {
  const W = 240, H = 426;
  const C = {
    black: '#0b0606', ink: '#1a0f0c', red: '#d81e1e', darkRed: '#7a0a0a', yellow: '#ffd21f',
    cream: '#f3e3c0', cyan: '#2ec5e8', skin: '#e2a272', skinDark: '#b8784a', hair: '#2a1a10',
    olive: '#55642c', oliveDark: '#3a4520', wood: '#6b3a1a', woodLight: '#8e5228', woodDark: '#3d1f0c',
    coke: '#f7f7f2', gen: '#2f3a22', suit: '#191919', money: '#2f8f3c', moneyDark: '#1e5e28',
  };

  const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  // ---------- backdrop (pre-rendered once) ----------
  let bg = null;
  function backdrop() {
    if (bg) return bg;
    bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const x = bg.getContext('2d');
    R(x, 0, 0, W, H, C.black);
    const bands = ['#1c0303', '#2c0505', '#420707', '#5c0a0a', '#7a0e0b', '#9a160d', '#bb2410', '#d8371a'];
    bands.forEach((c, i) => R(x, 0, 26 + i * 12, W, 12, c));
    // dither between bands
    for (let i = 1; i < bands.length; i++) {
      for (let px = (i % 2); px < W; px += 2) R(x, px, 26 + i * 12 - 1, 1, 1, bands[i - 1]);
      for (let px = (i % 2) + 1; px < W; px += 4) R(x, px, 26 + i * 12, 1, 1, bands[i - 1]);
    }
    // sun
    for (let dy = -14; dy <= 14; dy++) {
      const w = Math.round(Math.sqrt(196 - dy * dy));
      R(x, 206 - w, 104 + dy, w * 2, 1, dy < 0 ? '#ffd21f' : '#ffb000');
    }
    // skyline
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let bx = -4; bx < W; ) {
      const bw = 8 + Math.floor(rnd() * 14), bh = 22 + Math.floor(rnd() * 52);
      const top = 124 - bh;
      R(x, bx, top, bw, 130 - top, '#0d0505');
      if (rnd() > 0.6) R(x, bx + bw / 2 - 1, top - 8, 2, 8, '#0d0505');
      for (let wy = top + 4; wy < 122; wy += 5)
        for (let wx = bx + 2; wx < bx + bw - 2; wx += 4)
          if (rnd() > 0.82) R(x, wx, wy, 1, 2, rnd() > 0.5 ? '#ffb000' : '#ff5a1a');
      bx += bw + Math.floor(rnd() * 3);
    }
    // interior wall below the window
    R(x, 0, 126, W, 140, '#140909');
    for (let py = 128; py < 266; py += 2)
      for (let px = (py / 2) % 2 ? 0 : 2; px < W; px += 4) R(x, px, py, 1, 1, '#1d0d0b');
    R(x, 0, 124, W, 3, '#2a1210');
    // floor
    R(x, 0, 236, W, 30, '#0f0707');
    for (let px = 0; px < W; px += 12) R(x, px, 236, 1, 30, '#1b0c0a');
    return bg;
  }

  // ---------- the man ----------
  function manBody(ctx, cx) {
    // torso behind the table
    R(ctx, cx - 34, 176, 68, 52, C.oliveDark);
    R(ctx, cx - 32, 174, 64, 52, C.olive);
    R(ctx, cx - 30, 174, 6, 50, '#647536');
    R(ctx, cx + 22, 176, 10, 50, C.oliveDark);
    R(ctx, cx - 7, 172, 14, 6, C.skinDark); // neck
    R(ctx, cx - 9, 174, 18, 3, C.oliveDark); // collar
    // arms resting on the table
    R(ctx, cx - 46, 186, 16, 36, C.olive);
    R(ctx, cx + 30, 186, 16, 36, C.olive);
    R(ctx, cx - 46, 186, 3, 36, '#647536');
    R(ctx, cx + 43, 186, 3, 36, C.oliveDark);
  }

  function manHands(ctx, cx, slam) {
    const dy = slam ? 2 : 0;
    R(ctx, cx - 50, 220 + dy, 20, 9, C.skin);
    R(ctx, cx + 30, 220 + dy, 20, 9, C.skin);
    R(ctx, cx - 50, 227 + dy, 20, 2, C.skinDark);
    R(ctx, cx + 30, 227 + dy, 20, 2, C.skinDark);
    for (let i = 0; i < 4; i++) {
      R(ctx, cx - 49 + i * 5, 222 + dy, 1, 6, C.skinDark);
      R(ctx, cx + 33 + i * 5, 222 + dy, 1, 6, C.skinDark);
    }
  }

  function table(ctx, line, t) {
    R(ctx, 54, 222, 132, 3, C.woodLight);
    R(ctx, 54, 225, 132, 7, C.wood);
    R(ctx, 54, 232, 132, 30, C.woodDark);
    for (let i = 0; i < 5; i++) R(ctx, 58 + i * 26, 236 + (i % 2) * 8, 18, 1, '#55301a');
    R(ctx, 54, 232, 132, 1, C.black);
    if (line > 0) {
      const w = Math.round(30 * line), x0 = 120 - w / 2;
      R(ctx, x0, 227, w, 2, C.coke);
      R(ctx, x0 + 1, 229, w - 2, 1, '#cfcfc8');
      const s = Math.floor(t * 6) % 6;
      R(ctx, x0 + ((s * 7) % Math.max(1, w)), 225, 1, 1, '#ffffff');
    }
  }

  // face: idle | lean | hit | snort | high | dazed | alone
  function manHead(ctx, hx, hy, face, t, nose) {
    const x = Math.round(hx - 20), y = Math.round(hy);
    // hair & head shape
    R(ctx, x + 3, y, 34, 10, C.hair);
    R(ctx, x + 1, y + 4, 4, 16, C.hair);
    R(ctx, x + 35, y + 4, 4, 16, C.hair);
    R(ctx, x + 4, y + 7, 32, 34, C.skin);
    R(ctx, x + 6, y + 41, 28, 3, C.skin);
    R(ctx, x + 32, y + 10, 4, 31, C.skinDark);
    R(ctx, x + 4, y + 38, 32, 3, C.skinDark);
    R(ctx, x + 1, y + 18, 3, 9, C.skin); R(ctx, x + 36, y + 18, 3, 9, C.skinDark);
    R(ctx, x + 6, y + 6, 6, 4, C.hair); R(ctx, x + 26, y + 6, 8, 3, C.hair);
    // stubble
    for (let i = 0; i < 14; i++) R(ctx, x + 7 + ((i * 5) % 26), y + 33 + (i % 4) * 2, 1, 1, '#7a4a2a');
    R(ctx, x + 8, y + 40, 24, 2, '#8a5a3a');

    const blink = (t % 3.2) < 0.12;
    if (face === 'hit' || face === 'dazed') {
      // squeezed eyes
      R(ctx, x + 9, y + 18, 8, 2, C.black); R(ctx, x + 23, y + 18, 8, 2, C.black);
      R(ctx, x + 9, y + 16, 2, 2, C.black); R(ctx, x + 29, y + 16, 2, 2, C.black);
      if (face === 'dazed') {
        const s = Math.floor(t * 10) % 4;
        R(ctx, x + 6 + s * 8, y - 6 - (s % 2) * 2, 3, 3, C.yellow);
        R(ctx, x + 30 - s * 8, y - 8 + (s % 2) * 2, 2, 2, C.yellow);
      }
      R(ctx, x + 13, y + 32, 14, 6, C.black); R(ctx, x + 14, y + 32, 12, 2, '#fff');
      R(ctx, x + 2, y + 10, 2, 4, C.cyan); R(ctx, x + 37, y + 12, 2, 4, C.cyan);
    } else if (face === 'snort') {
      R(ctx, x + 9, y + 18, 8, 2, C.black); R(ctx, x + 23, y + 18, 8, 2, C.black);
      R(ctx, x + 15, y + 34, 10, 2, C.black);
    } else if (face === 'high') {
      R(ctx, x + 8, y + 15, 10, 7, '#fff'); R(ctx, x + 22, y + 15, 10, 7, '#fff');
      const j = Math.floor(t * 20) % 2;
      R(ctx, x + 11 + j, y + 16, 5, 5, C.black); R(ctx, x + 25 - j, y + 16, 5, 5, C.black);
      R(ctx, x + 8, y + 13, 10, 2, C.hair); R(ctx, x + 22, y + 13, 10, 2, C.hair);
      R(ctx, x + 10, y + 31, 20, 6, C.black); R(ctx, x + 11, y + 31, 18, 3, '#fff');
      R(ctx, x + 10, y + 30, 2, 2, C.black); R(ctx, x + 28, y + 30, 2, 2, C.black);
    } else {
      // idle / lean / alone: heavy brows, glaring eyes
      const lean = face === 'lean';
      R(ctx, x + 8, y + 17, 9, 5, '#fff'); R(ctx, x + 23, y + 17, 9, 5, '#fff');
      if (!blink) {
        const py = lean ? 20 : 18;
        R(ctx, x + 12, y + py, 3, 3, C.black); R(ctx, x + 25, y + py, 3, 3, C.black);
      } else { R(ctx, x + 8, y + 19, 9, 2, C.skinDark); R(ctx, x + 23, y + 19, 9, 2, C.skinDark); }
      R(ctx, x + 7, y + 13, 11, 3, C.hair); R(ctx, x + 22, y + 13, 11, 3, C.hair);
      if (face !== 'alone') { R(ctx, x + 15, y + 15, 3, 2, C.hair); R(ctx, x + 22, y + 15, 3, 2, C.hair); }
      if (face === 'alone') R(ctx, x + 14, y + 35, 12, 2, C.black);
      else if (lean) { R(ctx, x + 14, y + 33, 12, 3, C.black); R(ctx, x + 15, y + 33, 10, 1, '#fff'); }
      else R(ctx, x + 13, y + 34, 14, 2, C.black);
    }
    // the nose: big, red, and the target of the whole game
    const n = Math.min(1, nose);
    const nc = n > 0.66 ? '#ff2020' : n > 0.33 ? '#e43a2a' : '#d8603a';
    R(ctx, x + 15, y + 21, 10, 10, C.black);
    R(ctx, x + 16, y + 21, 8, 10, nc);
    R(ctx, x + 14, y + 23, 12, 7, nc);
    R(ctx, x + 17, y + 22, 3, 2, '#ffb0a0');
    R(ctx, x + 16, y + 29, 2, 1, '#600'); R(ctx, x + 22, y + 29, 2, 1, '#600');
    if (face === 'snort' || face === 'high') R(ctx, x + 16, y + 30, 2, 2, C.coke);
  }

  // ---------- the machine ----------
  function devil(ctx, cx, cy, o) {
    const open = o.open || 0, laugh = o.laugh, frozen = o.frozen, a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const shake = laugh ? (Math.floor(o.t * 20) % 2) : 0;
    const x = cx - 26, y = cy - 26 + shake;
    const base = frozen ? '#8a7f9a' : '#a80f0f', dark = frozen ? '#5a5268' : '#640606', hi = frozen ? '#b8b0c8' : '#d42020';
    // glow
    if (!frozen) for (let r = 46; r > 26; r -= 5) {
      ctx.globalAlpha = a * 0.08;
      R(ctx, cx - r, cy - r * 0.8, r * 2, r * 1.6, '#ff2a00');
    }
    ctx.globalAlpha = a;
    // shoulders
    R(ctx, x - 18, y + 46, 88, 30, dark);
    R(ctx, x - 12, y + 44, 76, 6, base);
    // horns
    for (let i = 0; i < 9; i++) {
      R(ctx, x + 2 - i * 2, y + 4 - i * 2, 9 - i, 3, i < 3 ? dark : '#2a0505');
      R(ctx, x + 41 + i * 2, y + 4 - i * 2, 9 - i, 3, i < 3 ? dark : '#2a0505');
    }
    // head
    R(ctx, x - 1, y + 3, 54, 46, C.black);
    R(ctx, x, y + 4, 52, 44, base);
    R(ctx, x + 40, y + 6, 12, 40, dark);
    R(ctx, x + 2, y + 6, 6, 30, hi);
    R(ctx, x - 5, y + 18, 6, 10, base); R(ctx, x + 51, y + 18, 6, 10, dark);
    // brows & eyes
    R(ctx, x + 6, y + 14, 16, 3, C.black); R(ctx, x + 30, y + 14, 16, 3, C.black);
    R(ctx, x + 18, y + 17, 6, 2, C.black); R(ctx, x + 28, y + 17, 6, 2, C.black);
    const eye = frozen ? '#d8e8ff' : laugh && Math.floor(o.t * 8) % 2 ? '#ffffff' : '#ffe040';
    R(ctx, x + 8, y + 18, 12, 5, eye); R(ctx, x + 32, y + 18, 12, 5, eye);
    R(ctx, x + 13, y + 18, 2, 5, C.black); R(ctx, x + 37, y + 18, 2, 5, C.black);
    // nose
    R(ctx, x + 22, y + 24, 8, 6, dark);
    // mouth
    const mh = 4 + Math.round(open * 10);
    R(ctx, x + 8, y + 32, 36, mh, C.black);
    R(ctx, x + 6, y + 30, 4, 3, C.black); R(ctx, x + 42, y + 30, 4, 3, C.black);
    for (let i = 0; i < 6; i++) R(ctx, x + 10 + i * 6, y + 32, 3, 3, '#f4ecd8');
    if (mh > 6) for (let i = 0; i < 5; i++) R(ctx, x + 13 + i * 6, y + 30 + mh, 3, 2, '#f4ecd8');
    if (mh > 8) R(ctx, x + 18, y + 36, 16, mh - 6, '#5a0000');
    // goatee
    R(ctx, x + 20, y + 47, 12, 6, C.black); R(ctx, x + 23, y + 53, 6, 4, C.black);
    ctx.globalAlpha = 1;
  }

  function belt(ctx, x0, y0, x1, y1, phase, frozen) {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u;
      R(ctx, px, py, 1, 6, '#1a1a1a');
      R(ctx, px, py, 1, 1, '#555');
      const tick = Math.floor(i + phase) % 6 === 0;
      R(ctx, px, py + 2, 1, 2, tick ? (frozen ? '#9ad' : C.yellow) : '#333');
    }
    for (let u = 0.1; u < 1; u += 0.25) {
      const px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u;
      R(ctx, px, py + 6, 2, 236 - py, '#241010');
    }
  }

  function baby(ctx, x, y, t, scared) {
    x = Math.round(x); y = Math.round(y);
    R(ctx, x + 1, y, 6, 5, '#f2c0a0');
    R(ctx, x + 2, y + 1, 1, 1, C.black); R(ctx, x + 5, y + 1, 1, 1, C.black);
    if (scared) R(ctx, x + 3, y + 3, 2, 2, C.black); else R(ctx, x + 3, y + 3, 2, 1, '#c06060');
    R(ctx, x, y + 5, 8, 3, '#f2c0a0');
    R(ctx, x + 1, y + 6, 6, 3, '#ffffff');
    if (Math.floor(t * 4) % 2) R(ctx, x - 1, y + 4, 1, 2, '#f2c0a0'); else R(ctx, x + 8, y + 4, 1, 2, '#f2c0a0');
  }

  function meat(ctx, x, y) {
    R(ctx, x - 1, y + 4, 14, 3, '#9a9a9a');
    R(ctx, x, y + 5, 12, 1, '#cfcfcf');
    R(ctx, x + 1, y, 10, 5, '#b51f2a');
    R(ctx, x + 1, y, 10, 1, '#fff0e0');
    R(ctx, x + 3, y + 2, 3, 1, '#f07a8a'); R(ctx, x + 7, y + 3, 2, 1, '#f07a8a');
  }

  function money(ctx, x, y) {
    R(ctx, x, y, 12, 5, C.moneyDark);
    R(ctx, x, y, 12, 1, '#5ac26a');
    R(ctx, x, y + 2, 12, 1, C.money);
    R(ctx, x + 5, y, 2, 5, C.yellow);
  }

  // kind: 'gen' (general with meat) or 'pol' (politician with money)
  function figure(ctx, x, y, o) {
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const fr = o.frozen, laugh = o.laugh && !fr;
    const bob = laugh ? (Math.floor(o.t * 10 + o.seed) % 2) : 0;
    y = Math.round(y - bob); x = Math.round(x);
    const skin = fr ? '#c8d8f0' : '#d89a6a', coat = fr ? '#8aa0c0' : o.kind === 'gen' ? C.gen : C.suit;
    const K = C.black;
    // body
    R(ctx, x + 1, y + 15, 14, 12, K);
    R(ctx, x + 2, y + 15, 12, 11, coat);
    if (o.kind === 'gen') {
      R(ctx, x + 1, y + 15, 3, 2, fr ? '#fff' : C.yellow); R(ctx, x + 12, y + 15, 3, 2, fr ? '#fff' : C.yellow);
      R(ctx, x + 3, y + 18, 2, 2, fr ? '#fff' : C.yellow); R(ctx, x + 5, y + 18, 2, 2, fr ? '#fff' : C.red);
      R(ctx, x + 3, y + 21, 4, 1, fr ? '#fff' : C.red);
    } else {
      R(ctx, x + 6, y + 15, 4, 4, '#eee'); R(ctx, x + 7, y + 16, 2, 6, fr ? '#fff' : C.red);
    }
    R(ctx, x + 3, y + 26, 4, 2, K); R(ctx, x + 9, y + 26, 4, 2, K);
    // head
    R(ctx, x + 3, y + 5, 10, 11, K);
    R(ctx, x + 4, y + 6, 8, 9, skin);
    if (o.kind === 'gen') {
      R(ctx, x + 1, y + 4, 14, 3, K); // visor
      R(ctx, x + 3, y, 10, 5, fr ? '#a0b0d0' : '#26301a');
      R(ctx, x + 7, y + 1, 2, 2, fr ? '#fff' : C.yellow);
    } else {
      R(ctx, x + 3, y + 5, 2, 4, fr ? '#ddd' : '#9a9a9a'); R(ctx, x + 11, y + 5, 2, 4, fr ? '#ddd' : '#9a9a9a');
      R(ctx, x + 5, y + 4, 6, 2, skin);
      if (o.seed % 2) R(ctx, x + 5, y + 10, 2, 1, K), R(ctx, x + 9, y + 10, 2, 1, K); // sunglasses look
    }
    if (laugh) {
      R(ctx, x + 5, y + 9, 2, 1, K); R(ctx, x + 9, y + 9, 2, 1, K);
      R(ctx, x + 6, y + 11, 4, 3, K); R(ctx, x + 6, y + 11, 4, 1, '#fff');
      R(ctx, x + 4, y + 11, 1, 1, '#e06060'); R(ctx, x + 11, y + 11, 1, 1, '#e06060');
    } else if (fr) {
      R(ctx, x + 5, y + 9, 2, 2, K); R(ctx, x + 9, y + 9, 2, 2, K);
      R(ctx, x + 5, y + 12, 6, 1, K); // frozen grin
    } else {
      R(ctx, x + 5, y + 9, 2, 2, K); R(ctx, x + 9, y + 9, 2, 2, K);
      R(ctx, x + 6, y + 12, 4, 1, K);
    }
    // what they carry
    if (o.kind === 'gen') meat(ctx, x + 2, y + 18); else money(ctx, x + 2, y + 20);
    R(ctx, x, y + 21, 3, 3, skin); R(ctx, x + 13, y + 21, 3, 3, skin);
    ctx.globalAlpha = 1;
  }

  function person(ctx, x, y, o) {
    x = Math.round(x); y = Math.round(y);
    const awake = o.awake, run = o.run, f = Math.floor(o.t * (run ? 12 : 2) + o.seed) % 2;
    const sk = awake ? '#e2a272' : '#8a8078', shirt = awake ? o.color : '#4a4a52';
    R(ctx, x + 1, y, 4, 4, sk);
    R(ctx, x + 1, y, 4, 1, awake ? '#3a2416' : '#3a3a3a');
    if (awake) { R(ctx, x + 2, y + 2, 1, 1, C.black); R(ctx, x + 4, y + 2, 1, 1, C.black); }
    R(ctx, x, y + 4, 6, 5, shirt);
    if (run) {
      R(ctx, x + (f ? 0 : 4), y + 9, 2, 3, '#222'); R(ctx, x + (f ? 4 : 1), y + 9, 2, 2, '#222');
      R(ctx, x - 1, y + 5 + f, 1, 2, sk);
    } else {
      R(ctx, x + 1, y + 9, 2, 3, '#222'); R(ctx, x + 3, y + 9, 2, 3, '#222');
    }
  }

  function exitDoor(ctx, x, y, open, t) {
    R(ctx, x - 2, y - 12, 26, 9, C.black);
    R(ctx, x - 1, y - 11, 24, 7, open ? '#1a8a2a' : '#5a0a0a');
    Font.text(ctx, 'EXIT', x + 11, y - 10, { color: open ? '#ffffff' : '#c08080', align: 'center' });
    R(ctx, x - 2, y - 2, 26, 46, C.black);
    if (open) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 10);
      ctx.globalAlpha = 0.35 * pulse;
      R(ctx, x - 8, y - 6, 38, 52, C.yellow);
      ctx.globalAlpha = 1;
      R(ctx, x, y, 22, 42, '#fff4a0');
      R(ctx, x + 2, y + 2, 18, 40, C.yellow);
    } else {
      R(ctx, x, y, 22, 42, '#3a1a10');
      R(ctx, x + 2, y + 2, 18, 38, '#4a2416');
      R(ctx, x + 16, y + 20, 2, 3, C.yellow);
    }
  }

  window.Art = { W, H, C, R, backdrop, manBody, manHands, manHead, table, devil, belt, baby, meat, money, figure, person, exitDoor };
})();
