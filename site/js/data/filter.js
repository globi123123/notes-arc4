/**
 * Pure filtering logic for the library: category membership, favorites and
 * free-text search. Kept DOM-free so it can be unit tested in Node.
 */

import { categoryLabel } from './categories.js';

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function haystack(game) {
  return normalize(
    [game.title, game.description, ...(game.tags || []), ...game.categories.map(categoryLabel)].join(' '),
  );
}

/** Every whitespace-separated term in the query must appear somewhere. */
export function matchesQuery(game, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = haystack(game);
  return terms.every((term) => text.includes(term));
}

export function inCategory(game, category, favorites = []) {
  if (!category || category === 'all') return true;
  if (category === 'favorites') return favorites.includes(game.id);
  return game.categories.includes(category);
}

/** Games in the selected category that also match the search query. */
export function filterGames(games, { category = 'all', query = '', favorites = [] } = {}) {
  return games.filter((game) => inCategory(game, category, favorites) && matchesQuery(game, query));
}

/** Number of matching games per category, respecting the current query. */
export function countByCategory(games, categoryIds, { query = '', favorites = [] } = {}) {
  const counts = {};
  for (const id of categoryIds) counts[id] = filterGames(games, { category: id, query, favorites }).length;
  return counts;
}
