/** Pong: a match to seven points against a computer paddle with three skill levels. */

import { createGameCanvas, fillRoundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createKeyboard, createTouchControls } from '../../lib/input.js';
import { font, palette, surfaces } from '../../lib/palette.js';
import { onThemeChange } from '../../lib/theme.js';
import { clamp, randomRange } from '../../lib/random.js';
import { segmented } from '../../ui/components.js';

const W = 640;
const H = 420;
const PADDLE_W = 12;
const PADDLE_H = 82;
const BALL_R = 8;
const WIN_SCORE = 7;
const PLAYER_X = 28;
const CPU_X = W - 28 - PADDLE_W;

const SKILLS = {
  easy: { label: 'Easy', speed: 250, error: 46, reaction: 0.22 },
  normal: { label: 'Normal', speed: 340, error: 26, reaction: 0.14 },
  hard: { label: 'Hard', speed: 450, error: 10, reaction: 0.07 },
};

export default function mount(ctx) {
  let skillId = ctx.storage.getPref('skill', 'normal');
  if (!SKILLS[skillId]) skillId = 'normal';

  const view = createGameCanvas(ctx, { width: W, height: H, label: 'Pong court' });
  const g = view.ctx;
  const keys = createKeyboard(ctx);

  const skillControl = segmented({
    label: 'Computer skill',
    value: skillId,
    options: Object.entries(SKILLS).map(([value, s]) => ({ value, label: s.label })),
    onChange: (value) => {
      skillId = value;
      ctx.storage.setPref('skill', value);
      restart(true);
    },
  });
  ctx.toolbar.append(skillControl);

  let player;
  let cpu;
  let ball;
  let scores;
  let serveTimer;
  let serveDir;
  let pointerY = null;
  let cpuAim = H / 2;
  let cpuThink = 0;
  let rally = 0;

  const loop = createLoop({ update, render });

  function reset() {
    player = { y: H / 2 - PADDLE_H / 2 };
    cpu = { y: H / 2 - PADDLE_H / 2 };
    scores = { player: 0, cpu: 0 };
    serveDir = Math.random() < 0.5 ? -1 : 1;
    prepareServe();
    updateStats();
  }

  function prepareServe() {
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 330 };
    serveTimer = 0.9;
    rally = 0;
  }

  function serve() {
    const angle = randomRange(-0.45, 0.45);
    ball.vx = Math.cos(angle) * ball.speed * serveDir;
    ball.vy = Math.sin(angle) * ball.speed;
  }

  function updateStats() {
    ctx.setStats({ player: scores.player, cpu: scores.cpu, wins: ctx.storage.getRecord(`wins-${skillId}`) ?? 0 });
    ctx.showRecords(
      Object.entries(SKILLS).map(([id, s]) => ({
        label: `Wins (${s.label})`,
        value: ctx.storage.getRecord(`wins-${id}`) ?? 0,
      })),
    );
  }

  // ----- Input -----

  keys.on('action', () => ctx.status === 'idle' && start());
  keys.on('up', () => {
    pointerY = null;
    if (ctx.status === 'idle') start();
  });
  keys.on('down', () => {
    pointerY = null;
    if (ctx.status === 'idle') start();
  });

  ctx.listen(view.canvas, 'pointermove', (event) => {
    pointerY = view.toLogical(event).y;
  });
  ctx.listen(view.canvas, 'pointerdown', (event) => {
    pointerY = view.toLogical(event).y;
    if (ctx.status === 'idle') start();
  });

  createTouchControls(ctx, keys, [
    [
      { action: 'up', icon: 'chevronUp', label: 'Move up', variant: 'wide' },
      { action: 'down', icon: 'chevronDown', label: 'Move down', variant: 'wide' },
    ],
  ]);

  // ----- Simulation -----

  function movePlayer(dt) {
    const axis = keys.axis('up', 'down');
    if (axis !== 0) player.y += axis * 470 * dt;
    else if (pointerY !== null) {
      const target = pointerY - PADDLE_H / 2;
      player.y += (target - player.y) * Math.min(1, dt * 22);
    }
    player.y = clamp(player.y, 0, H - PADDLE_H);
  }

  /** Predicts where the ball will cross the computer's side, including wall bounces. */
  function predictY() {
    if (ball.vx <= 0) return H / 2;
    const time = (CPU_X - ball.x) / ball.vx;
    let y = ball.y + ball.vy * time;
    const span = H - BALL_R * 2;
    y -= BALL_R;
    y = ((y % (2 * span)) + 2 * span) % (2 * span);
    if (y > span) y = 2 * span - y;
    return y + BALL_R;
  }

  function moveCpu(dt) {
    const skill = SKILLS[skillId];
    cpuThink -= dt;
    if (cpuThink <= 0) {
      cpuThink = skill.reaction;
      // Longer rallies make the computer slightly sharper.
      const error = skill.error * Math.max(0.4, 1 - rally * 0.05);
      cpuAim = predictY() + randomRange(-error, error);
    }
    const center = cpu.y + PADDLE_H / 2;
    const diff = cpuAim - center;
    const maxStep = skill.speed * dt;
    cpu.y += clamp(diff, -maxStep, maxStep);
    cpu.y = clamp(cpu.y, 0, H - PADDLE_H);
  }

  function update(dt) {
    movePlayer(dt);
    moveCpu(dt);

    if (serveTimer > 0) {
      serveTimer -= dt;
      if (serveTimer <= 0) serve();
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y < BALL_R) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y > H - BALL_R) {
      ball.y = H - BALL_R;
      ball.vy = -Math.abs(ball.vy);
    }

    // Paddle hits: the further from the center, the steeper the return.
    if (ball.vx < 0 && ball.x - BALL_R <= PLAYER_X + PADDLE_W && ball.x - BALL_R >= PLAYER_X - 6) {
      if (ball.y >= player.y - BALL_R && ball.y <= player.y + PADDLE_H + BALL_R) bounce(player, 1);
    }
    if (ball.vx > 0 && ball.x + BALL_R >= CPU_X && ball.x + BALL_R <= CPU_X + PADDLE_W + 6) {
      if (ball.y >= cpu.y - BALL_R && ball.y <= cpu.y + PADDLE_H + BALL_R) bounce(cpu, -1);
    }

    if (ball.x < -BALL_R * 2) point('cpu');
    else if (ball.x > W + BALL_R * 2) point('player');
  }

  function bounce(paddle, dir) {
    const offset = clamp((ball.y - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2), -1, 1);
    const angle = offset * 0.95;
    ball.speed = Math.min(ball.speed * 1.06, 820);
    ball.vx = Math.cos(angle) * ball.speed * dir;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.x = dir > 0 ? PLAYER_X + PADDLE_W + BALL_R : CPU_X - BALL_R;
    rally += 1;
    cpuThink = 0;
  }

  function point(who) {
    scores[who] += 1;
    serveDir = who === 'player' ? 1 : -1; // serve toward the side that lost the point
    updateStats();
    if (scores[who] >= WIN_SCORE) finish(who === 'player');
    else prepareServe();
  }

  // ----- Flow -----

  function finish(won) {
    loop.stop();
    ctx.setStatus('over');
    let wins = ctx.storage.getRecord(`wins-${skillId}`) ?? 0;
    if (won) {
      wins += 1;
      ctx.storage.submitRecord(`wins-${skillId}`, wins);
      ctx.storage.submitRecord('wins', (ctx.storage.getRecord('wins') ?? 0) + 1);
    }
    updateStats();
    render();
    ctx.overlay.show({
      kicker: won ? 'Match won' : 'Match lost',
      title: `${scores.player} – ${scores.cpu}`,
      tone: won ? 'success' : 'default',
      message: won
        ? `That makes ${wins} ${wins === 1 ? 'win' : 'wins'} on ${SKILLS[skillId].label}.`
        : 'The computer took this one. Rematch?',
      actions: [{ label: 'Rematch', icon: 'restart', onClick: () => restart() }],
      suggest: true,
      delay: 400,
    });
  }

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Pong',
      title: `First to ${WIN_SCORE}`,
      message: 'Use the arrow keys, W and S, or move your mouse over the court.',
      actions: [{ label: 'Start match', icon: 'play', onClick: start }],
    });
  }

  function start() {
    if (ctx.status === 'running') return;
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function restart(toStart = false) {
    loop.stop();
    reset();
    render();
    if (toStart) {
      showStart();
      return;
    }
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  // ----- Rendering -----

  function render() {
    const s = surfaces();
    g.fillStyle = s.board;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = s.line;
    g.lineWidth = 3;
    g.setLineDash([10, 12]);
    g.beginPath();
    g.moveTo(W / 2, 14);
    g.lineTo(W / 2, H - 14);
    g.stroke();
    g.setLineDash([]);

    g.fillStyle = s.strong;
    g.font = font(64, 650);
    g.textAlign = 'center';
    g.fillText(String(scores.player), W / 2 - 70, 84);
    g.fillText(String(scores.cpu), W / 2 + 70, 84);

    fillRoundRect(g, PLAYER_X, player.y, PADDLE_W, PADDLE_H, 6, s.ink);
    fillRoundRect(g, CPU_X, cpu.y, PADDLE_W, PADDLE_H, 6, palette.slate);

    g.fillStyle = palette.accent;
    g.beginPath();
    g.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = s.muted;
    g.font = font(11, 600);
    g.fillText('YOU', W / 2 - 70, 106);
    g.fillText('COMPUTER', W / 2 + 70, 106);
  }

  view.onResize(() => render());
  ctx.onDestroy(onThemeChange(() => render()));

  reset();
  render();
  showStart();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    restart: () => restart(),
    destroy: () => loop.stop(),
  };
}
