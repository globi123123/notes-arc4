/**
 * Pure 2048 rules using tile objects, so the UI can animate each tile from
 * its old position to its new one.
 */

let nextId = 1;
const newId = () => nextId++;

export const SIZE = 4;
export const TARGET = 2048;

export function createGame({ size = SIZE, rng = Math.random } = {}) {
  return { size, tiles: [], score: 0, won: false, rng };
}

/** Builds a game from a 2D array of numbers (0 = empty). Useful for tests and saved games. */
export function fromGrid(rows, options = {}) {
  const game = createGame({ size: rows.length, ...options });
  rows.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value) game.tiles.push({ id: newId(), value, r, c });
    }),
  );
  return game;
}

export function toGrid(game) {
  const rows = Array.from({ length: game.size }, () => Array(game.size).fill(0));
  for (const tile of game.tiles) rows[tile.r][tile.c] = tile.value;
  return rows;
}

function emptyCells(game) {
  const taken = new Set(game.tiles.map((t) => `${t.r},${t.c}`));
  const cells = [];
  for (let r = 0; r < game.size; r += 1) {
    for (let c = 0; c < game.size; c += 1) if (!taken.has(`${r},${c}`)) cells.push({ r, c });
  }
  return cells;
}

export function addRandomTile(game) {
  const cells = emptyCells(game);
  if (!cells.length) return null;
  const { r, c } = cells[Math.floor(game.rng() * cells.length)];
  const tile = { id: newId(), value: game.rng() < 0.9 ? 2 : 4, r, c, isNew: true };
  game.tiles.push(tile);
  return tile;
}

/**
 * Slides every tile in a direction, merging equal neighbours once per move.
 * @param {'up'|'down'|'left'|'right'} dir
 * @returns {{ moved: boolean, gained: number, removed: object[], created: object[] }}
 */
export function move(game, dir) {
  const n = game.size;
  const grid = Array.from({ length: n }, () => Array(n).fill(null));
  for (const tile of game.tiles) {
    tile.isNew = false;
    tile.mergedFrom = null;
    grid[tile.r][tile.c] = tile;
  }

  // Position k along line i, ordered from the edge the tiles move toward.
  const at = (i, k) => {
    if (dir === 'left') return { r: i, c: k };
    if (dir === 'right') return { r: i, c: n - 1 - k };
    if (dir === 'up') return { r: k, c: i };
    return { r: n - 1 - k, c: i };
  };

  let moved = false;
  let gained = 0;
  const removed = [];
  const created = [];
  const survivors = [];

  for (let i = 0; i < n; i += 1) {
    let target = 0;
    let last = null; // last tile placed in this line
    let lastFromMerge = false;
    for (let k = 0; k < n; k += 1) {
      const { r, c } = at(i, k);
      const tile = grid[r][c];
      if (!tile) continue;

      if (last && !lastFromMerge && last.value === tile.value) {
        // Both tiles slide onto the same cell and are replaced by a merged tile.
        tile.r = last.r;
        tile.c = last.c;
        const merged = { id: newId(), value: tile.value * 2, r: last.r, c: last.c, mergedFrom: [last.id, tile.id] };
        removed.push(last, tile);
        survivors.splice(survivors.indexOf(last), 1, merged);
        created.push(merged);
        gained += merged.value;
        last = merged;
        lastFromMerge = true;
        moved = true;
      } else {
        const dest = at(i, target);
        target += 1;
        if (dest.r !== tile.r || dest.c !== tile.c) moved = true;
        tile.r = dest.r;
        tile.c = dest.c;
        survivors.push(tile);
        last = tile;
        lastFromMerge = false;
      }
    }
  }

  if (moved) {
    game.tiles = survivors;
    game.score += gained;
  }
  return { moved, gained, removed: moved ? removed : [], created: moved ? created : [] };
}

export function canMove(game) {
  if (game.tiles.length < game.size * game.size) return true;
  const grid = toGrid(game);
  for (let r = 0; r < game.size; r += 1) {
    for (let c = 0; c < game.size; c += 1) {
      if (c + 1 < game.size && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < game.size && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export const maxTile = (game) => game.tiles.reduce((max, t) => Math.max(max, t.value), 0);
