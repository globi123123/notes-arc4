/** Sudoku: generated puzzles, notes, conflict highlighting, undo and saved progress. */

import { h } from '../../lib/dom.js';
import { formatClock } from '../../lib/format.js';
import { isTypingTarget } from '../../lib/input.js';
import { button, segmented } from '../../ui/components.js';
import { icon } from '../../ui/icons.js';
import { DIFFICULTIES, boxOf, colOf, findConflicts, generatePuzzle, isSolved, rowOf } from './logic.js';

export default function mount(ctx) {
  let difficulty = ctx.storage.getPref('difficulty', 'easy');
  if (!DIFFICULTIES[difficulty]) difficulty = 'easy';

  let puzzle; // givens, 0 = empty
  let solution;
  let entries; // player values
  let notes; // bitmask of candidate digits per cell
  let selected = 40;
  let notesMode = false;
  let history = [];
  let elapsed = 0;
  let timerStart = 0;
  let timer = 0;
  let solved = false;

  // ----- Toolbar -----
  const difficultyControl = segmented({
    label: 'Difficulty',
    value: difficulty,
    options: Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: d.label })),
    onChange: (value) => {
      difficulty = value;
      ctx.storage.setPref('difficulty', value);
      newPuzzle();
    },
  });
  const newButton = button({ label: 'New puzzle', icon: 'dice', size: 'sm', onClick: () => newPuzzle() });
  ctx.toolbar.append(difficultyControl, newButton);

  // ----- Board -----
  const board = h('div', { class: 'sdk-board', role: 'grid', 'aria-label': 'Sudoku board' });
  const cells = Array.from({ length: 81 }, (_, i) => {
    const el = h('button', {
      type: 'button',
      class: 'sdk-cell',
      role: 'gridcell',
      tabindex: i === selected ? '0' : '-1',
      dataset: { i: String(i), row: String(rowOf(i)), col: String(colOf(i)) },
    });
    board.append(el);
    return el;
  });

  // ----- Number pad -----
  const digitButtons = [];
  const pad = h('div', { class: 'sdk-pad', role: 'group', 'aria-label': 'Number pad' });
  for (let d = 1; d <= 9; d += 1) {
    const el = h(
      'button',
      { type: 'button', class: 'sdk-key', 'aria-label': `Enter ${d}` },
      h('span', null, String(d)),
      h('small', null, '9'),
    );
    el.addEventListener('click', () => input(d));
    digitButtons.push(el);
    pad.append(el);
  }
  const notesButton = h('button', {
    type: 'button',
    class: 'sdk-tool',
    'aria-pressed': 'false',
    html: `${icon('pencil')}<span>Notes</span>`,
  });
  notesButton.addEventListener('click', () => toggleNotes());
  const eraseButton = h('button', { type: 'button', class: 'sdk-tool', html: `${icon('eraser')}<span>Erase</span>` });
  eraseButton.addEventListener('click', () => erase());
  const undoButton = h('button', { type: 'button', class: 'sdk-tool', html: `${icon('undo')}<span>Undo</span>` });
  undoButton.addEventListener('click', () => undo());
  const tools = h('div', { class: 'sdk-tools' }, notesButton, eraseButton, undoButton);

  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const loading = h('p', { class: 'sdk-loading', hidden: true }, 'Generating a fresh puzzle…');
  ctx.stage.append(
    h(
      'div',
      { class: 'sdk' },
      h('div', { class: 'sdk-board-wrap' }, board, loading),
      h('div', { class: 'sdk-side' }, tools, pad),
      live,
    ),
  );

  // ----- State helpers -----

  const valueAt = (i) => puzzle[i] || entries[i];
  const values = () => Array.from({ length: 81 }, (_, i) => valueAt(i));

  function save() {
    ctx.storage.setPref('current', {
      difficulty,
      puzzle: puzzle.join(''),
      solution: solution.join(''),
      entries: entries.join(''),
      notes: [...notes],
      elapsed: Math.round(currentElapsed()),
      solved,
    });
  }

  function restore() {
    const saved = ctx.storage.getPref('current', null);
    const valid =
      saved &&
      DIFFICULTIES[saved.difficulty] &&
      /^[0-9]{81}$/.test(saved.puzzle) &&
      /^[1-9]{81}$/.test(saved.solution) &&
      /^[0-9]{81}$/.test(saved.entries) &&
      Array.isArray(saved.notes) &&
      saved.notes.length === 81 &&
      !saved.solved;
    if (!valid) return false;
    difficulty = saved.difficulty;
    difficultyControl.setValue(difficulty);
    puzzle = [...saved.puzzle].map(Number);
    solution = [...saved.solution].map(Number);
    entries = [...saved.entries].map(Number);
    notes = saved.notes.map((n) => (Number.isInteger(n) ? n & 0b1111111110 : 0));
    elapsed = Number(saved.elapsed) || 0;
    solved = false;
    history = [];
    return true;
  }

  // ----- Timer -----

  const currentElapsed = () => elapsed + (timer ? (performance.now() - timerStart) / 1000 : 0);

  function startTimer() {
    if (timer || solved) return;
    timerStart = performance.now();
    timer = window.setInterval(() => ctx.setStats({ time: formatClock(currentElapsed()) }), 500);
  }

  function stopTimer() {
    if (!timer) return;
    elapsed = currentElapsed();
    clearInterval(timer);
    timer = 0;
  }

  // ----- Rendering -----

  function render() {
    const vals = values();
    const conflicts = findConflicts(vals);
    const sel = selected;
    const selValue = vals[sel];

    cells.forEach((el, i) => {
      const v = vals[i];
      const given = Boolean(puzzle[i]);
      el.className = 'sdk-cell';
      if (given) el.classList.add('is-given');
      else if (v) el.classList.add('is-entry');
      if (i === sel) el.classList.add('is-selected');
      else if (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel))
        el.classList.add('is-peer');
      if (selValue && v === selValue && i !== sel) el.classList.add('is-same');
      if (conflicts.has(i)) el.classList.add('is-conflict');
      el.tabIndex = i === sel ? 0 : -1;

      if (v) {
        el.textContent = String(v);
      } else if (notes[i]) {
        el.replaceChildren(
          h(
            'span',
            { class: 'sdk-notes', 'aria-hidden': 'true' },
            Array.from({ length: 9 }, (_, k) => h('span', null, notes[i] & (1 << (k + 1)) ? String(k + 1) : '')),
          ),
        );
      } else el.textContent = '';

      const position = `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
      el.setAttribute(
        'aria-label',
        v ? `${position}, ${v}${given ? ', given' : ''}${conflicts.has(i) ? ', conflict' : ''}` : `${position}, empty`,
      );
    });

    // Remaining count per digit on the number pad
    const counts = Array(10).fill(0);
    vals.forEach((v) => (counts[v] += 1));
    digitButtons.forEach((el, k) => {
      const left = 9 - counts[k + 1];
      el.querySelector('small').textContent = left > 0 ? String(left) : '';
      el.classList.toggle('is-done', left <= 0);
    });

    notesButton.setAttribute('aria-pressed', String(notesMode));
    undoButton.disabled = history.length === 0;
    updateStats();
  }

  function updateStats() {
    const filled = values().filter(Boolean).length;
    ctx.setStats({
      time: formatClock(currentElapsed()),
      filled: `${filled} / 81`,
      best: formatClock(ctx.storage.getRecord(`best-${difficulty}`)),
    });
  }

  function showRecords() {
    ctx.showRecords(
      Object.entries(DIFFICULTIES).map(([id, d]) => ({
        label: d.label,
        value: formatClock(ctx.storage.getRecord(`best-${id}`)),
      })),
    );
  }

  // ----- Actions -----

  function select(i, focus = false) {
    selected = Math.max(0, Math.min(80, i));
    render();
    if (focus) cells[selected].focus({ preventScroll: true });
  }

  function record(i) {
    history.push({ i, entry: entries[i], notes: notes[i] });
    if (history.length > 200) history.shift();
  }

  function input(d) {
    if (solved || puzzle[selected]) return;
    if (notesMode && entries[selected]) return;
    startTimer();
    record(selected);
    if (notesMode) {
      notes[selected] ^= 1 << d;
    } else {
      entries[selected] = entries[selected] === d ? 0 : d;
      notes[selected] = 0;
      // Placing a number clears it from the notes of its peers.
      if (entries[selected]) {
        for (let j = 0; j < 81; j += 1) {
          if (
            j !== selected &&
            (rowOf(j) === rowOf(selected) || colOf(j) === colOf(selected) || boxOf(j) === boxOf(selected))
          ) {
            notes[j] &= ~(1 << d);
          }
        }
      }
    }
    render();
    save();
    checkSolved();
  }

  function erase() {
    if (solved || puzzle[selected] || (!entries[selected] && !notes[selected])) return;
    record(selected);
    entries[selected] = 0;
    notes[selected] = 0;
    render();
    save();
  }

  function undo() {
    if (solved) return;
    const last = history.pop();
    if (!last) return;
    entries[last.i] = last.entry;
    notes[last.i] = last.notes;
    selected = last.i;
    render();
    save();
  }

  function toggleNotes() {
    notesMode = !notesMode;
    render();
  }

  function checkSolved() {
    const vals = values();
    if (!vals.every(Boolean)) return;
    if (!isSolved(vals)) {
      live.textContent = 'The grid is full, but some numbers clash.';
      return;
    }
    solved = true;
    stopTimer();
    ctx.setStatus('over');
    const time = Math.round(elapsed);
    const { best, isNew } = ctx.storage.submitRecord(`best-${difficulty}`, time, { lowerIsBetter: true });
    save();
    render();
    showRecords();
    board.classList.add('is-solved');
    ctx.overlay.show({
      kicker: 'Solved',
      title: `Finished in ${formatClock(time)}`,
      tone: 'success',
      light: true,
      badge: isNew ? 'New best time' : null,
      stats: [
        { label: 'Difficulty', value: DIFFICULTIES[difficulty].label },
        { label: 'Best', value: formatClock(best), highlight: isNew },
      ],
      actions: [{ label: 'New puzzle', icon: 'dice', onClick: () => newPuzzle() }],
      suggest: true,
      delay: 300,
    });
  }

  function beginPuzzle() {
    history = [];
    solved = false;
    notesMode = false;
    board.classList.remove('is-solved');
    selected = puzzle.findIndex((v) => v === 0);
    if (selected < 0) selected = 40;
    ctx.overlay.hide();
    ctx.setStatus('running');
    render();
    showRecords();
    startTimer();
  }

  function newPuzzle() {
    stopTimer();
    loading.hidden = false;
    board.classList.add('is-loading');
    // Let the loading state paint before the (short) generation work.
    window.setTimeout(() => {
      if (!ctx.isActive()) return;
      const generated = generatePuzzle(difficulty);
      puzzle = generated.puzzle;
      solution = generated.solution;
      entries = Array(81).fill(0);
      notes = Array(81).fill(0);
      elapsed = 0;
      loading.hidden = true;
      board.classList.remove('is-loading');
      beginPuzzle();
      save();
    }, 30);
  }

  function restartPuzzle() {
    if (!puzzle) return;
    stopTimer();
    entries = Array(81).fill(0);
    notes = Array(81).fill(0);
    elapsed = 0;
    beginPuzzle();
    save();
  }

  // ----- Input -----

  ctx.listen(board, 'click', (event) => {
    const el = event.target instanceof Element ? event.target.closest('.sdk-cell') : null;
    if (el) select(Number(el.dataset.i));
  });

  ctx.listen(window, 'keydown', (event) => {
    if (!ctx.isActive() || !puzzle || isTypingTarget(event.target)) return;
    if (event.target instanceof Element && event.target.closest('.site-header, .overlay')) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[event.key]) {
      event.preventDefault();
      const r = rowOf(selected);
      const c = colOf(selected);
      if (event.key === 'ArrowUp') select(((r + 8) % 9) * 9 + c, true);
      if (event.key === 'ArrowDown') select(((r + 1) % 9) * 9 + c, true);
      if (event.key === 'ArrowLeft') select(r * 9 + ((c + 8) % 9), true);
      if (event.key === 'ArrowRight') select(r * 9 + ((c + 1) % 9), true);
      return;
    }

    const digit = /^(Digit|Numpad)([1-9])$/.exec(event.code)?.[2] ?? (/^[1-9]$/.test(event.key) ? event.key : null);
    if (digit) {
      event.preventDefault();
      input(Number(digit));
    } else if (['Backspace', 'Delete'].includes(event.key) || event.code === 'Digit0' || event.code === 'Numpad0') {
      event.preventDefault();
      erase();
    } else if (event.code === 'KeyN') {
      event.preventDefault();
      toggleNotes();
    }
  });

  // The clock only runs while the page is visible.
  ctx.listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      stopTimer();
      if (puzzle) save();
    } else if (puzzle && !solved) startTimer();
  });

  if (restore()) beginPuzzleRestored();
  else newPuzzle();

  function beginPuzzleRestored() {
    selected = puzzle.findIndex((v, i) => v === 0 && !entries[i]);
    if (selected < 0) selected = 40;
    ctx.setStatus('running');
    render();
    showRecords();
    startTimer();
  }

  return {
    restart: restartPuzzle,
    destroy() {
      stopTimer();
      if (puzzle) save();
    },
  };
}
