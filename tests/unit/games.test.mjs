import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../../site/js/lib/random.js';
import * as snake from '../../site/js/games/snake/logic.js';
import * as blocks from '../../site/js/games/blocks/logic.js';
import * as t2048 from '../../site/js/games/2048/logic.js';
import * as mines from '../../site/js/games/minesweeper/logic.js';
import * as sudoku from '../../site/js/games/sudoku/logic.js';
import * as pairs from '../../site/js/games/pairs/logic.js';

// ---------------------------------------------------------------- Snake

test('snake moves, grows on food and dies on walls', () => {
  const state = snake.createState({ cols: 10, rows: 10, rng: seeded(1) });
  const head = { ...state.snake[0] };
  state.food = { x: head.x + 1, y: head.y };
  const ate = snake.step(state);
  assert.equal(ate.ate, true);
  assert.equal(state.snake.length, 4);
  assert.equal(state.score, 1);

  state.food = { x: 0, y: 0 };
  for (let i = 0; i < 20 && !state.dead; i += 1) snake.step(state);
  assert.equal(state.dead, true);
});

test('snake ignores reversing into itself and buffers turns', () => {
  const state = snake.createState({ rng: seeded(2) });
  assert.equal(snake.queueDirection(state, 'left'), false);
  assert.equal(snake.queueDirection(state, 'up'), true);
  assert.equal(snake.queueDirection(state, 'down'), false);
  assert.equal(snake.queueDirection(state, 'left'), true);
});

test('snake detects running into its own body', () => {
  const state = snake.createState({ cols: 10, rows: 10, rng: seeded(3) });
  state.snake = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
  ];
  state.dir = 'right';
  state.food = { x: 0, y: 0 };
  snake.queueDirection(state, 'down');
  snake.step(state);
  assert.equal(state.dead, true);
});

test('snake speeds up but never below the minimum interval', () => {
  assert.ok(snake.tickInterval(10) < snake.tickInterval(0));
  assert.equal(snake.tickInterval(1000), 58);
});

// ---------------------------------------------------------------- Block Stacker

test('blocks rotate four times back to the start', () => {
  let m = blocks.SHAPES.T;
  for (let i = 0; i < 4; i += 1) m = blocks.rotateMatrix(m, 1);
  assert.deepEqual(m, blocks.SHAPES.T);
  assert.deepEqual(blocks.rotateMatrix(blocks.rotateMatrix(blocks.SHAPES.L, 1), -1), blocks.SHAPES.L);
});

test('blocks collide with walls and the floor', () => {
  const board = blocks.createBoard();
  const piece = blocks.spawnPiece('O');
  assert.equal(blocks.collides(board, piece), false);
  assert.equal(blocks.tryMove(board, { ...piece, x: 0 }, -1, 0), null);
  const landed = blocks.dropPosition(board, piece);
  assert.equal(landed.y, blocks.ROWS - 2);
});

test('blocks clear full rows and shift the stack down', () => {
  const board = blocks.createBoard();
  board[19] = Array(10).fill('I');
  board[18] = Array(10).fill(null);
  board[18][0] = 'T';
  const full = blocks.fullRows(board);
  assert.deepEqual(full, [19]);
  blocks.removeRows(board, full);
  assert.equal(board.length, blocks.ROWS);
  assert.equal(board[19][0], 'T');
  assert.ok(board[0].every((c) => c === null));
});

test('blocks 7-bag deals every piece once per bag', () => {
  const next = blocks.createBag(seeded(5));
  const bag = Array.from({ length: 7 }, next).sort();
  assert.deepEqual(bag, [...blocks.TYPES].sort());
});

test('blocks merging above the top reports a lock out', () => {
  const board = blocks.createBoard();
  assert.equal(blocks.merge(board, { ...blocks.spawnPiece('I'), y: -2 }), false);
});

// ---------------------------------------------------------------- 2048

