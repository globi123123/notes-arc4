/**
 * In-memory UI state for the library (selected category and search text).
 * It survives navigating into a game and back, so the library looks the way
 * the player left it.
 */

const state = {
  category: 'all',
  query: '',
};

const listeners = new Set();

export const appState = {
  get() {
    return { ...state };
  },
  set(patch) {
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (state[key] !== value) {
        state[key] = value;
        changed = true;
      }
    }
    if (changed) for (const listener of listeners) listener({ ...state });
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
