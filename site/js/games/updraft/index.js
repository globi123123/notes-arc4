/** Updraft: a one-button paper glider weaving through columns. */

import { createGameCanvas, fillRoundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createKeyboard } from '../../lib/input.js';
import { font, palette } from '../../lib/palette.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { clamp, randomRange } from '../../lib/random.js';

const W = 400;
const H = 600;
const GROUND = 70;
const GLIDER_X = 112;
const RADIUS = 12;
const GRAVITY = 1450;
const FLAP = -420;
const MAX_FALL = 620;
const COLUMN_W = 62;
const SPACING = 228;

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: W, height: H, minHeight: 0.58, label: 'Updraft sky' });
  const g = view.ctx;
  const keys = createKeyboard(ctx);

  let glider;
  let columns;
  let score;
  let scroll;
  let dead;
  let deadTimer;
  let flash;
  let idleTime = 0;

  const loop = createLoop({ update, render });

  const speed = () => Math.min(285, 168 + score * 4.5);
  const gapSize = () => Math.max(128, 176 - score * 2.2);

  function reset() {
    glider = { y: H * 0.42, vy: 0, angle: 0 };
    columns = [];
    score = 0;
    scroll = 0;
    dead = false;
    deadTimer = 0;
    flash = 0;
    let x = W + 80;
    let last = (H - GROUND) / 2;
    for (let i = 0; i < 3; i += 1) {
      last = nextGapY(last);
      columns.push({ x, gapY: last, gap: gapSize(), passed: false });
      x += SPACING;
    }
    updateStats();
  }

  /** Random but fair: the next gap is never too far from the previous one. */
  function nextGapY(previous) {
    const margin = 110;
    const min = margin;
    const max = H - GROUND - margin;
    return clamp(previous + randomRange(-165, 165), min, max);
  }

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({ score, best: Math.max(best, score) });
  }

  function flap() {
    if (ctx.status === 'over' || dead) return;
    if (ctx.status === 'idle') start();
    if (ctx.status !== 'running') return;
    glider.vy = FLAP;
  }

  keys.on('action', flap);
  keys.on('up', flap);
  ctx.listen(view.canvas, 'pointerdown', (event) => {
    event.preventDefault();
    flap();
  });

  function update(dt) {
    if (flash > 0) flash = Math.max(0, flash - dt * 3);

    if (ctx.status === 'idle') {
      idleTime += dt;
      glider.y = H * 0.42 + Math.sin(idleTime * 3) * 8;
      scroll += 60 * dt;
      return;
    }

    glider.vy = Math.min(MAX_FALL, glider.vy + GRAVITY * dt);
    glider.y += glider.vy * dt;
    glider.angle = clamp(glider.vy / 700, -0.45, 1.1);
    if (glider.y < RADIUS) {
      glider.y = RADIUS;
      glider.vy = 0;
    }

    if (dead) {
      deadTimer += dt;
      if (glider.y >= H - GROUND - RADIUS) glider.y = H - GROUND - RADIUS;
      if (deadTimer > 0.6) gameOver();
      return;
    }

    const dx = speed() * dt;
    scroll += dx;
    for (const col of columns) {
      col.x -= dx;
      if (!col.passed && col.x + COLUMN_W < GLIDER_X - RADIUS) {
        col.passed = true;
        score += 1;
        updateStats();
      }
    }
    if (columns[0].x + COLUMN_W < -10) {
      columns.shift();
      const last = columns[columns.length - 1];
      columns.push({ x: last.x + SPACING, gapY: nextGapY(last.gapY), gap: gapSize(), passed: false });
    }

    if (glider.y + RADIUS >= H - GROUND || hitsColumn()) die();
  }

  function hitsColumn() {
    for (const col of columns) {
      if (GLIDER_X + RADIUS < col.x || GLIDER_X - RADIUS > col.x + COLUMN_W) continue;
      const top = col.gapY - col.gap / 2;
      const bottom = col.gapY + col.gap / 2;
      for (const rect of [
        { y1: -100, y2: top },
        { y1: bottom, y2: H - GROUND },
      ]) {
        const nx = clamp(GLIDER_X, col.x, col.x + COLUMN_W);
        const ny = clamp(glider.y, rect.y1, rect.y2);
        // Slightly forgiving hitbox.
        if ((GLIDER_X - nx) ** 2 + (glider.y - ny) ** 2 < (RADIUS - 2) ** 2) return true;
      }
    }
    return false;
  }

  function die() {
    dead = true;
    deadTimer = 0;
    flash = prefersReducedMotion() ? 0 : 1;
    glider.vy = Math.max(glider.vy, 0);
  }

  function gameOver() {
    loop.stop();
    ctx.setStatus('over');
    const { best, isNew } = ctx.storage.submitRecord('best', score);
    updateStats();
    render();
    ctx.overlay.show({
      kicker: 'Grounded',
      title: score === 1 ? '1 column' : `${score} columns`,
      badge: isNew && score > 0 ? 'New best' : null,
      stats: [
        { label: 'Score', value: score },
        { label: 'Best', value: best ?? 0, highlight: isNew && score > 0 },
      ],
      actions: [{ label: 'Fly again', icon: 'restart', onClick: restart }],
      suggest: true,
      delay: 500,
    });
  }

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Updraft',
      title: 'Catch the wind',
      message: 'Press Space or tap to give the glider a lift. Fly through the gaps.',
      actions: [{ label: 'Ready', icon: 'play', onClick: () => ctx.overlay.hide() }],
    });
    loop.start();
  }

  function start() {
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function restart() {
    loop.stop();
    reset();
    ctx.overlay.hide();
    ctx.setStatus('idle');
    idleTime = 0;
    loop.start();
  }

  // ----- Rendering -----

  function hills(offset, baseY, amplitude, color, period) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
      const t = (x + offset) / period;
      g.lineTo(x, baseY - Math.sin(t) * amplitude - Math.sin(t * 2.3) * amplitude * 0.35);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }

  function cloud(x, y, s) {
    g.fillStyle = 'rgba(251,250,247,0.9)';
    g.beginPath();
    g.arc(x, y, 14 * s, 0, Math.PI * 2);
    g.arc(x + 16 * s, y - 6 * s, 18 * s, 0, Math.PI * 2);
    g.arc(x + 36 * s, y, 13 * s, 0, Math.PI * 2);
    g.rect(x, y, 36 * s, 12 * s);
    g.fill();
  }

  function drawColumn(col) {
    const top = col.gapY - col.gap / 2;
    const bottom = col.gapY + col.gap / 2;
    fillRoundRect(g, col.x, -20, COLUMN_W, top + 20, 10, palette.sage);
    fillRoundRect(g, col.x, bottom, COLUMN_W, H - GROUND - bottom + 20, 10, palette.sage);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(col.x + 8, -20, 8, top + 10);
    g.fillRect(col.x + 8, bottom + 18, 8, H - GROUND - bottom);
    fillRoundRect(g, col.x - 5, top - 18, COLUMN_W + 10, 18, 7, palette.sageDeep);
    fillRoundRect(g, col.x - 5, bottom, COLUMN_W + 10, 18, 7, palette.sageDeep);
  }

  function drawGlider() {
    g.save();
    g.translate(GLIDER_X, glider.y);
    g.rotate(glider.angle);
    // Paper plane: two wing halves and a fold line.
    g.fillStyle = palette.accentDeep;
    g.beginPath();
    g.moveTo(-17, 1);
    g.lineTo(-4, 4);
    g.lineTo(-9, 12);
    g.closePath();
    g.fill();
    g.fillStyle = palette.accent;
    g.beginPath();
    g.moveTo(-17, 0);
    g.lineTo(17, -9);
    g.lineTo(-4, 4);
    g.closePath();
    g.fill();
    g.fillStyle = '#dc805f';
    g.beginPath();
    g.moveTo(-4, 4);
    g.lineTo(17, -9);
    g.lineTo(2, 10);
    g.closePath();
    g.fill();
    g.restore();
  }

  function render() {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#e7efed');
    sky.addColorStop(1, '#f6f0e4');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    g.fillStyle = '#f3dcc4';
    g.beginPath();
    g.arc(W - 86, 110, 34, 0, Math.PI * 2);
    g.fill();

    const s = scroll;
    cloud(((-s * 0.15) % (W + 160)) + W + 20, 90, 1);
    cloud(((-s * 0.15 + 260) % (W + 160)) + W + 20, 170, 0.75);
    hills(s * 0.25, H - GROUND - 70, 26, '#dfe3d6', 140);
    hills(s * 0.5, H - GROUND - 26, 18, '#d2d8c6', 90);

    for (const col of columns) drawColumn(col);

    // Ground with scrolling stripes
    g.fillStyle = '#e4d6bb';
    g.fillRect(0, H - GROUND, W, GROUND);
    g.fillStyle = palette.sageDeep;
    g.fillRect(0, H - GROUND, W, 6);
    g.fillStyle = 'rgba(166,113,78,0.18)';
    const off = s % 40;
    for (let x = -40 - off; x < W + 40; x += 40) {
      g.beginPath();
      g.moveTo(x, H - GROUND + 6);
      g.lineTo(x + 20, H - GROUND + 6);
      g.lineTo(x + 6, H);
      g.lineTo(x - 14, H);
      g.closePath();
      g.fill();
    }

    drawGlider();

    if (ctx.status !== 'idle' || score > 0) {
      g.textAlign = 'center';
      g.font = font(44, 700);
      g.fillStyle = 'rgba(34,33,31,0.12)';
      g.fillText(String(score), W / 2 + 2, 92);
      g.fillStyle = palette.cream;
      g.fillText(String(score), W / 2, 90);
    } else {
      g.textAlign = 'center';
      g.font = font(14, 600);
      g.fillStyle = palette.muted;
      g.fillText('Press Space or tap to fly', W / 2, H - GROUND - 120);
    }

    if (flash > 0) {
      g.fillStyle = `rgba(251,250,247,${flash * 0.6})`;
      g.fillRect(0, 0, W, H);
    }
  }

  view.onResize(() => render());

  reset();
  render();
  showStart();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    restart,
    destroy: () => loop.stop(),
  };
}