test('2048 merges each pair once per move', () => {
  const game = t2048.fromGrid([
    [2, 2, 2, 2],
    [4, 4, 8, 8],
    [2, 0, 2, 4],
    [0, 0, 0, 0],
  ]);
  const result = t2048.move(game, 'left');
  assert.equal(result.moved, true);
  assert.deepEqual(t2048.toGrid(game), [
    [4, 4, 0, 0],
    [8, 16, 0, 0],
    [4, 4, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(result.gained, 4 + 4 + 8 + 16 + 4);
  assert.equal(game.score, 36);
});

test('2048 reports when nothing moves', () => {
  const game = t2048.fromGrid([
    [2, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(t2048.move(game, 'left').moved, false);
  assert.equal(t2048.move(game, 'right').moved, true);
});

test('2048 detects game over', () => {
  const stuck = t2048.fromGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  assert.equal(t2048.canMove(stuck), false);
  const open = t2048.fromGrid([
    [2, 2, 4, 8],
    [4, 8, 16, 32],
    [8, 16, 32, 64],
    [16, 32, 64, 128],
  ]);
  assert.equal(t2048.canMove(open), true);
});

test('2048 adds tiles only on empty cells', () => {
  const game = t2048.createGame({ rng: seeded(9) });
  for (let i = 0; i < 16; i += 1) assert.ok(t2048.addRandomTile(game));
  assert.equal(t2048.addRandomTile(game), null);
  assert.equal(new Set(game.tiles.map((t) => `${t.r},${t.c}`)).size, 16);
});

// ---------------------------------------------------------------- Minesweeper

test('minesweeper keeps the first click and its neighbours safe', () => {
  for (let seed = 1; seed < 20; seed += 1) {
    const board = mines.createBoard(9, 9, 10);
    mines.reveal(board, 40, seeded(seed));
    assert.equal(board.cells.filter((c) => c.mine).length, 10);
    assert.equal(board.cells[40].mine, false);
    for (const n of mines.neighbors(board, 40)) assert.equal(board.cells[n].mine, false);
    assert.notEqual(board.state, 'lost');
  }
});

test('minesweeper flood-fills empty regions and detects a win', () => {
  const board = mines.createBoard(5, 5, 1);
  mines.placeMines(board, 0, () => 0.999);
  const mineIndex = board.cells.findIndex((c) => c.mine);
  assert.ok(mineIndex >= 0);
  const safe = board.cells.findIndex((c, i) => !c.mine && c.adjacent === 0 && i !== mineIndex);
  mines.reveal(board, safe);
  assert.equal(board.state, 'won');
  assert.equal(board.revealed, 24);
});

test('minesweeper flags, chords and loses on a mine', () => {
  const board = mines.createBoard(3, 3, 1);
  board.cells[8].mine = true;
  board.cells.forEach((cell, i) => {
    cell.adjacent = mines.neighbors(board, i).filter((n) => board.cells[n].mine).length;
  });
  board.placed = true;
  board.state = 'playing';

  mines.reveal(board, 4); // center shows 1
  assert.equal(board.cells[4].adjacent, 1);
  assert.equal(mines.chord(board, 4).length, 0, 'no chord without flags');
  mines.toggleFlag(board, 7);
  mines.chord(board, 4); // wrong flag: opens the real mine
  assert.equal(board.state, 'lost');
  assert.equal(board.exploded, 8);
});

// ---------------------------------------------------------------- Sudoku

test('sudoku solver solves a known puzzle', () => {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
    .split('')
    .map(Number);
  const { count, solution } = sudoku.solve(puzzle, { limit: 2 });
  assert.equal(count, 1);
  assert.equal(solution.join(''), '534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  assert.equal(sudoku.isSolved(solution), true);
});

test('sudoku generator creates valid puzzles with exactly one solution', () => {
  for (const [difficulty, seed] of [
    ['easy', 1],
    ['medium', 2],
    ['hard', 3],
  ]) {
    const { puzzle, solution, clues } = sudoku.generatePuzzle(difficulty, seeded(seed));
    assert.equal(sudoku.isSolved(solution), true);
    assert.equal(puzzle.filter(Boolean).length, clues);
    assert.ok(clues <= 50 && clues >= 17, `${difficulty} clues ${clues}`);
    puzzle.forEach((v, i) => v && assert.equal(v, solution[i]));
    assert.equal(sudoku.solve(puzzle, { limit: 2 }).count, 1, `${difficulty} must be unique`);
  }
});

test('sudoku harder levels give fewer clues', () => {
  const easy = sudoku.generatePuzzle('easy', seeded(11)).clues;
  const hard = sudoku.generatePuzzle('hard', seeded(11)).clues;
  assert.ok(hard < easy);
});

test('sudoku conflict detection', () => {
  const values = Array(81).fill(0);
  values[0] = 5;
  values[8] = 5; // same row
  values[40] = 3;
  const conflicts = sudoku.findConflicts(values);
  assert.deepEqual(
    [...conflicts].sort((a, b) => a - b),
    [0, 8],
  );
  assert.equal(sudoku.PEERS[0].length, 20);
});

// ---------------------------------------------------------------- Pairs

test('pairs deck contains each chosen symbol exactly twice', () => {
  const deck = pairs.createDeck(8, 18, seeded(4));
  assert.equal(deck.length, 16);
  const counts = {};
  deck.forEach((c) => (counts[c.symbol] = (counts[c.symbol] || 0) + 1));
  assert.ok(Object.values(counts).every((n) => n === 2));
  assert.equal(Object.keys(counts).length, 8);
  const [a, b] = deck.filter((c) => c.symbol === deck[0].symbol);
  assert.equal(pairs.isMatch(a, b), true);
  assert.equal(pairs.isMatch(a, a), false);
  for (const size of Object.values(pairs.SIZES)) assert.equal((size.cols * size.rows) % 2, 0);
});
