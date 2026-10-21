/** Breakout: paddle, ball, five brick layouts, lives and levels. */

import { createGameCanvas, fillRoundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createKeyboard, createTouchControls } from '../../lib/input.js';
import { font, palette, surfaces } from '../../lib/palette.js';
import { onThemeChange } from '../../lib/theme.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { clamp, randomRange } from '../../lib/random.js';

const W = 480;
const H = 620;
const COLS = 8;
const MARGIN = 22;
const GAP = 6;
const BRICK_W = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const BRICK_H = 18;
const TOP = 72;
const PADDLE_Y = H - 52;
const BALL_R = 7;
const LIVES = 3;

// '.' empty, '1' normal brick, '2' brick that needs two hits
const LEVELS = [
  ['11111111', '11111111', '11111111', '11111111', '11111111'],
  ['22222222', '11111111', '11111111', '11111111', '11111111', '11111111'],
  ['...11...', '..1221..', '.122221.', '12222221', '.122221.', '..1221..', '...11...'],
  ['2.2.2.2.', '.1.1.1.1', '2.2.2.2.', '.1.1.1.1', '11111111', '22222222'],
  ['22222222', '21111112', '21222212', '21211212', '21222212', '21111112', '22222222'],
];

const ROW_COLORS = [
  palette.accent,
  palette.clay,
  palette.mustard,
  palette.sage,
  palette.teal,
  palette.slate,
  palette.rose,
];

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: W, height: H, label: 'Breakout playfield' });
  const g = view.ctx;
  const keys = createKeyboard(ctx);

  let bricks;
  let paddle;
  let ball;
  let score;
  let lives;
  let level;
  let particles = [];
  let pointerX = null;
  let launched = false;

  const loop = createLoop({ update, render });

  function buildLevel(index) {
    bricks = [];
    LEVELS[index].forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === '.') return;
        bricks.push({
          x: MARGIN + c * (BRICK_W + GAP),
          y: TOP + r * (BRICK_H + GAP),
          w: BRICK_W,
          h: BRICK_H,
          hp: Number(ch),
          color: ROW_COLORS[r % ROW_COLORS.length],
          points: 10 + (LEVELS[index].length - r) * 5,
        });
      });
    });
  }

  function speedFor(lvl) {
    return 340 + lvl * 32;
  }

  function resetBall() {
    launched = false;
    ball = { x: paddle.x, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, speed: speedFor(level) };
  }

  function reset() {
    score = 0;
    lives = LIVES;
    level = 0;
    particles = [];
    paddle = { x: W / 2, w: 88, h: 12, vx: 0 };
    buildLevel(level);
    resetBall();
    updateStats();
  }

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({ score, lives, level: level + 1, best: Math.max(best, score) });
  }

  function launch() {
    if (ctx.status === 'idle') {
      start();
      return;
    }
    if (ctx.status !== 'running' || launched) return;
    launched = true;
    const angle = randomRange(-0.35, 0.35);
    ball.vx = Math.sin(angle) * ball.speed;
    ball.vy = -Math.cos(angle) * ball.speed;
  }

  // ----- Input -----

  keys.on('action', launch);
  keys.on('up', launch);
  keys.on('left', () => {
    pointerX = null;
  });
  keys.on('right', () => {
    pointerX = null;
  });

  ctx.listen(view.canvas, 'pointermove', (event) => {
    pointerX = view.toLogical(event).x;
  });
  ctx.listen(view.canvas, 'pointerdown', (event) => {
    pointerX = view.toLogical(event).x;
    launch();
  });

  createTouchControls(ctx, keys, [
    [{ action: 'left', icon: 'chevronLeft', label: 'Move left', variant: 'wide' }],
    [{ action: 'action', icon: 'jump', label: 'Launch ball', variant: 'accent' }],
    [{ action: 'right', icon: 'chevronRight', label: 'Move right', variant: 'wide' }],
  ]);

  // ----- Simulation -----

  function update(dt) {
    // Paddle: keyboard velocity or follow the pointer.
    const axis = keys.axis('left', 'right');
    const half = paddle.w / 2;
    if (axis !== 0) {
      paddle.vx += (axis * 640 - paddle.vx) * Math.min(1, dt * 20);
      paddle.x += paddle.vx * dt;
    } else if (pointerX !== null) {
      const target = clamp(pointerX, half, W - half);
      paddle.vx = (target - paddle.x) / dt;
      paddle.x += (target - paddle.x) * Math.min(1, dt * 30);
    } else {
      paddle.vx *= 0.8;
      paddle.x += paddle.vx * dt;
    }
    paddle.x = clamp(paddle.x, half, W - half);

    updateParticles(dt);

    if (!launched) {
      ball.x = paddle.x;
      ball.y = PADDLE_Y - BALL_R - 1;
      return;
    }

    // Sub-steps keep the fast ball from tunnelling through bricks.
    const distance = Math.hypot(ball.vx, ball.vy) * dt;
    const steps = Math.max(1, Math.ceil(distance / 3));
    for (let i = 0; i < steps; i += 1) {
      if (!stepBall(dt / steps)) return;
    }
  }

  /** Moves the ball one sub-step. Returns false if the step ended the turn. */
  function stepBall(dt) {
    const prevX = ball.x;
    const prevY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < BALL_R) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > W - BALL_R) {
      ball.x = W - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < BALL_R) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle
    const half = paddle.w / 2;
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= PADDLE_Y &&
      prevY + BALL_R <= PADDLE_Y + 4 &&
      ball.x >= paddle.x - half - BALL_R &&
      ball.x <= paddle.x + half + BALL_R
    ) {
      // The hit position decides the bounce angle (up to about 62 degrees).
      const offset = clamp((ball.x - paddle.x) / (half + BALL_R), -1, 1);
      const angle = offset * 1.08;
      ball.speed = Math.min(ball.speed * 1.012, speedFor(level) * 1.35);
      ball.vx = Math.sin(angle) * ball.speed;
      ball.vy = -Math.cos(angle) * ball.speed;
      ball.y = PADDLE_Y - BALL_R;
    }

    // Bricks: at most one hit per sub-step.
    for (const brick of bricks) {
      const nearestX = clamp(ball.x, brick.x, brick.x + brick.w);
      const nearestY = clamp(ball.y, brick.y, brick.y + brick.h);
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

      // If the ball was already within the brick's horizontal span it hit
      // the top or bottom face, otherwise a side.
      const wasInsideX = prevX + BALL_R > brick.x && prevX - BALL_R < brick.x + brick.w;
      if (wasInsideX) {
        ball.vy = -ball.vy;
        ball.y = prevY;
      } else {
        ball.vx = -ball.vx;
        ball.x = prevX;
      }
      hitBrick(brick);
      break;
    }

    // Keep the ball from travelling almost horizontally.
    const minVy = ball.speed * 0.28;
    if (Math.abs(ball.vy) < minVy) {
      ball.vy = Math.sign(ball.vy || -1) * minVy;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, ball.speed ** 2 - minVy ** 2));
    }

    if (ball.y - BALL_R > H) {
      loseLife();
      return false;
    }
    if (bricks.length === 0) {
      levelCleared();
      return false;
    }
    return true;
  }

  function hitBrick(brick) {
    brick.hp -= 1;
    score += brick.hp > 0 ? 5 : brick.points;
    if (brick.hp <= 0) {
      bricks.splice(bricks.indexOf(brick), 1);
      burst(brick);
    }
    updateStats();
  }

  function burst(brick) {
    if (prefersReducedMotion()) return;
    for (let i = 0; i < 8; i += 1) {
      particles.push({
        x: brick.x + Math.random() * brick.w,
        y: brick.y + Math.random() * brick.h,
        vx: randomRange(-90, 90),
        vy: randomRange(-60, 120),
        life: randomRange(0.35, 0.6),
        color: brick.color,
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // ----- Flow -----

  function loseLife() {
    lives -= 1;
    updateStats();
    if (lives <= 0) {
      gameOver(false);
      return;
    }
    resetBall();
  }

  function levelCleared() {
    loop.stop();
    if (level === LEVELS.length - 1) {
      gameOver(true);
      return;
    }
    ctx.setStatus('over');
    const bonus = lives * 100;
    score += bonus;
    updateStats();
    render();
    ctx.overlay.show({
      kicker: `Level ${level + 1} cleared`,
      title: 'Nicely done',
      message: `Lives bonus +${bonus}. The next wall is a little faster.`,
      tone: 'success',
      stats: [
        { label: 'Score', value: score.toLocaleString('en-US') },
        { label: 'Lives', value: lives },
      ],
      actions: [{ label: `Start level ${level + 2}`, icon: 'play', onClick: nextLevel }],
      delay: 350,
    });
  }

  function nextLevel() {
    level += 1;
    paddle.w = Math.max(68, 88 - level * 4);
    buildLevel(level);
    resetBall();
    particles = [];
    updateStats();
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function gameOver(won) {
    loop.stop();
    ctx.setStatus('over');
    const { best, isNew } = ctx.storage.submitRecord('best', score);
    updateStats();
    render();
    ctx.overlay.show({
      kicker: won ? 'Every wall cleared' : 'Game over',
      title: won ? 'You beat Breakout' : `${score.toLocaleString('en-US')} points`,
      tone: won ? 'success' : 'default',
      badge: isNew && score > 0 ? 'New best' : null,
      stats: [
        { label: 'Score', value: score.toLocaleString('en-US') },
        { label: 'Level', value: level + 1 },
        { label: 'Best', value: (best ?? 0).toLocaleString('en-US'), highlight: isNew && score > 0 },
      ],
      actions: [{ label: 'Play again', icon: 'restart', onClick: restart }],
      suggest: true,
      delay: 450,
    });
  }

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Breakout',
      title: 'Clear the wall',
      message: 'Move with the arrow keys or your mouse. Press Space or click to launch the ball.',
      actions: [{ label: 'Start', icon: 'play', onClick: start }],
    });
  }

  function start() {
    if (ctx.status === 'running') return;
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function restart() {
    loop.stop();
    reset();
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  // ----- Rendering -----

  function render() {
    const s = surfaces();
    g.fillStyle = s.board;
    g.fillRect(0, 0, W, H);

    // Soft floor line under the paddle
    g.fillStyle = s.floor;
    g.fillRect(0, PADDLE_Y + 24, W, H);

    for (const brick of bricks) {
      if (brick.hp >= 2) {
        fillRoundRect(g, brick.x, brick.y, brick.w, brick.h, 4, s.inkSoft);
        fillRoundRect(g, brick.x + 3, brick.y + brick.h - 5, brick.w - 6, 2.5, 1.25, brick.color);
      } else {
        fillRoundRect(g, brick.x, brick.y, brick.w, brick.h, 4, brick.color);
        g.fillStyle = 'rgba(255,255,255,0.2)';
        g.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 3);
      }
    }

    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life * 2);
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, 4, 4);
    }
    g.globalAlpha = 1;

    fillRoundRect(g, paddle.x - paddle.w / 2, PADDLE_Y, paddle.w, paddle.h, 6, s.ink);

    g.fillStyle = palette.accent;
    g.beginPath();
    g.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    g.fill();

    if (!launched && ctx.status === 'running') {
      g.fillStyle = s.muted;
      g.font = font(13, 550);
      g.textAlign = 'center';
      g.fillText('Press Space or click to launch', W / 2, PADDLE_Y - 34);
    }

    // Lives as small dots, top right
    for (let i = 0; i < lives; i += 1) {
      g.fillStyle = palette.accent;
      g.beginPath();
      g.arc(W - MARGIN - i * 16, 34, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = s.muted;
    g.font = font(12, 600);
    g.textAlign = 'left';
    g.fillText(`LEVEL ${level + 1}`, MARGIN, 38);
  }

  view.onResize(() => render());
  ctx.onDestroy(onThemeChange(() => render()));

  reset();
  render();
  showStart();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    restart,
    destroy: () => loop.stop(),
  };
}
