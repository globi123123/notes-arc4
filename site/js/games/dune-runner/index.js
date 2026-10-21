/** Dune Runner: an endless desert run with variable-height jumps and ducking. */

import { createGameCanvas, fillRoundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { capturePointer, createKeyboard, createTouchControls } from '../../lib/input.js';
import { font, palette } from '../../lib/palette.js';
import { chance, pick, randomRange } from '../../lib/random.js';

const W = 640;
const H = 340;
const GROUND = 272;
const RUNNER_X = 92;
const STAND_H = 46;
const DUCK_H = 26;
const RUNNER_W = 22;
const JUMP_V = -735;
const GRAVITY = 2250;
const START_SPEED = 340;
const MAX_SPEED = 920;

const OBSTACLES = [
  { type: 'cactus', w: 18, h: 40 },
  { type: 'cactus', w: 22, h: 54 },
  { type: 'group', w: 46, h: 40 },
  { type: 'rock', w: 32, h: 20 },
];

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: W, height: H, label: 'Desert running track' });
  const g = view.ctx;
  const keys = createKeyboard(ctx, {
    jump: ['Space', 'ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
  });

  let runner;
  let obstacles;
  let pebbles;
  let speed;
  let distance;
  let nextSpawn;
  let phase;
  let dead;

  const loop = createLoop({ update, render });

  function reset() {
    runner = { y: GROUND, vy: 0, grounded: true, ducking: false };
    obstacles = [];
    pebbles = Array.from({ length: 18 }, () => ({
      x: Math.random() * W,
      y: GROUND + 8 + Math.random() * 56,
      w: randomRange(2, 7),
    }));
    speed = START_SPEED;
    distance = 0;
    nextSpawn = 500;
    phase = 0;
    dead = false;
    updateStats();
  }

  const score = () => Math.floor(distance / 12);

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({ score: score(), speed: `${(speed / START_SPEED).toFixed(1)}×`, best: Math.max(best, score()) });
  }

  // ----- Input -----

  function jump() {
    if (ctx.status === 'idle') {
      start();
      return;
    }
    if (ctx.status !== 'running' || !runner.grounded) return;
    runner.vy = JUMP_V;
    runner.grounded = false;
  }

  keys.on('jump', jump);
  keys.on('down', () => ctx.status === 'idle' && start());

  ctx.listen(view.canvas, 'pointerdown', (event) => {
    event.preventDefault();
    capturePointer(view.canvas, event.pointerId);
    keys.press('jump');
  });
  const releaseJump = () => keys.release('jump');
  ctx.listen(view.canvas, 'pointerup', releaseJump);
  ctx.listen(view.canvas, 'pointercancel', releaseJump);

  createTouchControls(ctx, keys, [
    [{ action: 'down', icon: 'duck', label: 'Duck', variant: 'wide' }],
    'spacer',
    [{ action: 'jump', icon: 'jump', label: 'Jump', variant: 'wide accent' }],
  ]);

  // ----- Simulation -----

  function spawnObstacle() {
    const flyingAllowed = score() > 250;
    if (flyingAllowed && chance(0.28)) {
      // Birds fly low (jump), at head height (duck) or high (run under).
      const height = pick([GROUND - 30, GROUND - 56, GROUND - 56, GROUND - 92]);
      obstacles.push({ type: 'bird', x: W + 30, y: height - 18, w: 38, h: 18, flap: Math.random() * 6 });
    } else {
      const spec = pick(OBSTACLES);
      obstacles.push({ ...spec, x: W + 20, y: GROUND - spec.h });
    }
    // The gap grows with speed so every obstacle stays clearable.
    nextSpawn = speed * 0.62 + 170 + randomRange(0, speed * 0.75);
  }

  function update(dt) {
    if (dead) return;

    speed = Math.min(MAX_SPEED, speed + 9 * dt);
    const dx = speed * dt;
    distance += dx;
    phase += dt * (speed / 38);

    // Jump physics: releasing early or pressing down shortens the jump.
    const holding = keys.isDown('jump');
    const ducking = keys.isDown('down');
    if (!runner.grounded) {
      let gravity = GRAVITY;
      if (runner.vy < 0 && !holding) gravity *= 2.6;
      if (ducking) gravity *= 2.4;
      runner.vy += gravity * dt;
      runner.y += runner.vy * dt;
      if (runner.y >= GROUND) {
        runner.y = GROUND;
        runner.vy = 0;
        runner.grounded = true;
        if (holding) {
          // Holding jump on landing hops again, which feels responsive.
          runner.vy = JUMP_V;
          runner.grounded = false;
        }
      }
    }
    runner.ducking = runner.grounded && ducking;

    for (const o of obstacles) {
      o.x -= dx;
      if (o.type === 'bird') {
        o.x -= 40 * dt;
        o.flap += dt * 10;
      }
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -20);
    for (const p of pebbles) {
      p.x -= dx;
      if (p.x < -10) {
        p.x = W + Math.random() * 40;
        p.y = GROUND + 8 + Math.random() * 56;
      }
    }

    nextSpawn -= dx;
    if (nextSpawn <= 0) spawnObstacle();

    if (collides()) {
      dead = true;
      gameOver();
      return;
    }
    updateStats();
  }

  function hitbox() {
    const h = runner.ducking ? DUCK_H : STAND_H;
    const w = runner.ducking ? RUNNER_W + 14 : RUNNER_W;
    return { x: RUNNER_X - w / 2 + 3, y: runner.y - h + 4, w: w - 6, h: h - 6 };
  }

  function collides() {
    const r = hitbox();
    return obstacles.some((o) => {
      const inset = o.type === 'bird' ? 4 : 3;
      return r.x < o.x + o.w - inset && r.x + r.w > o.x + inset && r.y < o.y + o.h - inset && r.y + r.h > o.y + inset;
    });
  }

  // ----- Flow -----

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Dune Runner',
      title: 'Run for it',
      message: 'Space or tap to jump, hold for a higher leap. Down to duck.',
      actions: [{ label: 'Run', icon: 'play', onClick: start }],
    });
  }

  function start() {
    if (ctx.status === 'running') return;
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  function gameOver() {
    loop.stop();
    ctx.setStatus('over');
    keys.releaseAll();
    const final = score();
    const { best, isNew } = ctx.storage.submitRecord('best', final);
    updateStats();
    render();
    ctx.overlay.show({
      kicker: 'Tripped up',
      title: `${final} points`,
      badge: isNew && final > 0 ? 'New best' : null,
      stats: [
        { label: 'Pace', value: `${(speed / START_SPEED).toFixed(1)}×` },
        { label: 'Best', value: best ?? 0, highlight: isNew && final > 0 },
      ],
      actions: [{ label: 'Run again', icon: 'restart', onClick: restart }],
      suggest: true,
      delay: 450,
    });
  }

  function restart() {
    loop.stop();
    reset();
    ctx.overlay.hide();
    ctx.setStatus('running');
    loop.start();
  }

  // ----- Rendering -----

  function dunes(offset, base, amp, period, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 8) {
      const t = (x + offset) / period;
      g.lineTo(x, base - Math.sin(t) * amp - Math.sin(t * 0.47 + 1.3) * amp * 0.6);
    }
    g.lineTo(W, GROUND);
    g.closePath();
    g.fill();
  }

  function drawCactus(x, y, w, h) {
    const color = palette.sageDeep;
    fillRoundRect(g, x + w / 2 - 5, y, 10, h, 5, color);
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x + w / 2 - 4, y + h * 0.55);
    g.lineTo(x + 1, y + h * 0.55);
    g.lineTo(x + 1, y + h * 0.28);
    g.moveTo(x + w / 2 + 4, y + h * 0.42);
    g.lineTo(x + w - 1, y + h * 0.42);
    g.lineTo(x + w - 1, y + h * 0.18);
    g.stroke();
  }

  function drawObstacle(o) {
    if (o.type === 'cactus') drawCactus(o.x, o.y, o.w, o.h);
    else if (o.type === 'group') {
      drawCactus(o.x, o.y + 8, 20, o.h - 8);
      drawCactus(o.x + 22, o.y, 24, o.h);
    } else if (o.type === 'rock') {
      g.fillStyle = palette.clay;
      g.beginPath();
      g.moveTo(o.x, o.y + o.h);
      g.quadraticCurveTo(o.x + 2, o.y + 4, o.x + o.w * 0.45, o.y);
      g.quadraticCurveTo(o.x + o.w, o.y + 2, o.x + o.w, o.y + o.h);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(o.x + 8, o.y + 5, 8, 3);
    } else {
      // Bird: body and flapping wings
      const wing = Math.sin(o.flap) * 9;
      g.strokeStyle = palette.inkSoft;
      g.fillStyle = palette.inkSoft;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.ellipse(o.x + 19, o.y + 10, 12, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(o.x + 12, o.y + 9);
      g.quadraticCurveTo(o.x + 4, o.y + 4 - wing, o.x - 2, o.y + 6 - wing);
      g.moveTo(o.x + 24, o.y + 9);
      g.quadraticCurveTo(o.x + 30, o.y + 2 - wing, o.x + 38, o.y + 4 - wing);
      g.stroke();
      g.fillStyle = palette.mustard;
      g.beginPath();
      g.moveTo(o.x + 6, o.y + 9);
      g.lineTo(o.x, o.y + 11);
      g.lineTo(o.x + 6, o.y + 12);
      g.fill();
    }
  }

  function drawRunner() {
    const x = RUNNER_X;
    const y = runner.y;
    g.strokeStyle = palette.ink;
    g.fillStyle = palette.ink;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    if (runner.ducking) {
      g.beginPath();
      g.arc(x + 16, y - 20, 7, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(x + 9, y - 17);
      g.lineTo(x - 10, y - 14);
      const s = Math.sin(phase * 1.4) * 6;
      g.moveTo(x - 10, y - 14);
      g.lineTo(x - 4 + s, y);
      g.moveTo(x - 10, y - 14);
      g.lineTo(x - 16 - s, y);
      g.moveTo(x + 2, y - 16);
      g.lineTo(x + 12, y - 8);
      g.stroke();
      return;
    }

    const airborne = !runner.grounded;
    const swing = airborne ? 0.7 : Math.sin(phase);
    const hip = { x, y: y - 20 };
    const neck = { x: x + 3, y: y - 36 };

    g.beginPath();
    g.arc(x + 5, y - 44, 7.5, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.moveTo(neck.x, neck.y);
    g.lineTo(hip.x, hip.y);
    // Legs
    const leg = (s) => {
      const knee = { x: hip.x + s * 9, y: hip.y + 10 };
      const foot = airborne
        ? { x: hip.x + s * 6 - 6, y: hip.y + 16 }
        : { x: hip.x + s * 13, y: y - Math.max(0, -s) * 6 };
      g.moveTo(hip.x, hip.y);
      g.lineTo(knee.x, knee.y);
      g.lineTo(foot.x, foot.y);
    };
    leg(swing);
    leg(-swing);
    // Arms
    const arm = (s) => {
      const elbow = { x: neck.x - s * 8, y: neck.y + 8 };
      g.moveTo(neck.x, neck.y + 2);
      g.lineTo(elbow.x, elbow.y);
      g.lineTo(elbow.x + 6, elbow.y + 6 - s * 4);
    };
    arm(swing);
    arm(-swing);
    g.stroke();

    // Scarf, a small splash of the accent color
    g.strokeStyle = palette.accent;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(neck.x, neck.y - 1);
    g.quadraticCurveTo(neck.x - 10, neck.y - 4 + Math.sin(phase * 2) * 2, neck.x - 18, neck.y + 2);
    g.stroke();
  }

  function render() {
    g.fillStyle = '#f6e9d9';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#f0c9a4';
    g.beginPath();
    g.arc(W - 120, 84, 34, 0, Math.PI * 2);
    g.fill();

    dunes(distance * 0.12, GROUND - 70, 18, 160, '#efd8bb');
    dunes(distance * 0.35 + 400, GROUND - 30, 14, 110, '#e6c8a1');

    g.fillStyle = '#ddb98c';
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = palette.clay;
    g.globalAlpha = 0.45;
    g.fillRect(0, GROUND, W, 2);
    for (const p of pebbles) g.fillRect(p.x, p.y, p.w, 2);
    g.globalAlpha = 1;

    for (const o of obstacles) drawObstacle(o);
    drawRunner();

    // Score, top right
    g.textAlign = 'right';
    g.font = font(16, 650);
    g.fillStyle = palette.inkSoft;
    g.fillText(String(score()).padStart(5, '0'), W - 20, 34);
    const best = ctx.storage.getRecord('best');
    if (best) {
      g.font = font(12, 600);
      g.fillStyle = palette.muted;
      g.fillText(`BEST ${String(best).padStart(5, '0')}`, W - 20, 54);
    }
  }

  view.onResize(() => render());

  reset();
  render();
  showStart();

  return {
    pause: () => {
      loop.stop();
      keys.releaseAll();
    },
    resume: () => loop.start(),
    restart,
    destroy: () => loop.stop(),
  };
}
