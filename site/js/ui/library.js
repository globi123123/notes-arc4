/** Library home screen: welcome, category tabs, results grid and empty states. */

import { SITE } from '../config.js';
import { h, clear } from '../lib/dom.js';
import { plural } from '../lib/format.js';
import { persistence } from '../lib/storage.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { appState } from '../state.js';
import { categories, categoryById } from '../data/categories.js';
import { filterGames, countByCategory } from '../data/filter.js';
import { games } from '../games/registry.js';
import { button, emptyState } from './components.js';
import { gameCard } from './gameCard.js';
import { icon } from './icons.js';

export function createLibrary() {
  const realCategories = categories.filter((c) => c.id !== 'all' && c.id !== 'favorites');

  // ----- Welcome -----
  const title = SITE.tagline.replace(/play\.$/, '<em>play</em>.');
  const welcome = h(
    'section',
    { class: 'welcome', 'aria-labelledby': 'welcome-title' },
    h(
      'div',
      null,
      h('h1', { class: 'welcome__title', id: 'welcome-title', html: title }),
      h('p', { class: 'welcome__subtitle' }, SITE.description),
    ),
    h(
      'dl',
      { class: 'welcome__meta' },
      h('div', null, h('dt', null, 'Games'), h('dd', null, String(games.length))),
      h('div', null, h('dt', null, 'Categories'), h('dd', null, String(realCategories.length))),
      h('div', null, h('dt', null, 'Favorites'), h('dd', { 'data-fav-count': '' }, '0')),
    ),
  );
  const favCount = welcome.querySelector('[data-fav-count]');

  // ----- Category tabs -----
  const tabButtons = new Map();
  const tabList = h('div', { class: 'categories__list', role: 'tablist', 'aria-label': 'Game categories' });
  for (const category of categories) {
    const count = h('span', { class: 'category-tab__count' }, '0');
    const tab = h(
      'button',
      {
        type: 'button',
        class: 'category-tab',
        role: 'tab',
        id: `tab-${category.id}`,
        'aria-controls': 'library-results',
        'aria-selected': 'false',
        tabindex: '-1',
        dataset: { category: category.id },
      },
      h('span', { html: icon(category.icon), style: { display: 'contents' } }),
      category.label,
      count,
    );
    tab.addEventListener('click', () => appState.set({ category: category.id }));
    tabButtons.set(category.id, { tab, count });
    tabList.append(tab);
  }

  // Arrow keys move between tabs (roving tabindex).
  tabList.addEventListener('keydown', (event) => {
    const ids = categories.map((c) => c.id);
    const index = ids.indexOf(appState.get().category);
    let next = null;
    if (event.key === 'ArrowRight') next = ids[(index + 1) % ids.length];
    if (event.key === 'ArrowLeft') next = ids[(index - 1 + ids.length) % ids.length];
    if (event.key === 'Home') next = ids[0];
    if (event.key === 'End') next = ids[ids.length - 1];
    if (!next) return;
    event.preventDefault();
    appState.set({ category: next });
    tabButtons.get(next).tab.focus();
  });

  const categoryNav = h('nav', { class: 'categories', 'aria-label': 'Categories' }, tabList);

  // ----- Results -----
  const resultsTitle = h('h2', { class: 'results-header__title', id: 'results-title', tabindex: '-1' });
  const resultsDesc = h('p', { class: 'results-header__desc' });
  const resultsCount = h('p', { class: 'results-header__count', 'aria-live': 'polite' });
  const grid = h('div', { class: 'card-grid' });
  const empty = h('div', { hidden: true });

  const results = h(
    'section',
    { class: 'library-results', id: 'library-results', role: 'tabpanel', 'aria-labelledby': 'results-title' },
    h('header', { class: 'results-header' }, h('div', null, resultsTitle, resultsDesc), resultsCount),
    grid,
    empty,
  );

  const element = h('div', { class: 'view library container' }, welcome, categoryNav, results);

  function renderEmpty({ category, query }) {
    clear(empty);
    const cat = categoryById(category);
    const clearSearch = () => appState.set({ query: '' });
    const showAll = () => appState.set({ category: 'all', query: '' });

    if (category === 'favorites' && !query) {
      empty.append(
        emptyState({
          title: 'No favorites yet',
          message: 'Tap the heart on any game card to keep it here for quick access.',
          actions: [button({ label: 'Browse all games', variant: 'dark', onClick: showAll })],
        }),
      );
      return;
    }

    const where = category === 'all' ? '' : ` in ${cat.label}`;
    const actions = [];
    if (query) actions.push(button({ label: 'Clear search', variant: 'dark', onClick: clearSearch }));
    if (category !== 'all') actions.push(button({ label: 'Show all games', onClick: showAll }));
    empty.append(
      emptyState({
        title: 'No games found',
        message: query
          ? `Nothing matches “${query}”${where}. Try another word or clear the filters.`
          : `Nothing here yet${where}.`,
        actions,
      }),
    );
  }

  let lastRenderKey = '';
  let recordsVersion = 0;

  function render() {
    const { category, query } = appState.get();
    const favorites = persistence.getFavorites();
    const list = filterGames(games, { category, query, favorites });
    const counts = countByCategory(
      games,
      categories.map((c) => c.id),
      { query, favorites },
    );

    for (const [id, { tab, count }] of tabButtons) {
      const selected = id === category;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      count.textContent = String(counts[id]);
    }

    const cat = categoryById(category) || categories[0];
    resultsTitle.textContent = query ? `Results for “${query.trim()}”` : cat.label;
    resultsDesc.textContent = query ? `Searching in ${cat.label}` : cat.description;
    resultsCount.textContent = plural(list.length, 'game');
    favCount.textContent = String(favorites.length);

    // Re-render cards only when the visible set changes, so focus and hover
    // states survive unrelated updates.
    const renderKey = `${list.map((g) => g.id).join(',')}|${favorites.join(',')}|${recordsVersion}`;
    if (renderKey !== lastRenderKey) {
      const focusedFavorite = document.activeElement?.dataset?.favorite;
      lastRenderKey = renderKey;
      clear(grid);
      grid.append(...list.map((game) => gameCard(game)));
      if (focusedFavorite) {
        const again = grid.querySelector(`[data-favorite="${CSS.escape(focusedFavorite)}"]`);
        if (again) again.focus({ preventScroll: true });
        else resultsTitle.focus({ preventScroll: true });
      }
    }

    grid.hidden = list.length === 0;
    empty.hidden = list.length > 0;
    if (list.length === 0) renderEmpty({ category, query });
  }

  appState.subscribe(render);
  persistence.subscribe((change) => {
    if (change.type === 'records' || change.type === 'reload') recordsVersion += 1;
    render();
  });
  render();

  return {
    element,
    render,
    focusResults() {
      resultsTitle.focus({ preventScroll: true });
      categoryNav.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    focusCard(id) {
      const link = grid.querySelector(`[data-game="${CSS.escape(id)}"] .game-card__link`);
      if (link) {
        link.focus({ preventScroll: true });
        return true;
      }
      return false;
    },
  };
}
