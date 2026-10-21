/** Block Stacker: falling pieces, line clears, levels and a next preview. */

import { createGameCanvas, fillRoundRect, roundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { attachSwipe, createKeyboard, createTouchControls } from '../../lib/input.js';
import { font, palette } from '../../lib/palette.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import {
  COLS,
  ROWS,
  LINE_SCORES,
  SHAPES,
  createBag,
  createBoard,
  cellsOf,
  collides,
  dropPosition,
  fullRows,
  gravityInterval,
  merge,
  removeRows,
  spawnPiece,
  tryMove,
  tryRotate,
} from './logic.js';

const CELL = 30;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const SIDE_X = BOARD_W + 18;
const WIDTH = BOARD_W + 150;

const COLORS = {
  I: palette.teal,
  O: palette.mustard,
  T: palette.accent,
  S: palette.sage,
  Z: palette.rose,
  J: palette.slate,
  L: palette.clay,
};

const LOCK_DELAY = 480;
const MAX_LOCK_RESETS = 15;
const DAS = 165; // delay before a held direction repeats
const ARR = 48; // repeat rate while held
const SOFT_DROP_INTERVAL = 35;
const CLEAR_ANIMATION = 200;

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: WIDTH, height: BOARD_H, label: 'Block Stacker board' });
  const g = view.ctx;
  const keys = createKeyboard(ctx, {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    down: ['ArrowDown', 'KeyS'],
    rotate: ['ArrowUp', 'KeyX', 'KeyW'],
    rotateBack: ['KeyZ', 'KeyY'],
    drop: ['Space'],
  });

  let board;
  let piece;
  let nextType;
  let nextPiece;
  let score;
  let lines;
  let level;
  let gravityTimer;
  let lockTimer;
  let lockResets;
  let clearing; // { rows, t } while a line clear animation plays
  let shift; // { dir, timer, repeating } for held left/right

  const loop = createLoop({ update, render });

  function reset() {
    board = createBoard();
    nextPiece = createBag();
    nextType = nextPiece();
    score = 0;
    lines = 0;
    level = 1;
    clearing = null;
    shift = null;
    spawn();
    updateStats();
  }

  function spawn() {
    piece = spawnPiece(nextType);
    nextType = nextPiece();
    gravityTimer = 0;
    lockTimer = 0;
    lockResets = 0;
    if (collides(board, piece)) gameOver();
  }

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({ score, lines, level, best: Math.max(best, score) });
  }

  // ----- Player actions -----

  const canAct = () => ctx.status === 'running' && piece && !clearing;

  function onGroundedChange() {
    // A successful move while resting on something gives a little more time.
    if (!tryMove(board, piece, 0, 1) && lockResets < MAX_LOCK_RESETS) {
      lockTimer = 0;
      lockResets += 1;
    }
  }

  function move(dx) {
    if (!canAct()) return false;
    const moved = tryMove(board, piece, dx, 0);
    if (!moved) return false;
    piece = moved;
    onGroundedChange();
    return true;
  }

  function rotate(dir) {
    if (!canAct()) return;
    const rotated = tryRotate(board, piece, dir);
    if (rotated) {
      piece = rotated;
      onGroundedChange();
    }
  }

  function hardDrop() {
    if (!canAct()) return;
    const landed = dropPosition(board, piece);
    score += (landed.y - piece.y) * 2;
    piece = landed;
    lock();
  }

  function lock() {
    const inside = merge(board, piece);
    piece = null;
    if (!inside) {
      gameOver();
      return;
    }
    const rows = fullRows(board);
    if (rows.length) {
      clearing = { rows, t: 0 };
      if (prefersReducedMotion()) finishClear();
    } else spawn();
    updateStats();
  }

  function finishClear() {
    const count = removeRows(board, clearing.rows);
    clearing = null;
    score += LINE_SCORES[count] * level;
    lines += count;
    level = Math.floor(lines / 10) + 1;
    updateStats();
    spawn();
  }

  keys.on('left', () => {
    if (ctx.status === 'idle') return start();
    move(-1);
    shift = { dir: -1, timer: 0, repeating: false };
  });
  keys.on('right', () => {
    if (ctx.status === 'idle') return start();
    move(1);
    shift = { dir: 1, timer: 0, repeating: false };
  });
  keys.onUp('left', () => {
    if (shift?.dir === -1) shift = keys.isDown('right') ? { dir: 1, timer: 0, repeating: false } : null;
  });
  keys.onUp('right', () => {
    if (shift?.dir === 1) shift = keys.isDown('left') ? { dir: -1, timer: 0, repeating: false } : null;
  });
  keys.on('rotate', () => (ctx.status === 'idle' ? start() : rotate(1)));
  keys.on('rotateBack', () => rotate(-1));
  keys.on('drop', () => (ctx.status === 'idle' ? start() : hardDrop()));

  attachSwipe(ctx, view.canvas, {
    threshold: 30,
    onSwipe: (dir) => {
      if (dir === 'left') move(-1);
      if (dir === 'right') move(1);
      if (dir === 'down') hardDrop();
      if (dir === 'up') rotate(1);
    },
    onTap: () => (ctx.status === 'idle' ? start() : rotate(1)),
  });

  createTouchControls(ctx, keys, [
    [
      { action: 'left', icon: 'chevronLeft', label: 'Move left' },
      { action: 'right', icon: 'chevronRight', label: 'Move right' },
    ],
    [
      { action: 'rotate', icon: 'rotate', label: 'Rotate' },
      { action: 'down', icon: 'chevronDown', label: 'Soft drop' },
      { action: 'drop', icon: 'drop', label: 'Hard drop', variant: 'accent' },
    ],
  ]);

  // ----- Simulation -----

  function update(dt) {
    const ms = dt * 1000;

    if (clearing) {
      clearing.t += ms;
      if (clearing.t >= CLEAR_ANIMATION) finishClear();
      return;
    }
    if (!piece) return;

    // Auto-repeat for held left/right.
    if (shift) {
      shift.timer += ms;
      const threshold = shift.repeating ? ARR : DAS;
      if (shift.timer >= threshold) {
        shift.timer -= threshold;
        shift.repeating = true;
        move(shift.dir);
      }
    }

    const softDrop = keys.isDown('down');
    const interval = softDrop ? Math.min(SOFT_DROP_INTERVAL, gravityInterval(level)) : gravityInterval(level);
    const grounded = !tryMove(board, piece, 0, 1);

    if (grounded) {
      lockTimer += ms;
      if (lockTimer >= LOCK_DELAY || (softDrop && lockTimer >= LOCK_DELAY / 3)) lock();
      return;
    }

    lockTimer = 0;
    gravityTimer += ms;
    while (gravityTimer >= interval && piece) {
      gravityTimer -= interval;
      const moved = tryMove(board, piece, 0, 1);
      if (!moved) break;
      piece = moved;
      if (softDrop) {
        score += 1;
        updateStats();
      }
    }
  }

  // ----- Flow -----

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Block Stacker',
      title: 'Stack it up',
      message: 'Clear rows by filling them from edge to edge. Press any arrow key or tap to begin.',
      actions: [{ label: 'Start', icon: 'play', onClick: () => start() }],
    });
  }

  function start() {
    if (ctx.status === 'running') return;
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function gameOver() {
    loop.stop();
    piece = null;
    ctx.setStatus('over');
    const { best, isNew } = ctx.storage.submitRecord('best', score);
    updateStats();
    render();
    ctx.overlay.show({
      kicker: 'Game over',
      title: `${score.toLocaleString('en-US')} points`,
      badge: isNew && score > 0 ? 'New best' : null,
      stats: [
        { label: 'Lines', value: lines },
        { label: 'Level', value: level },
        { label: 'Best', value: (best ?? 0).toLocaleString('en-US'), highlight: isNew && score > 0 },
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
  }

  // ----- Rendering -----

  function drawCell(x, y, color, alpha = 1) {
    g.globalAlpha = alpha;
    fillRoundRect(g, x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, 5, color);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(g, x * CELL + 4, y * CELL + 4, CELL - 8, (CELL - 8) / 2.6, 3);
    g.fill();
    g.globalAlpha = 1;
  }

  function drawPreview(type, x, y, size) {
    const matrix = SHAPES[type];
    const cells = [];
    matrix.forEach((row, ry) => row.forEach((v, rx) => v && cells.push([rx, ry])));
    const minX = Math.min(...cells.map((c) => c[0]));
    const maxX = Math.max(...cells.map((c) => c[0]));
    const minY = Math.min(...cells.map((c) => c[1]));
    const maxY = Math.max(...cells.map((c) => c[1]));
    const w = (maxX - minX + 1) * size;
    const h = (maxY - minY + 1) * size;
    for (const [cx, cy] of cells) {
      fillRoundRect(
        g,
        x - w / 2 + (cx - minX) * size + 1,
        y - h / 2 + (cy - minY) * size + 1,
        size - 2,
        size - 2,
        4,
        COLORS[type],
      );
    }
  }

  function render() {
    g.fillStyle = palette.sunken;
    g.fillRect(0, 0, WIDTH, BOARD_H);

    // Board background and faint grid
    fillRoundRect(g, 0, 0, BOARD_W, BOARD_H, 10, palette.cream);
    g.strokeStyle = 'rgba(34,33,31,0.045)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < COLS; x += 1) {
      g.moveTo(x * CELL + 0.5, 0);
      g.lineTo(x * CELL + 0.5, BOARD_H);
    }
    for (let y = 1; y < ROWS; y += 1) {
      g.moveTo(0, y * CELL + 0.5);
      g.lineTo(BOARD_W, y * CELL + 0.5);
    }
    g.stroke();

    if (!board) return;

    // Settled blocks
    const flashing = clearing ? new Set(clearing.rows) : null;
    board.forEach((row, y) =>
      row.forEach((type, x) => {
        if (!type) return;
        if (flashing?.has(y)) {
          const k = clearing.t / CLEAR_ANIMATION;
          fillRoundRect(g, x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, 5, palette.ink);
          drawCell(x, y, palette.cream, 1 - k);
        } else drawCell(x, y, COLORS[type]);
      }),
    );

    if (piece) {
      // Ghost piece shows where a hard drop would land.
      const ghost = dropPosition(board, piece);
      g.strokeStyle = COLORS[piece.type];
      g.lineWidth = 1.5;
      g.setLineDash([4, 3]);
      for (const { x, y } of cellsOf(ghost)) {
        if (y < 0) continue;
        roundRect(g, x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6, 4);
        g.stroke();
      }
      g.setLineDash([]);
      for (const { x, y } of cellsOf(piece)) if (y >= 0) drawCell(x, y, COLORS[piece.type]);
    }

    // Side panel
    g.fillStyle = palette.muted;
    g.font = font(12, 600);
    g.textAlign = 'left';
    g.fillText('NEXT', SIDE_X, 22);
    fillRoundRect(g, SIDE_X, 32, WIDTH - SIDE_X - 6, 96, 12, palette.cream);
    if (nextType) drawPreview(nextType, SIDE_X + (WIDTH - SIDE_X - 6) / 2, 80, 22);

    g.fillStyle = palette.muted;
    g.fillText('LEVEL', SIDE_X, 162);
    g.fillStyle = palette.ink;
    g.font = font(26, 650);
    g.fillText(String(level), SIDE_X, 192);

    // Progress toward the next level
    const progress = (lines % 10) / 10;
    fillRoundRect(g, SIDE_X, 206, WIDTH - SIDE_X - 6, 6, 3, palette.strong);
    if (progress > 0) fillRoundRect(g, SIDE_X, 206, (WIDTH - SIDE_X - 6) * progress, 6, 3, palette.accent);
    g.fillStyle = palette.muted;
    g.font = font(11, 500);
    g.fillText(`${10 - (lines % 10)} lines to go`, SIDE_X, 230);
  }

  view.onResize(() => render());

  reset();
  render();
  showStart();

  return {
    pause: () => {
      loop.stop();
      shift = null;
    },
    resume: () => loop.start(),
    restart,
    destroy: () => loop.stop(),
  };
}
