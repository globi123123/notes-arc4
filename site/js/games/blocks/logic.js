/** Pure rules for the block stacker: pieces, rotation, collisions, lines. */

export const COLS = 10;
export const ROWS = 20;

export const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

export const TYPES = Object.keys(SHAPES);

/** Points for clearing 0-4 lines at once, multiplied by the level. */
export const LINE_SCORES = [0, 100, 300, 500, 800];

export function createBoard(cols = COLS, rows = ROWS) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

/** Rotates a square matrix clockwise (dir = 1) or counter-clockwise (dir = -1). */
export function rotateMatrix(matrix, dir = 1) {
  const n = matrix.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (dir > 0) out[x][n - 1 - y] = matrix[y][x];
      else out[n - 1 - x][y] = matrix[y][x];
    }
  }
  return out;
}

export function spawnPiece(type, cols = COLS) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return { type, matrix, x: Math.floor((cols - matrix.length) / 2), y: type === 'I' ? -1 : 0 };
}

/** Cells covered by a piece, in board coordinates. */
export function cellsOf(piece) {
  const cells = [];
  piece.matrix.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) cells.push({ x: piece.x + x, y: piece.y + y });
    }),
  );
  return cells;
}

/** True if the piece overlaps a wall, the floor or settled blocks. Cells above the board are allowed. */
export function collides(board, piece) {
  const cols = board[0].length;
  const rows = board.length;
  return cellsOf(piece).some(({ x, y }) => x < 0 || x >= cols || y >= rows || (y >= 0 && board[y][x] !== null));
}

export function tryMove(board, piece, dx, dy) {
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(board, moved) ? null : moved;
}

/** Rotation with simple wall kicks so pieces can turn next to walls. */
export function tryRotate(board, piece, dir = 1) {
  if (piece.type === 'O') return piece;
  const matrix = rotateMatrix(piece.matrix, dir);
  const kicks =
    piece.type === 'I'
      ? [
          [0, 0],
          [-1, 0],
          [1, 0],
          [-2, 0],
          [2, 0],
          [0, -1],
        ]
      : [
          [0, 0],
          [-1, 0],
          [1, 0],
          [0, -1],
          [-1, -1],
          [1, -1],
        ];
  for (const [kx, ky] of kicks) {
    const candidate = { ...piece, matrix, x: piece.x + kx, y: piece.y + ky };
    if (!collides(board, candidate)) return candidate;
  }
  return null;
}

/** Lowest valid position straight below the piece (used for ghost and hard drop). */
export function dropPosition(board, piece) {
  let current = piece;
  for (;;) {
    const next = tryMove(board, current, 0, 1);
    if (!next) return current;
    current = next;
  }
}

/** Writes a piece into the board. Returns false if part of it is above the top (lock out). */
export function merge(board, piece) {
  let inside = true;
  for (const { x, y } of cellsOf(piece)) {
    if (y < 0) inside = false;
    else board[y][x] = piece.type;
  }
  return inside;
}

export function fullRows(board) {
  const rows = [];
  board.forEach((row, y) => {
    if (row.every((cell) => cell !== null)) rows.push(y);
  });
  return rows;
}

/** Removes the given rows and adds empty rows on top. */
export function removeRows(board, rows) {
  const cols = board[0].length;
  const set = new Set(rows);
  const kept = board.filter((_, y) => !set.has(y));
  while (kept.length < board.length) kept.unshift(Array(cols).fill(null));
  board.splice(0, board.length, ...kept);
  return rows.length;
}

/** 7-bag randomizer: every piece appears once per bag of seven. */
export function createBag(rng = Math.random) {
  let bag = [];
  return () => {
    if (bag.length === 0) {
      bag = [...TYPES];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  };
}

/** Gravity interval in ms for a level (starting at 1). */
export const gravityInterval = (level) => Math.max(70, Math.round(820 * Math.pow(0.83, level - 1)));
