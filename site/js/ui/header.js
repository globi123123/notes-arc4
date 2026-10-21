/** Site header: brand, compact navigation, search and the game count. */

import { SITE } from '../config.js';
import { h } from '../lib/dom.js';
import { isTypingTarget } from '../lib/input.js';
import { appState } from '../state.js';
import { games } from '../games/registry.js';
import { libraryHref, navigate, gameHref } from '../router.js';
import { icon } from './icons.js';

export function createHeader({ getRoute, onShowLibrary }) {
  const input = h('input', {
    class: 'search__input',
    type: 'search',
    id: 'site-search',
    placeholder: 'Search games',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Search games',
    enterkeyhint: 'search',
  });

  const clearButton = h('button', {
    type: 'button',
    class: 'search__clear',
    'aria-label': 'Clear search',
    html: icon('close'),
    hidden: true,
  });

  const hint = h('span', { class: 'search__hint', 'aria-hidden': 'true' }, h('kbd', null, '/'));

  const libraryLink = h(
    'a',
    { class: 'site-nav__link', href: libraryHref, dataset: { nav: 'library' } },
    h('span', { html: icon('library'), style: { display: 'contents' } }),
    'Library',
  );
  const favoritesLink = h(
    'a',
    { class: 'site-nav__link', href: libraryHref, dataset: { nav: 'favorites' } },
    h('span', { html: icon('heart'), style: { display: 'contents' } }),
    'Favorites',
  );
  const randomButton = h(
    'button',
    { type: 'button', class: 'site-nav__link', title: 'Play a random game' },
    h('span', { html: icon('shuffle'), style: { display: 'contents' } }),
    h('span', { class: 'site-nav__label-long' }, 'Random'),
    h('span', { class: 'visually-hidden' }, ' game'),
  );

  const header = h(
    'header',
    { class: 'site-header' },
    h(
      'div',
      { class: 'container site-header__inner' },
      h(
        'a',
        { class: 'brand', href: libraryHref, 'aria-label': `${SITE.name}${SITE.mark} home` },
        SITE.name,
        h('span', { class: 'brand__mark' }, SITE.mark),
      ),
      h('nav', { class: 'site-nav', 'aria-label': 'Main' }, libraryLink, favoritesLink, randomButton),
      h(
        'div',
        { class: 'site-header__tools' },
        h(
          'div',
          { class: 'search site-header__search', role: 'search' },
          h('span', { html: icon('search'), style: { display: 'contents' } }),
          input,
          hint,
          clearButton,
        ),
        h(
          'span',
          { class: 'count-pill', title: 'Games in the library' },
          h('span', { class: 'count-pill__dot', 'aria-hidden': 'true' }),
          `${games.length} games`,
        ),
      ),
    ),
  );
  header.querySelector('.search svg').classList.add('search__icon');

  function syncInput() {
    const { query } = appState.get();
    if (input.value !== query) input.value = query;
    clearButton.hidden = query.length === 0;
    hint.hidden = query.length > 0;
  }

  input.addEventListener('input', () => {
    appState.set({ query: input.value });
    if (getRoute().name !== 'library') onShowLibrary();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (input.value) {
        event.preventDefault();
        appState.set({ query: '' });
      } else input.blur();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('library-results')?.scrollIntoView({ block: 'start' });
    }
  });

  clearButton.addEventListener('click', () => {
    appState.set({ query: '' });
    input.focus();
  });

  libraryLink.addEventListener('click', (event) => {
    event.preventDefault();
    if (appState.get().category === 'favorites') appState.set({ category: 'all' });
    onShowLibrary({ scrollTop: true });
  });

  favoritesLink.addEventListener('click', (event) => {
    event.preventDefault();
    appState.set({ category: 'favorites' });
    onShowLibrary({ focusResults: true });
  });

  randomButton.addEventListener('click', () => {
    const route = getRoute();
    const pool = games.filter((g) => g.id !== route.id);
    navigate(gameHref(pool[Math.floor(Math.random() * pool.length)].id));
  });

  // "/" focuses search from anywhere, unless the user is typing.
  window.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    input.focus();
    input.select();
  });

  // Hairline under the header once the page scrolls.
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  appState.subscribe(() => {
    syncInput();
    updateNav();
  });

  function updateNav() {
    const route = getRoute();
    const { category } = appState.get();
    const onLibrary = route.name === 'library';
    libraryLink.toggleAttribute('aria-current', false);
    favoritesLink.toggleAttribute('aria-current', false);
    if (onLibrary && category === 'favorites') favoritesLink.setAttribute('aria-current', 'page');
    else if (onLibrary) libraryLink.setAttribute('aria-current', 'page');
  }

  syncInput();
  return { element: header, updateNav, focusSearch: () => input.focus() };
}
