/**
 * App entry point: builds the page frame and switches between the library
 * and game views based on the URL hash.
 */

import { SITE, siteTitle } from './config.js';
import { h, toast } from './lib/dom.js';
import { isTypingTarget } from './lib/input.js';
import { persistence } from './lib/storage.js';
import { appState } from './state.js';
import { gameById } from './games/registry.js';
import { libraryHref, navigate, startRouter } from './router.js';
import { createHeader } from './ui/header.js';
import { createLibrary } from './ui/library.js';
import { createGameView } from './ui/gameShell.js';
import { syncFavoriteButtons } from './ui/gameCard.js';

const app = document.getElementById('app');

let route = null; // set by the first routing pass
let gameView = null;
let libraryScroll = 0;
let lastGameId = null;
// True when the current game was opened from inside the app, so "Back"
// can use history and keep the browser's back button meaningful.
let openedFromLibrary = false;

const header = createHeader({
  getRoute: () => route || { name: 'library' },
  onShowLibrary: showLibrary,
});

const library = createLibrary();
const main = h('main', { class: 'site-main', id: 'main', tabindex: '-1' });
main.append(library.element);

const footer = h(
  'footer',
  { class: 'site-footer' },
  h(
    'div',
    { class: 'container site-footer__inner' },
    h('p', null, h('span', { class: 'site-footer__brand' }, siteTitle()), ' Small games, made for the browser.'),
    h(
      'div',
      { class: 'site-footer__links' },
      h(
        'span',
        null,
        persistence.available
          ? 'Scores and favorites stay on this device.'
          : 'Storage is unavailable, progress lasts for this visit.',
      ),
      h('button', { type: 'button', class: 'link-button', onClick: clearData }, 'Clear saved data'),
    ),
  ),
);

const skipLink = h('a', { class: 'skip-link', href: '#main' }, 'Skip to content');
skipLink.addEventListener('click', (event) => {
  // The hash is reserved for routing, so move focus manually.
  event.preventDefault();
  main.focus();
});

app.replaceChildren(skipLink, header.element, main, footer);

function clearData() {
  if (!window.confirm(`Remove all favorites, records and settings saved by ${siteTitle()} on this device?`)) return;
  persistence.clearAll();
  toast('Saved data cleared');
}

persistence.subscribe(() => syncFavoriteButtons());

function showLibrary(options = {}) {
  if (route?.name !== 'library') navigate(libraryHref);
  if (options.scrollTop) window.scrollTo({ top: 0 });
  // Wait for the hash change to render the library before moving focus.
  if (options.focusResults) window.setTimeout(() => library.focusResults(), 60);
}

function goBack() {
  if (openedFromLibrary && window.history.length > 1) window.history.back();
  else navigate(libraryHref);
}

function renderRoute(next) {
  const previous = route || { name: 'initial' };
  route = next;

  if (gameView) {
    gameView.destroy();
    gameView.element.remove();
    gameView = null;
  }

  if (next.name === 'game') {
    const game = gameById(next.id);
    if (!game) {
      toast('That game could not be found');
      navigate(libraryHref);
      return;
    }
    openedFromLibrary = previous.name === 'library';
    if (openedFromLibrary) libraryScroll = window.scrollY;
    lastGameId = game.id;
    library.element.hidden = true;
    gameView = createGameView(game, { onBack: goBack });
    main.append(gameView.element);
    window.scrollTo({ top: 0 });
    gameView.focusTitle();
  } else {
    library.element.hidden = false;
    document.title = `${siteTitle()} ${SITE.tagline}`;
    if (previous.name === 'game') {
      const typing = isTypingTarget(document.activeElement);
      window.scrollTo({ top: typing ? 0 : libraryScroll });
      // Return focus to the card of the game the player just left, unless
      // the player is typing a search from the header.
      if (!typing && (!lastGameId || !library.focusCard(lastGameId))) main.focus({ preventScroll: true });
    }
    openedFromLibrary = false;
  }

  header.updateNav();
}

// Search typed while on a game page should bring the player to results.
appState.subscribe(() => header.updateNav());

startRouter(renderRoute);
