/** Echo: watch a growing sequence of tiles, then repeat it. */

import { h } from '../../lib/dom.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { icon } from '../../ui/icons.js';

const TILES = 9;
// A pentatonic scale keeps any sequence pleasant when sound is on.
const NOTES = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0];

export default function mount(ctx) {
  let soundOn = Boolean(ctx.storage.getPref('sound', false));
  let audio = null;

  const soundButton = h('button', {
    type: 'button',
    class: 'btn btn-sm',
    'aria-pressed': String(soundOn),
    html: `${icon(soundOn ? 'sound' : 'mute')}<span>Sound</span>`,
  });
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    ctx.storage.setPref('sound', soundOn);
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.innerHTML = `${icon(soundOn ? 'sound' : 'mute')}<span>Sound</span>`;
  });
  ctx.toolbar.append(soundButton);

  const status = h('p', { class: 'echo-status', 'aria-live': 'polite' });
  const dots = h('div', { class: 'echo-dots', 'aria-hidden': 'true' });
  const grid = h('div', { class: 'echo-grid', role: 'group', 'aria-label': 'Echo tiles' });
  const tiles = Array.from({ length: TILES }, (_, i) => {
    const el = h('button', {
      type: 'button',
      class: 'echo-tile',
      'aria-label': `Tile ${i + 1}`,
      dataset: { i: String(i) },
    });
    grid.append(el);
    return el;
  });
  ctx.stage.append(h('div', { class: 'echo' }, status, grid, dots));

  let sequence = [];
  let step = 0;
  let phase = 'idle'; // idle | showing | input | over
  let timers = [];

  const later = (fn, ms) => timers.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  function tone(i, duration) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = NOTES[i];
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration / 1000);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration / 1000 + 0.05);
    } catch {
      // Audio is optional.
    }
  }

  function light(i, duration, kind = 'is-lit') {
    const el = tiles[i];
    el.classList.add(kind);
    tone(i, duration);
    later(() => el.classList.remove(kind), duration);
  }

  function renderDots() {
    dots.replaceChildren(
      ...sequence.map((_, i) =>
        h('span', { class: phase === 'input' && i < step ? 'is-done' : phase === 'input' ? '' : 'is-pending' }),
      ),
    );
  }

  function updateStats() {
    const level = sequence.length;
    ctx.setStats({
      level: level || '–',
      progress: phase === 'input' ? `${step} / ${level}` : '–',
      best: ctx.storage.getRecord('best') ?? '–',
    });
  }

  function setPhase(next) {
    phase = next;
    grid.dataset.phase = next;
    tiles.forEach((el) => (el.disabled = next !== 'input'));
    renderDots();
    updateStats();
  }

  function nextRound() {
    sequence.push(Math.floor(Math.random() * TILES));
    playSequence();
  }

  function playSequence() {
    clearTimers();
    setPhase('showing');
    status.textContent = `Level ${sequence.length} · Watch closely`;
    // Playback speeds up a little each level.
    const on = Math.max(260, 520 - sequence.length * 18);
    const gap = Math.max(110, 200 - sequence.length * 6);
    let t = 650;
    sequence.forEach((tile) => {
      later(() => light(tile, on), t);
      t += on + gap;
    });
    later(() => {
      step = 0;
      setPhase('input');
      status.textContent = `Your turn · repeat ${sequence.length} ${sequence.length === 1 ? 'step' : 'steps'}`;
    }, t);
  }

  function press(i) {
    if (phase !== 'input') return;
    if (sequence[step] !== i) {
      fail(i);
      return;
    }
    light(i, 220, 'is-pressed');
    step += 1;
    renderDots();
    updateStats();
    if (step === sequence.length) {
      setPhase('showing');
      status.textContent = 'Nice. Next level…';
      later(nextRound, prefersReducedMotion() ? 500 : 800);
    }
  }

  function fail(i) {
    clearTimers();
    tiles[i].classList.add('is-wrong');
    tiles[sequence[step]].classList.add('is-answer');
    setPhase('over');
    ctx.setStatus('over');
    const reached = sequence.length - 1;
    const { best, isNew } = ctx.storage.submitRecord('best', reached);
    updateStats();
    ctx.showRecords([{ label: 'Best level', value: ctx.storage.getRecord('best') ?? '–' }]);
    status.textContent = `Game over at level ${sequence.length}`;
    later(() => {
      ctx.overlay.show({
        kicker: 'Sequence broken',
        title: reached === 1 ? '1 level complete' : `${reached} levels complete`,
        light: true,
        badge: isNew && reached > 0 ? 'New best' : null,
        stats: [
          { label: 'Reached', value: `Level ${sequence.length}` },
          { label: 'Best', value: best ?? 0, highlight: isNew && reached > 0 },
        ],
        actions: [{ label: 'Play again', icon: 'restart', onClick: start }],
        suggest: true,
        delay: 250,
      });
    }, 900);
  }

  function start() {
    clearTimers();
    ctx.overlay.hide();
    tiles.forEach((el) => el.classList.remove('is-wrong', 'is-answer', 'is-lit', 'is-pressed'));
    sequence = [];
    step = 0;
    ctx.setStatus('running');
    nextRound();
  }

  function showStart() {
    setPhase('idle');
    ctx.setStatus('idle');
    status.textContent = 'Watch the tiles, then repeat the pattern.';
    ctx.overlay.show({
      kicker: 'Echo',
      title: 'How long can you go?',
      message: 'Each level adds one more step to the pattern. Sound is optional.',
      actions: [{ label: 'Start', icon: 'play', onClick: start }],
    });
  }

  ctx.listen(grid, 'pointerdown', (event) => {
    const el = event.target instanceof Element ? event.target.closest('.echo-tile') : null;
    if (!el || el.disabled) return;
    event.preventDefault();
    press(Number(el.dataset.i));
  });
  ctx.listen(grid, 'click', (event) => {
    // Keyboard activation (Enter/Space on a focused tile).
    if (event.detail !== 0) return;
    const el = event.target instanceof Element ? event.target.closest('.echo-tile') : null;
    if (el) press(Number(el.dataset.i));
  });
  ctx.listen(window, 'keydown', (event) => {
    if (!/^(Digit|Numpad)[1-9]$/.test(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    event.preventDefault();
    press(Number(event.code.slice(-1)) - 1);
  });

  ctx.showRecords([{ label: 'Best level', value: ctx.storage.getRecord('best') ?? '–' }]);
  showStart();

  return {
    restart: start,
    destroy() {
      clearTimers();
      audio?.close?.();
    },
  };
}
