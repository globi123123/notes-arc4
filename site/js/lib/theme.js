/**
 * Light / dark theme. The active theme lives on <html data-theme="...">;
 * every color in the CSS comes from tokens that switch with it. A tiny
 * inline script in index.html applies the saved theme before first paint,
 * this module handles switching and remembering it afterwards.
 */

import { SITE } from '../config.js';

export const THEME_KEY = `${SITE.storageKey}:theme`;
export const THEMES = ['dark', 'light'];
export const DEFAULT_THEME = 'dark';
const EVENT = 'playground:themechange';
const META_COLORS = { dark: '#1d1c1a', light: '#f5f4ef' };

const root = () => document.documentElement;

export function getTheme() {
  return root().dataset.theme === 'light' ? 'light' : 'dark';
}

export function readSavedTheme() {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

export function forgetTheme() {
  try {
    globalThis.localStorage?.removeItem(THEME_KEY);
  } catch {
    // ignore
  }
}

/** Applies a theme without saving it. */
function applyTheme(theme) {
  const el = root();
  // Suppress hover transitions for one frame so everything switches together.
  el.classList.add('theme-switching');
  el.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('theme-switching')));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { theme } }));
}

/** Applies a theme immediately and remembers it. */
export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  applyTheme(next);
  saveTheme(next);
  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/** Makes sure <html> carries a valid theme (in case the inline script did not run). */
export function initTheme() {
  const theme = readSavedTheme() || (THEMES.includes(root().dataset.theme) ? root().dataset.theme : DEFAULT_THEME);
  root().dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
  return theme;
}

if (typeof window !== 'undefined') {
  // Keep every open tab on the same theme.
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY && THEMES.includes(event.newValue) && event.newValue !== getTheme()) {
      applyTheme(event.newValue);
    }
  });
}

/** Calls `listener(theme)` whenever the theme changes. Returns an unsubscribe function. */
export function onThemeChange(listener) {
  const handler = (event) => listener(event.detail.theme);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
