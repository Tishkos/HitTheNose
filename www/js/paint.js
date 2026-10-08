// Painted comic-poster renderer: inked outlines, gradient shading, hatching,
// film grain and a worn poster frame. Everything is drawn in logical units
// (240 x 426) and cached per device scale, so it stays sharp on any phone.
//
// Optional painted art: list image files in www/assets/art/art-manifest.js
// and they replace the procedural layers of the same name (see docs/ART_GUIDE.md).
(function () {
  const W = 240, H = 426, INK = '#150b07';
  let k = 1;
  const cache = new Map();
  const ART = {};

  // ---------- optional image overrides ----------
  const manifest = window.HTN_ART || {};
  Object.keys(manifest).forEach((name) => {
    const img = new Image();
    img.onload = () => { ART[name] = img; cache.clear(); };
    img.src = 'assets/art/' + manifest[name];
  });
  const art = (name) => ART[name] || null;

  function setScale(s) { if (Math.abs(s - k) > 0.001) { k = s; cache.clear(); } }
  function clear() { cache.clear(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(clear);

  function sprite(key, w, h, draw) {
    let s = cache.get(key);
    if (s) return s;
    if (cache.size > 400) cache.clear();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    const x = c.getContext('2d');
    x.scale(k, k);
    draw(x);
    s = { c, w, h };
    cache.set(key, s);
    return s;
  }
  const put = (ctx, s, x, y) => ctx.drawImage(s.c, x, y, s.w, s.h);

  function rng(seed) {
    let s = (seed * 9301 + 49297) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  // ---------- drawing primitives ----------
  function smooth(ctx, pts, closed = true) {
    const n = pts.length;
    ctx.beginPath();
    if (closed) {
      ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  function poly(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); }
  function fill(ctx, style) { ctx.fillStyle = style; ctx.fill(); }
  function ink(ctx, lw = 0.9, color = INK) { ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function line(ctx, pts, lw, color) { smooth(ctx, pts, false); ink(ctx, lw, color); }
  function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rg(ctx, x, y, r0, r1, stops, fx, fy) {
    const g = ctx.createRadialGradient(fx == null ? x : fx, fy == null ? y : fy, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
  }
  function clipDo(ctx, shape, fn) { ctx.save(); shape(); ctx.clip(); fn(); ctx.restore(); }
  function hatch(ctx, x, y, w, h, gap, color, lw = 0.35) {
    ctx.beginPath();
    for (let i = -h; i < w; i += gap) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
  }
  function tint(ctx, w, h, color) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color; ctx.fillRect(0, 0, w * k + 2, h * k + 2);
    ctx.restore();
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(ctx, x, y, r0, r1, n, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n, r = i % 2 ? r0 : r1 * (0.8 + 0.2 * ((i * 7) % 3) / 2);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  // ---------- backdrop ----------
  function background(ctx) {
    if (art('background')) { ctx.drawImage(art('background'), 0, 0, W, 262); return; }
    put(ctx, sprite('bg', W, 262, (x) => {
      const r = rng(11);
      x.fillStyle = '#0d0706'; x.fillRect(0, 0, W, 262);
      // burning sky behind the machine
      x.fillStyle = lg(x, 0, 20, 0, 134, [[0, '#120303'], [0.4, '#3a0706'], [0.75, '#86140a'], [1, '#c8360f']]);
      x.fillRect(0, 20, W, 114);
      x.fillStyle = rg(x, 120, 72, 0, 130, [[0, 'rgba(255,110,40,0.55)'], [0.45, 'rgba(210,40,12,0.28)'], [1, 'rgba(0,0,0,0)']]);
      x.fillRect(0, 0, W, 140);
      for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(25,4,3,0.32)'; ell(x, r() * W, 34 + r() * 60, 18 + r() * 34, 4 + r() * 7); x.fill(); }
      // far and near skyline
      for (let bx = -6; bx < W;) {
        const bw = 6 + r() * 12, bh = 24 + r() * 50;
        x.fillStyle = '#4a0c07'; x.fillRect(bx, 132 - bh, bw, bh);
        if (r() > 0.7) x.fillRect(bx + bw / 2 - 0.6, 132 - bh - 9, 1.2, 9);
        bx += bw + r() * 2;
      }
      for (let bx = -6; bx < W;) {
        const bw = 8 + r() * 16, bh = 14 + r() * 40;
        x.fillStyle = '#1a0504'; x.fillRect(bx, 134 - bh, bw, bh);
        for (let wy = 134 - bh + 3; wy < 130; wy += 4)
          for (let wx = bx + 2; wx < bx + bw - 2; wx += 3)
            if (r() > 0.86) { x.fillStyle = r() > 0.5 ? '#ffb030' : '#ff5a1a'; x.fillRect(wx, wy, 1, 1.5); }
        bx += bw + r() * 3;
      }
      // factory pillars and girders on the right, pipes on the left
      x.fillStyle = '#0f0605';
      x.fillRect(150, 20, 5, 118); x.fillRect(233, 20, 7, 118);
      x.strokeStyle = '#0f0605'; x.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(155, 24 + i * 34); x.lineTo(233, 58 + i * 34); x.moveTo(155, 58 + i * 34); x.lineTo(233, 24 + i * 34); x.stroke(); }
      // billboard: A BRIGHTER TOMORROW (TM)
      x.save(); x.translate(204, 38); x.rotate(-0.06);
      rrect(x, -28, -11, 56, 22, 1); fill(x, lg(x, 0, -11, 0, 11, [[0, '#e8d6a8'], [1, '#b89c6a']])); ink(x, 1);
      for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(70,40,20,${0.08 + r() * 0.15})`; ell(x, -26 + r() * 52, -10 + r() * 20, 2 + r() * 6, 1 + r() * 3); x.fill(); }
      x.fillStyle = '#2a1a10'; x.textAlign = 'center';
      x.font = '6.5px "Anton", Impact, sans-serif'; x.fillText('A BRIGHTER', 0, -2);
      x.font = '8px "Anton", Impact, sans-serif'; x.fillText('TOMORROW', -2, 7.5);
      x.font = '3.5px "Anton", Impact, sans-serif'; x.fillText('(TM)', 22, 7.5);
      poly(x, [[28, -11], [22, -11], [28, -5]]); fill(x, '#7a6040');
      x.restore();
      // interior wall
      x.fillStyle = lg(x, 0, 134, 0, 236, [[0, '#2a140c'], [1, '#110806']]);
      x.fillRect(0, 134, W, 102);
      x.fillStyle = '#3a1a10'; x.fillRect(0, 132, W, 3);
      for (let px = 6; px < W; px += 16) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, 135, 1, 101); }
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`; ell(x, r() * W, 140 + r() * 90, 3 + r() * 10, 2 + r() * 8); x.fill(); }
      x.fillStyle = lg(x, 0, 150, 0, 156, [[0, '#5a3020'], [1, '#1e0e08']]); x.fillRect(0, 150, 46, 6);
      x.fillStyle = '#0d0605'; x.fillRect(44, 148, 4, 10);
      // floor
      x.fillStyle = lg(x, 0, 236, 0, 262, [[0, '#1e100a'], [1, '#080403']]);
      x.fillRect(0, 236, W, 26);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 0.5;
      for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(120 + i * 14, 236); x.lineTo(120 + i * 40, 262); x.stroke(); }
      // shadow pooled under the table
      x.fillStyle = rg(x, 120, 240, 10, 100, [[0, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]);
      x.fillRect(0, 200, W, 62);
    }), 0, 0);
  }

  // ---------- the devil ----------
  function devilSprite(frozen, openQ, flash) {
    return sprite(`dv|${frozen}|${openQ}|${flash}`, 130, 112, (x) => {
      const cx = 65, open = openQ / 3;
      // shoulders and a reaching claw
      ell(x, cx, 106, 66, 28); fill(x, lg(x, 0, 80, 0, 112, [[0, '#5a0807'], [1, '#120202']]));
      // horns
      [-1, 1].forEach((s) => {
        const P = [[cx - 19 * s, 26], [cx - 31 * s, 17], [cx - 41 * s, 7], [cx - 48 * s, 0.5], [cx - 42 * s, 12], [cx - 35 * s, 23], [cx - 24 * s, 33]];
        smooth(x, P); fill(x, lg(x, cx - 48 * s, 0, cx - 20 * s, 32, [[0, '#d8c8a0'], [0.3, '#5a2414'], [1, '#160303']])); ink(x, 1.1);
        line(x, [P[1], P[5]], 0.5, 'rgba(0,0,0,0.6)'); line(x, [P[2], P[4]], 0.5, 'rgba(0,0,0,0.6)');
      });
      // ears
      [-1, 1].forEach((s) => { smooth(x, [[cx - 30 * s, 36], [cx - 41 * s, 28], [cx - 36 * s, 44], [cx - 30 * s, 48]]); fill(x, '#7a0d0a'); ink(x, 0.9); });
      // head
      const head = [[cx, 12], [cx + 18, 15], [cx + 28, 26], [cx + 31, 42], [cx + 26, 58], [cx + 16, 70], [cx + 6, 79], [cx, 82], [cx - 6, 79], [cx - 16, 70], [cx - 26, 58], [cx - 31, 42], [cx - 28, 26], [cx - 18, 15]];
      smooth(x, head);
      fill(x, lg(x, 0, 12, 0, 84, [[0, '#c62c1e'], [0.5, '#8a0f0a'], [1, '#360303']]));
      clipDo(x, () => smooth(x, head), () => {
        x.fillStyle = rg(x, cx, 40, 8, 40, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(12,0,0,0.7)']]); x.fillRect(0, 0, 130, 112);
        x.fillStyle = 'rgba(255,150,100,0.22)'; ell(x, cx - 9, 24, 13, 6, -0.3); x.fill();
        x.fillStyle = 'rgba(20,0,0,0.5)'; ell(x, cx - 19, 58, 6, 11, 0.4); x.fill(); ell(x, cx + 19, 58, 6, 11, -0.4); x.fill();
        hatch(x, cx + 10, 16, 26, 66, 2, 'rgba(20,0,0,0.4)', 0.45);
        line(x, [[cx - 10, 20], [cx, 24], [cx + 10, 20]], 0.6, 'rgba(30,0,0,0.6)');
        line(x, [[cx - 7, 25], [cx, 28], [cx + 7, 25]], 0.5, 'rgba(30,0,0,0.5)');
      });
      smooth(x, head); ink(x, 1.4);
      // brow ridge
      [-1, 1].forEach((s) => { poly(x, [[cx - 27 * s, 31], [cx - 3 * s, 40], [cx - 3 * s, 44], [cx - 25 * s, 38]]); fill(x, '#260202'); });
      // glowing eyes
      [-1, 1].forEach((s) => {
        const ex = cx - 14 * s, ey = 44;
        smooth(x, [[ex + 7.5 * s, ey - 2], [ex, ey - 3.5], [ex - 7.5 * s, ey + 1], [ex, ey + 2.6]]);
        fill(x, frozen ? '#c8d0e0' : rg(x, ex, ey, 0, 8, [[0, '#ffffff'], [0.35, flash ? '#ffffff' : '#fff0a0'], [0.8, '#ffb020'], [1, '#e05010']]));
        ink(x, 0.7);
        x.fillStyle = INK; ell(x, ex, ey - 0.4, 0.8, 2.4); x.fill();
      });
      if (!frozen) {
        x.globalCompositeOperation = 'lighter';
        [-1, 1].forEach((s) => { x.fillStyle = rg(x, cx - 14 * s, 44, 0, 12, [[0, 'rgba(255,190,70,0.55)'], [1, 'rgba(255,90,20,0)']]); x.fillRect(cx - 14 * s - 12, 32, 24, 24); });
        x.globalCompositeOperation = 'source-over';
      }
      // snout
      smooth(x, [[cx - 6, 50], [cx, 47], [cx + 6, 50], [cx + 7, 56], [cx, 58], [cx - 7, 56]]); fill(x, '#7a0b08'); ink(x, 0.7);
      x.fillStyle = INK; ell(x, cx - 3, 56, 1.6, 1); x.fill(); ell(x, cx + 3, 56, 1.6, 1); x.fill();
      // grin
      const my = 63;
      const mouth = [[cx - 21, my - 3], [cx - 10, my + 1], [cx, my + 2], [cx + 10, my + 1], [cx + 21, my - 3], [cx + 14, my + 4 + open * 9], [cx, my + 7 + open * 11], [cx - 14, my + 4 + open * 9]];
      smooth(x, mouth); fill(x, '#1a0202');
      clipDo(x, () => smooth(x, mouth), () => {
        if (open > 0.1) { x.fillStyle = '#9a1418'; ell(x, cx, my + 7 + open * 9, 8, 3 + open * 2); x.fill(); }
        x.fillStyle = '#ece0c4';
        for (let i = -5; i <= 5; i++) { poly(x, [[cx + i * 3.8 - 1.9, my - 4], [cx + i * 3.8 + 1.9, my - 4], [cx + i * 3.8, my + 3.4 - Math.abs(i) * 0.25]]); x.fill(); }
        if (open > 0.1) for (let i = -4; i <= 4; i++) { const by = my + 6 + open * 11 - Math.abs(i) * 0.9; poly(x, [[cx + i * 4 - 1.8, by + 3], [cx + i * 4 + 1.8, by + 3], [cx + i * 4, by - 2]]); x.fill(); }
      });
      smooth(x, mouth); ink(x, 1);
      line(x, [[cx - 23, my - 6], [cx - 21, my - 3], [cx - 22, my + 1]], 0.6, INK);
      line(x, [[cx + 23, my - 6], [cx + 21, my - 3], [cx + 22, my + 1]], 0.6, INK);
      // goatee
      poly(x, [[cx - 7, 78], [cx + 7, 78], [cx + 2.5, 92], [cx, 99], [cx - 2.5, 92]]); fill(x, '#120202');
      if (frozen) tint(x, 130, 112, 'rgba(176,184,214,0.78)');
    });
  }

  function devil(ctx, cx, cy, o) {
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.01) return;
    ctx.globalAlpha = a;
    if (!o.frozen) {
      const p = 0.75 + 0.25 * Math.sin(o.t * 3) + (o.laugh ? 0.25 : 0);
      ctx.fillStyle = rg(ctx, cx, cy, 6, 80, [[0, `rgba(255,60,20,${0.35 * p})`], [1, 'rgba(255,30,10,0)']]);
      ctx.fillRect(cx - 80, cy - 70, 160, 140);
    }
    const sx = o.laugh ? Math.sin(o.t * 40) * 0.8 : 0;
    if (art('devil')) {
      ctx.drawImage(art('devil'), cx - 65 + sx, cy - 48, 130, 112);
    } else {
      const s = devilSprite(o.frozen ? 1 : 0, Math.round(clamp(o.open || 0, 0, 1) * 3), o.laugh && Math.floor(o.t * 8) % 2 ? 1 : 0);
      put(ctx, s, cx - 65 + sx, cy - 48);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- generals & politicians ----------
  function figureSprite(kind, seed, laugh, frame, frozen) {
    return sprite(`fg|${kind}|${seed}|${laugh}|${frame}|${frozen}`, 40, 58, (x) => {
      const gen = kind === 'gen';
      const skinG = (c) => rg(x, 18, 21, 2, 17, [[0, '#f2c49c'], [0.55, '#cf8b62'], [1, '#8a4a30']]);
      // body
      poly(x, [[1, 58], [2, 44], [7, 37.5], [20, 34], [33, 37.5], [38, 44], [39, 58]]);
      fill(x, lg(x, 0, 34, 40, 58, gen ? [[0, '#4e5636'], [0.5, '#2c3220'], [1, '#121608']] : [[0, '#3c3c48'], [0.5, '#22222a'], [1, '#0a0a0e']]));
      ink(x, 1);
      if (gen) {
        line(x, [[20, 35], [16, 44], [20, 58]], 0.6, 'rgba(0,0,0,0.6)');
        [8, 32].forEach((ex, i) => { ell(x, ex, 38.4, 5, 2.2, i ? 0.3 : -0.3); fill(x, lg(x, 0, 36, 0, 41, [[0, '#ffe68a'], [1, '#a07010']])); ink(x, 0.5); });
        const cols = ['#c81e1e', '#e8c030', '#2a6ad0', '#e8e0d0', '#2a8a3a', '#a02090'];
        for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) { x.fillStyle = cols[(row * 3 + c + seed) % 6]; x.fillRect(8 + c * 3.1, 40.5 + row * 2, 2.8, 1.6); }
        for (let b = 0; b < 3; b++) { ell(x, 24, 40 + b * 4.5, 0.8, 0.8); fill(x, '#d8a830'); }
      } else {
        poly(x, [[15, 35], [25, 35], [20, 46]]); fill(x, '#ebe6d8');
        smooth(x, [[19, 37], [21, 37], [22.6, 46], [20, 50], [17.4, 46]]); fill(x, '#b8141a'); ink(x, 0.4);
        line(x, [[15, 35], [12.5, 44], [16, 58]], 0.7, 'rgba(255,255,255,0.18)');
        line(x, [[25, 35], [27.5, 44], [24, 58]], 0.7, 'rgba(255,255,255,0.18)');
      }
      x.fillStyle = '#a8684a'; x.fillRect(15, 30, 10, 6);
      // head
      const tilt = laugh ? (frame ? -0.07 : 0.05) : 0;
      x.save(); x.translate(20, 24); x.rotate(tilt); x.translate(-20, -24);
      [8.6, 31.4].forEach((ex) => { ell(x, ex, 24, 2.4, 3.4); fill(x, '#c08060'); ink(x, 0.6); });
      const head = [[20, 9], [27, 10.5], [30.5, 16], [31.5, 24], [30.2, 31], [26, 35.6], [20, 37.2], [14, 35.6], [9.8, 31], [8.5, 24], [9.5, 16], [13, 10.5]];
      smooth(x, head); fill(x, skinG());
      clipDo(x, () => smooth(x, head), () => {
        hatch(x, 24, 10, 10, 28, 1.3, 'rgba(70,25,10,0.35)', 0.35);
        x.fillStyle = 'rgba(220,60,50,0.3)'; ell(x, 13, 28, 3, 2); x.fill(); ell(x, 27, 28, 3, 2); x.fill();
      });
      smooth(x, head); ink(x, 0.9);
      line(x, [[11.5, 29], [12.6, 33], [16, 35.4]], 0.4, 'rgba(60,20,10,0.7)');
      line(x, [[28.5, 29], [27.4, 33], [24, 35.4]], 0.4, 'rgba(60,20,10,0.7)');
      line(x, [[16, 27.5], [15, 30], [16.3, 32]], 0.4, 'rgba(60,20,10,0.6)');
      line(x, [[24, 27.5], [25, 30], [23.7, 32]], 0.4, 'rgba(60,20,10,0.6)');
      // eyes
      if (laugh) {
        line(x, [[12, 22.4], [14.6, 20.6], [17.2, 22.4]], 0.9, INK);
        line(x, [[22.8, 22.4], [25.4, 20.6], [28, 22.4]], 0.9, INK);
        line(x, [[10.8, 21.4], [9.6, 21]], 0.4, INK); line(x, [[29.2, 21.4], [30.4, 21]], 0.4, INK);
      } else if (!gen && seed % 2) {
        x.fillStyle = '#0a0a0c'; rrect(x, 10.8, 19.6, 7.4, 4.6, 1.6); x.fill(); rrect(x, 21.8, 19.6, 7.4, 4.6, 1.6); x.fill();
        line(x, [[18.2, 21], [21.8, 21]], 0.6, '#0a0a0c');
        line(x, [[12.2, 20.6], [14, 20.6]], 0.4, 'rgba(255,255,255,0.7)'); line(x, [[23.2, 20.6], [25, 20.6]], 0.4, 'rgba(255,255,255,0.7)');
      } else {
        [14.6, 25.4].forEach((ex) => { ell(x, ex, 22, 2.4, 1.3); fill(x, '#f4ecd8'); x.fillStyle = INK; ell(x, ex, 22.1, 0.9, 1); x.fill(); });
        line(x, [[12.5, 23.8], [14.6, 24.5], [16.7, 23.8]], 0.35, 'rgba(60,20,10,0.7)');
        line(x, [[23.3, 23.8], [25.4, 24.5], [27.5, 23.8]], 0.35, 'rgba(60,20,10,0.7)');
      }
      const browC = gen ? '#2a1a10' : '#8a8680';
      if (laugh) { line(x, [[11, 18.4], [14, 16.8], [17.6, 18.2]], 1.4, browC); line(x, [[29, 18.4], [26, 16.8], [22.4, 18.2]], 1.4, browC); }
      else { line(x, [[11, 18.3], [17.8, 20.2]], 1.7, browC); line(x, [[29, 18.3], [22.2, 20.2]], 1.7, browC); }
      // nose
      ell(x, 20, 26.2, 3, 2.6); fill(x, rg(x, 19.2, 25.4, 0.3, 3.4, [[0, '#f4ac8c'], [1, '#a85a44']])); ink(x, 0.5);
      x.fillStyle = INK; ell(x, 18.7, 27.8, 0.6, 0.4); x.fill(); ell(x, 21.3, 27.8, 0.6, 0.4); x.fill();
      // mouth
      if (laugh) {
        const mo = frame ? 4.6 : 3.6;
        const m = [[14, 30], [20, 30.6], [26, 30], [24, mo + 30], [20, mo + 31], [16, mo + 30]];
        smooth(x, m); fill(x, '#3a0606');
        x.fillStyle = '#f0e8d0'; x.fillRect(15.6, 30.2, 8.8, 1.3);
        x.fillStyle = '#c03030'; ell(x, 20, 30 + mo - 0.4, 2.5, 1); x.fill();
        smooth(x, m); ink(x, 0.6);
      } else {
        line(x, [[15.6, 31.6], [20, 30.8], [24.4, 31.6]], 0.8, INK);
        line(x, [[14.6, 32.8], [15.6, 31.6]], 0.6, INK); line(x, [[25.4, 32.8], [24.4, 31.6]], 0.6, INK);
      }
      line(x, [[15, 35.2], [20, 36.4], [25, 35.2]], 0.5, 'rgba(60,20,10,0.6)');
      if (gen) {
        smooth(x, [[6, 15], [5, 9], [12, 4], [20, 2.5], [28, 4], [35, 9], [34, 15]]);
        fill(x, lg(x, 0, 2, 0, 15, [[0, '#5e6844'], [1, '#262c18']])); ink(x, 0.9);
        x.fillStyle = '#14160c'; x.fillRect(6.6, 12, 26.8, 3.2);
        x.fillStyle = '#c8a030'; x.fillRect(6.6, 12.2, 26.8, 0.6);
        x.beginPath(); x.moveTo(6, 15); x.quadraticCurveTo(20, 20.8, 34, 15); x.quadraticCurveTo(20, 17, 6, 15); fill(x, '#050505'); ink(x, 0.4);
        line(x, [[10, 16.4], [16, 17.6]], 0.4, 'rgba(255,255,255,0.35)');
        ell(x, 20, 8, 1.6, 1.8); fill(x, '#f0c040'); ink(x, 0.35);
        line(x, [[15.4, 6.6], [18.4, 8.2]], 1.1, '#f0c040'); line(x, [[24.6, 6.6], [21.6, 8.2]], 1.1, '#f0c040');
      } else {
        x.fillStyle = 'rgba(255,240,220,0.4)'; ell(x, 17, 13, 4.2, 2, -0.3); x.fill();
        [[9, 22], [31, 22]].forEach(([hx], i) => { const s = i ? -1 : 1; smooth(x, [[hx, 23], [hx + 0.4 * s, 15.5], [hx + 3.5 * s, 13.4], [hx + 2.4 * s, 19]]); fill(x, '#a8a49a'); ink(x, 0.4); });
        line(x, [[15, 14.6], [20, 13.8], [25, 14.6]], 0.35, 'rgba(60,20,10,0.5)');
        line(x, [[14.5, 16.4], [20, 15.6], [25.5, 16.4]], 0.35, 'rgba(60,20,10,0.5)');
      }
      x.restore();
      // what they carry
      if (gen) {
        ell(x, 20, 51.5, 15, 4.3); fill(x, lg(x, 0, 47, 0, 56, [[0, '#f4f4f4'], [1, '#6a6a6a']])); ink(x, 0.7);
        [9, 20].forEach((sx) => {
          const st = [[sx, 49.6], [sx + 3.5, 46.2], [sx + 9.5, 46.6], [sx + 11, 50], [sx + 6, 52.2], [sx + 1, 51.8]];
          smooth(x, st); fill(x, lg(x, 0, 46, 0, 52, [[0, '#c41c28'], [1, '#7a0a14']])); ink(x, 0.5);
          line(x, [[sx + 2, 49], [sx + 5, 48], [sx + 8, 49.4]], 0.5, 'rgba(255,230,220,0.75)');
          line(x, [[sx + 4, 50.6], [sx + 7, 50]], 0.4, 'rgba(255,230,220,0.6)');
        });
        [4.5, 35.5].forEach((hx) => { ell(x, hx, 51.5, 3, 2.4); fill(x, '#d89a70'); ink(x, 0.5); });
      } else {
        rrect(x, 7, 43, 26, 13, 0.8); fill(x, lg(x, 0, 43, 0, 56, [[0, '#8a5a2a'], [1, '#4a2a10']])); ink(x, 0.7);
        for (let row = 0; row < 2; row++) for (let c = 0; c < 3; c++) {
          const bx = 8.5 + c * 7.8, by = 41.5 + row * 3.2;
          x.fillStyle = '#2e7a38'; x.fillRect(bx, by, 7, 3); x.fillStyle = '#6ac078'; x.fillRect(bx, by, 7, 0.7);
          x.fillStyle = '#e8d8a0'; x.fillRect(bx + 2.8, by, 1.4, 3);
        }
        [5, 35].forEach((hx) => { ell(x, hx, 49, 2.8, 2.4); fill(x, '#d89a70'); ink(x, 0.5); });
      }
      if (frozen) tint(x, 40, 58, 'rgba(192,206,232,0.8)');
    });
  }

  function figure(ctx, x, y, o) {
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.01) return;
    ctx.globalAlpha = a;
    const ov = art(o.kind === 'gen' ? 'general' : 'politician');
    const bob = o.laugh && !o.frozen ? Math.abs(Math.sin(o.t * 12 + o.seed)) * 1.2 : 0;
    if (ov) {
      ctx.drawImage(ov, x, y - bob, 40, 58);
      if (o.frozen) { ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#c8d4ec'; ctx.fillRect(x + 4, y + 2, 32, 54); }
    } else {
      put(ctx, figureSprite(o.kind, o.seed, o.laugh && !o.frozen ? 1 : 0, Math.floor(o.t * 8 + o.seed) % 2, o.frozen ? 1 : 0), x, y - bob);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- conveyor & babies ----------
  function belt(ctx, B, phase, frozen, alpha) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha = alpha;
    const dx = B.x1 - B.x0, dy = B.y1 - B.y0, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    // supports
    for (let u = 0.12; u < 1; u += 0.22) {
      const px = B.x0 + dx * u, py = B.y0 + dy * u;
      ctx.fillStyle = '#140807'; ctx.fillRect(px - 1.2, py + 4, 2.4, 134 - py);
      ctx.fillStyle = 'rgba(255,120,60,0.18)'; ctx.fillRect(px - 1.2, py + 4, 0.6, 134 - py);
    }
    // belt body
    const p = (u, off) => [B.x0 + dx * u + nx * off, B.y0 + dy * u + ny * off];
    poly(ctx, [p(0, -1.5), p(1, -1.5), p(1, 5.5), p(0, 5.5)]);
    fill(ctx, '#1e1a18'); ink(ctx, 0.9);
    poly(ctx, [p(0, -1.5), p(1, -1.5), p(1, 0.6), p(0, 0.6)]); fill(ctx, '#5a524a');
    ctx.strokeStyle = frozen ? '#9ab0d0' : '#c8a030'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    const step = 5, off = ((phase % step) + step) % step;
    for (let d = off; d < len; d += step) { const [ax, ay] = p(d / len, -1.4); const [bx, by] = p(d / len, 0.4); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
    ctx.stroke();
    // rollers
    for (let d = 3; d < len; d += 9) {
      const [rx, ry] = p(d / len, 3.4);
      ell(ctx, rx, ry, 1.8, 1.8); fill(ctx, '#3a3430'); ink(ctx, 0.4);
      ctx.fillStyle = '#8a7a6a'; ctx.fillRect(rx - 0.4, ry - 0.4, 0.8, 0.8);
    }
    ctx.restore();
  }

  function babySprite(scared, frame) {
    return sprite(`bb|${scared}|${frame}`, 16, 16, (x) => {
      const skin = rg(x, 7, 6, 0.5, 6, [[0, '#ffe0c8'], [1, '#d89474']]);
      smooth(x, [[4, 15.6], [3.4, 11], [8, 8.6], [12.6, 11], [12, 15.6]]); fill(x, skin); ink(x, 0.6);
      smooth(x, [[3.8, 15.6], [4.4, 12.6], [8, 13.6], [11.6, 12.6], [12.2, 15.6]]); fill(x, '#f6f2ea'); ink(x, 0.5);
      line(x, [[5, 11.2], [3.2, frame ? 7.6 : 9.6]], 2.2, INK); line(x, [[5, 11.2], [3.2, frame ? 7.6 : 9.6]], 1.4, '#eab090');
      line(x, [[11, 11.2], [12.8, frame ? 9.6 : 7.6]], 2.2, INK); line(x, [[11, 11.2], [12.8, frame ? 9.6 : 7.6]], 1.4, '#eab090');
      ell(x, 8, 6, 4.7, 4.4); fill(x, skin); ink(x, 0.7);
      line(x, [[7.6, 1.8], [8.8, 0.8], [9.4, 2]], 0.6, '#8a5a30');
      [6.2, 9.8].forEach((ex) => { ell(x, ex, 6, 1.2, 1.4); fill(x, '#fff'); x.fillStyle = INK; ell(x, ex, scared ? 6.3 : 6.1, 0.65, 0.75); x.fill(); });
      x.fillStyle = 'rgba(240,110,110,0.45)'; ell(x, 5, 8, 1.1, 0.7); x.fill(); ell(x, 11, 8, 1.1, 0.7); x.fill();
      if (scared) { ell(x, 8, 8.8, 0.9, 1.1); fill(x, '#5a1a1a'); line(x, [[5, 4.2], [7, 4.8]], 0.4, INK); line(x, [[11, 4.2], [9, 4.8]], 0.4, INK); }
      else line(x, [[7, 8.6], [8, 9.1], [9, 8.6]], 0.45, '#8a3a3a');
    });
  }
  function baby(ctx, x, y, t, scared) {
    if (art('baby')) { ctx.drawImage(art('baby'), x, y, 16, 16); return; }
    put(ctx, babySprite(scared ? 1 : 0, Math.floor(t * 4) % 2), x, y);
  }

  // ---------- money & meat ----------
  function moneyBrick(ctx, x, y) {
    put(ctx, sprite('money', 14, 8, (c) => {
      for (let i = 0; i < 3; i++) {
        rrect(c, 0.5, 5 - i * 2, 13, 3, 0.4); fill(c, i % 2 ? '#2a7034' : '#348a40'); ink(c, 0.35);
      }
      c.fillStyle = '#7acc88'; c.fillRect(1, 1.2, 12, 0.5);
      c.fillStyle = '#e8d8a0'; c.fillRect(5.6, 1, 2.6, 7);
    }), x, y);
  }
  function meatBlock(ctx, x, y) {
    put(ctx, sprite('meat', 14, 9, (c) => {
      rrect(c, 0.5, 1, 13, 7.5, 1.4); fill(c, lg(c, 0, 1, 0, 9, [[0, '#d4303a'], [1, '#7a0a14']])); ink(c, 0.5);
      c.fillStyle = '#f0dcd0'; c.fillRect(1, 1.3, 12, 1);
      line(c, [[2, 4], [5, 3.4], [8, 4.6], [11, 3.8]], 0.5, 'rgba(255,225,215,0.75)');
      line(c, [[3, 6.2], [6, 5.6], [10, 6.4]], 0.4, 'rgba(255,225,215,0.55)');
    }), x, y);
  }

  // ---------- exit & people ----------
  function exitDoor(ctx, x, y, open, t) {
    if (open) {
      const a = 0.8 + 0.2 * Math.sin(t * 8);
      ctx.fillStyle = rg(ctx, x + 12, y + 24, 4, 48, [[0, `rgba(255,220,110,${0.55 * a})`], [1, 'rgba(255,200,60,0)']]);
      ctx.fillRect(x - 40, y - 30, 100, 100);
      poly(ctx, [[x + 1, y + 46], [x + 25, y + 46], [x + 70, y + 72], [x - 6, y + 72]]);
      fill(ctx, lg(ctx, 0, y + 46, 0, y + 72, [[0, `rgba(255,214,90,${0.5 * a})`], [1, 'rgba(255,200,60,0)']]));
    }
    ctx.fillStyle = '#080403'; ctx.fillRect(x - 2.5, y - 2.5, 29, 49);
    if (open) {
      ctx.fillStyle = lg(ctx, 0, y, 0, y + 46, [[0, '#fffbe2'], [0.5, '#ffd84a'], [1, '#e89a10']]);
      ctx.fillRect(x, y, 24, 46);
    } else {
      ctx.fillStyle = lg(ctx, x, 0, x + 24, 0, [[0, '#3a2014'], [1, '#1e0e08']]); ctx.fillRect(x, y, 24, 46);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6, y); ctx.lineTo(x + i * 6, y + 46); ctx.stroke(); }
      ell(ctx, x + 19.5, y + 25, 1.1, 1.1); fill(ctx, '#c8a030');
    }
    // sign
    const sx = x, sy = y - 13;
    if (open) { ctx.fillStyle = 'rgba(255,210,80,0.35)'; ctx.fillRect(sx - 3, sy - 3, 30, 15); }
    rrect(ctx, sx, sy, 24, 9.5, 0.8); fill(ctx, open ? '#f5c518' : '#6a5410'); ink(ctx, 0.8);
    Font.text(ctx, 'EXIT', sx + 12, sy + 1.6, { size: 0.9, color: open ? '#c41a14' : '#3a1008', align: 'center' });
  }

  function person(ctx, x, y, o) {
    const run = o.run, f = Math.sin(o.t * 14 + o.seed);
    const col = o.awake ? '#140e0b' : '#2c2624';
    const droop = o.awake ? 0 : 1;
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (run) { ctx.moveTo(x + 4.5, y + 13); ctx.lineTo(x + 4.5 + f * 3.2, y + 20); ctx.moveTo(x + 4.5, y + 13); ctx.lineTo(x + 4.5 - f * 3.2, y + 20); }
    else { ctx.moveTo(x + 3.4, y + 13); ctx.lineTo(x + 3.2, y + 20); ctx.moveTo(x + 5.6, y + 13); ctx.lineTo(x + 5.8, y + 20); }
    ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath();
    if (run) { ctx.moveTo(x + 2, y + 8); ctx.lineTo(x + 0.5 - f * 2, y + 13); ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 8.5 + f * 2, y + 13); }
    else { ctx.moveTo(x + 1.8, y + 8.5); ctx.lineTo(x + 1.6, y + 14); ctx.moveTo(x + 7.2, y + 8.5); ctx.lineTo(x + 7.4, y + 14); }
    ctx.stroke();
    smooth(ctx, [[x + 1.6, y + 14], [x + 1.2, y + 8 + droop], [x + 4.5, y + 5.6 + droop], [x + 7.8, y + 8 + droop], [x + 7.4, y + 14]]);
    fill(ctx, col);
    ell(ctx, x + 4.5 + droop * 0.8, y + 3 + droop * 1.4, 2.6, 2.8); fill(ctx, col);
    if (o.awake) {
      ctx.strokeStyle = 'rgba(255,214,90,0.9)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(x + 4.5, y + 3, 2.6, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 1.3, y + 8.4); ctx.lineTo(x + 1.6, y + 13.6); ctx.stroke();
      ctx.fillStyle = o.color; ctx.globalAlpha = 0.55; ctx.fillRect(x + 2.5, y + 8, 4, 4); ctx.globalAlpha = 1;
    } else if (Math.floor(o.t * 1.2 + o.seed) % 3 === 0) {
      Font.text(ctx, 'z', x + 7, y - 4 - ((o.t * 3 + o.seed) % 2), { size: 0.7, color: 'rgba(239,220,176,0.6)' });
    }
  }

  // ---------- the man (an invented caricature) ----------
  function tableSprite() {
    return sprite('table', 136, 48, (x) => {
      const r = rng(5);
      poly(x, [[6, 2], [130, 2], [136, 16], [0, 16]]);
      fill(x, lg(x, 0, 2, 0, 16, [[0, '#8a5228'], [1, '#4e2810']])); ink(x, 1);
      x.strokeStyle = 'rgba(30,12,4,0.45)'; x.lineWidth = 0.4;
      for (let i = 0; i < 12; i++) { const yy = 3 + r() * 12, xx = 8 + r() * 110; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 6 + r() * 16, yy + (r() - 0.5)); x.stroke(); }
      x.fillStyle = 'rgba(245,240,230,0.25)';
      for (let i = 0; i < 40; i++) x.fillRect(40 + r() * 56, 4 + r() * 10, 0.6, 0.6);
      x.fillStyle = lg(x, 0, 16, 0, 48, [[0, '#3a1c0c'], [1, '#160804']]);
      x.fillRect(0, 16, 136, 32);
      x.fillStyle = '#a0643a'; x.fillRect(0, 16, 136, 0.8);
      x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 0.5;
      for (let i = 0; i < 8; i++) { const yy = 20 + r() * 26; x.beginPath(); x.moveTo(r() * 30, yy); x.bezierCurveTo(40, yy + 2, 90, yy - 2, 136, yy + 1); x.stroke(); }
      x.strokeStyle = INK; x.lineWidth = 1; x.strokeRect(0, 16, 136, 32);
    });
  }
  function table(ctx, x, y) { put(ctx, tableSprite(), x, y); }

  function cokeLine(ctx, cx, y, amount, t) {
    if (amount <= 0) return;
    const w = 30 * amount;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, cx, y + 1.6, w / 2 + 1, 1.6); ctx.fill();
    smooth(ctx, [[cx - w / 2, y + 0.6], [cx - w / 4, y - 0.8], [cx + w / 4, y - 0.6], [cx + w / 2, y + 0.6], [cx, y + 1.6]]);
    fill(ctx, '#f6f4ee');
    const r = rng(3);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) ctx.fillRect(cx - w / 2 + r() * w, y - 1 + r() * 2.4, 0.5, 0.5);
    const s = (t * 2) % 1;
    ctx.fillStyle = `rgba(255,255,255,${1 - s})`;
    star(ctx, cx - w / 2 + ((t * 13) % w), y - 1.5, 0.3, 1.6, 4); ctx.fill();
  }

  function bodySprite() {
    return sprite('body', 140, 80, (x) => {
      const r = rng(9);
      const M = (pts, s) => pts.map(([px, py]) => [s > 0 ? px : 140 - px, py]);
      const skinG = (y0, y1) => lg(x, 0, y0, 0, y1, [[0, '#e8b48a'], [0.55, '#c8875e'], [1, '#8a4e30']]);
      // torso in a sweat-stained olive t-shirt
      const torso = [[26, 80], [23, 48], [27, 27], [41, 15.5], [58, 10.5], [82, 10.5], [99, 15.5], [113, 27], [117, 48], [114, 80]];
      smooth(x, torso);
      fill(x, lg(x, 22, 0, 118, 0, [[0, '#6e7c3a'], [0.4, '#57642e'], [0.8, '#3a4420'], [1, '#232a10']]));
      clipDo(x, () => smooth(x, torso), () => {
        hatch(x, 84, 10, 40, 72, 1.6, 'rgba(10,14,4,0.4)', 0.45);
        x.fillStyle = 'rgba(16,20,6,0.45)'; ell(x, 30, 40, 7, 13); x.fill(); ell(x, 110, 40, 7, 13); x.fill();
        x.fillStyle = 'rgba(16,20,6,0.28)'; ell(x, 70, 34, 13, 7); x.fill();
        x.fillStyle = 'rgba(255,255,220,0.1)'; ell(x, 52, 30, 12, 8, -0.3); x.fill();
        line(x, [[70, 24], [69, 44], [71, 70]], 0.5, 'rgba(15,18,5,0.5)');
        line(x, [[44, 34], [52, 52], [50, 76]], 0.6, 'rgba(15,18,5,0.55)');
        line(x, [[96, 32], [90, 54], [92, 76]], 0.6, 'rgba(15,18,5,0.55)');
        line(x, [[54, 60], [70, 64], [86, 60]], 0.5, 'rgba(15,18,5,0.45)');
      });
      smooth(x, torso); ink(x, 1.3);
      // neck and collar
      smooth(x, [[57, 0], [83, 0], [86, 15], [70, 19], [54, 15]]); fill(x, lg(x, 54, 0, 86, 0, [[0, '#dca47c'], [1, '#9a5e3e']])); ink(x, 1);
      line(x, [[62, 4], [66, 12]], 0.5, 'rgba(80,35,15,0.6)'); line(x, [[78, 4], [74, 12]], 0.5, 'rgba(80,35,15,0.6)');
      smooth(x, [[52, 12], [70, 20], [88, 12], [85, 16.5], [70, 24], [55, 16.5]]); fill(x, '#323c1a'); ink(x, 0.9);
      [1, -1].forEach((s) => {
        // short sleeve
        smooth(x, M([[42, 15], [28, 22], [17, 37], [19, 48], [33, 47], [38, 30]], s));
        fill(x, s > 0 ? lg(x, 14, 0, 42, 0, [[0, '#7a8a42'], [1, '#4e5a28']]) : lg(x, 98, 0, 126, 0, [[0, '#3a4420'], [1, '#1e240e']]));
        ink(x, 1.1);
        line(x, M([[19, 45], [26, 44], [33, 45]], s), 0.6, 'rgba(10,14,4,0.6)');
        // upper arm (muscle) down to the elbow
        const ua = M([[18, 45], [33, 46], [33, 58], [27, 66], [14, 64], [13, 54]], s);
        smooth(x, ua); fill(x, skinG(44, 66)); ink(x, 1.1);
        x.fillStyle = 'rgba(255,230,200,0.3)'; ell(x, s > 0 ? 21 : 119, 52, 3, 5); x.fill();
        // forearm lying across the table toward the line
        const fa = M([[12, 60], [26, 58], [38, 63], [45, 68], [44, 77], [32, 76], [14, 72]], s);
        smooth(x, fa); fill(x, skinG(58, 78)); ink(x, 1.2);
        x.strokeStyle = 'rgba(55,28,12,0.55)'; x.lineWidth = 0.35;
        for (let i = 0; i < 30; i++) {
          const hx = 16 + r() * 26, hy = 62 + r() * 10;
          const [ax, ay] = M([[hx, hy]], s)[0];
          x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + 1.3 * s, ay - 0.7); x.stroke();
        }
        line(x, M([[22, 66], [30, 67], [38, 70]], s), 0.5, 'rgba(70,30,10,0.4)');
        // hand flat on the table, fingers spread
        smooth(x, M([[37, 67], [46, 66], [52, 70], [50, 77], [39, 78]], s)); fill(x, '#d29a72'); ink(x, 1);
        for (let i = 0; i < 4; i++) {
          const f0 = M([[48 + i * 0.6, 68.5 + i * 2.6]], s)[0], f1 = M([[55.5 - Math.abs(i - 1.5) * 0.8, 67.6 + i * 3.4]], s)[0];
          line(x, [f0, f1], 3, INK); line(x, [f0, f1], 2.1, '#d8a07a');
          x.fillStyle = 'rgba(255,240,230,0.7)'; x.fillRect(f1[0] - 0.5, f1[1] - 0.4, 0.9, 0.7);
        }
        const t0 = M([[43, 67]], s)[0], t1 = M([[49, 63.5]], s)[0];
        line(x, [t0, t1], 3.2, INK); line(x, [t0, t1], 2.2, '#d8a07a');
        line(x, M([[40, 72], [44, 73]], s), 0.4, 'rgba(70,30,10,0.6)');
      });
    });
  }
  function body(ctx, x, y) { if (art('man-body')) ctx.drawImage(art('man-body'), x, y, 140, 80); else put(ctx, bodySprite(), x, y); }

  // face: idle | lean | hit | snort | high | dazed | alone
  function headSprite(face, noseQ, blink) {
    return sprite(`hd|${face}|${noseQ}|${blink}`, 64, 76, (x) => {
      const r = rng(21);
      const shape = [[32, 6], [44, 8], [52, 16], [55, 28], [55.5, 40], [53, 52], [47, 62], [39, 68.5], [32, 70], [25, 68.5], [17, 62], [11, 52], [8.5, 40], [9, 28], [12, 16], [20, 8]];
      // ears
      [[8, 1], [56, -1]].forEach(([ex, s]) => { ell(x, ex, 39, 4.2, 7); fill(x, '#c48660'); ink(x, 0.9); line(x, [[ex + 1.2 * s, 35], [ex - 0.6 * s, 39], [ex + 1.2 * s, 43]], 0.6, 'rgba(70,25,10,0.7)'); });
      smooth(x, shape);
      fill(x, rg(x, 32, 40, 4, 34, [[0, '#f2c09a'], [0.55, '#d8976c'], [0.85, '#b06a46'], [1, '#7a3e26']], 27, 32));
      clipDo(x, () => smooth(x, shape), () => {
        x.fillStyle = 'rgba(60,30,20,0.28)';
        for (let i = 0; i < 420; i++) {
          const sx = 12 + r() * 40, sy = 50 + r() * 20;
          if (sy > 54 && sy < 61 && sx > 23 && sx < 41) continue;
          x.fillRect(sx, sy, 0.45, 0.45);
        }
        hatch(x, 44, 10, 16, 62, 1.6, 'rgba(80,30,10,0.3)', 0.4);
        hatch(x, 6, 44, 14, 26, 1.6, 'rgba(80,30,10,0.25)', 0.35);
        x.fillStyle = 'rgba(90,40,20,0.28)'; ell(x, 23, 38, 8, 5.5); x.fill(); ell(x, 41, 38, 8, 5.5); x.fill();
        x.fillStyle = 'rgba(40,25,18,0.16)'; ell(x, 32, 62, 20, 9); x.fill();
        x.fillStyle = 'rgba(225,70,55,0.28)'; ell(x, 18, 50, 5, 3.4); x.fill(); ell(x, 46, 50, 5, 3.4); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)'; ell(x, 24, 22, 6, 3, -0.4); x.fill();
        if (face === 'hit') { x.fillStyle = 'rgba(230,40,40,0.35)'; ell(x, 48, 44, 7, 9); x.fill(); }
      });
      smooth(x, shape); ink(x, 1.3);
      // receding, slicked hair with heavy sideburns
      smooth(x, [[10, 36], [9.5, 20], [16, 9], [32, 3.5], [48, 9], [54.5, 20], [54, 36], [51, 28], [49, 17], [43, 14], [37, 17], [32, 15], [27, 17], [21, 14], [15, 17], [13, 28]]);
      fill(x, lg(x, 0, 3, 0, 36, [[0, '#3a2a20'], [1, '#160e0a']])); ink(x, 0.8);
      x.strokeStyle = 'rgba(255,230,200,0.18)'; x.lineWidth = 0.4;
      for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(18 + i * 3.4, 8 + (i % 3)); x.quadraticCurveTo(22 + i * 3, 4, 30 + i * 2, 5); x.stroke(); }
      // forehead creases
      if (face !== 'high') { line(x, [[23, 21], [32, 19.5], [41, 21]], 0.5, 'rgba(80,30,15,0.6)'); line(x, [[25, 24.5], [32, 23.4], [39, 24.5]], 0.45, 'rgba(80,30,15,0.5)'); }
      // brows & eyes
      const L = 23, R = 41, EY = 37.5;
      const brow = (pts) => { line(x, pts, 3, '#1e140e'); };
      if (face === 'hit' || face === 'dazed') {
        brow([[15, 31], [21, 34], [28, 33]]); brow([[49, 31], [43, 34], [36, 33]]);
        if (face === 'hit') {
          line(x, [[17.5, 36], [23, 38.4], [28.5, 36.2]], 1.4, INK); line(x, [[17.5, 39.8], [23, 38.4]], 0.9, INK);
          line(x, [[46.5, 36], [41, 38.4], [35.5, 36.2]], 1.4, INK); line(x, [[46.5, 39.8], [41, 38.4]], 0.9, INK);
          [[31, 32], [33, 32]].forEach(([a]) => line(x, [[a, 30.5], [a, 33]], 0.5, 'rgba(70,25,10,0.7)'));
        } else {
          [L, R].forEach((ex) => { x.strokeStyle = INK; x.lineWidth = 0.7; x.beginPath(); for (let a = 0; a < 12; a += 0.4) { const rr = a * 0.33; x.lineTo(ex + Math.cos(a) * rr, EY + Math.sin(a) * rr * 0.8); } x.stroke(); });
        }
      } else if (face === 'snort') {
        brow([[16, 32.5], [23, 31.5], [29, 33]]); brow([[48, 32.5], [41, 31.5], [35, 33]]);
        line(x, [[18, 37.5], [23, 39.4], [28, 37.5]], 1.2, INK); line(x, [[36, 37.5], [41, 39.4], [46, 37.5]], 1.2, INK);
      } else if (face === 'high') {
        brow([[15, 27], [22, 25], [29, 28]]); brow([[49, 27], [42, 25], [35, 28]]);
        [L, R].forEach((ex) => {
          ell(x, ex, EY, 6, 4.6); fill(x, '#fbf6ea'); ink(x, 0.9);
          x.strokeStyle = 'rgba(200,40,40,0.5)'; x.lineWidth = 0.3; for (let v = 0; v < 4; v++) { x.beginPath(); x.moveTo(ex - 6 + v * 0.5, EY - 1 + v); x.lineTo(ex - 3, EY); x.stroke(); }
          ell(x, ex + (ex === L ? 0.8 : -0.8), EY, 2, 2); fill(x, '#5a3a20'); x.fillStyle = INK; ell(x, ex + (ex === L ? 0.8 : -0.8), EY, 1.5, 1.5); x.fill();
          x.fillStyle = '#fff'; x.fillRect(ex, EY - 1.2, 0.8, 0.8);
        });
      } else {
        const greedy = face === 'lean', sad = face === 'alone';
        if (sad) { brow([[16, 32], [22, 30.6], [28, 29.5]]); brow([[48, 32], [42, 30.6], [36, 29.5]]); }
        else if (greedy) { brow([[16, 30], [22, 29], [28.5, 31.5]]); brow([[48, 30], [42, 29], [35.5, 31.5]]); }
        else { brow([[15.5, 30.5], [22, 32], [28.5, 34.2]]); brow([[48.5, 30.5], [42, 32], [35.5, 34.2]]); }
        [L, R].forEach((ex) => {
          if (blink) { line(x, [[ex - 5, EY], [ex, EY + 1.2], [ex + 5, EY]], 1.1, INK); return; }
          smooth(x, [[ex - 5.2, EY], [ex, EY - 2.8], [ex + 5.2, EY], [ex, EY + 2.4]]); fill(x, '#f6eedc'); ink(x, 0.8);
          const py = greedy || sad ? EY + 1 : EY;
          ell(x, ex, py, 1.9, 1.9); fill(x, '#4a2e18'); x.fillStyle = INK; ell(x, ex, py, 1, 1); x.fill();
          x.fillStyle = '#fff'; x.fillRect(ex + 0.4, py - 1.1, 0.6, 0.6);
          line(x, [[ex - 5.6, EY - 0.4], [ex, EY - 3.6], [ex + 5.6, EY - 0.4]], 1.1, INK);
        });
      }
      // eye bags
      line(x, [[18, 42], [23, 43.4], [28, 42]], 0.45, 'rgba(80,30,15,0.6)');
      line(x, [[36, 42], [41, 43.4], [46, 42]], 0.45, 'rgba(80,30,15,0.6)');
      // mouth
      const my = 58;
      if (face === 'hit') {
        smooth(x, [[23, my - 2], [32, my - 3], [41, my - 2], [40, my + 3], [32, my + 4], [24, my + 3]]); fill(x, '#3a0808'); ink(x, 0.9);
        x.fillStyle = '#f2ead6'; x.fillRect(25, my - 1.6, 14, 3.4);
        x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 0.4; x.beginPath(); x.moveTo(25, my + 0.1); x.lineTo(39, my + 0.1);
        for (let i = 0; i < 6; i++) { x.moveTo(26.5 + i * 2.2, my - 1.6); x.lineTo(26.5 + i * 2.2, my + 1.8); }
        x.stroke();
      } else if (face === 'high') {
        smooth(x, [[20, my - 3], [32, my - 1], [44, my - 3], [40, my + 4], [32, my + 6], [24, my + 4]]); fill(x, '#3a0808'); ink(x, 1);
        x.fillStyle = '#f2ead6'; x.fillRect(23.5, my - 2, 17, 2.4);
      } else if (face === 'snort') {
        ell(x, 32, my + 0.5, 2.6, 2); fill(x, '#3a0808'); ink(x, 0.8);
      } else if (face === 'lean') {
        smooth(x, [[25, my - 1], [32, my - 1.6], [39, my - 1], [37, my + 2.6], [32, my + 3.2], [27, my + 2.6]]); fill(x, '#3a0808'); ink(x, 0.8);
        x.fillStyle = '#c04040'; ell(x, 32, my + 2, 3, 1); x.fill();
      } else if (face === 'alone') {
        line(x, [[25, my + 1.6], [32, my - 0.4], [39, my + 1.6]], 1.2, INK);
      } else {
        line(x, [[24.5, my], [32, my - 0.8], [39.5, my]], 1.2, INK);
        line(x, [[23.4, my + 1.8], [24.5, my]], 0.9, INK); line(x, [[40.6, my + 1.8], [39.5, my]], 0.9, INK);
        line(x, [[28, my + 3], [32, my + 3.6], [36, my + 3]], 0.5, 'rgba(80,30,15,0.6)');
      }
      line(x, [[26, 66.4], [32, 67.6], [38, 66.4]], 0.5, 'rgba(80,30,15,0.6)');
      // the big red nose
      const swell = 1 + noseQ * 0.08;
      const nc = ['#d8603a', '#e23a2a', '#ff1e1e'][noseQ];
      ell(x, 32, 47.5, 7 * swell, 6.4 * swell);
      fill(x, rg(x, 32, 47.5, 0.5, 7.5 * swell, [[0, '#ff9a80'], [0.35, nc], [1, '#6a0606']], 29.5, 45));
      ink(x, 1);
      x.fillStyle = 'rgba(255,255,255,0.8)'; ell(x, 29.4, 44.6, 1.8, 1.1, -0.5); x.fill();
      x.fillStyle = INK; ell(x, 29.2, 52.4, 1.3, 0.8); x.fill(); ell(x, 34.8, 52.4, 1.3, 0.8); x.fill();
      if (face === 'snort' || face === 'high') {
        x.fillStyle = '#f8f8f4';
        for (let i = 0; i < 26; i++) x.fillRect(27 + r() * 10, 50 + r() * 5, 0.6, 0.6);
        ell(x, 32, 53.6, 3.4, 0.9); x.fill();
      }
      if (face === 'hit') {
        [[4, 26], [60, 30], [2, 44], [61, 47]].forEach(([dx, dy]) => { smooth(x, [[dx, dy - 2.4], [dx + 1.3, dy + 0.8], [dx, dy + 1.8], [dx - 1.3, dy + 0.8]]); fill(x, '#bfe6ff'); ink(x, 0.4); });
      }
    });
  }
  function head(ctx, hx, hy, face, t, nose) {
    const noseQ = nose > 0.66 ? 2 : nose > 0.33 ? 1 : 0;
    const blink = (face === 'idle' || face === 'lean') && (t % 3.2) < 0.12 ? 1 : 0;
    const ov = art('man-' + face) || (face !== 'idle' && art('man-idle'));
    if (ov) ctx.drawImage(ov, hx - 32, hy, 64, 76);
    else put(ctx, headSprite(face, noseQ, blink), hx - 32, hy);
    if (face === 'dazed') {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        star(ctx, hx + Math.cos(a) * 20, hy + 6 + Math.sin(a) * 5, 1.2, 3.4, 5, a);
        fill(ctx, '#f5c518'); ink(ctx, 0.5);
      }
    }
  }

  // ---------- the player's hands ----------
  // k: 0..1 extension of the strike toward the target point (tx, ty).
  function fist(ctx, tx, ty, k, side) {
    const sx = 120 + side * 70, sy = 300;
    const ang = Math.atan2(ty - sy, tx - sx);
    const reach = Math.hypot(tx - sx, ty - sy) * (0.55 + 0.45 * k);
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(ang); ctx.translate(reach, 0); ctx.scale(1.35, 1.35);
    // forearm
    smooth(ctx, [[-110, -13], [-24, -10], [-14, -9], [-14, 9], [-24, 10], [-110, 13]]);
    fill(ctx, lg(ctx, 0, -12, 0, 12, [[0, '#e6b088'], [0.5, '#c88a60'], [1, '#7a4428']])); ink(ctx, 1.2);
    ctx.strokeStyle = 'rgba(50,25,10,0.5)'; ctx.lineWidth = 0.4;
    for (let i = 0; i < 18; i++) { const hx = -100 + i * 4.4, hy = -8 + ((i * 7) % 16); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 2, hy - 0.6); ctx.stroke(); }
    // tape wrap
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[-34 + i * 4.6, -10.6], [-30 + i * 4.6, -10.4], [-31 + i * 4.6, 10.4], [-35 + i * 4.6, 10.6]]);
      fill(ctx, i % 2 ? '#d8ccb0' : '#ece2c8'); ink(ctx, 0.5);
    }
    // fist
    rrect(ctx, -16, -12.5, 24, 25, 5);
    fill(ctx, lg(ctx, 0, -12, 0, 12, [[0, '#f0bc94'], [0.5, '#d29a70'], [1, '#8a4e30']])); ink(ctx, 1.2);
    for (let i = 0; i < 4; i++) {
      ell(ctx, 5, -9 + i * 6, 3.6, 3); fill(ctx, '#e8b088'); ink(ctx, 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, 6, -10 + i * 6, 1.2, 0.8); ctx.fill();
    }
    line(ctx, [[-6, -10], [-6, 10]], 0.6, 'rgba(70,30,10,0.6)');
    smooth(ctx, [[-12, 6], [-2, 3], [2, 8], [-8, 12]]); fill(ctx, '#d8a07a'); ink(ctx, 0.8);
    ctx.restore();
  }

  function palm(ctx, tx, ty, k, side) {
    const sx = 120 + side * 150, sy = ty - 6;
    const x = sx + (tx - sx) * (0.4 + 0.6 * k);
    ctx.save();
    ctx.translate(x, sy); ctx.scale(side < 0 ? -1.25 : 1.25, 1.25);
    smooth(ctx, [[18, -9], [120, -11], [120, 11], [18, 9]]); fill(ctx, '#1a1614'); ink(ctx, 1);
    smooth(ctx, [[-4, -9], [16, -10], [20, 0], [16, 10], [-4, 9], [-8, 0]]);
    fill(ctx, lg(ctx, 0, -10, 0, 10, [[0, '#f0bc94'], [1, '#a86a48']])); ink(ctx, 1);
    for (let i = 0; i < 4; i++) {
      const fy = -7 + i * 4.6;
      line(ctx, [[-2, fy], [-14 + Math.abs(i - 1.5) * 1.5, fy - 0.4]], 4, INK);
      line(ctx, [[-2, fy], [-14 + Math.abs(i - 1.5) * 1.5, fy - 0.4]], 3, '#e0a880');
    }
    line(ctx, [[8, -9], [2, -15]], 4.4, INK); line(ctx, [[8, -9], [2, -15]], 3.4, '#e0a880');
    ctx.restore();
  }

  function impact(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    star(ctx, 0, 0, 5, 13, 9, t * 3); fill(ctx, '#f5c518'); ink(ctx, 1.4, '#c41a14');
    star(ctx, 0, 0, 2.5, 7, 9, t * 3 + 0.3); fill(ctx, '#fffbe0');
    ctx.restore();
  }

  // ---------- icons ----------
  function icon(ctx, kind, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (kind === 'punch') {
      rrect(ctx, -8, -7, 16, 14, 3.5); fill(ctx, color); ink(ctx, 1.2);
      for (let i = 0; i < 4; i++) { line(ctx, [[-8 + i * 4 + 2, -7], [-8 + i * 4 + 2, -2]], 0.8, INK); }
      smooth(ctx, [[-9, 1], [0, 0], [3, 4], [-6, 6]]); fill(ctx, color); ink(ctx, 0.9);
    } else if (kind === 'slap') {
      smooth(ctx, [[-6, 8], [-7, -1], [-5, -4], [5, -4], [7, 0], [6, 8]]); fill(ctx, color); ink(ctx, 1.1);
      for (let i = 0; i < 4; i++) { const fx = -5 + i * 3.3; line(ctx, [[fx, -3], [fx, -10 + Math.abs(i - 1.5)]], 3.2, INK); line(ctx, [[fx, -3], [fx, -10 + Math.abs(i - 1.5)]], 2.1, color); }
      line(ctx, [[-6, 2], [-10, -2]], 3.2, INK); line(ctx, [[-6, 2], [-10, -2]], 2.1, color);
    } else {
      ctx.lineCap = 'round';
      [[-6, 1], [0, -4], [3, 4]].forEach(([ox, oy], i) => {
        ctx.beginPath(); ctx.moveTo(-10, oy); ctx.lineTo(4 + ox * 0.3, oy);
        ctx.arc(4 + ox * 0.3, oy - 3, 3, Math.PI / 2, -Math.PI / 2 - 0.6, true);
        ctx.lineWidth = 3.2; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
      });
    }
    ctx.restore();
  }

  // ---------- poster post-processing ----------
  let grainPat = null, grainK = 0;
  function grain(ctx) {
    if (!grainPat || grainK !== k) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const x = c.getContext('2d'), d = x.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255;
        d.data[i] = v; d.data[i + 1] = v * 0.92; d.data[i + 2] = v * 0.8; d.data[i + 3] = Math.random() < 0.004 ? 255 : 70;
      }
      x.putImageData(d, 0, 0);
      grainPat = ctx.createPattern(c, 'repeat'); grainK = k;
    }
    return grainPat;
  }

  function frameSprite() {
    return sprite('frame', W, H, (x) => {
      const r = rng(77);
      x.fillStyle = '#d9c597';
      x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'destination-out';
      rrect(x, 3, 3, W - 6, H - 6, 6); x.fill();
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = 'rgba(90,60,30,0.6)'; x.lineWidth = 0.6;
      rrect(x, 3, 3, W - 6, H - 6, 6); x.stroke();
      for (let i = 0; i < 70; i++) {
        const side = Math.floor(r() * 4), p = r();
        const cx = side === 0 ? p * W : side === 1 ? W - r() * 3 : side === 2 ? p * W : r() * 3;
        const cy = side === 0 ? r() * 3 : side === 1 ? p * H : side === 2 ? H - r() * 3 : p * H;
        x.fillStyle = r() > 0.5 ? 'rgba(60,35,15,0.5)' : 'rgba(255,245,220,0.5)';
        ell(x, cx, cy, 0.5 + r() * 1.6, 0.4 + r() * 1.2); x.fill();
      }
      x.globalCompositeOperation = 'destination-out';
      [[0, 0], [W, 0], [0, H], [W, H]].forEach(([cx, cy]) => { ell(x, cx, cy, 3.4, 3.4); x.fill(); });
    });
  }

  function post(ctx, t) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.save();
    // warm aged-print cast
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255,232,196,0.12)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rg(ctx, W / 2, H / 2, H * 0.3, H * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.12;
    const ox = Math.floor(t * 24) % 3 * 37, oy = Math.floor(t * 24) % 2 * 53;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = grain(ctx);
    ctx.fillRect(0, 0, cw + ox, ch + oy);
    ctx.restore();
    put(ctx, grungeSprite(), 0, 0);
    put(ctx, frameSprite(), 0, 0);
  }

  function grungeSprite() {
    return sprite('grunge', W, H, (x) => {
      const r = rng(303);
      for (let i = 0; i < 40; i++) {
        x.fillStyle = `rgba(${40 + r() * 30},${20 + r() * 15},8,${0.04 + r() * 0.06})`;
        ell(x, r() * W, r() * H, 6 + r() * 30, 4 + r() * 22, r() * 3); x.fill();
      }
      x.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const x0 = r() * W, y0 = r() * H, len = 4 + r() * 26, a = (r() - 0.5) * 0.6 + (r() > 0.5 ? Math.PI / 2 : 0);
        x.strokeStyle = r() > 0.4 ? `rgba(240,225,190,${0.06 + r() * 0.1})` : `rgba(0,0,0,${0.1 + r() * 0.15})`;
        x.lineWidth = 0.2 + r() * 0.35;
        x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); x.stroke();
      }
      for (let i = 0; i < 160; i++) { x.fillStyle = r() > 0.5 ? 'rgba(240,225,190,0.18)' : 'rgba(0,0,0,0.25)'; x.fillRect(r() * W, r() * H, 0.4 + r() * 0.6, 0.4 + r() * 0.6); }
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.Paint = {
    W, H, INK, setScale, clear, smooth, poly, ell, fill, ink, line, lg, rg, rrect, star,
    background, devil, figure, belt, baby, moneyBrick, meatBlock, exitDoor, person,
    table, cokeLine, body, head, fist, palm, impact, icon, post,
  };
})();
