// Neon Coast Cover Studio — editor wiring.
// Connects the controls in index.html to the cover engine in cover.js:
// photo loading (file input, drag-and-drop, samples), tray assignment,
// panel selection + drag-to-pan + zoom, layouts, grades, caption edits
// and PNG export at 1080x1080 / 1080x1350 / 1920x1080.

import { GRADES, LAYOUTS, defaultState, renderCover, renderExport } from './cover.js';

const $ = (id) => document.getElementById(id);
const state = defaultState();
// Loaded photos: { name, img } in tray order.
const photos = [];
let drag = null; // active pan drag { x, y, crop }

const preview = $('preview');
const pctx = preview.getContext('2d');
const statusEl = $('status');

function setStatus(msg) {
  statusEl.textContent = msg;
}

function fitPreview() {
  // Keep the preview canvas at a fixed internal resolution; CSS scales it.
  preview.width = 960;
  preview.height = state.layout === 'fullBleed' ? 540 : 600;
  draw();
}

function draw() {
  const images = photos.map((p) => p.img);
  renderCover(pctx, state, preview.width, preview.height, images);
  highlightSelected();
}

function highlightSelected() {
  document.querySelectorAll('.panel-btn').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === state.selected);
  });
  const crop = state.crops[state.selected] || { zoom: 1 };
  $('zoom').value = String(Math.round((crop.zoom - 1) * 100));
  $('zoomVal').textContent = `${crop.zoom.toFixed(2)}x`;
}

// ---- Photo loading -------------------------------------------------

function addPhotoFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      photos.push({ name: file.name || 'photo', img });
      renderTray();
      setStatus(`Loaded ${file.name || 'photo'} — ${photos.length} photo(s) in the tray.`);
      resolve(true);
    };
    img.onerror = () => {
      setStatus(`Could not read ${file.name || 'that file'} — try a JPG or PNG.`);
      resolve(false);
    };
    img.src = url;
  });
}

async function loadSample(path, name) {
  const res = await fetch(path);
  const blob = await res.blob();
  await addPhotoFile(new File([blob], name, { type: blob.type || 'image/jpeg' }));
}

function renderTray() {
  const tray = $('tray');
  if (!tray) return; // shot mode replaced the editor DOM
  tray.innerHTML = '';
  photos.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'tray-item';
    btn.type = 'button';
    btn.title = `Photo ${i + 1}: ${p.name} — click to assign to the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = p.img.src;
    thumb.alt = p.name;
    btn.appendChild(thumb);
    const tag = document.createElement('span');
    tag.textContent = `#${i + 1}`;
    btn.appendChild(tag);
    btn.addEventListener('click', () => {
      state.photos[state.selected] = i;
      setStatus(`Photo #${i + 1} assigned to panel ${state.selected + 1}.`);
      draw();
    });
    tray.appendChild(btn);
  });
  if (!photos.length) {
    tray.innerHTML = '<p class="hint">No photos yet — add your own or try a sample below.</p>';
  }
  draw();
}

// ---- Layout / grade / caption controls ------------------------------

function buildControls() {
  const layoutBox = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = def.label;
    b.dataset.layout = key;
    b.addEventListener('click', () => {
      state.layout = key;
      document.querySelectorAll('#layouts .chip').forEach((c) => c.classList.toggle('active', c === b));
      fitPreview();
      setStatus(`Layout: ${def.label}.`);
    });
    if (key === state.layout) b.classList.add('active');
    layoutBox.appendChild(b);
  });

  const gradeBox = $('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip grade-chip';
    b.dataset.grade = key;
    b.style.setProperty('--g1', def.stops[0]);
    b.style.setProperty('--g2', def.stops[2]);
    b.textContent = def.label;
    b.addEventListener('click', () => {
      state.grade = key;
      document.querySelectorAll('#grades .chip').forEach((c) => c.classList.toggle('active', c === b));
      draw();
      setStatus(`Grade: ${def.label}.`);
    });
    if (key === state.grade) b.classList.add('active');
    gradeBox.appendChild(b);
  });

  // Panel selector buttons.
  const panelBox = $('panels');
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip panel-btn';
    b.dataset.panel = String(i);
    b.textContent = `Panel ${i + 1}`;
    b.addEventListener('click', () => {
      state.selected = i;
      highlightSelected();
      setStatus(`Panel ${i + 1} selected — drag on the preview to pan, use the zoom slider.`);
    });
    panelBox.appendChild(b);
  }
}

