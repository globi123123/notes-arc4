/**
 * Small shared UI building blocks: buttons, segmented controls, stats and
 * the in-stage overlay used for start, pause and game-over screens.
 */

import { h, clear } from '../lib/dom.js';
import { icon } from './icons.js';

/**
 * @param {{ label: string, icon?: string, variant?: string, size?: string, onClick?: Function,
 *           title?: string, iconOnly?: boolean, href?: string }} options
 */
export function button({ label, icon: iconName, variant = 'secondary', size, onClick, title, iconOnly, href, attrs }) {
  const classes = ['btn'];
  if (variant === 'primary') classes.push('btn-primary');
  if (variant === 'ghost') classes.push('btn-ghost');
  if (variant === 'dark') classes.push('btn-dark');
  if (size === 'sm') classes.push('btn-sm');
  if (size === 'lg') classes.push('btn-lg');
  if (iconOnly) classes.push('btn-icon');
  const content = [];
  if (iconName) content.push(h('span', { html: icon(iconName), style: { display: 'contents' } }));
  if (iconOnly) content.push(h('span', { class: 'visually-hidden' }, label));
  else content.push(h('span', { class: 'btn-label' }, label));
  const tag = href ? 'a' : 'button';
  const el = h(
    tag,
    {
      class: classes.join(' '),
      type: href ? null : 'button',
      href,
      title: title || (iconOnly ? label : null),
      ...attrs,
    },
    content,
  );
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

/** Updates the visible label of a button made with `button()`. */
export function setButtonLabel(el, label, iconName) {
  const labelEl = el.querySelector('.btn-label, .visually-hidden');
  if (labelEl) labelEl.textContent = label;
  if (el.title) el.title = label;
  if (iconName) {
    const holder = el.querySelector('span[style]');
    if (holder) holder.innerHTML = icon(iconName);
  }
}

/**
 * Radio-group style segmented control.
 * @param {{ label: string, options: Array<{value: string, label: string}>, value: string,
 *           onChange: (value: string) => void }} config
 */
export function segmented({ label, options, value, onChange }) {
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  let current = value;

  const buttons = options.map((option) => {
    const el = h(
      'button',
      {
        type: 'button',
        class: 'segmented__option',
        role: 'radio',
        'aria-checked': String(option.value === current),
        tabindex: option.value === current ? '0' : '-1',
        dataset: { value: option.value },
      },
      option.label,
    );
    el.addEventListener('click', () => select(option.value, true));
    return el;
  });
  root.append(...buttons);

  root.addEventListener('keydown', (event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    event.stopPropagation();
    const index = options.findIndex((o) => o.value === current);
    const next = options[(index + keys[event.key] + options.length) % options.length];
    select(next.value, true);
    buttons[options.indexOf(next)].focus();
  });

  function select(next, notify) {
    if (next === current && notify) return;
    current = next;
    buttons.forEach((el) => {
      const on = el.dataset.value === current;
      el.setAttribute('aria-checked', String(on));
      el.tabIndex = on ? 0 : -1;
    });
    if (notify) onChange?.(current);
  }

  return Object.assign(root, {
    setValue: (next) => select(next, false),
    getValue: () => current,
  });
}

/** Renders a definition-list stat. */
export function stat(label, value, { highlight = false } = {}) {
  return h(
    'div',
    { class: `stat${highlight ? ' is-highlight' : ''}` },
    h('dt', null, label),
    h('dd', null, value ?? '–'),
  );
}

export function difficultyBadge(level, label) {
  return h(
    'span',
    { class: 'difficulty', dataset: { level: String(level) }, title: `Difficulty: ${label}` },
    h('span', { class: 'difficulty__bars', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
    label,
  );
}

/**
 * Creates the overlay controller for a stage element.
 */
export function createOverlay(stage, { onHidden, renderSuggestion } = {}) {
  let root = null;
  let enableTimer = 0;

  function hide() {
    if (!root) return;
    clearTimeout(enableTimer);
    const hadFocus = root.contains(document.activeElement);
    root.remove();
    root = null;
    onHidden?.(hadFocus);
  }

  /**
   * @param {{ kicker?: string, title: string, message?: string, badge?: string,
   *           stats?: Array<{label: string, value: any, highlight?: boolean}>,
   *           actions?: Array<{label: string, icon?: string, variant?: string, onClick: Function}>,
   *           tone?: 'default' | 'success' | 'danger', light?: boolean, suggest?: boolean,
   *           delay?: number, focus?: boolean }} options
   */
  function show(options) {
    hide();
    const actions = (options.actions || []).map((action, index) =>
      button({
        label: action.label,
        icon: action.icon,
        variant: action.variant || (index === 0 ? 'primary' : 'secondary'),
        onClick: () => action.onClick?.(),
      }),
    );

    const card = h(
      'div',
      { class: 'overlay__card' },
      options.kicker && h('p', { class: 'overlay__kicker' }, options.kicker),
      h('h2', { class: 'overlay__title' }, options.title),
      options.badge && h('span', { class: 'new-record', html: `${icon('sparkle', { size: 13 })}${options.badge}` }),
      options.message && h('p', { class: 'overlay__message' }, options.message),
      options.stats?.length &&
        h(
          'dl',
          { class: 'overlay__stats' },
          options.stats.map((s) => stat(s.label, s.value, { highlight: s.highlight })),
        ),
      actions.length && h('div', { class: 'overlay__actions' }, actions),
      options.suggest && renderSuggestion ? renderSuggestion() : null,
    );

    root = h(
      'div',
      {
        class: `overlay${options.light ? ' is-light' : ''}`,
        role: 'dialog',
        'aria-modal': 'false',
        'aria-label': options.title,
        dataset: { tone: options.tone || 'default' },
      },
      card,
    );
    stage.append(root);

    // A short delay stops a key that was still held (for example Space in
    // a flying game) from instantly pressing "Play again".
    const delay = options.delay ?? 0;
    if (delay > 0) {
      actions.forEach((a) => (a.disabled = true));
      enableTimer = window.setTimeout(() => {
        actions.forEach((a) => (a.disabled = false));
        if (options.focus !== false) actions[0]?.focus({ preventScroll: true });
      }, delay);
    } else if (options.focus !== false) {
      actions[0]?.focus({ preventScroll: true });
    }
    return root;
  }

  return {
    show,
    hide,
    get open() {
      return Boolean(root);
    },
    destroy() {
      clearTimeout(enableTimer);
      if (root) root.remove();
      root = null;
    },
  };
}

export function emptyState({ title, message, actions = [] }) {
  return h(
    'div',
    { class: 'empty-state' },
    h('span', { html: icon('empty'), style: { display: 'contents' } }),
    h('h3', { class: 'empty-state__title' }, title),
    h('p', { class: 'empty-state__message' }, message),
    actions.length && h('div', { class: 'empty-state__actions' }, actions),
  );
}

export { clear };
