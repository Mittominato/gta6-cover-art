// Neon Coast Cover Studio — cover rendering engine.
// Draws multi-panel cover art onto any canvas: panel layouts, photo
// pan/zoom crops, gradient-map grades, bold outlined lettering, grain
// and vignette. Pure canvas 2D, no dependencies, no network.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    stops: ['#ff9a3c', '#ff5e62', '#c6427a', '#2b1055'],
    tint: 'rgba(255, 94, 98, 0.16)',
    title: '#ffffff',
    sub: '#ffd166',
  },
  neon: {
    label: 'Neon Nights',
    stops: ['#ff2ea6', '#7b2ff7', '#00e5ff', '#0b1035'],
    tint: 'rgba(0, 229, 255, 0.14)',
    title: '#ffffff',
    sub: '#ff5ce1',
  },
  teal: {
    label: 'Teal Dawn',
    stops: ['#7ef0d4', '#2bb3a3', '#1b6ca8', '#0a2540'],
    tint: 'rgba(46, 196, 182, 0.14)',
    title: '#ffffff',
    sub: '#a7f3d0',
  },
};

export const LAYOUTS = {
  heroTrio: { label: 'Hero + Trio', panels: 4 },
  fourGrid: { label: 'Four Grid', panels: 4 },
  fullBleed: { label: 'Full Bleed', panels: 1 },
};

// Panel rectangles as fractions of the cover, per layout.
export function layoutRects(layout, W, H) {
  const g = 0.012 * Math.min(W, H); // gutter in px
  const x0 = g, y0 = g, x1 = W - g, y1 = H - g;
  const w = x1 - x0, h = y1 - y0;
  if (layout === 'fourGrid') {
    const hw = w / 2 - g / 2, hh = h / 2 - g / 2;
    return [
      { x: x0, y: y0, w: hw, h: hh },
      { x: x0 + hw + g, y: y0, w: hw, h: hh },
      { x: x0, y: y0 + hh + g, w: hw, h: hh },
      { x: x0 + hw + g, y: y0 + hh + g, w: hw, h: hh },
    ];
  }
  if (layout === 'fullBleed') {
    return [{ x: 0, y: 0, w: W, h: H }];
  }
  // heroTrio: big hero on the left, three stacked small panels right.
  const heroW = w * 0.62 - g / 2;
  const sideX = x0 + heroW + g;
  const sideW = w - heroW - g;
  const sh = h / 3 - (2 * g) / 3;
  return [
    { x: x0, y: y0, w: heroW, h },
    { x: sideX, y: y0, w: sideW, h: sh },
    { x: sideX, y: y0 + sh + g, w: sideW, h: sh },
    { x: sideX, y: y0 + 2 * (sh + g), w: sideW, h: sh },
  ];
}

// Default editor state. Photos are HTMLImageElements held outside the
// serialised state; state.photos maps panel index -> photo slot index.
export function defaultState() {
  return {
    layout: 'heroTrio',
    grade: 'sunset',
    title: 'NEON SHORE',
    subtitle: 'palms, chrome & midnight drives',
    grain: true,
    vignette: true,
    titleSize: 1.0,
    photos: { 0: 0, 1: 1, 2: 0, 3: 1 },
    // per-panel crop: zoom >= 1, pan offsets as fractions of panel size
    crops: {
      0: { zoom: 1.15, px: 0, py: 0 },
      1: { zoom: 1.2, px: 0, py: 0 },
      2: { zoom: 1.2, px: 0, py: 0 },
      3: { zoom: 1.2, px: 0, py: 0 },
    },
    selected: 0,
  };
}

// Draw one photo into a panel rect with cover-fit, zoom and pan.
export function drawPhoto(ctx, img, rect, crop) {
  if (!img || !img.naturalWidth) {
    // Empty panel: warm dark placeholder with a diagonal sheen.
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, '#3a2b4f');
    grad.addColorStop(1, '#14101f');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h * 0.35);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const zoom = crop?.zoom ?? 1;
  const px = crop?.px ?? 0;
  const py = crop?.py ?? 0;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) / 2 + px * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + py * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// Paint the grade: a soft diagonal gradient wash plus a colour tint,
