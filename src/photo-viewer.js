// Static multi-angle photographs extracted from the supplied ObjectVR SWF.
// This viewer never executes Flash or reconstructs/fabricates 3D geometry.
export function createPhotoViewer(el, artifact) {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline-offset:-4px';
  canvas.title = '확대 전: 끌어서 사진 시점 변경 · 확대 후: 끌어서 위치 이동 · 휠/두 손가락: 확대';
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('사진 관찰 화면을 만들 수 없어요.');
  el.append(canvas);

  let disposed = false, manifest, manifestUrl, row = 0, column = 0;
  let image = null, shownFile = '', requested = 0, scale = 1, panX = 0, panY = 0;
  let width = 1, height = 1, pixelRatio = 1;
  const cache = new Map(), pointers = new Map();
  let gesture = null;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const wrap = (n, length) => ((n % length) + length) % length;

  function draw() {
    if (disposed) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = '#e8e9e0';
    ctx.fillRect(0, 0, width, height);
    if (!image) return;
    const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawnWidth = image.naturalWidth * fit * scale;
    const drawnHeight = image.naturalHeight * fit * scale;
    panX = clamp(panX, -Math.max(0, (drawnWidth - width) / 2), Math.max(0, (drawnWidth - width) / 2));
    panY = clamp(panY, -Math.max(0, (drawnHeight - height) / 2), Math.max(0, (drawnHeight - height) / 2));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, (width - drawnWidth) / 2 + panX, (height - drawnHeight) / 2 + panY, drawnWidth, drawnHeight);
    canvas.dataset.frame = shownFile;
    canvas.dataset.zoom = scale.toFixed(3);
    canvas.setAttribute('aria-label', `${artifact.name} 다각도 사진 ${shownFile.replace('.jpg', '')}. 방향키 또는 끌기로 시점을 바꿀 수 있어요.`);
  }

  function loadImage(file) {
    const existing = cache.get(file);
    if (existing) { existing.used = performance.now(); return existing.promise; }
    const img = new Image();
    const item = { image: img, used: performance.now(), promise: null };
    item.promise = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => { cache.delete(file); reject(new Error('관찰 사진을 불러오지 못했어요.')); };
      img.src = new URL(file, manifestUrl).href;
    });
    cache.set(file, item);
    // Retain a few decoded images, rather than loading all 54 images into memory.
    if (cache.size > 6) {
      const oldest = [...cache].filter(([key]) => key !== file && key !== shownFile).sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    return item.promise;
  }

  async function showFrame(nextRow, nextColumn) {
    if (!manifest || disposed) return;
    row = clamp(nextRow, 0, manifest.rows - 1);
    column = wrap(nextColumn, manifest.columns);
    const file = manifest.frames[row][column];
    const request = ++requested;
    canvas.dataset.loading = 'true';
    try {
      const loaded = await loadImage(file);
      if (disposed || request !== requested) return;
      image = loaded; shownFile = file;
      canvas.dataset.loading = 'false';
      delete canvas.dataset.error;
      draw();
    } catch (error) {
      if (!disposed && request === requested) {
        canvas.dataset.loading = 'false';
        canvas.dataset.error = error.message;
      }
      throw error;
    }
  }

  function requestFrame(r, c) { showFrame(r, c).catch(() => {}); }
  function resize() {
    if (disposed) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    draw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(el); resize();

  function zoom(factor) {
    if (disposed || !Number.isFinite(factor) || factor <= 0) return;
    const old = scale; scale = clamp(scale / factor, 1, 4);
    if (old) { panX *= scale / old; panY *= scale / old; }
    draw();
  }
  function reset() {
    scale = 1; panX = panY = 0;
    if (manifest) requestFrame(manifest.initialRow ?? 0, manifest.initialColumn ?? 0);
    draw();
  }
  const location = e => ({ x: e.clientX, y: e.clientY });
  function beginGesture(e) {
    const values = [...pointers.values()];
    if (values.length >= 2) {
      gesture = { mode: 'pinch', distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y), x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2, scale, panX, panY };
    } else if (values.length === 1) {
      gesture = { mode: scale > 1.05 || e?.button === 2 || e?.shiftKey ? 'pan' : 'frames', x: values[0].x, y: values[0].y, row, column, panX, panY };
    } else gesture = null;
  }
  function pointerDown(e) {
    if (disposed || !manifest) return;
    e.preventDefault(); canvas.focus({ preventScroll: true });
    pointers.set(e.pointerId, location(e)); canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing'; beginGesture(e);
  }
  function pointerMove(e) {
    if (!pointers.has(e.pointerId) || !gesture || disposed) return;
    e.preventDefault(); pointers.set(e.pointerId, location(e));
    const values = [...pointers.values()];
    if (values.length >= 2) {
      if (gesture.mode !== 'pinch') beginGesture(e);
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      scale = clamp(gesture.scale * distance / Math.max(gesture.distance, 1), 1, 4);
      panX = gesture.panX + (values[0].x + values[1].x) / 2 - gesture.x;
      panY = gesture.panY + (values[0].y + values[1].y) / 2 - gesture.y;
      draw(); return;
    }
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (gesture.mode === 'pan') { panX = gesture.panX + dx; panY = gesture.panY + dy; draw(); }
    else {
      const r = clamp(gesture.row + Math.round(dy / 50), 0, manifest.rows - 1);
      const c = wrap(gesture.column - Math.round(dx / 35), manifest.columns);
      if (r !== row || c !== column) requestFrame(r, c);
    }
  }
  function pointerUp(e) {
    pointers.delete(e.pointerId);
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    beginGesture(e); canvas.style.cursor = pointers.size ? 'grabbing' : 'grab';
  }
  function wheel(e) { e.preventDefault(); zoom(Math.exp(e.deltaY * .0013)); }
  function contextMenu(e) { e.preventDefault(); }
  function keyDown(e) {
    if (!manifest || disposed) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const r = row + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
      const c = column + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
      requestFrame(r, c);
    } else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(.84); }
    else if (e.key === '-') { e.preventDefault(); zoom(1.18); }
    else if (e.key === 'Home') { e.preventDefault(); reset(); }
  }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('lostpointercapture', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', contextMenu);
  canvas.addEventListener('keydown', keyDown);

  const ready = (async () => {
    manifestUrl = new URL(artifact.photoView, document.baseURI);
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('관찰 사진 목록을 불러오지 못했어요.');
    const data = await response.json();
    if (!Number.isInteger(data.rows) || !Number.isInteger(data.columns) || data.rows < 1 || data.columns < 1 || !Array.isArray(data.frames) || data.frames.length !== data.rows || data.frames.some(r => !Array.isArray(r) || r.length !== data.columns || r.some(file => typeof file !== 'string'))) throw new Error('관찰 사진 목록 형식이 올바르지 않아요.');
    if (disposed) return;
    manifest = data;
    await showFrame(data.initialRow ?? 0, data.initialColumn ?? 0);
  })();

  return {
    ready, zoom, reset,
    capture() {
      if (!image || disposed) throw new Error('사진이 준비될 때까지 기다려 주세요.');
      draw(); return canvas.toDataURL('image/jpeg', .85);
    },
    setReferenceColor() {},
    dispose() {
      if (disposed) return;
      disposed = true; requested++;
      observer.disconnect(); pointers.clear(); cache.clear();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', contextMenu);
      canvas.removeEventListener('keydown', keyDown);
      canvas.remove(); image = null;
    }
  };
}
