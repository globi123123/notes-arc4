/** Pairs: a memory card game with three board sizes. */

import { h } from '../../lib/dom.js';
import { formatClock } from '../../lib/format.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { segmented } from '../../ui/components.js';
import { SIZES, createDeck, isMatch } from './logic.js';

const C = {
  accent: '#c6613f',
  sage: '#7c8b6f',
  slate: '#5e7389',
  mustard: '#d2a44e',
  clay: '#a6714e',
  teal: '#5f8c88',
  rose: '#c98a80',
  ink: '#3a3835',
};

// Eighteen original symbols, each a distinct shape.
const SYMBOLS = [
  ['circle', `<circle cx="24" cy="24" r="13" fill="${C.sage}"/>`],
  ['square', `<rect x="12" y="12" width="24" height="24" rx="5" fill="${C.slate}"/>`],
  [
    'triangle',
    `<path d="M24 10 38 36H10Z" fill="${C.mustard}" stroke="${C.mustard}" stroke-width="3" stroke-linejoin="round"/>`,
  ],
  ['diamond', `<path d="M24 8 38 24 24 40 10 24Z" fill="${C.accent}"/>`],
  [
    'star',
    `<path d="m24 9 4.4 9.3 10.1 1.3-7.4 7 1.9 10L24 31.8 15 36.6l1.9-10-7.4-7 10.1-1.3Z" fill="${C.mustard}"/>`,
  ],
  ['hexagon', `<path d="M24 9 37 16.5v15L24 39 11 31.5v-15Z" fill="${C.teal}"/>`],
  ['ring', `<circle cx="24" cy="24" r="11" fill="none" stroke="${C.accent}" stroke-width="6"/>`],
  ['plus', `<path d="M24 11v26M11 24h26" stroke="${C.slate}" stroke-width="8" stroke-linecap="round"/>`],
  ['moon', `<path d="M30 10a14 14 0 1 0 8 23A12 12 0 0 1 30 10Z" fill="${C.clay}"/>`],
  ['drop', `<path d="M24 8c6 8 11 13.5 11 19.5a11 11 0 0 1-22 0C13 21.5 18 16 24 8Z" fill="${C.slate}"/>`],
  [
    'bolt',
    `<path d="M27 7 13 27h10l-3 14 15-21H25Z" fill="${C.accent}" stroke="${C.accent}" stroke-width="1.5" stroke-linejoin="round"/>`,
  ],
  [
    'leaf',
    `<path d="M11 37C11 22 20 12 37 11c0 17-9 26-26 26Z" fill="${C.sage}"/><path d="M12 36c6-8 12-13 20-18" stroke="#fbfaf7" stroke-width="2" stroke-linecap="round"/>`,
  ],
  [
    'wave',
    `<path d="M8 20c4-5 8-5 12 0s8 5 12 0 8-5 8-5M8 31c4-5 8-5 12 0s8 5 12 0 8-5 8-5" fill="none" stroke="${C.teal}" stroke-width="4.5" stroke-linecap="round"/>`,
  ],
  ['arch', `<path d="M10 38V25a14 14 0 0 1 28 0v13h-8V25a6 6 0 0 0-12 0v13Z" fill="${C.rose}"/>`],
  ['cross', `<path d="m13 13 22 22M35 13 13 35" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>`],
  [
    'flower',
    `<g fill="${C.rose}"><circle cx="24" cy="15" r="7"/><circle cx="33" cy="24" r="7"/><circle cx="24" cy="33" r="7"/><circle cx="15" cy="24" r="7"/></g><circle cx="24" cy="24" r="5" fill="${C.mustard}"/>`,
  ],
  [
    'half',
    `<path d="M10 28a14 14 0 0 1 28 0Z" fill="${C.clay}"/><rect x="10" y="31" width="28" height="5" rx="2.5" fill="${C.clay}"/>`,
  ],
  [
    'dots',
    `<g fill="${C.ink}"><circle cx="16" cy="16" r="4.5"/><circle cx="32" cy="16" r="4.5"/><circle cx="24" cy="24" r="4.5"/><circle cx="16" cy="32" r="4.5"/><circle cx="32" cy="32" r="4.5"/></g>`,
  ],
];

const symbolSvg = (index) => `<svg viewBox="0 0 48 48" aria-hidden="true">${SYMBOLS[index][1]}</svg>`;

