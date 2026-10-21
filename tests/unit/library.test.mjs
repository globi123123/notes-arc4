import { test } from 'node:test';
import assert from 'node:assert/strict';
import { games, gameById } from '../../site/js/games/registry.js';
import { categories } from '../../site/js/data/categories.js';
import { countByCategory, filterGames, matchesQuery, normalize } from '../../site/js/data/filter.js';
import { hasThumbnail } from '../../site/js/ui/thumbnails.js';
import { parseHash, gameHref } from '../../site/js/router.js';

const ids = (list) => list.map((g) => g.id);

test('registry has unique, URL-safe ids and complete metadata', () => {
  const seen = new Set();
  const validCategories = new Set(categories.map((c) => c.id));
  for (const game of games) {
    assert.match(game.id, /^[\w-]+$/);
    assert.ok(!seen.has(game.id), `duplicate id ${game.id}`);
    seen.add(game.id);
    assert.ok(game.title && game.description && game.howTo, `${game.id} text`);
    assert.ok(game.categories.length > 0, `${game.id} categories`);
    for (const c of game.categories) {
      assert.ok(validCategories.has(c) && c !== 'all' && c !== 'favorites', `${game.id} category ${c}`);
    }
    assert.ok([1, 2, 3].includes(game.difficulty), `${game.id} difficulty`);
    assert.ok(game.stats.length > 0, `${game.id} stats`);
    assert.equal(typeof game.load, 'function');
    assert.ok(hasThumbnail(game.id), `${game.id} thumbnail`);
  }
});

test('the required games are all registered', () => {
  for (const id of [
    'snake',
    'blocks',
    '2048',
    'minesweeper',
    'breakout',
    'updraft',
    'lane-splitter',
    'asteroid-belt',
    'dune-runner',
    'word-rain',
    'pairs',
    'sudoku',
  ]) {
    assert.ok(gameById(id), `missing ${id}`);
  }
});

test('"all" shows every game', () => {
  assert.equal(filterGames(games, { category: 'all' }).length, games.length);
});

test('categories filter by membership', () => {
  const classics = filterGames(games, { category: 'classics' });
  assert.ok(classics.length > 0);
  assert.ok(classics.every((g) => g.categories.includes('classics')));
  assert.deepEqual(ids(filterGames(games, { category: 'racing' })), ['lane-splitter']);
});

test('favorites category shows saved games only', () => {
  assert.deepEqual(filterGames(games, { category: 'favorites', favorites: [] }), []);
  assert.deepEqual(ids(filterGames(games, { category: 'favorites', favorites: ['pong', 'snake'] })).sort(), [
    'pong',
    'snake',
  ]);
});

test('search respects the selected category', () => {
  assert.deepEqual(ids(filterGames(games, { category: 'classics', query: 'snake' })), ['snake']);
  assert.deepEqual(filterGames(games, { category: 'arcade', query: 'snake' }), []);
  assert.deepEqual(ids(filterGames(games, { category: 'all', query: 'motorcycle' })), ['lane-splitter']);
});

test('search matches tags, all terms and ignores case and accents', () => {
  assert.equal(normalize('  Café '), 'cafe');
  assert.ok(matchesQuery(gameById('word-rain'), 'TYPING'));
  assert.ok(matchesQuery(gameById('lane-splitter'), 'moto traffic'));
  assert.ok(!matchesQuery(gameById('lane-splitter'), 'moto sudoku'));
  assert.ok(matchesQuery(gameById('snake'), ''));
});

test('counts per category follow the query', () => {
  const counts = countByCategory(
    games,
    categories.map((c) => c.id),
    { query: 'snake', favorites: [] },
  );
  assert.equal(counts.all, 1);
  assert.equal(counts.classics, 1);
  assert.equal(counts.arcade, 0);
  assert.equal(counts.favorites, 0);
});

test('hash routes', () => {
  assert.deepEqual(parseHash(''), { name: 'library' });
  assert.deepEqual(parseHash('#/'), { name: 'library' });
  assert.deepEqual(parseHash('#/play/snake'), { name: 'game', id: 'snake' });
  assert.deepEqual(parseHash(gameHref('lane-splitter')), { name: 'game', id: 'lane-splitter' });
  assert.deepEqual(parseHash('#/play/../x'), { name: 'library' });
  assert.deepEqual(parseHash('#main'), { name: 'library' });
});
