// Poster typography: Anton (condensed body text) and Bungee (3D block titles).
// Sizes are in "cap units": size 1 = 7 logical px tall capitals.
(function () {
  const FAM = {
    body: '"Anton", "Impact", "Arial Narrow", sans-serif',
    title: '"Bungee", "Anton", "Impact", sans-serif',
  };
  const CAP = { body: 0.735, title: 0.72 };

  function setFont(ctx, size, kind) {
    const px = (7 * size) / CAP[kind];
    ctx.font = `${px.toFixed(2)}px ${FAM[kind]}`;
    return px;
  }

  function fit(ctx, str, size, kind, maxW) {
    setFont(ctx, size, kind);
    let w = ctx.measureText(str).width;
    if (maxW && w > maxW) { size *= maxW / w; setFont(ctx, size, kind); w = maxW; }
    return { size, w };
  }

  function measure(ctx, str, size = 1, kind = 'body') { return fit(ctx, String(str), size, kind).w; }

  // text(ctx, str, x, y(top of capitals), {size, color, align, shadow, outline, font, maxW})
  function text(ctx, str, x, y, o = {}) {
    str = String(str);
    const kind = o.font || 'body', base = o.size || 1;
    const { size } = fit(ctx, str, base, kind, o.maxW);
    const by = y + 7 * base - (7 * base - 7 * size) / 2;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(str, x + Math.max(0.6, size * 0.45), by + Math.max(0.6, size * 0.45)); }
    if (o.outline) {
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = o.outlineW || Math.max(1.2, size * 0.7);
      ctx.strokeStyle = o.outline;
      ctx.strokeText(str, x, by);
    }
    ctx.fillStyle = o.color || '#efdcb0';
    ctx.fillText(str, x, by);
  }

  // Poster headline: yellow face, deep red extrusion, black ink outline.
  function title(ctx, str, x, y, o = {}) {
    str = String(str);
    const kind = o.font || 'title', base = o.size || 3;
    const { size } = fit(ctx, str, base, kind, o.maxW);
    const by = y + 7 * base - (7 * base - 7 * size) / 2;
    const depth = (o.depth == null ? size * 0.9 : o.depth);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    // outline behind the extrusion
    ctx.lineWidth = Math.max(1.6, size * 0.9);
    ctx.strokeStyle = o.outline || '#0d0604';
    ctx.strokeText(str, x + depth * 0.25, by + depth);
    ctx.strokeText(str, x, by);
    // extrusion
    const steps = Math.max(2, Math.ceil(depth * 2));
    for (let i = steps; i >= 1; i--) {
      const d = (depth * i) / steps;
      ctx.fillStyle = i === steps ? (o.sideDark || '#4a0606') : (o.side || '#c41a14');
      ctx.fillText(str, x + d * 0.25, by + d);
    }
    // face
    const top = by - 7 * size;
    if (o.color) ctx.fillStyle = o.color;
    else {
      const g = ctx.createLinearGradient(0, top, 0, by);
      g.addColorStop(0, '#ffe14a'); g.addColorStop(0.55, '#f5c518'); g.addColorStop(1, '#e09a10');
      ctx.fillStyle = g;
    }
    ctx.fillText(str, x, by);
    if (o.highlight) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(0.4, size * 0.18);
      ctx.strokeStyle = '#fff6c8';
      ctx.strokeText(str, x - size * 0.12, by - size * 0.12);
      ctx.restore();
    }
  }

  window.Font = { text, title, measure };
})();
