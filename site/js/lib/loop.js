/**
 * requestAnimationFrame loop with a fixed simulation step.
 *
 * `update(dt)` always receives the same small step so physics behave the
 * same on 60 Hz and 144 Hz screens. Large gaps (tab switches, slow frames)
 * are clamped so the game never tries to catch up on seconds of simulation.
 */
export function createLoop({ update, render, step = 1 / 120, maxFrame = 0.1 }) {
  let rafId = 0;
  let last = 0;
  let accumulator = 0;
  let running = false;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > maxFrame) elapsed = maxFrame;
    if (elapsed < 0) elapsed = 0;
    accumulator += elapsed;

    while (accumulator >= step) {
      update(step);
      accumulator -= step;
      // update() may stop the loop (game over); finish the frame cleanly.
      if (!running) break;
    }
    render?.(accumulator / step);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() {
      return running;
    },
  };
}
