/** Reaction Time: wait for the color change, then react. Five tries per round. */

import { h } from '../../lib/dom.js';
import { formatMs } from '../../lib/format.js';
import { randomRange } from '../../lib/random.js';

const TRIES = 5;

export default function mount(ctx) {
  const title = h('p', { class: 'rt-title' });
  const detail = h('p', { class: 'rt-detail' });
  const history = h('ol', { class: 'rt-history', 'aria-label': 'Results this round' });
  const panel = h(
    'div',
    { class: 'rt-panel', role: 'button', tabindex: '0', 'aria-label': 'Reaction panel' },
    h('div', { class: 'rt-content', 'aria-live': 'assertive' }, title, detail),
    history,
  );
  ctx.stage.append(panel);

  // ready -> waiting -> go -> result -> waiting ... -> done
  let state = 'ready';
  let results = [];
  let goTime = 0;
  let waitTimer = 0;
  let frame = 0;

  function setState(next, heading, text) {
    state = next;
    panel.dataset.state = next;
    title.textContent = heading;
    detail.textContent = text;
  }

  const average = () => (results.length ? results.reduce((a, b) => a + b, 0) / results.length : null);

  function updateStats() {
    ctx.setStats({
      last: results.length ? formatMs(results[results.length - 1]) : '–',
      average: formatMs(average()),
      attempt: `${Math.min(results.length + (state === 'done' ? 0 : 1), TRIES)} / ${TRIES}`,
      best: formatMs(ctx.storage.getRecord('best')),
    });
    history.replaceChildren(
      ...Array.from({ length: TRIES }, (_, i) =>
        h('li', { class: results[i] != null ? 'is-done' : '' }, results[i] != null ? `${Math.round(results[i])}` : ''),
      ),
    );
  }

  function showRecords() {
    ctx.showRecords([
      { label: 'Fastest single try', value: formatMs(ctx.storage.getRecord('best')) },
      { label: 'Best round average', value: formatMs(ctx.storage.getRecord('average')) },
    ]);
  }

  function ready() {
    clearTimeout(waitTimer);
    cancelAnimationFrame(frame);
    results = [];
    ctx.setStatus('idle');
    setState(
      'ready',
      'Reaction Time',
      'Click or press Space to begin. When the panel turns terracotta, react as fast as you can.',
    );
    updateStats();
  }

  function wait() {
    setState('waiting', 'Wait for it…', 'Click as soon as the color changes.');
    ctx.setStatus('running');
    clearTimeout(waitTimer);
    waitTimer = window.setTimeout(go, randomRange(1300, 4200));
    updateStats();
  }

  function go() {
    setState('go', 'Click!', '');
    goTime = performance.now();
    // Refine the start to the frame where the new color is painted.
    frame = requestAnimationFrame(() => {
      goTime = performance.now();
    });
  }

  function react(timeStamp) {
    if (state === 'ready' || state === 'result' || state === 'early') {
      wait();
      return;
    }
    if (state === 'done') {
      ready();
      wait();
      return;
    }
    if (state === 'waiting') {
      clearTimeout(waitTimer);
      setState('early', 'Too soon', 'That was a false start. Click to try again.');
      return;
    }
    if (state === 'go') {
      const now = timeStamp && timeStamp > goTime ? timeStamp : performance.now();
      const ms = Math.max(1, now - goTime);
      results.push(ms);
      const single = ctx.storage.submitRecord('best', Math.round(ms), { lowerIsBetter: true });
      if (results.length >= TRIES) finish();
      else {
        setState('result', `${Math.round(ms)} ms`, `${single.isNew ? 'New personal best. ' : ''}Click to keep going.`);
      }
      updateStats();
      showRecords();
    }
  }

  function finish() {
    const avg = average();
    const round = ctx.storage.submitRecord('average', Math.round(avg), { lowerIsBetter: true });
    ctx.setStatus('over');
    setState(
      'done',
      `${Math.round(avg)} ms average`,
      `${round.isNew ? 'Your best round so far. ' : ''}Click to start a new round.`,
    );
  }

  // Pointer down reacts faster than click, which waits for release.
  ctx.listen(panel, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    react(event.timeStamp);
  });
  ctx.listen(panel, 'keydown', (event) => {
    if (event.repeat || (event.code !== 'Space' && event.code !== 'Enter' && event.code !== 'NumpadEnter')) return;
    event.preventDefault();
    react(event.timeStamp);
  });

  // A hidden tab would ruin the measurement, so the current try is paused.
  ctx.listen(document, 'visibilitychange', () => {
    if (!document.hidden || (state !== 'waiting' && state !== 'go')) return;
    clearTimeout(waitTimer);
    cancelAnimationFrame(frame);
    setState('result', 'Paused', 'Click to continue where you left off.');
  });

  ready();
  showRecords();
  panel.focus({ preventScroll: true });

  return {
    restart() {
      ready();
      panel.focus({ preventScroll: true });
    },
    destroy() {
      clearTimeout(waitTimer);
      cancelAnimationFrame(frame);
    },
  };
}