export default function mount(ctx) {
  let sizeId = ctx.storage.getPref('size', '4x4');
  if (!SIZES[sizeId]) sizeId = '4x4';

  const sizeControl = segmented({
    label: 'Board size',
    value: sizeId,
    options: Object.entries(SIZES).map(([value, s]) => ({ value, label: `${s.label} ${value.replace('x', '×')}` })),
    onChange: (value) => {
      sizeId = value;
      ctx.storage.setPref('size', value);
      deal();
    },
  });
  ctx.toolbar.append(sizeControl);

  const grid = h('div', { class: 'pairs-grid' });
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  ctx.stage.append(h('div', { class: 'pairs' }, grid, live));

  let deck;
  let cards; // DOM elements
  let faceUp; // indices currently shown but not matched
  let matched;
  let moves;
  let startTime;
  let elapsed;
  let timer = 0;
  let flipBackTimer = 0;

  function deal() {
    stopTimer();
    clearTimeout(flipBackTimer);
    ctx.overlay.hide();
    const { cols, rows } = SIZES[sizeId];
    deck = createDeck((cols * rows) / 2, SYMBOLS.length);
    faceUp = [];
    matched = new Set();
    moves = 0;
    elapsed = 0;
    startTime = 0;
    grid.style.setProperty('--pairs-cols', cols);
    grid.style.setProperty('--pairs-rows', rows);
    grid.dataset.size = sizeId;
    grid.replaceChildren();
    cards = deck.map((card, index) => {
      const el = h(
        'button',
        {
          type: 'button',
          class: 'pairs-card',
          'aria-label': `Card ${index + 1}, face down`,
          dataset: { index: String(index) },
        },
        h(
          'span',
          { class: 'pairs-card__inner' },
          h('span', { class: 'pairs-card__back', 'aria-hidden': 'true' }),
          h('span', { class: 'pairs-card__face', html: symbolSvg(card.symbol) }),
        ),
      );
      grid.append(el);
      return el;
    });
    ctx.setStatus('running');
    updateStats();
    showRecords();
  }

  function updateStats() {
    const best = ctx.storage.getRecord(`moves-${sizeId}`);
    ctx.setStats({
      moves,
      pairs: `${matched.size / 2} / ${deck.length / 2}`,
      time: formatClock(elapsed),
      best: best ?? '–',
    });
  }

  function showRecords() {
    ctx.showRecords(
      Object.entries(SIZES).flatMap(([id, s]) => {
        const bestMoves = ctx.storage.getRecord(`moves-${id}`);
        const bestTime = ctx.storage.getRecord(`time-${id}`);
        return [
          {
            label: `${s.label}: moves / time`,
            value: bestMoves == null ? '–' : `${bestMoves} / ${formatClock(bestTime)}`,
          },
        ];
      }),
    );
  }

  function startTimer() {
    startTime = performance.now();
    timer = window.setInterval(() => {
      elapsed = (performance.now() - startTime) / 1000;
      ctx.setStats({ time: formatClock(elapsed) });
    }, 250);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = 0;
  }

  function setFace(index, up) {
    const el = cards[index];
    el.classList.toggle('is-up', up);
    const symbol = SYMBOLS[deck[index].symbol][0];
    el.setAttribute('aria-label', up ? `Card ${index + 1}, ${symbol}` : `Card ${index + 1}, face down`);
  }

  function hideMismatch() {
    clearTimeout(flipBackTimer);
    for (const i of faceUp) setFace(i, false);
    faceUp = [];
  }

  function flip(index) {
    if (matched.has(index) || faceUp.includes(index)) return;
    // A third click while a wrong pair is showing turns it back right away.
    if (faceUp.length === 2) hideMismatch();
    if (!timer && matched.size === 0 && moves === 0 && faceUp.length === 0) startTimer();

    setFace(index, true);
    faceUp.push(index);
    if (faceUp.length < 2) return;

    moves += 1;
    const [a, b] = faceUp;
    if (isMatch(deck[a], deck[b])) {
      matched.add(a);
      matched.add(b);
      cards[a].classList.add('is-matched');
      cards[b].classList.add('is-matched');
      faceUp = [];
      live.textContent = 'Match found';
      if (matched.size === deck.length) finish();
    } else {
      live.textContent = 'Not a match';
      flipBackTimer = window.setTimeout(hideMismatch, prefersReducedMotion() ? 700 : 900);
    }
    updateStats();
  }

  function finish() {
    stopTimer();
    elapsed = (performance.now() - startTime) / 1000;
    ctx.setStatus('over');
    const movesResult = ctx.storage.submitRecord(`moves-${sizeId}`, moves, { lowerIsBetter: true });
    const timeResult = ctx.storage.submitRecord(`time-${sizeId}`, Math.round(elapsed * 10) / 10, {
      lowerIsBetter: true,
    });
    updateStats();
    showRecords();
    window.setTimeout(() => {
      if (!ctx.isActive() || ctx.status !== 'over') return;
      ctx.overlay.show({
        kicker: 'All pairs found',
        title: `${moves} moves`,
        tone: 'success',
        light: true,
        badge: movesResult.isNew ? 'Fewest moves yet' : timeResult.isNew ? 'Fastest time yet' : null,
        stats: [
          { label: 'Time', value: formatClock(elapsed), highlight: timeResult.isNew },
          { label: 'Best moves', value: movesResult.best, highlight: movesResult.isNew },
        ],
        actions: [{ label: 'Deal again', icon: 'shuffle', onClick: deal }],
        suggest: true,
      });
    }, 500);
  }

  ctx.listen(grid, 'click', (event) => {
    const el = event.target instanceof Element ? event.target.closest('.pairs-card') : null;
    if (el) flip(Number(el.dataset.index));
  });

  deal();

  return {
    restart: deal,
    destroy() {
      stopTimer();
      clearTimeout(flipBackTimer);
    },
  };
}
