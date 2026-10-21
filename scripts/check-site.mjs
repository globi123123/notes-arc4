#!/usr/bin/env node
/**
 * Static checks for the deployable site in `site/`:
 *
 * - every file referenced from HTML, CSS and JS imports exists
 * - no root-absolute URLs (they break on GitHub Pages project sites,
 *   which are served from /<repo>/)
 * - every registered game has its module, optional stylesheet and artwork
 *
 * Exits with code 1 when a problem is found.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../site', import.meta.url)));
const problems = [];
const report = (file, message) => problems.push(`${relative(root, file) || file}: ${message}`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root);
const isExternal = (url) => /^(https?:|data:|mailto:|#|blob:)/.test(url);

function checkReference(from, url, kind) {
  if (!url || isExternal(url)) return;
  if (url.startsWith('/')) {
    report(from, `${kind} "${url}" is root-absolute and would break on a GitHub Pages project site`);
    return;
  }
  const clean = url.split(/[?#]/)[0];
  const target = resolve(dirname(from), clean);
  if (!target.startsWith(root)) report(from, `${kind} "${url}" points outside the site folder`);
  else if (!existsSync(target)) report(from, `${kind} "${url}" does not exist`);
}

// HTML: src and href attributes
for (const file of files.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)) checkReference(file, match[1], 'reference');
}

// CSS: url(...) and @import
for (const file of files.filter((f) => extname(f) === '.css')) {
  const css = readFileSync(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) checkReference(file, match[1], 'url()');
  for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) checkReference(file, match[1], '@import');
}

// JS: static and dynamic imports
for (const file of files.filter((f) => extname(f) === '.js')) {
  const js = readFileSync(file, 'utf8');
  const specifiers = [
    ...js.matchAll(/^\s*import\s[^'"]*?from\s+['"]([^'"]+)['"]/gm),
    ...js.matchAll(/^\s*export\s[^'"]*?from\s+['"]([^'"]+)['"]/gm),
    ...js.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]);
  for (const specifier of specifiers) {
    if (!/^[./]/.test(specifier))
      report(file, `import "${specifier}" is a bare specifier; browsers need a relative path`);
    else checkReference(file, specifier, 'import');
  }
}

// Game registry
const { games } = await import(pathToFileURL(join(root, 'js/games/registry.js')).href);
const { categories } = await import(pathToFileURL(join(root, 'js/data/categories.js')).href);
const { hasThumbnail } = await import(pathToFileURL(join(root, 'js/ui/thumbnails.js')).href);
const categoryIds = new Set(categories.map((c) => c.id));
const registry = join(root, 'js/games/registry.js');
const seen = new Set();

for (const game of games) {
  if (seen.has(game.id)) report(registry, `duplicate game id "${game.id}"`);
  seen.add(game.id);
  const folder = join(root, 'js/games', game.id);
  if (!existsSync(join(folder, 'index.js'))) report(registry, `game "${game.id}" has no index.js`);
  if (game.styles && !existsSync(join(folder, 'style.css')))
    report(registry, `game "${game.id}" declares styles but has no style.css`);
  if (!game.styles && existsSync(join(folder, 'style.css')))
    report(registry, `game "${game.id}" has a style.css but does not declare styles: true`);
  if (!hasThumbnail(game.id)) report(registry, `game "${game.id}" has no thumbnail illustration`);
  for (const c of game.categories)
    if (!categoryIds.has(c)) report(registry, `game "${game.id}" uses unknown category "${c}"`);
  const source = existsSync(join(folder, 'index.js')) ? readFileSync(join(folder, 'index.js'), 'utf8') : '';
  if (!/export default function/.test(source))
    report(registry, `game "${game.id}" must export a default mount function`);
}

// Folders in games/ that are not registered are probably forgotten.
for (const name of readdirSync(join(root, 'js/games'))) {
  const full = join(root, 'js/games', name);
  if (statSync(full).isDirectory() && !seen.has(name)) report(full, 'game folder is not listed in registry.js');
}

if (problems.length) {
  console.error(`Found ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`Site check passed: ${files.length} files, ${games.length} games, all references resolve.`);
