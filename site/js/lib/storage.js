/**
 * Versioned persistence on top of localStorage.
 *
 * Everything lives under one key as a small JSON document:
 *   { version, favorites: string[], records: { [gameId]: { [key]: number } }, prefs: { [scope]: object } }
 *
 * Reads are validated so missing, corrupted or foreign data never breaks the
 * site. When localStorage is unavailable (private mode, blocked cookies) the
 * same API keeps working in memory for the current visit.
 */

import { SITE } from '../config.js';

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = `${SITE.storageKey}:v${STORAGE_VERSION}`;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function defaultData() {
  return { version: STORAGE_VERSION, favorites: [], records: {}, prefs: {} };
}

/** Coerces any parsed value into a valid data document. */
export function sanitize(raw) {
  const data = defaultData();
  if (!isPlainObject(raw)) return data;

  if (Array.isArray(raw.favorites)) {
    data.favorites = [...new Set(raw.favorites.filter((id) => typeof id === 'string' && id.length < 64))];
  }

  if (isPlainObject(raw.records)) {
    for (const [gameId, record] of Object.entries(raw.records)) {
      if (!isPlainObject(record)) continue;
      const clean = {};
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
      }
      data.records[gameId] = clean;
    }
  }

  if (isPlainObject(raw.prefs)) {
    for (const [scope, prefs] of Object.entries(raw.prefs)) {
      if (isPlainObject(prefs)) data.prefs[scope] = { ...prefs };
    }
  }

  return data;
}

function detectBackend() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Creates a persistence instance. Accepts any object with getItem/setItem
 * (handy for tests); defaults to window.localStorage when available.
 */
export function createPersistence(backend = detectBackend()) {
  let data = load();
  const listeners = new Set();

  function load() {
    if (!backend) return defaultData();
    try {
      const text = backend.getItem(STORAGE_KEY);
      return text ? sanitize(JSON.parse(text)) : defaultData();
    } catch {
      return defaultData();
    }
  }

  function save() {
    if (!backend) return;
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded or storage revoked: keep working in memory.
    }
  }

  function emit(change) {
    for (const listener of listeners) listener(change);
  }

  const api = {
    get available() {
      return Boolean(backend);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Re-reads storage, e.g. after another tab changed it. */
    reload() {
      data = load();
      emit({ type: 'reload' });
    },

    // ----- Favorites -----
    getFavorites() {
      return [...data.favorites];
    },
    isFavorite(id) {
      return data.favorites.includes(id);
    },
    toggleFavorite(id) {
      const has = data.favorites.includes(id);
      data.favorites = has ? data.favorites.filter((f) => f !== id) : [...data.favorites, id];
      save();
      emit({ type: 'favorites', id, value: !has });
      return !has;
    },

    // ----- Records (best scores, best times, ...) -----
    getRecord(gameId, key = 'best') {
      const value = data.records[gameId]?.[key];
      return typeof value === 'number' ? value : null;
    },
    getRecords(gameId) {
      return { ...(data.records[gameId] || {}) };
    },
    setRecord(gameId, key, value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      data.records[gameId] = { ...(data.records[gameId] || {}), [key]: value };
      save();
      emit({ type: 'records', gameId, key, value });
    },
    /**
     * Stores `value` if it beats the previous record.
     * @returns {{ best: number, isNew: boolean, previous: number | null }}
     */
    submitRecord(gameId, key, value, { lowerIsBetter = false } = {}) {
      const previous = api.getRecord(gameId, key);
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { best: previous, isNew: false, previous };
      }
      const better = previous == null || (lowerIsBetter ? value < previous : value > previous);
      if (better) api.setRecord(gameId, key, value);
      return { best: better ? value : previous, isNew: better, previous };
    },

    // ----- Preferences -----
    getPref(scope, key, fallback = null) {
      const value = data.prefs[scope]?.[key];
      return value === undefined ? fallback : value;
    },
    setPref(scope, key, value) {
      data.prefs[scope] = { ...(data.prefs[scope] || {}), [key]: value };
      save();
    },

    /** Removes everything this site stored. */
    clearAll() {
      data = defaultData();
      if (backend) {
        try {
          backend.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      emit({ type: 'reload' });
    },
  };

  return api;
}

/** Shared instance used by the app. */
export const persistence = createPersistence();

if (typeof window !== 'undefined') {
  // Keep tabs in sync when favorites or records change elsewhere.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) persistence.reload();
  });
}
