/** Pure Minesweeper rules: mine placement, flood fill, flags, chording, win/loss. */

export const LEVELS = {
  beginner: { label: 'Beginner', cols: 9, rows: 9, mines: 10 },
  intermediate: { label: 'Intermediate', cols: 16, rows: 16, mines: 40 },
  expert: { label: 'Expert', cols: 30, rows: 16, mines: 99 },
};

export function createBoard(cols, rows, mines) {
  return {
    cols,
    rows,
    mines,
    cells: Array.from({ length: cols * rows }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })),
    placed: false,
    revealed: 0,
    flags: 0,
    state: 'ready', // ready | playing | won | lost
    exploded: -1,
  };
}

export function neighbors(board, index) {
  const x = index % board.cols;
  const y = Math.floor(index / board.cols);
  const list = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < board.cols && ny < board.rows) list.push(ny * board.cols + nx);
    }
  }
  return list;
}

/** Places mines after the first click so it (and, if possible, its neighbours) is safe. */
export function placeMines(board, safeIndex, rng = Math.random) {
  const total = board.cols * board.rows;
  let excluded = new Set([safeIndex, ...neighbors(board, safeIndex)]);
  if (total - excluded.size < board.mines) excluded = new Set([safeIndex]);
  const candidates = [];
  for (let i = 0; i < total; i += 1) if (!excluded.has(i)) candidates.push(i);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const i of candidates.slice(0, board.mines)) board.cells[i].mine = true;
  board.cells.forEach((cell, i) => {
    cell.adjacent = neighbors(board, i).filter((n) => board.cells[n].mine).length;
  });
  board.placed = true;
  board.state = 'playing';
}

/**
 * Reveals a cell. Empty cells open their whole region.
 * @returns {number[]} indices that changed
 */
export function reveal(board, index, rng) {
  if (board.state === 'won' || board.state === 'lost') return [];
  const cell = board.cells[index];
  if (cell.revealed || cell.flagged) return [];
  if (!board.placed) placeMines(board, index, rng);

  if (cell.mine) {
    cell.revealed = true;
    board.exploded = index;
    board.state = 'lost';
    return [index];
  }

  const changed = [];
  const stack = [index];
  while (stack.length) {
    const i = stack.pop();
    const c = board.cells[i];
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    board.revealed += 1;
    changed.push(i);
    if (c.adjacent === 0) for (const n of neighbors(board, i)) if (!board.cells[n].revealed) stack.push(n);
  }
  checkWin(board);
  return changed;
}

export function toggleFlag(board, index) {
  if (board.state === 'won' || board.state === 'lost') return false;
  const cell = board.cells[index];
  if (cell.revealed) return false;
  cell.flagged = !cell.flagged;
  board.flags += cell.flagged ? 1 : -1;
  return true;
}

/** Clicking a revealed number with enough flags around it opens the rest of its neighbours. */
export function chord(board, index, rng) {
  const cell = board.cells[index];
  if (!cell.revealed || cell.adjacent === 0 || board.state !== 'playing') return [];
  const around = neighbors(board, index);
  const flagged = around.filter((n) => board.cells[n].flagged).length;
  if (flagged !== cell.adjacent) return [];
  const changed = [];
  for (const n of around) {
    if (board.state !== 'playing') break;
    changed.push(...reveal(board, n, rng));
  }
  return changed;
}

export function checkWin(board) {
  if (board.state !== 'playing') return false;
  if (board.revealed === board.cols * board.rows - board.mines) {
    board.state = 'won';
    // Flag the remaining mines for a tidy finished board.
    for (const cell of board.cells) {
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        board.flags += 1;
      }
    }
    return true;
  }
  return false;
}
