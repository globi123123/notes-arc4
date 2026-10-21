/** Minesweeper: three difficulties, flags, chording, long-press and keyboard play. */

import { h } from '../../lib/dom.js';
import { formatClock } from '../../lib/format.js';
import { segmented } from '../../ui/components.js';
import { icon } from '../../ui/icons.js';
import { LEVELS, chord, createBoard, reveal, toggleFlag } from './logic.js';

const LONG_PRESS_MS = 420;
const MIN_CELL = 26;
const MAX_CELL = 38;

const FLAG_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7.5 4.5h10l-2.4 3.8 2.4 3.7H7.5Z" fill="currentColor"/></svg>';
const MINE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.2" fill="currentColor"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10.3" cy="10.3" r="1.3" fill="#fff" opacity=".8"/></svg>';

export default function mount(ctx) {
  let levelId = ctx.storage.getPref('level', 'beginner');
  if (!LEVELS[levelId]) levelId = 'beginner';

  let board;
  let cellsEl = [];
  let focusIndex = 0;
  let flagMode = false;
  let startTime = 0;
  let elapsed = 0;
  let timer = 0;
  let endTimer = 0;

  // ----- Toolbar -----
  const levelControl = segmented({
    label: 'Difficulty',
    value: levelId,
    options: Object.entries(LEVELS).map(([value, l]) => ({ value, label: l.label })),
    onChange: (value) => {
      levelId = value;
      ctx.storage.setPref('level', value);
      newGame();
    },
  });

  const flagToggle = h('button', {
    type: 'button',
    class: 'btn btn-sm',
    'aria-pressed': 'false',
    title: 'When on, tapping a cell places a flag',
    html: `${icon('flag')}<span>Flag mode</span>`,
  });
  flagToggle.addEventListener('click', () => {
    flagMode = !flagMode;
    flagToggle.setAttribute('aria-pressed', String(flagMode));
  });
  ctx.toolbar.append(levelControl, flagToggle);

  // ----- Board -----
  const grid = h('div', { class: 'ms-grid', role: 'grid', 'aria-label': 'Minefield' });
  const scroller = h('div', { class: 'ms-scroller' }, grid);
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  ctx.stage.append(h('div', { class: 'ms' }, scroller, live));

  const GRID_GAP = 2;
  const GRID_CHROME = 8 * 2 + 2 + 4; // grid padding, border and scroller padding

  /** Largest cell size that fits `cols` columns into the stage. */
  function fittingCell(cols) {
    const style = getComputedStyle(ctx.stage);
    const inner = ctx.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.floor((inner - GRID_CHROME - GRID_GAP * (cols - 1)) / cols);
  }

  /** Uses a portrait layout for wide boards on narrow screens. */
  function dimensions() {
    const level = LEVELS[levelId];
    const fitsWide = fittingCell(level.cols) >= MIN_CELL;
    if (!fitsWide && level.cols > level.rows) return { cols: level.rows, rows: level.cols };
    return { cols: level.cols, rows: level.rows };
  }

  function sizeCells() {
    if (!board) return;
    // Boards that cannot fit at the minimum size scroll inside their frame.
    const size = Math.max(MIN_CELL, Math.min(MAX_CELL, fittingCell(board.cols)));
    grid.style.setProperty('--ms-cell', `${size}px`);
    grid.style.setProperty('--ms-cols', board.cols);
  }

  function newGame() {
    stopTimer();
    clearTimeout(endTimer);
    ctx.overlay.hide();
    const { cols, rows } = dimensions();
    board = createBoard(cols, rows, LEVELS[levelId].mines);
    elapsed = 0;
    focusIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    grid.replaceChildren();
    cellsEl = board.cells.map((_, i) => {
      const el = h('button', {
        type: 'button',
        class: 'ms-cell',
        role: 'gridcell',
        tabindex: i === focusIndex ? '0' : '-1',
        dataset: { i: String(i) },
        'aria-label': cellLabel(i),
      });
      grid.append(el);
      return el;
    });
    sizeCells();
    ctx.setStatus('running');
    updateStats();
    showRecords();
  }

  function cellLabel(i) {
    const cell = board.cells[i];
    const x = (i % board.cols) + 1;
    const y = Math.floor(i / board.cols) + 1;
    let state = 'hidden';
    if (cell.flagged) state = 'flagged';
    else if (cell.revealed) state = cell.mine ? 'mine' : cell.adjacent ? `${cell.adjacent}` : 'empty';
    return `Row ${y}, column ${x}, ${state}`;
  }

  function paint(i) {
    const cell = board.cells[i];
    const el = cellsEl[i];
    const over = board.state === 'lost';
    el.className = 'ms-cell';
    el.innerHTML = '';
    if (cell.revealed && !cell.mine) {
      el.classList.add('is-open');
      if (cell.adjacent) {
        el.textContent = String(cell.adjacent);
        el.dataset.n = String(cell.adjacent);
      }
    } else if (cell.flagged) {
      el.classList.add('is-flag');
      if (over && !cell.mine) el.classList.add('is-wrong');
      el.innerHTML = FLAG_SVG;
    } else if (over && cell.mine) {
      el.classList.add('is-open', 'is-mine');
      if (i === board.exploded) el.classList.add('is-exploded');
      el.innerHTML = MINE_SVG;
    }
    el.setAttribute('aria-label', cellLabel(i));
  }

  function paintAll() {
    board.cells.forEach((_, i) => paint(i));
  }

  // ----- Timer and stats -----

  function startTimer() {
    startTime = performance.now();
    timer = window.setInterval(tick, 250);
  }

  function stopTimer() {
    if (timer) {
      elapsed = (performance.now() - startTime) / 1000;
      clearInterval(timer);
      timer = 0;
    }
  }

  function tick() {
    elapsed = (performance.now() - startTime) / 1000;
    ctx.setStats({ time: formatClock(elapsed) });
  }

  function updateStats() {
    ctx.setStats({
      mines: board.mines - board.flags,
      time: formatClock(elapsed),
      best: formatClock(ctx.storage.getRecord(`best-${levelId}`)),
    });
  }

  function showRecords() {
    ctx.showRecords(
      Object.entries(LEVELS).map(([id, l]) => ({
        label: l.label,
        value: formatClock(ctx.storage.getRecord(`best-${id}`)),
      })),
    );
  }

  // ----- Actions -----

  function act(i, mode) {
    if (board.state === 'won' || board.state === 'lost') return;
    const cell = board.cells[i];
    const wasReady = board.state === 'ready';
    let changed = [];

    if (mode === 'flag') {
      if (cell.revealed) changed = chord(board, i);
      else if (toggleFlag(board, i)) changed = [i];
    } else if (cell.revealed) {
      changed = chord(board, i);
    } else {
      changed = reveal(board, i);
    }

    if (wasReady && board.state !== 'ready') startTimer();
    if (board.state === 'lost') {
      paintAll();
      lose();
    } else if (board.state === 'won') {
      paintAll();
      win();
    } else changed.forEach(paint);
    updateStats();
  }

  function win() {
    stopTimer();
    ctx.setStatus('over');
    const time = Math.round(elapsed * 10) / 10;
    const { best, isNew } = ctx.storage.submitRecord(`best-${levelId}`, time, { lowerIsBetter: true });
    updateStats();
    showRecords();
    live.textContent = 'Field cleared';
    endTimer = window.setTimeout(() => {
      ctx.overlay.show({
        kicker: 'Field cleared',
        title: `Cleared in ${formatClock(time)}`,
        tone: 'success',
        light: true,
        badge: isNew ? 'New best time' : null,
        stats: [
          { label: 'Level', value: LEVELS[levelId].label },
          { label: 'Best', value: formatClock(best), highlight: isNew },
        ],
        actions: [{ label: 'Play again', icon: 'restart', onClick: () => newGame() }],
        suggest: true,
      });
    }, 500);
  }

  function lose() {
    stopTimer();
    ctx.setStatus('over');
    live.textContent = 'You hit a mine';
    endTimer = window.setTimeout(() => {
      ctx.overlay.show({
        kicker: 'Boom',
        title: 'You hit a mine',
        message: 'Every field is solvable from the first click. Give it another go.',
        light: true,
        actions: [{ label: 'Try again', icon: 'restart', onClick: () => newGame() }],
        suggest: true,
      });
    }, 750);
  }

  // ----- Pointer input -----

  let pressTimer = 0;
  let suppressClick = false;
  let pressStart = null;
  let lastPointer = 'mouse';

  const indexOf = (target) => {
    const el = target instanceof Element ? target.closest('.ms-cell') : null;
    return el ? Number(el.dataset.i) : -1;
  };

  ctx.listen(grid, 'pointerdown', (event) => {
    const i = indexOf(event.target);
    if (i < 0) return;
    suppressClick = false;
    lastPointer = event.pointerType;
    setFocus(i, false);
    if (event.pointerType === 'mouse') return;
    pressStart = { x: event.clientX, y: event.clientY };
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      suppressClick = true;
      navigator.vibrate?.(12);
      act(i, 'flag');
    }, LONG_PRESS_MS);
  });

  const cancelPress = () => clearTimeout(pressTimer);
  ctx.listen(grid, 'pointerup', cancelPress);
  ctx.listen(grid, 'pointercancel', cancelPress);
  ctx.listen(grid, 'pointermove', (event) => {
    if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) cancelPress();
  });

  ctx.listen(grid, 'click', (event) => {
    const i = indexOf(event.target);
    if (i < 0) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    // Keyboard activation is handled in keydown.
    if (event.detail === 0) return;
    act(i, flagMode ? 'flag' : 'reveal');
  });

  ctx.listen(grid, 'contextmenu', (event) => {
    event.preventDefault();
    const i = indexOf(event.target);
    // A touch long-press may already have placed the flag.
    if (i < 0 || suppressClick) return;
    clearTimeout(pressTimer);
    act(i, 'flag');
    suppressClick = lastPointer !== 'mouse';
  });

  ctx.listen(grid, 'auxclick', (event) => {
    if (event.button !== 1) return;
    const i = indexOf(event.target);
    if (i >= 0 && board.cells[i].revealed) act(i, 'reveal');
  });

  // ----- Keyboard input (roving focus) -----

  function setFocus(i, move = true) {
    if (!cellsEl[i]) return;
    cellsEl[focusIndex].tabIndex = -1;
    focusIndex = i;
    cellsEl[i].tabIndex = 0;
    if (move) cellsEl[i].focus();
  }

  ctx.listen(grid, 'keydown', (event) => {
    const x = focusIndex % board.cols;
    const y = Math.floor(focusIndex / board.cols);
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      const nx = Math.min(board.cols - 1, Math.max(0, x + dx));
      const ny = Math.min(board.rows - 1, Math.max(0, y + dy));
      setFocus(ny * board.cols + nx);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      act(focusIndex, flagMode ? 'flag' : 'reveal');
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      act(focusIndex, 'flag');
    }
  });

  ctx.listen(window, 'resize', sizeCells);
  const observer = new ResizeObserver(() => sizeCells());
  observer.observe(ctx.stage);

  newGame();

  return {
    restart: newGame,
    destroy() {
      stopTimer();
      clearTimeout(endTimer);
      clearTimeout(pressTimer);
      observer.disconnect();
    },
  };
}
