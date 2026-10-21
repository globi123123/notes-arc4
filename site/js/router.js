/**
 * Hash-based routing. GitHub Pages has no server-side fallback for client
 * routes, so every view lives behind the `#` and the site works from any
 * base path (for example https://user.github.io/repo/).
 *
 *   #/              library
 *   #/play/<id>     a game
 */

export const libraryHref = '#/';
export const gameHref = (id) => `#/play/${encodeURIComponent(id)}`;

export function parseHash(hash) {
  const path = decodeURIComponent(String(hash || '').replace(/^#/, '')) || '/';
  const match = path.match(/^\/play\/([\w-]+)\/?$/);
  if (match) return { name: 'game', id: match[1] };
  return { name: 'library' };
}

export function startRouter(onRoute) {
  const handle = () => onRoute(parseHash(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
}

export function navigate(href) {
  if (window.location.hash === href) return;
  window.location.hash = href;
}
