/** Pure Snake rules, independent of rendering. */

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function createState({ cols = 20, rows = 20, rng = Math.random } = {}) {
  const y = Math.floor(rows / 2);
  const state = {
    cols,
    rows,
    rng,
    snake: [
      { x: 5, y },
      { x: 4, y },
      { x: 3, y },
    ],
    dir: 'right',
    queue: [],
    food: null,
    score: 0,
    dead: false,
    won: false,
  };
  state.food = spawnFood(state);
  return state;
}

/** Buffers a turn. Reversing straight into the body is ignored. */
export function queueDirection(state, dir) {
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
  if (!DIRECTIONS[dir] || dir === last || OPPOSITE[dir] === last || state.queue.length >= 3) return false;
  state.queue.push(dir);
  return true;
}

export function spawnFood(state) {
  const taken = new Set(state.snake.map((p) => `${p.x},${p.y}`));
  const free = [];
  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) if (!taken.has(`${x},${y}`)) free.push({ x, y });
  }
  if (free.length === 0) return null;
  return free[Math.floor(state.rng() * free.length)];
}

/**
 * Advances the snake by one cell.
 * @returns {{ ate: boolean, dead: boolean, tail: {x:number,y:number} | null }}
 */
export function step(state) {
  if (state.dead || state.won) return { ate: false, dead: state.dead, tail: null };
  if (state.queue.length) state.dir = state.queue.shift();

  const d = DIRECTIONS[state.dir];
  const head = state.snake[0];
  const next = { x: head.x + d.x, y: head.y + d.y };

  const outside = next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows;
  const ate = Boolean(state.food) && next.x === state.food.x && next.y === state.food.y;
  // The tail moves out of the way this tick unless the snake is growing.
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const hitSelf = body.some((p) => p.x === next.x && p.y === next.y);

  if (outside || hitSelf) {
    state.dead = true;
    return { ate: false, dead: true, tail: null };
  }

  state.snake.unshift(next);
  let tail = null;
  if (ate) {
    state.score += 1;
    state.food = spawnFood(state);
    if (!state.food) state.won = true;
  } else {
    tail = state.snake.pop();
  }
  return { ate, dead: false, tail };
}

/** Milliseconds between moves; the snake speeds up as it eats. */
export const tickInterval = (score) => Math.max(58, 135 - score * 3);
