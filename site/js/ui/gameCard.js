/** Game card used in the library grid and in "Play something else". */

import { h } from '../lib/dom.js';
import { formatRecord } from '../lib/format.js';
import { persistence } from '../lib/storage.js';
import { categoryLabel } from '../data/categories.js';
import { gameHref } from '../router.js';
import { difficultyBadge } from './components.js';
import { icon } from './icons.js';
import { thumbnail } from './thumbnails.js';

function favoriteLabel(game, on) {
  return on ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`;
}

function recordText(game) {
  if (!game.record) return null;
  const value = persistence.getRecord(game.id, game.record.key);
  if (value == null) return null;
  return h(
    'span',
    { class: 'game-card__record' },
    `${game.record.label} `,
    h('strong', null, formatRecord(value, game.record.format)),
  );
}

/**
 * @param {object} game registry entry
 * @param {{ compact?: boolean, headingLevel?: number }} [options]
 */
export function gameCard(game, { headingLevel = 3 } = {}) {
  const isFav = persistence.isFavorite(game.id);

  const favButton = h('button', {
    type: 'button',
    class: 'fav-btn',
    'aria-pressed': String(isFav),
    'aria-label': favoriteLabel(game, isFav),
    title: isFav ? 'Remove from favorites' : 'Add to favorites',
    dataset: { favorite: game.id },
    html: icon('heart'),
  });
  favButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    persistence.toggleFavorite(game.id);
  });

  return h(
    'article',
    { class: 'game-card', dataset: { game: game.id } },
    h('div', { class: 'game-card__media', html: thumbnail(game.id) }),
    favButton,
    h(
      'div',
      { class: 'game-card__body' },
      h(
        'div',
        { class: 'game-card__meta' },
        h('span', { class: 'tag' }, categoryLabel(game.categories[0])),
        difficultyBadge(game.difficulty, game.difficultyLabel),
      ),
      h(
        `h${headingLevel}`,
        { class: 'game-card__title' },
        h('a', { class: 'game-card__link', href: gameHref(game.id) }, game.title),
      ),
      h('p', { class: 'game-card__desc' }, game.description),
      h(
        'div',
        { class: 'game-card__footer' },
        h('span', { class: 'game-card__play', 'aria-hidden': 'true', html: `${icon('play')}Play` }),
        recordText(game),
      ),
    ),
  );
}

/** Keeps every favorite toggle on the page in sync with storage. */
export function syncFavoriteButtons(root = document) {
  for (const el of root.querySelectorAll('[data-favorite]')) {
    const id = el.dataset.favorite;
    const on = persistence.isFavorite(id);
    el.setAttribute('aria-pressed', String(on));
    const title = el.closest('[data-game]')?.querySelector('.game-card__link')?.textContent || el.dataset.title || id;
    el.setAttribute('aria-label', on ? `Remove ${title} from favorites` : `Add ${title} to favorites`);
    el.title = on ? 'Remove from favorites' : 'Add to favorites';
  }
}
