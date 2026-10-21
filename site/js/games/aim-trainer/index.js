/** Aim Trainer: timed rounds of shrinking targets with accuracy and reaction stats. */

import { createGameCanvas } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { font, palette } from '../../lib/palette.js';
import { formatPercent } from '../../lib/format.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { randomRange } from '../../lib/random.js';
import { segmented } from '../../ui/components.js';

const W = 640;
const H = 420;
const MAX_R = 30;
const MARGIN = 40;
const DURATIONS = { 30: '30 seconds', 60: '60 seconds' };

export default function mount(ctx) {
  let duration = Number(ctx.storage.getPref('duration', 30));
  if (!DURATIONS[duration]) duration = 30;

  const view = createGameCanvas(ctx, { width: W, height: H, label: 'Aim training area' });
  view.canvas.style.cursor = 'crosshair';
  const g = view.ctx;

  const durationControl = segmented({
    label: 'Round length',
    value: String(duration),
    options: Object.entries(DURATIONS).map(([value, label]) => ({ value, label })),
    onChange: (value) => {
      duration = Number(value);
      ctx.storage.setPref('duration', duration);
      loop.stop();
      reset();
      render();
      showStart();
    },
  });
  ctx.toolbar.append(durationControl);

  let target;
  let hits;
  let clicks;
  let expired;
  let reactions;
  let timeLeft;
  let countdown;
  let effects;
  let elapsed;

  const loop = createLoop({ update, render });

  /** Targets shrink faster as the round goes on. */
  const lifetime = () => Math.max(0.95, 1.7 - elapsed * 0.012);

  function reset() {
    target = null;
    hits = 0;
    clicks = 0;
    expired = 0;
    reactions = [];
    timeLeft = duration;
    countdown = 0;
    effects = [];
    elapsed = 0;
    updateStats();
    showRecordList();
  }

  function showRecordList() {
    ctx.showRecords(
      Object.entries(DURATIONS).map(([d, label]) => ({ label, value: ctx.storage.getRecord(`best-${d}`) ?? '–' })),
    );
  }

  const accuracy = () => (clicks ? hits / clicks : null);
  const avgReaction = () => (reactions.length ? reactions.reduce((a, b) => a + b, 0) / reactions.length : null);

  function updateStats() {
    const best = ctx.storage.getRecord(`best-${duration}`) ?? 0;
    const avg = avgReaction();
    ctx.setStats({
      hits,
      accuracy: formatPercent(accuracy()),
      reaction: avg == null ? '–' : `${Math.round(avg)} ms`,
      time: `${Math.ceil(timeLeft)}s`,
      best: Math.max(best, hits),
    });
  }

  function spawnTarget() {
    let x;
    let y;
    // Avoid spawning right on top of the previous target.
    do {
      x = randomRange(MARGIN, W - MARGIN);
      y = randomRange(MARGIN + 10, H - MARGIN);
    } while (target && Math.hypot(x - target.x, y - target.y) < 120);
    target = { x, y, age: 0, life: lifetime() };
  }

  const radius = () => (target ? MAX_R * Math.max(0, 1 - target.age / target.life) + 4 : 0);

  ctx.listen(view.canvas, 'pointerdown', (event) => {
    event.preventDefault();
    if (ctx.status !== 'running' || countdown > 0 || !target) return;
    const { x, y } = view.toLogical(event);
    clicks += 1;
    if (Math.hypot(x - target.x, y - target.y) <= radius() + 3) {
      hits += 1;
      reactions.push(target.age * 1000);
      effects.push({ x: target.x, y: target.y, t: 0, hit: true });
      spawnTarget();
    } else {
      effects.push({ x, y, t: 0, hit: false });
    }
    updateStats();
  });

  function update(dt) {
    effects = effects.filter((e) => (e.t += dt) < 0.4);
    if (countdown > 0) {
      countdown -= dt;
      if (countdown <= 0) spawnTarget();
      return;
    }
    elapsed += dt;
    timeLeft = Math.max(0, timeLeft - dt);
    if (target) {
      target.age += dt;
      if (target.age >= target.life) {
        expired += 1;
        spawnTarget();
      }
    }
    if (timeLeft <= 0) {
      finish();
      return;
    }
    updateStats();
  }

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Aim Trainer',
      title: `${duration} second round`,
      message: 'Click each target before it shrinks away. Misses lower your accuracy.',
      actions: [{ label: 'Start round', icon: 'play', onClick: begin }],
    });
  }

  function begin() {
    loop.stop();
    reset();
    countdown = 3;
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function finish() {
    loop.stop();
    target = null;
    ctx.setStatus('over');
    const { best, isNew } = ctx.storage.submitRecord(`best-${duration}`, hits);
    updateStats();
    render();
    showRecordList();
    const avg = avgReaction();
    ctx.overlay.show({
      kicker: 'Time',
      title: `${hits} ${hits === 1 ? 'hit' : 'hits'}`,
      badge: isNew && hits > 0 ? 'New best' : null,
      stats: [
        { label: 'Accuracy', value: formatPercent(accuracy()) },
        { label: 'Avg time', value: avg == null ? '–' : `${Math.round(avg)} ms` },
        { label: 'Best', value: best ?? 0, highlight: isNew && hits > 0 },
      ],
      message: expired
        ? `${expired} ${expired === 1 ? 'target' : 'targets'} got away.`
        : 'Not a single target got away.',
      actions: [{ label: 'Go again', icon: 'restart', onClick: begin }],
      suggest: true,
      delay: 300,
    });
  }

  function render() {
    g.fillStyle = palette.cream;
    g.fillRect(0, 0, W, H);

    // Subtle grid for a sense of space
    g.strokeStyle = 'rgba(34,33,31,0.04)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 40; x < W; x += 40) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, H);
    }
    for (let y = 40; y < H; y += 40) {
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
    }
    g.stroke();

    // Time bar along the top
    const progress = timeLeft / duration;
    g.fillStyle = palette.strong;
    g.fillRect(0, 0, W, 4);
    g.fillStyle = palette.accent;
    g.fillRect(0, 0, W * progress, 4);

    if (countdown > 0) {
      g.textAlign = 'center';
      g.font = font(72, 700);
      g.fillStyle = palette.ink;
      g.fillText(String(Math.ceil(countdown)), W / 2, H / 2 + 24);
      g.font = font(13, 600);
      g.fillStyle = palette.muted;
      g.fillText('Get ready', W / 2, H / 2 + 60);
    }

    if (target) {
      const r = radius();
      g.fillStyle = palette.surface;
      g.beginPath();
      g.arc(target.x, target.y, r, 0, Math.PI * 2);
      g.fill();
      for (const [k, color] of [
        [1, palette.accent],
        [0.62, palette.cream],
        [0.36, palette.accent],
      ]) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(target.x, target.y, r * k, 0, Math.PI * 2);
        g.fill();
      }
    }

    for (const e of effects) {
      const k = e.t / 0.4;
      g.globalAlpha = 1 - k;
      g.strokeStyle = e.hit ? palette.accent : palette.faint;
      g.lineWidth = 2;
      g.beginPath();
      if (e.hit) g.arc(e.x, e.y, prefersReducedMotion() ? 20 : 10 + k * 30, 0, Math.PI * 2);
      else {
        g.moveTo(e.x - 6, e.y - 6);
        g.lineTo(e.x + 6, e.y + 6);
        g.moveTo(e.x + 6, e.y - 6);
        g.lineTo(e.x - 6, e.y + 6);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  view.onResize(() => render());

  reset();
  render();
  showStart();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    restart: begin,
    destroy: () => loop.stop(),
  };
}
