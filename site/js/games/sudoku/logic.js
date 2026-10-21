/**
 * Sudoku generator and solver.
 *
 * Boards are arrays of 81 numbers (0 = empty). The solver uses bitmasks and
 * picks the cell with the fewest candidates first, which is fast enough to
 * check uniqueness after every removed clue while generating.
 */

export const DIFFICULTIES = {
  easy: { label: 'Easy', clues: 40 },
  medium: { label: 'Medium', clues: 32 },
  hard: { label: 'Hard', clues: 26 },
};

export const rowOf = (i) => Math.floor(i / 9);
export const colOf = (i) => i % 9;
export const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** For every cell, the 20 other cells in its row, column and box. */
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const peers = new Set();
  for (let j = 0; j < 81; j += 1) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) peers.add(j);
  }
  return [...peers];
});

const ALL = 0b1111111110; // bits 1-9

function bitCount(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count += 1;
  }
  return count;
}

function digitsOf(mask, rng) {
  const digits = [];
  for (let d = 1; d <= 9; d += 1) if (mask & (1 << d)) digits.push(d);
  if (rng) {
    for (let i = digits.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
  }
  return digits;
}

/**
 * Counts solutions up to `limit` and returns the first one found.
 * @returns {{ count: number, solution: number[] | null }}
 */
export function solve(board, { limit = 1, rng = null } = {}) {
  const cells = board.slice();
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);

  for (let i = 0; i < 81; i += 1) {
    const v = cells[i];
    if (!v) continue;
    const bit = 1 << v;
    // A given that repeats in its row, column or box has no solution.
    if (rows[rowOf(i)] & bit || cols[colOf(i)] & bit || boxes[boxOf(i)] & bit) return { count: 0, solution: null };
    rows[rowOf(i)] |= bit;
    cols[colOf(i)] |= bit;
    boxes[boxOf(i)] |= bit;
  }

  let count = 0;
  let solution = null;

  function search() {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (cells[i]) continue;
      const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = bitCount(mask);
      if (n === 0) return false;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count += 1;
      if (!solution) solution = cells.slice();
      return count >= limit;
    }
    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);
    for (const d of digitsOf(bestMask, rng)) {
      const bit = 1 << d;
      cells[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (search()) return true;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      cells[best] = 0;
    }
    return false;
  }

  search();
  return { count, solution };
}

export function generateSolved(rng = Math.random) {
  return solve(Array(81).fill(0), { rng }).solution;
}

/**
 * Creates a puzzle with exactly one solution. Clues are removed in
 * symmetric pairs; a removal is undone if it would allow a second solution.
 */
export function generatePuzzle(difficulty = 'easy', rng = Math.random) {
  const target = DIFFICULTIES[difficulty]?.clues ?? 40;
  const solution = generateSolved(rng);
  const puzzle = solution.slice();
  const order = Array.from({ length: 41 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let clues = 81;
  for (const i of order) {
    if (clues <= target) break;
    const mirror = 80 - i;
    const pair = i === mirror ? [i] : [i, mirror];
    const backup = pair.map((k) => puzzle[k]);
    pair.forEach((k) => (puzzle[k] = 0));
    if (solve(puzzle, { limit: 2 }).count === 1) clues -= pair.length;
    else pair.forEach((k, n) => (puzzle[k] = backup[n]));
  }
  return { puzzle, solution, clues };
}

/** Indices whose value repeats somewhere among their peers. */
export function findConflicts(values) {
  const conflicts = new Set();
  for (let i = 0; i < 81; i += 1) {
    const v = values[i];
    if (!v) continue;
    for (const p of PEERS[i]) {
      if (values[p] === v) {
        conflicts.add(i);
        conflicts.add(p);
      }
    }
  }
  return conflicts;
}

/** True when every cell is filled and the grid obeys all Sudoku rules. */
export function isSolved(values) {
  return values.every((v) => v >= 1 && v <= 9) && findConflicts(values).size === 0;
}
