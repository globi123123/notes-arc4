/**
 * Shared game page. Builds the consistent layout around every game (back
 * link, title, stats, stage, controls panel, suggestions), loads the game
 * module and hands it a `ctx` object with everything it needs.
 *
 * Game module contract (games/<id>/index.js):
 *
 *   export default function mount(ctx) {
 *     // draw into ctx.stage, report stats with ctx.setStats(...)
 *     return { pause(), resume(), restart(), destroy() }; // all optional
 *   }
 *
 * The shell guarantees cleanup: listeners added through ctx.listen and
 * callbacks registered with ctx.onDestroy run when the player leaves.
 */

import { siteTitle } from '../config.js';
import { h, clear } from '../lib/dom.js';
import { formatRecord } from '../lib/format.js';
import { isTypingTarget } from '../lib/input.js';
import { persistence } from '../lib/storage.js';
import { categoryLabel } from '../data/categories.js';
import { games } from '../games/registry.js';
import { gameHref, libraryHref } from '../router.js';
import { button, createOverlay, difficultyBadge, setButtonLabel, stat } from './components.js';
import { gameCard } from './gameCard.js';
import { icon } from './icons.js';

const loadedStyles = new Map();

/** Loads a game's stylesheet once and resolves when it has applied. */
function loadStylesheet(href) {
  if (!loadedStyles.has(href)) {
    loadedStyles.set(
      href,
      new Promise((resolve) => {
        const link = h('link', { rel: 'stylesheet', href });
        link.addEventListener('load', () => resolve());
        link.addEventListener('error', () => resolve());
        document.head.append(link);
      }),
    );
  }
  return loadedStyles.get(href);
}

/** Picks a few other games, preferring the same category. */
function suggestionsFor(game, count = 4) {
  const index = games.indexOf(game);
  const rotated = [...games.slice(index + 1), ...games.slice(0, index)];
  const same = rotated.filter((g) => g.categories.some((c) => game.categories.includes(c)));
  const other = rotated.filter((g) => !same.includes(g));
  return [...same.slice(0, 2), ...other, ...same.slice(2)].slice(0, count);
}

/**
 * @param {object} game registry entry
 * @param {{ onBack: () => void }} options
 */
