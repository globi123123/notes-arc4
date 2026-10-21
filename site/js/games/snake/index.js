/** Snake: grid movement with smooth interpolated rendering. */

import { createGameCanvas, fillRoundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { attachSwipe, createKeyboard, createTouchControls } from '../../lib/input.js';
import { palette } from '../../lib/palette.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { createState, queueDirection, step, tickInterval } from './logic.js';

const COLS = 20;
const ROWS = 20;
const CELL = 24;

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: COLS * CELL, height: ROWS * CELL, label: 'Snake board' });
  const g = view.ctx;
  const keys = createKeyboard(ctx);

  let state;
  let elapsed = 0; // ms since the last move
  let lastTail = null; // cell vacated on the last move, for smooth tail drawing
  let grew = false;
  let time = 0;

  const loop = createLoop({ update, render, step: 1 / 120 });

  function reset() {
    state = createState({ cols: COLS, rows: ROWS });
    elapsed = 0;
    lastTail = null;
    grew = false;
    updateStats();
  }

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({ score: state.score, length: state.snake.length, best: Math.max(best, state.score) });
  }

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Snake',
      title: 'Ready when you are',
      message: 'Press an arrow key or swipe to start moving.',
      actions: [{ label: 'Start', icon: 'play', onClick: () => start() }],
    });
  }

  function start(dir) {
    if (ctx.status === 'running') return;
    if (state.dead || state.won) reset();
    if (dir) queueDirection(state, dir);
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function turn(dir) {
    if (ctx.status === 'idle') {
      start(dir === 'left' ? null : dir);
      return;
    }
    if (ctx.status === 'running') queueDirection(state, dir);
  }

  for (const dir of ['up', 'down', 'left', 'right']) keys.on(dir, () => turn(dir));
  keys.on('action', () => {
    if (ctx.status === 'idle') start();
  });

  attachSwipe(ctx, view.canvas, {
    onSwipe: (dir) => turn(dir),
    onTap: () => {
      if (ctx.status === 'idle') start();
    },
  });

  createTouchControls(ctx, keys, [
    [{ action: 'left', icon: 'chevronLeft', label: 'Left' }],
    [
      { action: 'up', icon: 'chevronUp', label: 'Up' },
      { action: 'down', icon: 'chevronDown', label: 'Down' },
    ],
    [{ action: 'right', icon: 'chevronRight', label: 'Right' }],
  ]);

  function update(dt) {
    time += dt;
    elapsed += dt * 1000;
    const interval = tickInterval(state.score);
    if (elapsed < interval) return;
    elapsed -= interval;
    const result = step(state);
    lastTail = result.tail;
    grew = result.ate;
    if (result.ate) updateStats();
    if (result.dead || state.won) finish();
  }

  function finish() {
    loop.stop();
    elapsed = 0;
    ctx.setStatus('over');
    const { best, isNew } = ctx.storage.submitRecord('best', state.score);
    updateStats();
    ctx.overlay.show({
      kicker: state.won ? 'Board cleared' : 'Game over',
      title: state.won ? 'You filled the board' : `You scored ${state.score}`,
      badge: isNew && state.score > 0 ? 'New best' : null,
      stats: [
        { label: 'Score', value: state.score },
        { label: 'Length', value: state.snake.length },
        { label: 'Best', value: best ?? 0, highlight: isNew && state.score > 0 },
      ],
      actions: [{ label: 'Play again', icon: 'restart', onClick: () => restart() }],
      suggest: true,
      delay: 450,
    });
  }

  function restart() {
    loop.stop();
    reset();
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
    render(0);
  }

  // ----- Rendering -----

  const center = (p) => ({ x: p.x * CELL + CELL / 2, y: p.y * CELL + CELL / 2 });
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  function drawBoard() {
    g.fillStyle = palette.cream;
    g.fillRect(0, 0, view.width, view.height);
    g.fillStyle = '#f3efe5';
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = y % 2; x < COLS; x += 2) g.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  function render() {
    drawBoard();
    if (!state) return;
    const active = ctx.status === 'running' || ctx.status === 'paused';
    const t = active ? Math.min(1, elapsed / tickInterval(state.score)) : 1;

    // Food
    if (state.food) {
      const c = center(state.food);
      const pulse = prefersReducedMotion() ? 0 : Math.sin(time * 5) * 0.8;
      g.fillStyle = palette.accent;
      g.beginPath();
      g.arc(c.x, c.y + 1, 7 + pulse, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = palette.sageDeep;
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(c.x + 1, c.y - 6);
      g.quadraticCurveTo(c.x + 3, c.y - 10, c.x + 7, c.y - 10);
      g.stroke();
    }

    // Body as one thick rounded path, with the head and tail sliding
    // smoothly between cells.
    const snake = state.snake;
    const points = [];
    const moving = active && snake.length > 1 && !state.dead;
    points.push(moving ? mix(center(snake[1]), center(snake[0]), t) : center(snake[0]));
    for (let i = 1; i < snake.length; i += 1) points.push(center(snake[i]));
    if (moving && lastTail && !grew) points.push(mix(center(lastTail), center(snake[snake.length - 1]), t));

    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = state.dead ? palette.faint : palette.sageDeep;
    g.lineWidth = CELL * 0.72;
    g.beginPath();
    points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    if (points.length === 1) g.lineTo(points[0].x + 0.01, points[0].y);
    g.stroke();

    g.strokeStyle = state.dead ? palette.borderStrong : palette.sage;
    g.lineWidth = CELL * 0.36;
    g.stroke();

    // Head with eyes looking in the travel direction
    const head = points[0];
    const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.dir];
    g.fillStyle = state.dead ? palette.muted : palette.sageDeep;
    g.beginPath();
    g.arc(head.x, head.y, CELL * 0.42, 0, Math.PI * 2);
    g.fill();
    const side = [-dir[1], dir[0]];
    for (const s of [-1, 1]) {
      const ex = head.x + dir[0] * 4 + side[0] * 4.5 * s;
      const ey = head.y + dir[1] * 4 + side[1] * 4.5 * s;
      g.fillStyle = palette.cream;
      g.beginPath();
      g.arc(ex, ey, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = palette.ink;
      g.beginPath();
      g.arc(ex + dir[0] * 0.9, ey + dir[1] * 0.9, 1.3, 0, Math.PI * 2);
      g.fill();
    }

    if (state.dead) {
      fillRoundRect(g, 0, 0, view.width, view.height, 0, 'rgba(245,244,239,0.25)');
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
