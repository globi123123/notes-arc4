/** Asteroid Belt: rotate, thrust and shoot through waves of splitting rocks. */

import { createGameCanvas } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createKeyboard, createTouchControls } from '../../lib/input.js';
import { font, palette } from '../../lib/palette.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { randomRange, seeded } from '../../lib/random.js';

const W = 600;
const H = 600;
const SHIP_R = 12;
const ROTATE_SPEED = 4.3;
const THRUST = 270;
const MAX_SPEED = 390;
const BULLET_SPEED = 540;
const BULLET_LIFE = 0.85;
const FIRE_COOLDOWN = 0.17;
const MAX_BULLETS = 6;
const SIZES = {
  3: { r: 44, points: 20, speed: [28, 58] },
  2: { r: 24, points: 50, speed: [48, 92] },
  1: { r: 13, points: 100, speed: [78, 128] },
};
const EXTRA_LIFE_EVERY = 10000;

// Fixed starfield so the background does not flicker between games.
const STARS = (() => {
  const rng = seeded(42);
  return Array.from({ length: 90 }, () => ({
    x: rng() * W,
    y: rng() * H,
    r: rng() < 0.15 ? 1.6 : 0.9,
    a: 0.3 + rng() * 0.5,
  }));
})();

const wrap = (value, max) => ((value % max) + max) % max;

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: W, height: H, label: 'Asteroid field' });
  const g = view.ctx;
  const keys = createKeyboard(ctx, {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    fire: ['Space', 'KeyJ'],
  });

  let ship;
  let rocks;
  let bullets;
  let particles;
  let score;
  let lives;
  let wave;
  let fireTimer;
  let respawnTimer;
  let waveTimer;
  let nextExtraLife;
  let banner;
  let time = 0;

  const loop = createLoop({ update, render });

  function newShip() {
    return { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invulnerable: 2.4, thrusting: false };
  }

  function makeRock(size, x, y) {
    const spec = SIZES[size];
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(...spec.speed) * (1 + (wave - 1) * 0.06);
    const sides = 10 + Math.floor(Math.random() * 3);
    const shape = Array.from({ length: sides }, () => randomRange(0.74, 1.12));
    return {
      size,
      x,
      y,
      r: spec.r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: 0,
      spin: randomRange(-1, 1),
      shape,
    };
  }

  function startWave() {
    const count = Math.min(11, 3 + wave);
    rocks = [];
    for (let i = 0; i < count; i += 1) {
      // Spawn along the edges, away from the ship.
      let x;
      let y;
      do {
        x = Math.random() * W;
        y = Math.random() * H;
      } while (ship && Math.hypot(x - ship.x, y - ship.y) < 180);
      rocks.push(makeRock(3, x, y));
    }
    banner = { text: `Wave ${wave}`, t: 1.6 };
    updateStats();
  }

  function reset() {
    score = 0;
    lives = 3;
    wave = 1;
    fireTimer = 0;
    respawnTimer = 0;
    waveTimer = 0;
    nextExtraLife = EXTRA_LIFE_EVERY;
    bullets = [];
    particles = [];
    ship = newShip();
    startWave();
  }

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({
      score: score.toLocaleString('en-US'),
      lives,
      wave,
      best: Math.max(best, score).toLocaleString('en-US'),
    });
  }

  // ----- Input -----

  for (const action of ['left', 'right', 'up', 'fire']) keys.on(action, () => ctx.status === 'idle' && start());

  createTouchControls(ctx, keys, [
    [
      { action: 'left', icon: 'restart', label: 'Rotate left' },
      { action: 'right', icon: 'rotate', label: 'Rotate right' },
    ],
    'spacer',
    [
      { action: 'up', icon: 'thrust', label: 'Thrust' },
      { action: 'fire', icon: 'fire', label: 'Fire', variant: 'accent' },
    ],
  ]);

  // ----- Simulation -----

  function addBurst(x, y, color, count, speed = 160) {
    if (prefersReducedMotion()) count = Math.ceil(count / 4);
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = randomRange(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: randomRange(0.35, 0.9), color });
    }
  }

  function update(dt) {
    time += dt;
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const rock of rocks) {
      rock.x = wrap(rock.x + rock.vx * dt, W);
      rock.y = wrap(rock.y + rock.vy * dt, H);
      rock.rot += rock.spin * dt;
    }

    for (const b of bullets) {
      b.x = wrap(b.x + b.vx * dt, W);
      b.y = wrap(b.y + b.vy * dt, H);
      b.life -= dt;
    }
    bullets = bullets.filter((b) => b.life > 0);

    if (ship) updateShip(dt);
    else {
      respawnTimer -= dt;
      if (lives <= 0) {
        // Let the explosion play out before the game-over screen.
        if (respawnTimer <= 0) {
          gameOver();
          return;
        }
      } else {
        const clear = rocks.every((r) => Math.hypot(r.x - W / 2, r.y - H / 2) > r.r + 110);
        if (respawnTimer <= 0 && (clear || respawnTimer < -3)) ship = newShip();
      }
    }

    handleBulletHits();
    if (ship && ship.invulnerable <= 0) handleShipHits();

    if (rocks.length === 0) {
      waveTimer += dt;
      if (waveTimer > 1.4) {
        waveTimer = 0;
        wave += 1;
        startWave();
      }
    }
  }

  function updateShip(dt) {
    ship.angle += keys.axis('left', 'right') * ROTATE_SPEED * dt;
    ship.thrusting = keys.isDown('up');
    if (ship.thrusting) {
      ship.vx += Math.cos(ship.angle) * THRUST * dt;
      ship.vy += Math.sin(ship.angle) * THRUST * dt;
      if (!prefersReducedMotion() && Math.random() < 0.6) {
        const back = ship.angle + Math.PI + randomRange(-0.3, 0.3);
        particles.push({
          x: ship.x - Math.cos(ship.angle) * 12,
          y: ship.y - Math.sin(ship.angle) * 12,
          vx: Math.cos(back) * 120 + ship.vx,
          vy: Math.sin(back) * 120 + ship.vy,
          life: 0.25,
          color: palette.accent,
        });
      }
    }
    const damping = Math.exp(-0.55 * dt);
    ship.vx *= damping;
    ship.vy *= damping;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SPEED) {
      ship.vx *= MAX_SPEED / speed;
      ship.vy *= MAX_SPEED / speed;
    }
    ship.x = wrap(ship.x + ship.vx * dt, W);
    ship.y = wrap(ship.y + ship.vy * dt, H);
    if (ship.invulnerable > 0) ship.invulnerable -= dt;

    fireTimer -= dt;
    if (keys.isDown('fire') && fireTimer <= 0 && bullets.length < MAX_BULLETS) {
      fireTimer = FIRE_COOLDOWN;
      bullets.push({
        x: ship.x + Math.cos(ship.angle) * SHIP_R,
        y: ship.y + Math.sin(ship.angle) * SHIP_R,
        vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.5,
        vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.5,
        life: BULLET_LIFE,
      });
    }
  }

  /** Distance on a wrapping playfield. */
  function wrappedDistance(ax, ay, bx, by) {
    let dx = Math.abs(ax - bx);
    let dy = Math.abs(ay - by);
    if (dx > W / 2) dx = W - dx;
    if (dy > H / 2) dy = H - dy;
    return Math.hypot(dx, dy);
  }

  function handleBulletHits() {
    for (const b of bullets) {
      for (const rock of rocks) {
        if (wrappedDistance(b.x, b.y, rock.x, rock.y) > rock.r * 0.92) continue;
        b.life = 0;
        destroyRock(rock);
        break;
      }
    }
    bullets = bullets.filter((b) => b.life > 0);
  }

  function destroyRock(rock) {
    rocks.splice(rocks.indexOf(rock), 1);
    score += SIZES[rock.size].points;
    addBurst(rock.x, rock.y, '#d8cdbd', 6 + rock.size * 4, 120);
    if (rock.size > 1) for (let i = 0; i < 2; i += 1) rocks.push(makeRock(rock.size - 1, rock.x, rock.y));
    if (score >= nextExtraLife) {
      lives += 1;
      nextExtraLife += EXTRA_LIFE_EVERY;
      banner = { text: 'Extra ship', t: 1.4 };
    }
    updateStats();
  }

  function handleShipHits() {
    for (const rock of rocks) {
      if (wrappedDistance(ship.x, ship.y, rock.x, rock.y) > rock.r * 0.86 + SHIP_R * 0.7) continue;
      addBurst(ship.x, ship.y, palette.accent, 30, 220);
      addBurst(ship.x, ship.y, palette.cream, 14, 160);
      destroyRock(rock);
      ship = null;
      lives -= 1;
      respawnTimer = lives > 0 ? 1.5 : 1;
      updateStats();
      return;
    }
  }

  // ----- Flow -----

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Asteroid Belt',
      title: 'Clear the field',
      message: 'Rotate with the arrow keys, thrust with Up and hold Space to fire.',
      actions: [{ label: 'Launch', icon: 'play', onClick: start }],
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
    const { best, isNew } = ctx.storage.submitRecord('best', score);
    updateStats();
    render();
    ctx.overlay.show({
      kicker: 'Ship lost',
      title: `${score.toLocaleString('en-US')} points`,
      badge: isNew && score > 0 ? 'New best' : null,
      stats: [
        { label: 'Wave', value: wave },
        { label: 'Best', value: (best ?? 0).toLocaleString('en-US'), highlight: isNew && score > 0 },
      ],
      actions: [{ label: 'Play again', icon: 'restart', onClick: restart }],
      suggest: true,
      delay: 400,
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

  /** Draws something at its position and, near edges, at the wrapped copies. */
  function drawWrapped(x, y, r, draw) {
    const xs = [x];
    const ys = [y];
    if (x < r) xs.push(x + W);
    if (x > W - r) xs.push(x - W);
    if (y < r) ys.push(y + H);
    if (y > H - r) ys.push(y - H);
    for (const px of xs) for (const py of ys) draw(px, py);
  }

  function drawRock(rock) {
    drawWrapped(rock.x, rock.y, rock.r * 1.15, (x, y) => {
      g.beginPath();
      rock.shape.forEach((k, i) => {
        const a = rock.rot + (i / rock.shape.length) * Math.PI * 2;
        const px = x + Math.cos(a) * rock.r * k;
        const py = y + Math.sin(a) * rock.r * k;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.closePath();
      g.fillStyle = '#2c2a27';
      g.fill();
      g.strokeStyle = '#d8cdbd';
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.stroke();
    });
  }

  function drawShip() {
    if (!ship) return;
    if (ship.invulnerable > 0 && Math.floor(time * 10) % 2 === 0) return;
    drawWrapped(ship.x, ship.y, SHIP_R + 4, (x, y) => {
      g.save();
      g.translate(x, y);
      g.rotate(ship.angle + Math.PI / 2);
      if (ship.thrusting) {
        g.fillStyle = palette.accent;
        g.beginPath();
        g.moveTo(-5, 10);
        g.lineTo(0, 18 + Math.random() * 6);
        g.lineTo(5, 10);
        g.closePath();
        g.fill();
      }
      g.beginPath();
      g.moveTo(0, -SHIP_R - 3);
      g.lineTo(SHIP_R * 0.85, SHIP_R);
      g.lineTo(0, SHIP_R * 0.5);
      g.lineTo(-SHIP_R * 0.85, SHIP_R);
      g.closePath();
      g.fillStyle = palette.night;
      g.fill();
      g.strokeStyle = palette.cream;
      g.lineWidth = 2.2;
      g.lineJoin = 'round';
      g.stroke();
      g.restore();
    });
  }

  function render() {
    g.fillStyle = palette.night;
    g.fillRect(0, 0, W, H);
    for (const s of STARS) {
      g.globalAlpha = s.a;
      g.fillStyle = '#efe4d4';
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    for (const rock of rocks) drawRock(rock);

    g.fillStyle = palette.accent;
    for (const b of bullets) {
      g.beginPath();
      g.arc(b.x, b.y, 2.6, 0, Math.PI * 2);
      g.fill();
    }

    for (const p of particles) {
      g.globalAlpha = Math.min(1, p.life * 1.6);
      g.fillStyle = p.color;
      g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
    }
    g.globalAlpha = 1;

    drawShip();

    // Lives as tiny ships
    for (let i = 0; i < lives; i += 1) {
      g.save();
      g.translate(24 + i * 20, 26);
      g.strokeStyle = palette.cream;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(6, 7);
      g.lineTo(0, 4);
      g.lineTo(-6, 7);
      g.closePath();
      g.stroke();
      g.restore();
    }

    g.textAlign = 'right';
    g.font = font(15, 650);
    g.fillStyle = palette.cream;
    g.fillText(score.toLocaleString('en-US'), W - 20, 31);

    if (banner) {
      g.globalAlpha = Math.min(1, banner.t * 2);
      g.textAlign = 'center';
      g.font = font(26, 650);
      g.fillStyle = palette.cream;
      g.fillText(banner.text, W / 2, H / 2 - 60);
      g.globalAlpha = 1;
    }
  }

  view.onResize(() => render());

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