export function createGameView(game, { onBack }) {
  let instance = null;
  let destroyed = false;
  let status = 'idle';
  const cleanups = [];

  // ----- Layout -----
  const backButton = button({ label: 'Back to library', icon: 'arrowLeft', variant: 'ghost', href: libraryHref });
  backButton.classList.add('back-link');
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    onBack();
  });

  const pauseButton = button({ label: 'Pause', icon: 'pause', onClick: () => togglePause() });
  pauseButton.hidden = !game.pausable;
  pauseButton.disabled = true;

  const restartButton = button({ label: 'Restart', icon: 'restart', onClick: () => restart() });

  const favButton = h('button', {
    type: 'button',
    class: 'btn btn-icon',
    'aria-pressed': String(persistence.isFavorite(game.id)),
    'aria-label': `Add ${game.title} to favorites`,
    title: 'Add to favorites',
    dataset: { favorite: game.id, title: game.title },
    html: icon('heart'),
  });
  favButton.classList.add('fav-toggle');
  favButton.addEventListener('click', () => persistence.toggleFavorite(game.id));

  const title = h('h1', { class: 'game-heading__title', tabindex: '-1' }, game.title);

  const statsList = h('dl', { class: 'stats', 'aria-label': 'Game statistics' });
  const statValues = new Map();
  for (const { key, label } of game.stats || []) {
    const el = stat(label, '–');
    statValues.set(key, el);
    statsList.append(el);
  }

  const toolbar = h('div', { class: 'game-toolbar' });
  const stageClasses = ['stage'];
  if (game.stage === 'plain') stageClasses.push('is-plain');
  if (game.stage === 'flush') stageClasses.push('is-flush', 'is-plain');
  const stage = h(
    'div',
    { class: stageClasses.join(' '), tabindex: '-1' },
    h('p', { class: 'game-loading' }, 'Loading…'),
  );
  const controlsSlot = h('div', { class: 'game-controls-slot' });

  const recordList = h('ul', { class: 'record-list' });
  const recordsPanel = h('section', { class: 'panel' }, h('h2', { class: 'panel__title' }, 'Your records'), recordList);

  const controlsPanel = h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'panel__title' }, 'Controls'),
    h(
      'ul',
      { class: 'controls-list' },
      (game.controls || []).map(({ keys, action }) =>
        h(
          'li',
          null,
          h('span', { class: 'controls-list__action' }, action),
          h(
            'span',
            { class: 'controls-list__keys' },
            keys.map((k) => h('kbd', null, k)),
          ),
        ),
      ),
    ),
  );

  const howToPanel = h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'panel__title' }, 'How to play'),
    h('p', null, game.howTo),
  );

  const suggestions = suggestionsFor(game);
  const moreGames = h(
    'section',
    { class: 'more-games', 'aria-labelledby': 'more-games-title' },
    h(
      'div',
      { class: 'more-games__header' },
      h('h2', { class: 'more-games__title', id: 'more-games-title' }, 'Play something else'),
      h('a', { class: 'more-games__link', href: libraryHref }, 'All games'),
    ),
    h(
      'div',
      { class: 'card-grid is-compact' },
      suggestions.map((g) => gameCard(g)),
    ),
  );

  const element = h(
    'div',
    { class: 'view game-view container', dataset: { game: game.id } },
    h(
      'div',
      { class: 'game-topbar' },
      backButton,
      h('div', { class: 'game-topbar__actions' }, pauseButton, restartButton, favButton),
    ),
    h(
      'div',
      { class: 'game-heading' },
      h(
        'div',
        { class: 'game-heading__text' },
        h(
          'div',
          { class: 'game-heading__eyebrow' },
          h('span', { class: 'eyebrow' }, game.categories.map(categoryLabel).join(' · ')),
          h('span', { class: 'dot', 'aria-hidden': 'true' }),
          difficultyBadge(game.difficulty, game.difficultyLabel),
        ),
        title,
        h('p', { class: 'game-heading__desc' }, game.description),
      ),
    ),
    h(
      'div',
      { class: 'game-layout' },
      h('div', { class: 'game-main' }, h('div', { class: 'game-statbar' }, statsList, toolbar), stage, controlsSlot),
      h('aside', { class: 'game-aside', 'aria-label': 'Game information' }, controlsPanel, howToPanel, recordsPanel),
    ),
    moreGames,
  );

  // ----- Overlay -----
  const overlay = createOverlay(stage, {
    onHidden(hadFocus) {
      if (hadFocus || document.activeElement === document.body) stage.focus({ preventScroll: true });
    },
    renderSuggestion() {
      const next = suggestions[0];
      return h('p', { class: 'overlay__suggest' }, 'Or try ', h('a', { href: gameHref(next.id) }, next.title));
    },
  });

  // ----- Records panel -----
  let customRecords = null;
  function renderRecords() {
    clear(recordList);
    const rows = customRecords
      ? customRecords
      : game.record
        ? [
            {
              label: game.record.label,
              value: formatRecord(persistence.getRecord(game.id, game.record.key), game.record.format),
            },
          ]
        : [];
    for (const row of rows)
      recordList.append(h('li', null, h('span', null, row.label), h('strong', null, row.value ?? '–')));
    if (!rows.length) recordList.append(h('li', null, h('span', null, 'Play a round to set a record.')));
  }
  renderRecords();

  // ----- Context for the game -----
  const ctx = {
    game,
    stage,
    toolbar,
    controlsSlot,
    overlay,

    /** Adds an event listener that is removed automatically on exit. */
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    },
    onDestroy(fn) {
      cleanups.push(fn);
    },
    isActive: () => !destroyed,

    setStats(values) {
      for (const [key, value] of Object.entries(values)) {
        const el = statValues.get(key);
        if (el) el.querySelector('dd').textContent = value ?? '–';
      }
    },
    /** Briefly highlights a stat, for example a new best score. */
    highlightStat(key, on = true) {
      statValues.get(key)?.classList.toggle('is-highlight', on);
    },

    /** 'idle' | 'running' | 'paused' | 'over' — drives the Pause button. */
    setStatus(next) {
      status = next;
      pauseButton.disabled = !(status === 'running' || status === 'paused');
      setButtonLabel(pauseButton, status === 'paused' ? 'Resume' : 'Pause', status === 'paused' ? 'play' : 'pause');
    },
    get status() {
      return status;
    },

    storage: {
      getRecord: (key = 'best') => persistence.getRecord(game.id, key),
      submitRecord: (key, value, options) => {
        const result = persistence.submitRecord(game.id, key, value, options);
        renderRecords();
        return result;
      },
      getPref: (key, fallback) => persistence.getPref(game.id, key, fallback),
      setPref: (key, value) => persistence.setPref(game.id, key, value),
    },

    /** Replaces the "Your records" panel rows: [{ label, value }]. */
    showRecords(rows) {
      customRecords = rows;
      renderRecords();
    },

    pause: () => pause(),
    resume: () => resume(),
  };

  // ----- Pause / resume / restart -----
  function pause() {
    if (!game.pausable || status !== 'running' || !instance) return;
    instance.pause?.();
    ctx.setStatus('paused');
    overlay.show({
      kicker: 'Paused',
      title: 'Take your time',
      message: 'The game is waiting for you.',
      actions: [
        { label: 'Resume', icon: 'play', onClick: resume },
        { label: 'Restart', icon: 'restart', onClick: restart },
      ],
    });
  }

  function resume() {
    if (status !== 'paused' || !instance) return;
    overlay.hide();
    ctx.setStatus('running');
    instance.resume?.();
  }

  function togglePause() {
    if (status === 'paused') resume();
    else pause();
  }

  function restart() {
    if (!instance) return;
    overlay.hide();
    instance.restart?.();
    stage.focus({ preventScroll: true });
  }

  // Pause when the tab is hidden or the window loses focus.
  ctx.listen(document, 'visibilitychange', () => {
    if (document.hidden) pause();
  });
  ctx.listen(window, 'blur', () => pause());

  ctx.listen(window, 'keydown', (event) => {
    if (!game.pausable || event.ctrlKey || event.metaKey || event.altKey) return;
    const isEscape = event.key === 'Escape';
    if (!isEscape && (event.code !== 'KeyP' || isTypingTarget(event.target))) return;
    if (isEscape && event.target instanceof Element && event.target.closest('.site-header')) return;
    if (status === 'running' || status === 'paused') {
      event.preventDefault();
      togglePause();
    }
  });

  const unsubscribe = persistence.subscribe(() => renderRecords());
  cleanups.push(unsubscribe);

  // ----- Boot -----
  async function start() {
    document.title = `${game.title} · ${siteTitle()}`;
    try {
      if (game.styles) await loadStylesheet(new URL(`../games/${game.id}/style.css`, import.meta.url).href);
      const module = await game.load();
      if (destroyed) return;
      clear(stage);
      instance = module.default(ctx) || {};
    } catch (error) {
      console.error(error);
      if (destroyed) return;
      clear(stage);
      stage.append(
        h(
          'p',
          { class: 'game-error', role: 'alert' },
          'This game could not be loaded. Please check your connection and try again.',
        ),
      );
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try {
      instance?.destroy?.();
    } catch (error) {
      console.error(error);
    }
    overlay.destroy();
    while (cleanups.length) {
      try {
        cleanups.pop()();
      } catch (error) {
        console.error(error);
      }
    }
  }

  start();

  return {
    element,
    destroy,
    focusTitle: () => title.focus({ preventScroll: true }),
  };
}
