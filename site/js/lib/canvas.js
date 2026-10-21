/**
 * Responsive canvas with a fixed logical resolution.
 *
 * Games draw in logical units (for example 480 x 640). The canvas is scaled
 * with CSS to fit the stage while keeping its aspect ratio, and the backing
 * store is multiplied by devicePixelRatio so artwork stays crisp.
 */

import { h } from './dom.js';

/**
 * @param {object} ctx game context from the shell
 * @param {{ width: number, height: number, maxHeight?: number, label?: string }} options
 *   maxHeight is a fraction of the viewport height the canvas may use.
 */
export function createGameCanvas(ctx, { width, height, maxHeight = 0.82, minHeight = 0.5, label = 'Game area' }) {
  const canvas = h('canvas', { class: 'game-canvas', width, height, role: 'img', 'aria-label': label });
  const wrap = h('div', { class: 'canvas-wrap' }, canvas);
  ctx.stage.append(wrap);

  const g = canvas.getContext('2d');
  const resizeListeners = new Set();
  let cssWidth = 0;
  let cssHeight = 0;

  function resize() {
    const stageStyle = getComputedStyle(ctx.stage);
    const padX = parseFloat(stageStyle.paddingLeft) + parseFloat(stageStyle.paddingRight);
    const padY = parseFloat(stageStyle.paddingTop) + parseFloat(stageStyle.paddingBottom);
    const available = Math.max(160, ctx.stage.clientWidth - padX);
    // Fit the canvas into the space below the stage's top edge (as if the
    // page were scrolled to the top), leaving room for touch controls, but
    // never shrink below `minHeight` of the viewport.
    const viewport = window.innerHeight;
    const stageTop = ctx.stage.getBoundingClientRect().top + window.scrollY;
    const fit = viewport - stageTop - ctx.controlsSlot.offsetHeight - padY - 28;
    const viewportCap = Math.max(220, viewport * minHeight, Math.min(fit, viewport * maxHeight));
    const scale = Math.min(available / width, viewportCap / height);
    const nextWidth = Math.max(1, Math.floor(width * scale));
    const nextHeight = Math.max(1, Math.floor(height * scale));
    if (nextWidth === cssWidth && nextHeight === cssHeight) return;

    cssWidth = nextWidth;
    cssHeight = nextHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    g.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    // Short stages get a compact overlay layout.
    ctx.stage.classList.toggle('is-compact', cssHeight < 300);
    for (const listener of resizeListeners) listener();
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(ctx.stage);
  observer.observe(ctx.controlsSlot);
  ctx.listen(window, 'resize', resize);
  ctx.onDestroy(() => observer.disconnect());
  resize();

  return {
    canvas,
    ctx: g,
    width,
    height,
    resize,
    /** Registers a redraw callback; resizing clears the canvas. */
    onResize(listener) {
      resizeListeners.add(listener);
    },
    /** Converts a pointer event to logical game coordinates. */
    toLogical(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height,
      };
    },
  };
}

/** Rounded rectangle path helper. */
export function roundRect(g, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + radius, y);
  g.arcTo(x + w, y, x + w, y + h, radius);
  g.arcTo(x + w, y + h, x, y + h, radius);
  g.arcTo(x, y + h, x, y, radius);
  g.arcTo(x, y, x + w, y, radius);
  g.closePath();
}

export function fillRoundRect(g, x, y, w, h, r, color) {
  g.fillStyle = color;
  roundRect(g, x, y, w, h, r);
  g.fill();
}
