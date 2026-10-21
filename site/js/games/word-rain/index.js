/**
 * Word Rain: words fall from the top, the player types them before they
 * land. A real <input> is used so every keyboard layout, IME and mobile
 * keyboard works; matching happens on the typed text, not on key codes.
 */

import { createGameCanvas, fillRoundRect, roundRect } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { h } from '../../lib/dom.js';
import { formatPercent } from '../../lib/format.js';
import { font, palette } from '../../lib/palette.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { randomRange } from '../../lib/random.js';
import { WORDS_BY_LENGTH } from './words.js';

const W = 640;
const H = 400;
const GROUND = H - 28;
const LIVES = 5;
const WORDS_PER_LEVEL = 8;

export default function mount(ctx) {
  const view = createGameCanvas(ctx, { width: W, height: H, maxHeight: 0.62, minHeight: 0.36, label: 'Falling words' });
  const g = view.ctx;

  const input = h('input', {
    class: 'wr-input',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
    inputmode: 'text',
    'aria-label': 'Type the falling words',
    placeholder: 'Start typing a word…',
    disabled: true,
  });
  const typedPreview = h('span', { class: 'wr-target', 'aria-live': 'off' });
  const bar = h('div', { class: 'wr-bar' }, h('label', { class: 'wr-field' }, input), typedPreview);
  ctx.stage.classList.add('wr-stage');
  ctx.stage.append(bar);

  let words;
  let score;
  let lives;
  let level;
  let completed;
  let spawnTimer;
  let activeTime;
  let typedChars;
  let correctKeys;
  let wrongKeys;
  let effects;
  let lastValue = '';

  const loop = createLoop({ update, render });

  function reset() {
    words = [];
    score = 0;
    lives = LIVES;
    level = 1;
    completed = 0;
    spawnTimer = 0.4;
    activeTime = 0;
    typedChars = 0;
    correctKeys = 0;
    wrongKeys = 0;
    effects = [];
    input.value = '';
    lastValue = '';
    syncInputState();
    updateStats();
  }

  // ----- Difficulty -----
  const spawnInterval = () => Math.max(0.8, 2.3 - (level - 1) * 0.16);
  const fallSpeed = () => 24 + (level - 1) * 5.5;
  function lengthRange() {
    if (level <= 1) return [3, 5];
    if (level <= 2) return [3, 6];
    if (level <= 4) return [4, 7];
    if (level <= 6) return [4, 9];
    return [5, 12];
  }

  const wpm = () => (activeTime > 3 ? typedChars / 5 / (activeTime / 60) : 0);
  const accuracy = () => (correctKeys + wrongKeys ? correctKeys / (correctKeys + wrongKeys) : null);

  function updateStats() {
    const best = ctx.storage.getRecord('best') ?? 0;
    ctx.setStats({
      score: score.toLocaleString('en-US'),
      wpm: Math.round(wpm()),
      accuracy: formatPercent(accuracy()),
      lives,
      best: Math.max(best, score).toLocaleString('en-US'),
    });
  }

  // ----- Words -----

  function pickWord() {
    const [min, max] = lengthRange();
    const onScreen = new Set(words.map((w) => w.text[0]));
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const length = Math.floor(randomRange(min, max + 1));
      const pool = WORDS_BY_LENGTH[length];
      if (!pool) continue;
      const text = pool[Math.floor(Math.random() * pool.length)];
      // Prefer words whose first letter is not already falling, so the
      // player's first keystroke clearly picks a target.
      if (!onScreen.has(text[0]) || attempt > 8) return text;
    }
    return WORDS_BY_LENGTH[4][0];
  }

  function spawnWord() {
    const text = pickWord();
    g.font = font(17, 600);
    const width = g.measureText(text).width + 28;
    words.push({
      text,
      width,
      x: randomRange(14, W - width - 14),
      y: -10,
      speed: fallSpeed() * randomRange(0.85, 1.2),
    });
  }

  /** The lowest falling word that starts with what the player typed. */
  function targetWord(value) {
    if (!value) return null;
    let best = null;
    for (const word of words) if (word.text.startsWith(value) && (!best || word.y > best.y)) best = word;
    return best;
  }

  // ----- Typing -----

  function normalized() {
    return input.value.toLowerCase().replace(/\s+/g, '');
  }

  function syncInputState() {
    const value = normalized();
    const target = targetWord(value);
    const wrong = value.length > 0 && !target;
    input.classList.toggle('is-wrong', wrong);
    typedPreview.textContent = target ? target.text : value ? 'No word starts like that' : '';
    typedPreview.classList.toggle('is-wrong', wrong);
  }

  function completeWord(word) {
    words.splice(words.indexOf(word), 1);
    completed += 1;
    typedChars += word.text.length + 1;
    // Longer words and words caught higher up are worth more.
    const heightBonus = Math.max(0, 1 - word.y / GROUND);
    score += Math.round(word.text.length * 10 * level * (1 + heightBonus * 0.5));
    if (!prefersReducedMotion())
      effects.push({ x: word.x + word.width / 2, y: word.y, t: 0, text: word.text, kind: 'hit' });
    if (completed % WORDS_PER_LEVEL === 0) {
      level += 1;
      effects.push({ x: W / 2, y: H / 2 - 30, t: 0, text: `Level ${level}`, kind: 'level' });
    }
    input.value = '';
    lastValue = '';
    updateStats();
  }

  ctx.listen(input, 'input', (event) => {
    if (ctx.status !== 'running') return;
    if (event.isComposing) return;
    const raw = input.value;
    const value = normalized();

    // A space or a finished word ends the attempt.
    const finished = words.find((w) => w.text === value);
    if (finished) {
      if (value.length > lastValue.length) correctKeys += 1;
      completeWord(finished);
      syncInputState();
      return;
    }
    if (/\s/.test(raw)) {
      if (value.length) wrongKeys += 1;
      input.value = '';
      lastValue = '';
      syncInputState();
      updateStats();
      return;
    }

    // Count accuracy per typed character (deletions are free).
    if (value.length === lastValue.length + 1) {
      if (targetWord(value)) correctKeys += 1;
      else wrongKeys += 1;
    }
    lastValue = value;
    syncInputState();
    updateStats();
  });

  ctx.listen(input, 'keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (input.value) wrongKeys += normalized() && !words.some((w) => w.text === normalized()) ? 1 : 0;
      input.value = '';
      lastValue = '';
      syncInputState();
      updateStats();
    }
  });

  // Clicking the falling area keeps focus in the input.
  ctx.listen(view.canvas, 'pointerdown', (event) => {
    event.preventDefault();
    if (ctx.status === 'running') input.focus({ preventScroll: true });
  });

  // ----- Simulation -----

  function update(dt) {
    activeTime += dt;
    effects = effects.filter((e) => (e.t += dt) < (e.kind === 'level' ? 1.4 : 0.6));

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnWord();
      spawnTimer = spawnInterval() * randomRange(0.8, 1.15);
    }

    for (const word of words) word.y += word.speed * dt;
    const landed = words.filter((w) => w.y + 14 >= GROUND);
    if (landed.length) {
      for (const word of landed) {
        words.splice(words.indexOf(word), 1);
        lives -= 1;
        effects.push({ x: word.x + word.width / 2, y: GROUND - 10, t: 0, text: word.text, kind: 'miss' });
      }
      syncInputState();
      updateStats();
      if (lives <= 0) {
        gameOver();
        return;
      }
    }
    if (Math.floor(activeTime * 2) !== Math.floor((activeTime - dt) * 2)) updateStats();
  }

  // ----- Flow -----

  function showStart() {
    ctx.setStatus('idle');
    input.disabled = true;
    ctx.overlay.show({
      kicker: 'Word Rain',
      title: 'Catch the words',
      message: 'Type any falling word to clear it. Five words on the ground and the rain wins.',
      actions: [{ label: 'Start typing', icon: 'play', onClick: start }],
    });
  }

  function start() {
    reset();
    ctx.overlay.hide();
    ctx.setStatus('running');
    input.disabled = false;
    input.focus({ preventScroll: true });
    loop.start();
  }

  function gameOver() {
    loop.stop();
    ctx.setStatus('over');
    input.disabled = true;
    input.blur();
    const { best, isNew } = ctx.storage.submitRecord('best', score);
    const speed = Math.round(wpm());
    ctx.storage.submitRecord('wpm', speed);
    ctx.showRecords([
      { label: 'Best score', value: (ctx.storage.getRecord('best') ?? 0).toLocaleString('en-US') },
      { label: 'Fastest WPM', value: ctx.storage.getRecord('wpm') ?? '–' },
    ]);
    updateStats();
    render();
    ctx.overlay.show({
      kicker: 'The rain won',
      title: `${score.toLocaleString('en-US')} points`,
      badge: isNew && score > 0 ? 'New best' : null,
      stats: [
        { label: 'WPM', value: speed },
        { label: 'Accuracy', value: formatPercent(accuracy()) },
        { label: 'Words', value: completed },
        { label: 'Best', value: (best ?? 0).toLocaleString('en-US'), highlight: isNew && score > 0 },
      ],
      actions: [{ label: 'Play again', icon: 'restart', onClick: start }],
      suggest: true,
      delay: 500,
    });
  }

  // ----- Rendering -----

  function render() {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#eef1f3');
    sky.addColorStop(1, '#f7f4ee');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // Gentle rain streaks in the background
    g.strokeStyle = 'rgba(94,115,137,0.12)';
    g.lineWidth = 1.5;
    const t = prefersReducedMotion() ? 0 : (activeTime || 0) * 60;
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 97) % W;
      const y = ((i * 53 + t * (1 + (i % 3) * 0.3)) % (H + 40)) - 40;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 3, y + 14);
      g.stroke();
    }

    // Ground
    g.fillStyle = '#e3e7e3';
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = palette.sage;
    g.fillRect(0, GROUND, W, 3);

    const value = normalized();
    const target = targetWord(value);

    for (const word of words) {
      const danger = word.y > GROUND - 90;
      const isTarget = word === target;
      g.fillStyle = 'rgba(34,33,31,0.06)';
      roundRect(g, word.x + 1, word.y + 2, word.width, 30, 15);
      g.fill();
      fillRoundRect(g, word.x, word.y, word.width, 30, 15, palette.surface);
      g.strokeStyle = isTarget ? palette.accent : danger ? palette.rose : palette.border;
      g.lineWidth = isTarget ? 2 : 1;
      roundRect(g, word.x + 0.5, word.y + 0.5, word.width - 1, 29, 14.5);
      g.stroke();

      g.font = font(17, 600);
      g.textAlign = 'left';
      g.fillStyle = palette.ink;
      g.fillText(word.text, word.x + 14, word.y + 21);
      if (isTarget) {
        g.fillStyle = palette.accent;
        g.fillText(word.text.slice(0, value.length), word.x + 14, word.y + 21);
      }
    }

    for (const e of effects) {
      const life = e.kind === 'level' ? 1.4 : 0.6;
      const k = e.t / life;
      g.globalAlpha = 1 - k;
      g.textAlign = 'center';
      if (e.kind === 'level') {
        g.font = font(28, 700);
        g.fillStyle = palette.ink;
        g.fillText(e.text, e.x, e.y);
      } else if (e.kind === 'hit') {
        g.font = font(15, 650);
        g.fillStyle = palette.sageDeep;
        g.fillText(e.text, e.x, e.y + 18 - k * 30);
      } else {
        g.font = font(15, 650);
        g.fillStyle = palette.accent;
        g.fillText(e.text, e.x, e.y);
      }
    }
    g.globalAlpha = 1;

    // Lives and level
    for (let i = 0; i < LIVES; i += 1) {
      g.fillStyle = i < lives ? palette.accent : palette.borderStrong;
      g.beginPath();
      g.arc(20 + i * 16, 20, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.textAlign = 'right';
    g.font = font(12, 650);
    g.fillStyle = palette.muted;
    g.fillText(`LEVEL ${level}`, W - 16, 24);
  }

  view.onResize(() => render());

  reset();
  render();
  showStart();

  return {
    pause() {
      loop.stop();
      input.disabled = true;
    },
    resume() {
      input.disabled = false;
      input.focus({ preventScroll: true });
      loop.start();
    },
    restart: start,
    destroy: () => loop.stop(),
  };
}
