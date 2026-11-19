// Neon Coast Cover Studio — screenshot / demo mode.
// Handles ?shot=cover&size=WxH: hides the editor chrome and draws the
// cover full-viewport using the app's real render path (renderCover from
// cover.js), so a screenshot of this page IS the exported cover. Also
// used by ?demo=1 pages through main.js; this module only acts in shot
// mode and otherwise leaves the editor alone.

import { defaultState, renderCover } from './cover.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function runShotMode() {
  const params = new URLSearchParams(location.search);
  if (params.get('shot') !== 'cover') return;

  const size = params.get('size') || '1920x1080';
  const [W, H] = size.split('x').map((n) => parseInt(n, 10) || 0);
  if (!W || !H || W > 3840 || H > 3840) return;

  document.documentElement.classList.add('shot-mode');
  document.body.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'shot-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Exported cover ${W} by ${H}`);
  canvas.width = W;
  canvas.height = H;
  document.body.appendChild(canvas);

  // Wait for the bundled fonts so lettering renders in Anton/Pacifico.
  try { await document.fonts.ready; } catch (e) { /* fall back to system fonts */ }

  const state = defaultState();
  // Pick the layout that fits the aspect: wide covers get Hero+Trio,
  // square and portrait covers get the Four Grid.
  state.layout = W >= H ? 'heroTrio' : 'fourGrid';
  state.title = params.get('title') || 'NEON SHORE';
  state.subtitle = params.get('subtitle') || 'palms, chrome & midnight drives';
  state.grade = params.get('grade') || 'sunset';

  const images = [];
  try {
    images[0] = await loadImage('samples/boulevard.jpg');
    images[1] = await loadImage('samples/pier.jpg');
  } catch (e) {
    // Render anyway with placeholder panels.
  }

  const ctx = canvas.getContext('2d');
  renderCover(ctx, state, W, H, images);
  window.__shotReady = true;
  document.title = `Neon Coast Cover ${W}x${H} — ${state.title}`;
}

runShotMode();