function bindInputs() {
  $('title').addEventListener('input', (e) => { state.title = e.target.value; draw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; draw(); });
  $('titleSize').addEventListener('input', (e) => {
    state.titleSize = Number(e.target.value) / 100;
    draw();
  });
  $('grain').addEventListener('change', (e) => { state.grain = e.target.checked; draw(); });
  $('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; draw(); });
  $('zoom').addEventListener('input', (e) => {
    const crop = state.crops[state.selected];
    crop.zoom = 1 + Number(e.target.value) / 100;
    $('zoomVal').textContent = `${crop.zoom.toFixed(2)}x`;
    draw();
  });
  $('fillAll').addEventListener('click', () => {
    const slot = state.photos[state.selected];
    if (slot == null) { setStatus('Load a photo first, then Fill all panels.'); return; }
    const count = LAYOUTS[state.layout].panels;
    for (let i = 0; i < count; i++) state.photos[i] = slot;
    draw();
    setStatus('All panels now use the selected panel\u2019s photo.');
  });
  $('resetCrop').addEventListener('click', () => {
    state.crops[state.selected] = { zoom: 1.15, px: 0, py: 0 };
    highlightSelected();
    draw();
  });

  $('fileInput').addEventListener('change', async (e) => {
    for (const f of e.target.files) await addPhotoFile(f);
    e.target.value = '';
  });
  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', () => loadSample(b.dataset.sample, b.dataset.name || 'sample.jpg'));
  });

  // Drag-and-drop onto the whole editor.
  const drop = $('dropzone');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
  }));
  drop.addEventListener('drop', async (e) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    for (const f of files) await addPhotoFile(f);
    if (!files.length) setStatus('Drop image files (JPG/PNG) to add them.');
  });

  // Pan: drag inside the preview to move the selected panel's photo.
  preview.addEventListener('pointerdown', (e) => {
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    drag = { x, y, crop: { ...state.crops[state.selected] } };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const crop = state.crops[state.selected];
    // Keep the pan inside the photo so a panel never goes blank.
    crop.px = Math.max(-0.6, Math.min(0.6, drag.crop.px + (x - drag.x)));
    crop.py = Math.max(-0.6, Math.min(0.6, drag.crop.py + (y - drag.y)));
    draw();
  });
  preview.addEventListener('pointerup', () => { drag = null; });
  preview.addEventListener('pointercancel', () => { drag = null; });

  // Export buttons.
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => exportCover(b.dataset.export));
  });
}

// ---- Export ---------------------------------------------------------

function exportCover(size) {
  const [w, h] = size.split('x').map(Number);
  const images = photos.map((p) => p.img);
  const canvas = renderExport(state, w, h, images);
  canvas.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — the canvas could not produce a PNG.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-coast-cover-${w}x${h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported ${w} x ${h} PNG (${Math.round(blob.size / 1024)} KB).`);
  }, 'image/png');
}

// ---- Demo / shot mode -----------------------------------------------
// ?demo=1 autoloads a sample photo so the editor is never empty.
// ?shot=cover&size=WxH renders the cover full-viewport (see shots.js).

async function boot() {
  const params = new URLSearchParams(location.search);
  // In ?shot=cover mode shots.js owns the page and draws the cover
  // full-viewport; the editor must stay out of its way.
  if (params.get('shot') === 'cover') return;
  buildControls();
  bindInputs();
  if (params.get('demo') === '1') {
    await loadSample('samples/boulevard.jpg', 'boulevard.jpg');
    await loadSample('samples/pier.jpg', 'pier.jpg');
  }
  fitPreview();
  renderTray();
  if (!photos.length) setStatus('Add a photo to begin — or try a sample.');
  else setStatus('Sample photos loaded. Pick a layout, grade and caption, then export.');
}

boot();
