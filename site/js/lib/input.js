/**
 * Input helpers: semantic keyboard actions, swipe detection and on-screen
 * touch buttons that feed the same action state as the keyboard.
 */

import { h } from './dom.js';
import { icon } from '../ui/icons.js';

/** Physical key codes mapped to semantic actions (layout independent). */
export const DEFAULT_BINDINGS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  action: ['Space'],
  enter: ['Enter', 'NumpadEnter'],
};

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown']);

/** Captures a pointer so its release is seen even outside the element. */
export function capturePointer(element, pointerId) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The pointer may already be gone; capturing is only a convenience.
  }
}

/** True when the event target is a field where the user types text. */
export function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  const field = target.closest('input, textarea, select');
  if (!field) return false;
  if (field.tagName !== 'INPUT') return true;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(field.type);
}

/** True when Space/Enter should activate the focused control instead of the game. */
function isActivationTarget(event) {
  if (event.code !== 'Space' && event.code !== 'Enter' && event.code !== 'NumpadEnter') return false;
  return event.target instanceof Element && Boolean(event.target.closest('button, a[href], [role="button"]'));
}

/**
 * Keyboard state for a game. Listeners are attached to window and removed
 * automatically when the game is destroyed.
 */
export function createKeyboard(ctx, bindings = DEFAULT_BINDINGS) {
  const codeToActions = new Map();
  for (const [action, codes] of Object.entries(bindings)) {
    for (const code of codes) {
      if (!codeToActions.has(code)) codeToActions.set(code, []);
      codeToActions.get(code).push(action);
    }
  }

  const held = new Map(); // action -> number of sources holding it
  const downHandlers = new Map();
  const upHandlers = new Map();
  let anyHandler = null;

  function press(action, event) {
    const count = held.get(action) || 0;
    held.set(action, count + 1);
    if (count === 0) downHandlers.get(action)?.forEach((fn) => fn(event));
  }

  function release(action, event) {
    const count = held.get(action) || 0;
    if (count <= 0) return;
    if (count === 1) {
      held.delete(action);
      upHandlers.get(action)?.forEach((fn) => fn(event));
    } else held.set(action, count - 1);
  }

  ctx.listen(window, 'keydown', (event) => {
    if (!ctx.isActive() || isTypingTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isActivationTarget(event)) return;
    const actions = codeToActions.get(event.code);
    if (actions || SCROLL_KEYS.has(event.code)) event.preventDefault();
    if (anyHandler && !event.repeat) anyHandler(event);
    if (!actions || event.repeat) return;
    for (const action of actions) press(action, event);
  });

  ctx.listen(window, 'keyup', (event) => {
    const actions = codeToActions.get(event.code);
    if (!actions) return;
    for (const action of actions) release(action, event);
  });

  // Releasing everything on blur prevents "stuck" keys after alt-tab.
  ctx.listen(window, 'blur', () => releaseAll());

  function releaseAll() {
    for (const action of [...held.keys()]) {
      held.set(action, 1);
      release(action);
    }
  }

  const add = (map, action, fn) => {
    if (!map.has(action)) map.set(action, new Set());
    map.get(action).add(fn);
  };

  return {
    /** Runs `fn` when an action starts (key down or touch press). */
    on(action, fn) {
      add(downHandlers, action, fn);
    },
    onUp(action, fn) {
      add(upHandlers, action, fn);
    },
    /** Receives every non-repeating keydown inside the game. */
    onAny(fn) {
      anyHandler = fn;
    },
    isDown(action) {
      return (held.get(action) || 0) > 0;
    },
    /** -1, 0 or 1 for an axis made of two actions. */
    axis(negative, positive) {
      return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
    },
    press,
    release,
    releaseAll,
  };
}

/**
 * Detects swipes and taps on an element using pointer events.
 * Calls onSwipe('up' | 'down' | 'left' | 'right') or onTap(event).
 */
export function attachSwipe(ctx, element, { onSwipe, onTap, threshold = 24 } = {}) {
  let start = null;

  ctx.listen(element, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId, time: performance.now() };
  });

  ctx.listen(element, 'pointerup', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    start = null;
    if (distance >= threshold) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      onSwipe?.(dir, event);
    } else onTap?.(event);
  });

  ctx.listen(element, 'pointercancel', () => {
    start = null;
  });
}

/**
 * On-screen buttons for touch devices. Each button holds a keyboard action
 * while pressed, so games treat touch exactly like keys.
 *
 * @param {Array<Array<{action: string, icon: string, label: string, variant?: string}>|'spacer'>} groups
 */
export function createTouchControls(ctx, keyboard, groups, { forced = false } = {}) {
  const root = h('div', { class: `touch-controls${forced ? ' is-forced' : ''}` });

  for (const group of groups) {
    if (group === 'spacer') {
      root.append(h('div', { class: 'touch-controls__spacer' }));
      continue;
    }
    const groupEl = h('div', { class: 'touch-controls__group' });
    for (const button of group) {
      const variants = (button.variant || '')
        .split(' ')
        .filter(Boolean)
        .map((v) => ` is-${v}`)
        .join('');
      const el = h('button', {
        type: 'button',
        class: `touch-btn${variants}`,
        'aria-label': button.label,
        html: icon(button.icon),
      });
      let pointerId = null;
      const end = () => {
        if (pointerId === null) return;
        pointerId = null;
        el.classList.remove('is-active');
        keyboard.release(button.action);
      };
      ctx.listen(el, 'pointerdown', (event) => {
        event.preventDefault();
        if (pointerId !== null) return;
        pointerId = event.pointerId;
        capturePointer(el, event.pointerId);
        el.classList.add('is-active');
        keyboard.press(button.action, event);
      });
      ctx.listen(el, 'pointerup', end);
      ctx.listen(el, 'pointercancel', end);
      ctx.listen(el, 'lostpointercapture', end);
      ctx.listen(el, 'contextmenu', (event) => event.preventDefault());
      groupEl.append(el);
    }
    root.append(groupEl);
  }

  ctx.controlsSlot.append(root);
  return root;
}
