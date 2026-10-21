/** 2048: sliding tiles on a 4 x 4 grid, with the board saved between visits. */

import { h } from '../../lib/dom.js';
import { attachSwipe, createKeyboard } from '../../lib/input.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { TARGET, addRandomTile, canMove, createGame, fromGrid, maxTile, move, toGrid } from './logic.js';

const SLIDE_MS = 110;

export default function mount(ctx) {
  const tileLayer = h('div', { class: 't48-tiles' });
  const board = h(
    'div',
    { class: 't48-board', role: 'grid', 'aria-label': '2048 board' },
    h(
      'div',
      { class: 't48-grid', 'aria-hidden': 'true' },
      Array.from({ length: 16 }, () => h('span')),
    ),
    tileLayer,
  );
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const root = h(
    'div',
    { class: 't48' },
    board,
    h('p', { class: 't48-hint' }, 'Use the arrow keys or swipe on the board.'),
    live,
  );
  ctx.stage.append(root);

  const keys = createKeyboard(ctx);
  const elements = new Map(); // tile id -> element
  let game;
  let pending = null; // finishes the current animation early when needed
  let pendingTimer = 0;
  let keepPlaying = false;
  let locked = false; // true while an overlay is waiting for a decision

  // ----- Persistence -----

  function save() {
    ctx.storage.setPref('board', { grid: toGrid(game), score: game.score, won: game.won, keep: keepPlaying });
  }

  function load() {
    const saved = ctx.storage.getPref('board', null);
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== 4) return null;
    const valid = saved.grid.every(
      (row) => Array.isArray(row) && row.length === 4 && row.every((v) => Number.isInteger(v) && v >= 0),
    );
    if (!valid || saved.grid.flat().every((v) => v === 0)) return null;
    const restored = fromGrid(saved.grid);
    restored.score = Number(saved.score) || 0;
    restored.won = Boolean(saved.won);
    keepPlaying = Boolean(saved.keep);
    return restored;
  }

  // ----- Rendering -----

  function tileElement(tile) {
    const el = h('div', { class: 't48-tile' }, h('span', null, String(tile.value)));
    setTile(el, tile);
    tileLayer.append(el);
    elements.set(tile.id, el);
    return el;
  }

  function setTile(el, tile) {
    el.style.setProperty('--r', tile.r);
    el.style.setProperty('--c', tile.c);
    el.dataset.v = String(tile.value);
    el.dataset.digits = String(String(tile.value).length);
    el.classList.toggle('is-super', tile.value > 2048);
  }

  function renderAll() {
    tileLayer.replaceChildren();
    elements.clear();
    for (const tile of game.tiles) tileElement(tile);
  }

  function updateStats() {
    const best = Math.max(ctx.storage.getRecord('best') ?? 0, game.score);
    ctx.setStats({
      score: game.score.toLocaleString('en-US'),
      tile: maxTile(game),
      best: best.toLocaleString('en-US'),
    });
  }

  // ----- Moves -----

  function finishAnimation() {
    if (!pending) return;
    clearTimeout(pendingTimer);
    const run = pending;
    pending = null;
    run();
  }

  function play(dir) {
    if (locked) return;
    finishAnimation();
    const result = move(game, dir);
    if (!result.moved) return;

    // Slide existing tiles (including the ones about to merge).
    for (const tile of [...game.tiles, ...result.removed]) {
      const el = elements.get(tile.id);
      if (el) setTile(el, tile);
    }

    const spawned = addRandomTile(game);
    const finalize = () => {
      for (const tile of result.removed) {
        elements.get(tile.id)?.remove();
        elements.delete(tile.id);
      }
      for (const tile of result.created) tileElement(tile).classList.add('is-merged');
      if (spawned) tileElement(spawned).classList.add('is-new');
      afterMove(result);
    };

    if (prefersReducedMotion()) finalize();
    else {
      pending = finalize;
      pendingTimer = window.setTimeout(() => finishAnimation(), SLIDE_MS);
    }
    updateStats();
    save();
  }

  function afterMove(result) {
    if (result.gained) live.textContent = `Score ${game.score}`;
    const record = ctx.storage.submitRecord('best', game.score);
    updateStats();
    ctx.highlightStat('best', record.isNew && game.score > 0);

    if (!game.won && maxTile(game) >= TARGET) {
      game.won = true;
      save();
      locked = true;
      ctx.overlay.show({
        kicker: 'You did it',
        title: `You made ${TARGET}`,
        message: 'Keep going for an even bigger tile, or start fresh.',
        tone: 'success',
        light: true,
        stats: [{ label: 'Score', value: game.score.toLocaleString('en-US') }],
        actions: [
          {
            label: 'Keep going',
            onClick: () => {
              keepPlaying = true;
              locked = false;
              save();
              ctx.overlay.hide();
            },
          },
          { label: 'New game', icon: 'restart', onClick: () => restart() },
        ],
      });
      return;
    }

    if (!canMove(game)) gameOver();
  }

  function gameOver() {
    locked = true;
    ctx.setStatus('over');
    const { best, isNew } = ctx.storage.submitRecord('best', game.score);
    ctx.storage.setPref('board', null);
    ctx.overlay.show({
      kicker: 'No more moves',
      title: `${game.score.toLocaleString('en-US')} points`,
      badge: isNew && game.score > 0 ? 'New best' : null,
      light: true,
      stats: [
        { label: 'Top tile', value: maxTile(game) },
        { label: 'Best', value: (best ?? 0).toLocaleString('en-US'), highlight: isNew },
      ],
      actions: [{ label: 'Play again', icon: 'restart', onClick: () => restart() }],
      suggest: true,
      delay: 300,
    });
  }

  function restart() {
    finishAnimation();
    game = createGame();
    addRandomTile(game);
    addRandomTile(game);
    keepPlaying = false;
    locked = false;
    ctx.overlay.hide();
    ctx.setStatus('running');
    ctx.highlightStat('best', false);
    renderAll();
    for (const el of elements.values()) el.classList.add('is-new');
    updateStats();
    save();
  }

  // ----- Input -----

  for (const dir of ['up', 'down', 'left', 'right']) keys.on(dir, () => play(dir));
  attachSwipe(ctx, board, { onSwipe: (dir) => play(dir), threshold: 20 });

  // ----- Boot -----

  game = load();
  if (game) {
    ctx.setStatus('running');
    renderAll();
    updateStats();
    if (!canMove(game)) gameOver();
  } else restart();

  return {
    restart,
    destroy() {
      // The board was already saved when the move was made.
      clearTimeout(pendingTimer);
      pending = null;
    },
  };
}