// blended so photos keep their detail but share one poster palette.
export function applyGrade(ctx, W, H, gradeKey) {
  const g = GRADES[gradeKey] || GRADES.sunset;
  const grad = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.stops.forEach((c, i) => grad.addColorStop(i / (g.stops.length - 1), c));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = g.tint;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Deterministic pseudo-random grain (seeded, so exports are stable).
export function applyGrain(ctx, W, H) {
  let seed = 1337;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const step = Math.max(2, Math.round(Math.min(W, H) / 420));
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const v = next();
      ctx.fillStyle = v > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}

export function applyVignette(ctx, W, H) {
  const r = Math.hypot(W, H) / 2;
  const grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Bold outlined title + script subtitle, anchored bottom-left with a
// dark scrim band so lettering stays readable over any photo.
export function drawLettering(ctx, W, H, state) {
  const g = GRADES[state.grade] || GRADES.sunset;
  const pad = Math.round(W * 0.045);
  const titleSize = Math.round(Math.min(W, H) * 0.105 * (state.titleSize || 1));
  const subSize = Math.round(titleSize * 0.42);
  const bandH = titleSize + subSize + pad * 1.6;
  const bandY = H - bandH;

  const scrim = ctx.createLinearGradient(0, bandY - pad, 0, H);
  scrim.addColorStop(0, 'rgba(8,6,18,0)');
  scrim.addColorStop(0.35, 'rgba(8,6,18,0.72)');
  scrim.addColorStop(1, 'rgba(8,6,18,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - pad, W, H - bandY + pad);

  // Thin neon rule above the title.
  const rule = ctx.createLinearGradient(pad, 0, pad + W * 0.42, 0);
  rule.addColorStop(0, g.stops[0]);
  rule.addColorStop(1, g.stops[2]);
  ctx.fillStyle = rule;
  ctx.fillRect(pad, bandY + pad * 0.35, W * 0.42, Math.max(3, titleSize * 0.045));

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const titleY = bandY + pad * 0.35 + titleSize * 1.05;
  const title = (state.title || 'NEON SHORE').toUpperCase();
  // Shrink a long title until it fits the cover width.
  let fitSize = titleSize;
  ctx.font = `${fitSize}px Anton, 'Arial Black', sans-serif`;
  while (fitSize > titleSize * 0.5 && ctx.measureText(title).width > W - pad * 2) {
    fitSize = Math.round(fitSize * 0.92);
    ctx.font = `${fitSize}px Anton, 'Arial Black', sans-serif`;
  }
  ctx.font = `${fitSize}px Anton, 'Arial Black', sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,6,20,0.9)';
  ctx.lineWidth = Math.max(4, fitSize * 0.09);
  ctx.strokeText(title, pad, titleY);
  const tGrad = ctx.createLinearGradient(0, titleY - fitSize, 0, titleY);
  tGrad.addColorStop(0, '#ffffff');
  tGrad.addColorStop(0.75, g.title);
  tGrad.addColorStop(1, g.stops[0]);
  ctx.fillStyle = tGrad;
  ctx.fillText(title, pad, titleY);

  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.fillStyle = g.sub;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = Math.max(4, subSize * 0.18);
  ctx.fillText(state.subtitle || '', pad + 2, titleY + subSize * 1.25);
  ctx.shadowBlur = 0;
}

// Full render: photos, grade, grain, vignette, lettering. `images` is an
// array of HTMLImageElements indexed by photo slot.
export function renderCover(ctx, state, W, H, images) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0a18';
  ctx.fillRect(0, 0, W, H);
  const rects = layoutRects(state.layout, W, H);
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const slot = state.photos?.[i];
    const img = slot != null ? images[slot] : null;
    drawPhoto(ctx, img, rects[i], state.crops?.[i]);
    // Thin panel divider line for the poster-grid look.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
    ctx.strokeRect(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
    ctx.restore();
  }
  applyGrade(ctx, W, H, state.grade);
  if (state.vignette) applyVignette(ctx, W, H);
  if (state.grain) applyGrain(ctx, W, H);
  drawLettering(ctx, W, H, state);
  return rects;
}

// Export helper: render at full size to an offscreen canvas and return it.
export function renderExport(state, W, H, images) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, state, W, H, images);
  return canvas;
}
