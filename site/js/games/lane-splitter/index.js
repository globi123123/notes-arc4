/**
 * Lane Splitter: a top-down motorcycle ride through highway traffic.
 *
 * The road scrolls at the bike's speed. Traffic drives in the same
 * direction but slower, so cars appear at the top and slide toward the
 * player. Throttle and brake change the bike's speed (and the score rate),
 * steering is analog so the bike can ride between lanes.
 */

import { createGameCanvas, fillRoundRect, roundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { capturePointer, createKeyboard, createTouchControls } from '../../lib/input.js';
import { font, palette } from '../../lib/palette.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { chance, clamp, pick, randomRange } from '../../lib/random.js';

const W = 400;
const H = 640;
const LANES = 4;
const ROAD_LEFT = 62;
const ROAD_RIGHT = W - 62;
const LANE_W = (ROAD_RIGHT - ROAD_LEFT) / LANES;
const BIKE_Y = H - 150;
const BIKE_SCALE = 1.22;
const BIKE_LEN = 56;
const BIKE_HIT = { w: 14, h: 46 };
const KMH = 0.27; // km/h per px/s of scroll speed

const laneCenter = (lane) => ROAD_LEFT + LANE_W * (lane + 0.5);

const VEHICLES = [
  {
    kind: 'car',
    w: 34,
    h: 62,
    colors: [palette.slate, palette.mustard, palette.cream, palette.sage, palette.rose, '#8a8f96'],
  },
  { kind: 'car', w: 34, h: 58, colors: [palette.teal, palette.clay, '#d9d4c8', palette.slate] },
  { kind: 'van', w: 38, h: 74, colors: ['#e4dfd3', palette.sage, '#9aa3ab'] },
  { kind: 'truck', w: 42, h: 118, colors: [palette.accent, palette.slate, palette.sageDeep] },
];

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: W, height: H, minHeight: 0.6, label: 'Highway with your motorcycle' });
  const g = view.ctx;
  const keys = createKeyboard(ctx);

  let bike;
  let traffic;
  let hazards;
  let scenery;
  let particles;
  let popups;
  let speed;
  let elapsed;
  let distance;
  let score;
  let scroll;
  let spawnTimer;
  let hazardTimer;
  let crashed;
  let crashTimer;
  let shake;
  let combo;
  let comboTimer;
  let pointerTarget = null;
  let topSpeed = 0;

  const loop = createLoop({ update, render });

  function reset() {
    bike = { x: laneCenter(1) + LANE_W / 2, vx: 0, lean: 0, wobble: 0 };
    traffic = [];
    hazards = [];
    particles = [];
    popups = [];
    scenery = [];
    for (let y = -40; y < H + 40; y += 70) addScenery(y);
    speed = 320;
    elapsed = 0;
    distance = 0;
    score = 0;
    scroll = 0;
    spawnTimer = 0.6;
    hazardTimer = 12;
    crashed = false;
    crashTimer = 0;
    shake = 0;
    combo = 0;
    comboTimer = 0;
    topSpeed = 0;
    updateStats();
  }

  // ----- Difficulty curve -----
  const baseSpeed = () => Math.min(880, 320 + elapsed * 5);
  const spawnInterval = () => Math.max(0.42, 1.05 - elapsed * 0.006);

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({
      score: Math.floor(score).toLocaleString('en-US'),
      distance: `${distance.toFixed(2)} km`,
      speed: `${Math.round(speed * KMH)} km/h`,
      best: Math.max(best, Math.floor(score)).toLocaleString('en-US'),
    });
  }

  // ----- Spawning -----

  function addScenery(y) {
    for (const side of [0, 1]) {
      if (!chance(0.75)) continue;
      const x = side === 0 ? randomRange(8, ROAD_LEFT - 22) : randomRange(ROAD_RIGHT + 22, W - 8);
      const type = chance(0.55) ? 'bush' : chance(0.55) ? 'rock' : 'tree';
      scenery.push({ x, y: y + randomRange(-20, 20), type, r: randomRange(9, 15) });
    }
  }

  function laneBusy(lane, top, bottom) {
    return traffic.some((v) => Math.abs(v.x - laneCenter(lane)) < LANE_W * 0.7 && v.y < bottom && v.y + v.h > top);
  }

  function spawnVehicle() {
    // Keep at least one lane open across the band where new cars appear,
    // so there is always a way through.
    const busyLanes = [0, 1, 2, 3].filter((lane) => laneBusy(lane, -260, 120));
    const options = [0, 1, 2, 3].filter((lane) => !laneBusy(lane, -260, 40));
    if (options.length === 0 || busyLanes.length >= LANES - 1) return;

    const lane = pick(options);
    const model = elapsed > 20 && chance(0.18) ? VEHICLES[3] : pick(VEHICLES.slice(0, 3));
    const base = baseSpeed();
    traffic.push({
      x: laneCenter(lane) + randomRange(-4, 4),
      y: -model.h - 10,
      w: model.w,
      h: model.h,
      kind: model.kind,
      color: pick(model.colors),
      lane,
      speed: base * randomRange(0.38, model.kind === 'truck' ? 0.5 : 0.66),
      passed: false,
      change: null, // planned lane change
    });
  }

  function spawnHazard() {
    const lane = Math.floor(Math.random() * LANES);
    if (laneBusy(lane, -200, 60)) return;
    if (elapsed > 35 && chance(0.5)) {
      // Road works: a diagonal row of cones closing most of a lane.
      const dir = lane < 2 ? 1 : -1;
      for (let i = 0; i < 4; i += 1) {
        hazards.push({
          type: 'cone',
          x: laneCenter(lane) - dir * (LANE_W * 0.32) + dir * i * (LANE_W * 0.22),
          y: -40 - i * 34,
          r: 7,
        });
      }
    } else {
      hazards.push({ type: 'oil', x: laneCenter(lane) + randomRange(-12, 12), y: -40, r: 18, hit: false });
    }
  }

  // ----- Input -----

  for (const action of ['left', 'right', 'up', 'down']) {
    keys.on(action, () => {
      if (action === 'left' || action === 'right') pointerTarget = null;
      if (ctx.status === 'idle') start();
    });
  }
  keys.on('action', () => ctx.status === 'idle' && start());

  const steerToPointer = (event) => {
    if (event.pointerType === 'mouse' && event.buttons !== 1) return;
    pointerTarget = view.toLogical(event).x;
  };
  ctx.listen(view.canvas, 'pointerdown', (event) => {
    if (ctx.status === 'idle') start();
    capturePointer(view.canvas, event.pointerId);
    pointerTarget = view.toLogical(event).x;
  });
  ctx.listen(view.canvas, 'pointermove', steerToPointer);
  const releasePointer = () => {
    pointerTarget = null;
  };
  ctx.listen(view.canvas, 'pointerup', releasePointer);
  ctx.listen(view.canvas, 'pointercancel', releasePointer);

  createTouchControls(ctx, keys, [
    [{ action: 'left', icon: 'chevronLeft', label: 'Steer left', variant: 'wide' }],
    [
      { action: 'down', icon: 'chevronDown', label: 'Brake' },
      { action: 'up', icon: 'chevronUp', label: 'Throttle', variant: 'accent' },
    ],
    [{ action: 'right', icon: 'chevronRight', label: 'Steer right', variant: 'wide' }],
  ]);

  // ----- Simulation -----

  function update(dt) {
    updateParticles(dt);
    popups = popups.filter((p) => (p.t += dt) < 1);
    if (shake > 0) shake = Math.max(0, shake - dt * 2.5);

    if (crashed) {
      crashTimer += dt;
      speed = Math.max(0, speed - 900 * dt);
      scrollWorld(dt);
      bike.lean += dt * 9;
      if (crashTimer > 0.9) gameOver();
      return;
    }

    elapsed += dt;

    // Speed: throttle and brake pull toward a target around the base speed.
    const base = baseSpeed();
    const throttle = keys.isDown('up');
    const brake = keys.isDown('down');
    const target = throttle ? base * 1.28 : brake ? base * 0.55 : base;
    const rate = brake ? 520 : throttle ? 260 : 180;
    speed += clamp(target - speed, -rate * dt, rate * dt);

    // Steering: analog lateral velocity with a little inertia.
    let steer = keys.axis('left', 'right');
    if (steer === 0 && pointerTarget !== null) steer = clamp((pointerTarget - bike.x) / 36, -1, 1);
    const maxLateral = 250 + speed * 0.22;
    bike.vx += (steer * maxLateral - bike.vx) * Math.min(1, dt * 9);
    if (bike.wobble > 0) {
      bike.wobble -= dt;
      bike.vx += Math.sin(elapsed * 38) * 900 * dt;
    }
    bike.x += bike.vx * dt;
    const minX = ROAD_LEFT + 10;
    const maxX = ROAD_RIGHT - 10;
    if (bike.x < minX || bike.x > maxX) {
      bike.x = clamp(bike.x, minX, maxX);
      bike.vx *= -0.3;
    }
    bike.lean = clamp(bike.vx / maxLateral, -1, 1) * 0.32;

    scrollWorld(dt);

    // Traffic
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnVehicle();
      spawnTimer = spawnInterval() * randomRange(0.7, 1.3);
    }
    hazardTimer -= dt;
    if (hazardTimer <= 0) {
      spawnHazard();
      hazardTimer = randomRange(6, 11);
    }
    updateTraffic(dt);

    // Score and distance
    distance += (speed * KMH * dt) / 3600;
    score += (speed / 100) * dt * 9 * (throttle ? 1.6 : 1);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    checkCollisions();
    updateStats();
  }

  function scrollWorld(dt) {
    const dy = speed * dt;
    scroll += dy;
    for (const s of scenery) s.y += dy;
    for (const hz of hazards) hz.y += dy;
    scenery = scenery.filter((s) => s.y < H + 40);
    while (scenery.length < 26) {
      const top = Math.min(...scenery.map((s) => s.y), H);
      addScenery(top - 70);
    }
    hazards = hazards.filter((hz) => hz.y < H + 60);
    if (crashed) for (const v of traffic) v.y += (speed - v.speed * 0.5) * dt;
  }

  function updateTraffic(dt) {
    for (const v of traffic) {
      v.y += (speed - v.speed) * dt;

      // Occasionally a car signals and changes lane once things get busy.
      if (!v.change && elapsed > 22 && v.kind !== 'truck' && v.y > 20 && v.y < 200 && chance(dt * 0.25)) {
        const dir = v.lane === 0 ? 1 : v.lane === LANES - 1 ? -1 : chance(0.5) ? 1 : -1;
        const lane = v.lane + dir;
        if (!laneBusy(lane, v.y - 60, v.y + v.h + 60)) v.change = { lane, dir, t: 0 };
      }
      if (v.change) {
        v.change.t += dt;
        if (v.change.t > 0.9) {
          const targetX = laneCenter(v.change.lane);
          v.x += clamp(targetX - v.x, -70 * dt, 70 * dt);
          if (Math.abs(targetX - v.x) < 0.5) {
            v.lane = v.change.lane;
            v.change = null;
          }
        }
      }

      // Near miss: a car slides past the bike without touching it.
      if (!v.passed && v.y > BIKE_Y + BIKE_LEN) {
        v.passed = true;
        const gap = Math.abs(v.x - bike.x) - (v.w / 2 + BIKE_HIT.w / 2);
        if (gap < 14) {
          combo += 1;
          comboTimer = 2.5;
          const bonus = 50 * combo;
          score += bonus;
          popups.push({
            x: bike.x,
            y: BIKE_Y - 18,
            text: combo > 1 ? `Close call x${combo}  +${bonus}` : `Close call  +${bonus}`,
            t: 0,
          });
        }
      }
    }
    traffic = traffic.filter((v) => v.y < H + 20 && v.y > -v.h - 400);
  }

  function checkCollisions() {
    const bx = bike.x - BIKE_HIT.w / 2;
    const by = BIKE_Y + (BIKE_LEN - BIKE_HIT.h) / 2;
    for (const v of traffic) {
      const inset = 3;
      if (
        bx < v.x + v.w / 2 - inset &&
        bx + BIKE_HIT.w > v.x - v.w / 2 + inset &&
        by < v.y + v.h - inset &&
        by + BIKE_HIT.h > v.y + inset
      ) {
        crash();
        return;
      }
    }
    for (const hz of hazards) {
      const dx = clamp(hz.x, bx, bx + BIKE_HIT.w) - hz.x;
      const dy = clamp(hz.y, by, by + BIKE_HIT.h) - hz.y;
      if (dx * dx + dy * dy > hz.r * hz.r) continue;
      if (hz.type === 'cone') {
        crash();
        return;
      }
      if (hz.type === 'oil' && !hz.hit) {
        hz.hit = true;
        bike.wobble = 0.7;
        speed *= 0.85;
        popups.push({ x: bike.x, y: BIKE_Y - 18, text: 'Slippery!', t: 0 });
      }
    }
  }

  function crash() {
    crashed = true;
    crashTimer = 0;
    shake = prefersReducedMotion() ? 0 : 1;
    if (!prefersReducedMotion()) {
      for (let i = 0; i < 26; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = randomRange(60, 260);
        particles.push({
          x: bike.x,
          y: BIKE_Y + 14,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: randomRange(0.3, 0.8),
          color: chance(0.5) ? palette.mustard : palette.accent,
        });
      }
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // ----- Flow -----

  function showStart() {
    ctx.setStatus('idle');
    ctx.overlay.show({
      kicker: 'Lane Splitter',
      title: 'Hit the road',
      message: 'Steer with the arrow keys, throttle with Up, brake with Down. On touch, hold where you want to go.',
      actions: [{ label: 'Ride', icon: 'play', onClick: start }],
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
    const final = Math.floor(score);
    const { best, isNew } = ctx.storage.submitRecord('best', final);
    ctx.storage.submitRecord('distance', Math.round(distance * 100) / 100);
    updateStats();
    ctx.showRecords([
      { label: 'Best score', value: (ctx.storage.getRecord('best') ?? 0).toLocaleString('en-US') },
      { label: 'Longest ride', value: `${(ctx.storage.getRecord('distance') ?? 0).toFixed(2)} km` },
    ]);
    ctx.overlay.show({
      kicker: 'Crashed',
      title: `${final.toLocaleString('en-US')} points`,
      badge: isNew && final > 0 ? 'New best' : null,
      stats: [
        { label: 'Distance', value: `${distance.toFixed(2)} km` },
        { label: 'Top speed', value: `${Math.round(topSpeed * KMH)} km/h` },
        { label: 'Best', value: (best ?? 0).toLocaleString('en-US'), highlight: isNew && final > 0 },
      ],
      actions: [{ label: 'Ride again', icon: 'restart', onClick: restart }],
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

  function drawScenery(s) {
    if (s.type === 'bush') {
      g.fillStyle = 'rgba(34,33,31,0.08)';
      g.beginPath();
      g.arc(s.x + 4, s.y + 5, s.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = palette.sage;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#93a084';
      g.beginPath();
      g.arc(s.x + s.r * 0.35, s.y - s.r * 0.3, s.r * 0.55, 0, Math.PI * 2);
      g.fill();
    } else if (s.type === 'rock') {
      g.fillStyle = '#cdbfa6';
      g.beginPath();
      g.ellipse(s.x, s.y, s.r * 0.7, s.r * 0.5, 0.3, 0, Math.PI * 2);
      g.fill();
    } else {
      // Tree seen from above: shadow, canopy and a lighter crown.
      g.fillStyle = 'rgba(34,33,31,0.1)';
      g.beginPath();
      g.arc(s.x + 6, s.y + 7, s.r * 1.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = palette.sageDeep;
      g.beginPath();
      g.arc(s.x, s.y, s.r * 1.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = palette.sage;
      g.beginPath();
      g.arc(s.x - s.r * 0.25, s.y - s.r * 0.3, s.r * 0.8, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawRoad() {
    // Verge
    g.fillStyle = '#e8dcc4';
    g.fillRect(0, 0, W, H);
    for (const s of scenery) drawScenery(s);

    // Asphalt with subtle scrolling texture
    g.fillStyle = '#3b3936';
    g.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, H);
    // Tar seams and worn wheel tracks make the motion readable.
    const texture = scroll % 240;
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = -240 + texture; y < H; y += 240) {
      g.fillRect(ROAD_LEFT + 8, y, ROAD_RIGHT - ROAD_LEFT - 16, 1.5);
      g.fillRect(ROAD_LEFT + 60, y + 130, 90, 1.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.018)';
    for (let lane = 0; lane < LANES; lane += 1) {
      const cx = laneCenter(lane);
      g.fillRect(cx - 14, 0, 7, H);
      g.fillRect(cx + 7, 0, 7, H);
    }

    // Rumble strips
    const stripe = 18;
    const offset = scroll % (stripe * 2);
    for (let y = -stripe * 2 + offset; y < H; y += stripe * 2) {
      for (const x of [ROAD_LEFT - 8, ROAD_RIGHT]) {
        g.fillStyle = palette.accent;
        g.fillRect(x, y, 8, stripe);
        g.fillStyle = palette.cream;
        g.fillRect(x, y + stripe, 8, stripe);
      }
    }

    // Edge lines
    g.fillStyle = 'rgba(251,250,247,0.85)';
    g.fillRect(ROAD_LEFT + 4, 0, 3, H);
    g.fillRect(ROAD_RIGHT - 7, 0, 3, H);

    // Lane dashes
    const dash = 30;
    const gap = 34;
    const dashOffset = scroll % (dash + gap);
    g.fillStyle = 'rgba(251,250,247,0.7)';
    for (let lane = 1; lane < LANES; lane += 1) {
      const x = ROAD_LEFT + LANE_W * lane - 1.5;
      for (let y = -(dash + gap) + dashOffset; y < H; y += dash + gap) g.fillRect(x, y, 3, dash);
    }

    // Speed streaks at high speed
    if (!prefersReducedMotion() && speed > 520) {
      const alpha = Math.min(0.22, (speed - 520) / 1500);
      g.strokeStyle = `rgba(251,250,247,${alpha})`;
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i += 1) {
        const x = ROAD_LEFT + 14 + ((i * 53 + 17) % (ROAD_RIGHT - ROAD_LEFT - 28));
        const y = ((scroll * 1.6 + i * 137) % (H + 120)) - 120;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 60);
        g.stroke();
      }
    }
  }

  function drawHazard(hz) {
    if (hz.type === 'oil') {
      g.fillStyle = 'rgba(20,20,20,0.55)';
      g.beginPath();
      g.ellipse(hz.x, hz.y, hz.r, hz.r * 0.7, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(160,170,190,0.18)';
      g.beginPath();
      g.ellipse(hz.x - 4, hz.y - 3, hz.r * 0.45, hz.r * 0.25, 0.4, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.arc(hz.x + 2, hz.y + 3, hz.r + 1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e07a4f';
      g.beginPath();
      g.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = palette.cream;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(hz.x, hz.y, hz.r * 0.55, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function drawVehicle(v) {
    const x = v.x - v.w / 2;
    const y = v.y;
    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(g, x + 3, y + 5, v.w, v.h, 8);
    g.fill();

    if (v.kind === 'truck') {
      // Trailer and cab
      fillRoundRect(g, x, y, v.w, v.h - 30, 4, v.color);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 1; i < 4; i += 1) g.fillRect(x + 4, y + i * ((v.h - 30) / 4), v.w - 8, 1.5);
      fillRoundRect(g, x + 2, y + v.h - 28, v.w - 4, 28, 6, '#d9d4c8');
      fillRoundRect(g, x + 6, y + v.h - 26, v.w - 12, 8, 3, 'rgba(34,33,31,0.6)');
    } else {
      fillRoundRect(g, x, y, v.w, v.h, 9, v.color);
      // Roof and windows (rear of the car faces the player)
      const roofTop = y + v.h * 0.26;
      const roofH = v.h * 0.42;
      fillRoundRect(g, x + 5, roofTop, v.w - 10, roofH, 6, 'rgba(34,33,31,0.12)');
      fillRoundRect(g, x + 5, roofTop - 7, v.w - 10, 9, 4, 'rgba(34,33,31,0.62)');
      fillRoundRect(g, x + 6, roofTop + roofH - 2, v.w - 12, 8, 3, 'rgba(34,33,31,0.5)');
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(x + 4, y + 4, v.w - 8, 2);
    }
    // Tail lights, plus a blinking indicator when changing lanes
    g.fillStyle = '#b4483a';
    g.fillRect(x + 3, y + v.h - 4, 7, 3);
    g.fillRect(x + v.w - 10, y + v.h - 4, 7, 3);
    if (v.change && Math.floor(v.change.t * 4) % 2 === 0) {
      g.fillStyle = palette.mustard;
      const ix = v.change.dir < 0 ? x - 1 : x + v.w - 5;
      g.fillRect(ix, y + 2, 6, 5);
      g.fillRect(ix, y + v.h - 7, 6, 5);
    }
  }

  function drawBike() {
    g.save();
    g.translate(bike.x, BIKE_Y + BIKE_LEN / 2);
    g.rotate(bike.lean);
    g.scale(BIKE_SCALE, BIKE_SCALE);

    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(4, 6, 10, 24, 0, 0, Math.PI * 2);
    g.fill();

    // Tyres
    fillRoundRect(g, -3.5, -26, 7, 14, 3.5, palette.ink);
    fillRoundRect(g, -4, 12, 8, 15, 4, palette.ink);

    // Body and tank
    g.fillStyle = palette.accent;
    g.beginPath();
    g.moveTo(-6, -15);
    g.quadraticCurveTo(0, -22, 6, -15);
    g.lineTo(7, 10);
    g.quadraticCurveTo(0, 18, -7, 10);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(-1.2, -16, 2.4, 10);

    // Handlebars and mirrors
    g.strokeStyle = palette.ink;
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-12, -11);
    g.lineTo(12, -11);
    g.stroke();
    g.fillStyle = palette.inkSoft;
    g.fillRect(-14, -14, 3, 3);
    g.fillRect(11, -14, 3, 3);

    // Rider: shoulders, arms and helmet
    fillRoundRect(g, -9, -3, 18, 12, 6, palette.ink);
    g.strokeStyle = palette.ink;
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(-7, -1);
    g.lineTo(-10, -10);
    g.moveTo(7, -1);
    g.lineTo(10, -10);
    g.stroke();
    g.fillStyle = '#2d2b28';
    g.beginPath();
    g.arc(0, -4, 6.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = palette.cream;
    g.beginPath();
    g.ellipse(0, -7.5, 3.6, 1.6, 0, 0, Math.PI * 2);
    g.fill();

    // Tail light
    g.fillStyle = '#e0634a';
    g.fillRect(-2.5, 14, 5, 2);

    g.restore();
  }

  function render() {
    g.save();
    if (shake > 0) g.translate(randomRange(-6, 6) * shake, randomRange(-6, 6) * shake);
    drawRoad();
    for (const hz of hazards) drawHazard(hz);
    for (const v of traffic) drawVehicle(v);
    drawBike();

    for (const p of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      g.fillStyle = p.color;
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    g.restore();

    // Floating texts
    g.textAlign = 'center';
    g.font = font(14, 650);
    for (const p of popups) {
      g.globalAlpha = 1 - p.t;
      g.fillStyle = palette.cream;
      g.fillText(p.text, p.x + 1, p.y - p.t * 40 + 1);
      g.fillStyle = palette.ink;
      g.fillText(p.text, p.x, p.y - p.t * 40);
    }
    g.globalAlpha = 1;

    // Speed readout
    topSpeed = Math.max(topSpeed, speed);
    const kmh = Math.round(speed * KMH);
    fillRoundRect(g, 12, H - 50, 92, 36, 12, 'rgba(34,33,31,0.78)');
    g.textAlign = 'left';
    g.fillStyle = palette.cream;
    g.font = font(18, 650);
    g.fillText(String(kmh), 24, H - 26);
    const numberWidth = g.measureText(String(kmh)).width;
    g.font = font(10, 600);
    g.fillStyle = 'rgba(251,250,247,0.7)';
    g.fillText('KM/H', 24 + numberWidth + 5, H - 26);
    if (combo > 1) {
      fillRoundRect(g, W - 104, H - 50, 92, 36, 12, palette.accent);
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.font = font(13, 650);
      g.fillText(`Combo x${combo}`, W - 58, H - 27);
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
