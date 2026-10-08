// STATS window: pixel world map, top countries, players, play time, downloads.
// Shows clearly labelled DEMO STATS until a real endpoint is configured in
// window.HTN_CONFIG.statsEndpoint (see README for the JSON format).
(function () {
  const { R, C } = Art;

  const DEMO = {
    demo: true,
    playingNow: 2481,
    players: 84206,
    avgPlayTimeSec: 402,
    downloads: 128540,
    topCountries: [
      { name: 'USA', players: 582, lon: -98, lat: 39 },
      { name: 'GERMANY', players: 421, lon: 10, lat: 51 },
      { name: 'UK', players: 317, lon: -2, lat: 53 },
      { name: 'BRAZIL', players: 244, lon: -48, lat: -14 },
      { name: 'JAPAN', players: 190, lon: 138, lat: 36 },
    ],
    hotspots: [
      [-100, 55, 60], [-102, 23, 70], [2, 46, 110], [-4, 40, 80], [12, 43, 90], [19, 52, 60], [35, 39, 50],
      [-64, -34, 60], [-74, 4, 30], [78, 22, 50], [127, 37, 80], [116, 35, 50], [145, -33, 70], [174, -40, 20],
      [25, -29, 30], [8, 9, 20], [30, 27, 20], [110, -7, 40], [121, 14, 40], [100, 14, 30], [55, 25, 20],
      [-58, -20, 40], [-77, -12, 20], [37, 55, 40], [-6, 53, 30], [5, 52, 50], [18, 60, 30],
    ],
    downloadsByRegion: [
      { label: 'USA', value: 52300, color: '#e8242a' },
      { label: 'EUROPE', value: 33400, color: '#ffd21f' },
      { label: 'ASIA', value: 21900, color: '#2ec5e8' },
      { label: 'S. AMERICA', value: 12800, color: '#f3e3c0' },
      { label: 'OTHER', value: 8140, color: '#5a6a7a' },
    ],
  };

  // Rough continent outlines (lon, lat), rasterised into a dot grid once.
  const LAND = [
    [[-168, 66], [-162, 70], [-140, 70], [-125, 72], [-95, 72], [-80, 73], [-62, 66], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-82, 29], [-90, 30], [-97, 26], [-97, 21], [-87, 21], [-87, 15], [-83, 9], [-78, 8], [-80, 7], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-112, 31], [-117, 32], [-124, 40], [-125, 48], [-132, 55], [-140, 59], [-152, 58], [-165, 54], [-158, 60], [-166, 62]],
    [[-55, 60], [-44, 60], [-20, 70], [-18, 80], [-40, 83], [-65, 80], [-55, 72]],
    [[-80, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-38, -14], [-41, -22], [-48, -26], [-58, -36], [-63, -41], [-66, -47], [-69, -52], [-72, -54], [-75, -48], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-77, 4]],
    [[-10, 36], [-9, 43], [-2, 44], [-4, 48], [2, 51], [5, 53], [8, 55], [10, 57], [5, 59], [6, 62], [14, 67], [20, 70], [28, 71], [40, 68], [44, 66], [40, 62], [30, 60], [24, 60], [22, 64], [18, 60], [21, 56], [14, 54], [19, 54], [28, 46], [30, 45], [28, 41], [23, 40], [22, 37], [19, 40], [16, 38], [18, 40], [13, 44], [10, 44], [8, 44], [3, 43], [3, 41], [0, 39], [-2, 37], [-6, 36]],
    [[-5, 50], [1, 51], [2, 53], [-1, 55], [-2, 58], [-5, 58], [-5, 55], [-3, 54], [-5, 53]],
    [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
    [[-24, 64], [-14, 64], [-14, 66], [-22, 66]],
    [[-17, 21], [-10, 30], [-6, 35], [10, 37], [11, 33], [20, 31], [32, 31], [34, 28], [43, 12], [51, 12], [43, 0], [40, -10], [40, -16], [35, -24], [32, -29], [27, -34], [20, -35], [18, -30], [12, -17], [13, -6], [9, -1], [9, 4], [4, 6], [-8, 4], [-13, 8], [-17, 14]],
    [[44, -13], [50, -16], [47, -25], [43, -23]],
    [[26, 40], [36, 36], [35, 32], [34, 28], [43, 13], [53, 16], [58, 22], [56, 26], [51, 25], [48, 30], [56, 27], [62, 25], [67, 24], [72, 21], [77, 8], [80, 15], [87, 22], [92, 22], [94, 16], [98, 16], [100, 13], [100, 6], [104, 1], [103, 10], [106, 10], [109, 13], [107, 20], [110, 21], [117, 24], [121, 30], [121, 36], [118, 39], [122, 40], [125, 38], [129, 35], [129, 42], [135, 44], [140, 48], [141, 53], [135, 55], [140, 59], [150, 59], [160, 61], [163, 58], [156, 51], [162, 57], [170, 60], [178, 64], [190, 66], [180, 69], [160, 70], [140, 72], [113, 74], [105, 78], [95, 76], [80, 73], [70, 73], [68, 69], [60, 69], [54, 68], [44, 68], [40, 64], [30, 60], [28, 50], [30, 45]],
    [[130, 31], [132, 34], [136, 34], [140, 35], [142, 40], [140, 42], [141, 45], [145, 44], [142, 41], [141, 37], [140, 35], [135, 33]],
    [[95, 5], [98, 4], [106, -6], [102, -4]], [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
    [[106, -6], [114, -8], [106, -8]], [[131, -1], [141, -3], [150, -10], [141, -9], [138, -7]],
    [[120, 18], [122, 18], [126, 7], [122, 7], [120, 14]],
    [[114, -22], [122, -18], [129, -15], [131, -12], [137, -12], [136, -15], [140, -17], [142, -11], [146, -19], [153, -25], [153, -32], [150, -37], [146, -39], [141, -38], [138, -35], [135, -35], [131, -31], [124, -34], [115, -34], [113, -26]],
    [[172, -34], [178, -38], [175, -41], [171, -46], [167, -46], [172, -41]],
  ];

  const MAP = { x: 10, y: 60, cols: 73, rows: 33, pitch: 3, lon0: -170, lon1: 190, lat0: 82, lat1: -56 };
  let grid = null;

  function inside(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function buildGrid() {
    grid = [];
    for (let r = 0; r < MAP.rows; r++) {
      const lat = MAP.lat0 + ((MAP.lat1 - MAP.lat0) * (r + 0.5)) / MAP.rows;
      for (let c = 0; c < MAP.cols; c++) {
        const lon = MAP.lon0 + ((MAP.lon1 - MAP.lon0) * (c + 0.5)) / MAP.cols;
        if (LAND.some((p) => inside(p, lon, lat))) grid.push([c, r]);
      }
    }
  }

  function toXY(lon, lat) {
    return [
      MAP.x + ((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0)) * MAP.cols * MAP.pitch,
      MAP.y + ((lat - MAP.lat0) / (MAP.lat1 - MAP.lat0)) * MAP.rows * MAP.pitch,
    ];
  }

  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.round(s % 60)).padStart(2, '0');

  function panel(ctx, x, y, w, h) {
    R(ctx, x, y, w, h, '#0e1a22');
    ctx.strokeStyle = '#2ec5e8'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    R(ctx, x + 2, y + 2, w - 4, 1, '#14303c');
  }

  const Stats = {
    data: DEMO,
    loading: false,

    async load() {
      const url = window.HTN_CONFIG && window.HTN_CONFIG.statsEndpoint;
      if (!url || this.loading) return;
      this.loading = true;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        const d = await res.json();
        this.data = Object.assign({}, DEMO, d, { demo: false });
      } catch (e) {
        this.data = DEMO; // stay on clearly labelled sample figures
      } finally { this.loading = false; }
    },

    // Returns the rectangle of the BACK button so the game can hit-test it.
    draw(ctx, t) {
      if (!grid) buildGrid();
      const d = this.data;
      R(ctx, 0, 0, Art.W, Art.H, '#080404');
      ctx.drawImage(Art.backdrop(), 0, 26, 240, 26, 0, 0, 240, 26);
      Font.title(ctx, 'HIT THE NOSE', 120, 6, { size: 2, depth: 2 });
      R(ctx, 70, 30, 100, 20, C.black);
      ctx.strokeStyle = '#2ec5e8'; ctx.strokeRect(70.5, 30.5, 99, 19);
      Font.text(ctx, 'STATS', 120, 34, { size: 2, color: C.yellow, align: 'center', shadow: '#a01010' });
      R(ctx, 30, 38, 34, 2, C.red); R(ctx, 30, 42, 34, 2, C.red);
      R(ctx, 176, 38, 34, 2, C.red); R(ctx, 176, 42, 34, 2, C.red);

      // world map
      panel(ctx, 4, 54, 232, 128);
      for (const [c, r] of grid) R(ctx, MAP.x + c * MAP.pitch, MAP.y + r * MAP.pitch, 2, 2, (c + r) % 5 ? '#1f6f86' : '#2a8aa4');
      const spots = d.topCountries.map((c) => [c.lon, c.lat, c.players]).concat(d.hotspots || []);
      let seed = 3;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (const [lon, lat, n] of spots) {
        const [sx, sy] = toXY(lon, lat);
        const dots = Math.max(2, Math.round(Math.sqrt(n) * 1.1)), rad = 2 + Math.sqrt(n) * 0.45;
        for (let i = 0; i < dots; i++) {
          const a = rnd() * 6.283, rr = rnd() * rad;
          const on = Math.sin(t * 3 + i * 1.7 + lon) > -0.6;
          if (!on) continue;
          const hot = rr < rad * 0.4;
          R(ctx, sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.7, 2, 2, hot ? '#ff3a1a' : i % 3 ? '#ffd21f' : '#ff8a1a');
        }
      }
      Font.text(ctx, 'PLAYING NOW', 10, 166, { color: C.cyan });
      Font.text(ctx, fmt(d.playingNow), 80, 163, { size: 2, color: C.yellow });
      R(ctx, 10, 176, 120, 1, C.cyan);
      if (d.demo) {
        Font.text(ctx, 'DEMO STATS', 230, 166, { color: C.cyan, align: 'right' });
        R(ctx, 170, 176, 60, 1, C.cyan);
      } else {
        const blink = Math.floor(t * 2) % 2;
        if (blink) R(ctx, 196, 167, 4, 4, '#ff2020');
        Font.text(ctx, 'LIVE', 230, 166, { color: '#ff4040', align: 'right' });
      }

      // top countries
      panel(ctx, 4, 186, 232, 98);
      for (let i = 0; i < 16; i++) R(ctx, 5, 187 + i, 230, 1, i < 8 ? '#a01010' : '#7a0a0a');
      Font.text(ctx, 'TOP COUNTRIES', 120, 188, { size: 2, color: C.yellow, align: 'center', shadow: '#000' });
      d.topCountries.slice(0, 5).forEach((c, i) => {
        const y = 205 + i * 15;
        R(ctx, 14, y - 2, 13, 12, '#e01818');
        Font.text(ctx, i + 1, 20, y, { color: C.cream, align: 'center' });
        Font.text(ctx, c.name.toUpperCase().slice(0, 14), 40, y, { color: C.yellow });
        Font.text(ctx, fmt(c.players), 224, y, { color: C.yellow, align: 'right' });
        if (i < 4) for (let x = 12; x < 228; x += 3) R(ctx, x, y + 11, 1, 1, '#1f6f86');
      });

      // players + avg play time
      panel(ctx, 4, 288, 114, 52);
      Font.text(ctx, 'PLAYERS', 61, 292, { color: C.cyan, align: 'center' });
      for (let i = 0; i < 3; i++) {
        const px = 9 + i * 8, py = i === 1 ? 307 : 310;
        R(ctx, px + 2, py, 4, 4, C.cyan); R(ctx, px, py + 5, 8, 6, C.cyan);
      }
      Font.text(ctx, fmt(d.players), 79, 314, { size: 2, color: C.yellow, align: 'center' });
      panel(ctx, 122, 288, 114, 52);
      Font.text(ctx, 'AVG. PLAY TIME', 179, 292, { color: C.cyan, align: 'center' });
      ctx.strokeStyle = C.cyan; ctx.beginPath(); ctx.arc(140, 318, 9, 0, 6.283); ctx.stroke();
      R(ctx, 139, 311, 2, 8, C.cyan); R(ctx, 139, 317, 6, 2, C.cyan);
      Font.text(ctx, fmtTime(d.avgPlayTimeSec), 194, 314, { size: 2, color: C.yellow, align: 'center' });

      // downloads pie
      panel(ctx, 4, 344, 232, 78);
      Font.text(ctx, 'DOWNLOADS', 166, 348, { color: C.cyan, align: 'center' });
      const segs = d.downloadsByRegion, total = segs.reduce((s, x) => s + x.value, 0) || 1;
      const cx = 48, cy = 383, ro = 35, ri = 23;
      const bounds = []; let acc = 0;
      for (const s of segs) { acc += s.value / total; bounds.push([acc, s.color]); }
      for (let y = -ro; y <= ro; y += 2) for (let x = -ro; x <= ro; x += 2) {
        const dd = Math.hypot(x + 1, y + 1);
        if (dd > ro || dd < ri) continue;
        let a = (Math.atan2(x + 1, -(y + 1)) / 6.283 + 1) % 1;
        const col = (bounds.find((b) => a <= b[0]) || bounds[bounds.length - 1])[1];
        R(ctx, cx + x, cy + y, 2, 2, col);
      }
      Font.text(ctx, 'TOTAL', cx + 1, cy - 9, { color: C.cream, align: 'center' });
      Font.text(ctx, fmt(d.downloads), cx + 1, cy + 1, { color: C.yellow, align: 'center' });
      segs.forEach((s, i) => {
        const y = 362 + i * 11;
        R(ctx, 112, y, 7, 7, s.color);
        Font.text(ctx, s.label.toUpperCase(), 124, y, { color: C.cream });
      });

      // back button
      R(ctx, 2, 2, 22, 18, C.black);
      ctx.strokeStyle = C.yellow; ctx.strokeRect(2.5, 2.5, 21, 17);
      Font.text(ctx, '<', 13, 8, { color: C.yellow, align: 'center' });
      return { back: [0, 0, 30, 24] };
    },
  };

  window.Stats = Stats;
})();
