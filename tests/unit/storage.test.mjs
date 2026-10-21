import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, createPersistence, sanitize } from '../../site/js/lib/storage.js';

function memoryBackend(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

test('starts empty without stored data', () => {
  const store = createPersistence(memoryBackend());
  assert.deepEqual(store.getFavorites(), []);
  assert.equal(store.getRecord('snake'), null);
});

test('toggles favorites and persists them', () => {
  const backend = memoryBackend();
  const store = createPersistence(backend);
  assert.equal(store.toggleFavorite('snake'), true);
  assert.equal(store.isFavorite('snake'), true);
  const reloaded = createPersistence(backend);
  assert.deepEqual(reloaded.getFavorites(), ['snake']);
  assert.equal(reloaded.toggleFavorite('snake'), false);
  assert.deepEqual(reloaded.getFavorites(), []);
});

test('submitRecord keeps the best value in either direction', () => {
  const store = createPersistence(memoryBackend());
  assert.equal(store.submitRecord('snake', 'best', 10).isNew, true);
  assert.equal(store.submitRecord('snake', 'best', 5).isNew, false);
  assert.equal(store.getRecord('snake', 'best'), 10);

  assert.equal(store.submitRecord('sudoku', 'best-easy', 300, { lowerIsBetter: true }).isNew, true);
  assert.equal(store.submitRecord('sudoku', 'best-easy', 280, { lowerIsBetter: true }).isNew, true);
  assert.equal(store.submitRecord('sudoku', 'best-easy', 400, { lowerIsBetter: true }).isNew, false);
  assert.equal(store.getRecord('sudoku', 'best-easy'), 280);
});

test('ignores corrupted JSON', () => {
  const store = createPersistence(memoryBackend({ [STORAGE_KEY]: '{not json' }));
  assert.deepEqual(store.getFavorites(), []);
  store.toggleFavorite('pong');
  assert.deepEqual(store.getFavorites(), ['pong']);
});

test('sanitize drops invalid fields', () => {
  const clean = sanitize({
    favorites: ['snake', 3, null, 'snake'],
    records: { snake: { best: 12, bad: 'x', inf: Infinity }, broken: 4 },
    prefs: { pong: { skill: 'hard' }, nope: 5 },
  });
  assert.deepEqual(clean.favorites, ['snake']);
  assert.deepEqual(clean.records, { snake: { best: 12 } });
  assert.deepEqual(clean.prefs, { pong: { skill: 'hard' } });
  assert.deepEqual(sanitize(null).favorites, []);
  assert.deepEqual(sanitize([1, 2]).records, {});
});

test('keeps working when storage throws', () => {
  const backend = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => {},
  };
  const store = createPersistence(backend);
  store.toggleFavorite('snake');
  store.setPref('pong', 'skill', 'easy');
  assert.equal(store.isFavorite('snake'), true);
  assert.equal(store.getPref('pong', 'skill'), 'easy');
});

test('works without any backend', () => {
  const store = createPersistence(null);
  assert.equal(store.available, false);
  store.setRecord('echo', 'best', 7);
  assert.equal(store.getRecord('echo', 'best'), 7);
});

test('clearAll removes stored data', () => {
  const backend = memoryBackend();
  const store = createPersistence(backend);
  store.toggleFavorite('snake');
  store.clearAll();
  assert.deepEqual(store.getFavorites(), []);
  assert.equal(backend.getItem(STORAGE_KEY), null);
});
