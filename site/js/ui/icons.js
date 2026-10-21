/**
 * Inline SVG icon set (24 x 24, stroked). Kept as strings so icons can be
 * dropped into markup without extra requests.
 */

const paths = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  heart: '<path d="M12 20.2s-7.2-4.4-7.2-10.1A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.2 2.5c0 5.7-7.2 10.1-7.2 10.1Z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronUp: '<path d="m5 15 7-7 7 7"/>',
  chevronDown: '<path d="m5 9 7 7 7-7"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  drop: '<path d="M12 4v11M7 10.5l5 5 5-5M6 20h12"/>',
  thrust: '<path d="M12 4 6.5 18l5.5-3.5 5.5 3.5L12 4Z"/>',
  fire: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  jump: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>',
  duck: '<path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h10.5l-2 3.75 2 3.75H6"/>',
  shovel: '<path d="M12 3v10"/><rect x="8" y="13" width="8" height="8" rx="2"/>',
  eraser:
    '<path d="m16.5 4.5 3 3a1.5 1.5 0 0 1 0 2.1L11 18H6.5l-2-2a1.5 1.5 0 0 1 0-2.1l9.9-9.4a1.5 1.5 0 0 1 2.1 0Z"/><path d="M9 9.5 14.5 15M11 18h9"/>',
  pencil:
    '<path d="M4.5 19.5 5.5 15 15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5l-4.5 1Z"/><path d="m14 6.5 3.5 3.5"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M4.5 11.5h10a5 5 0 0 1 0 10H12"/>',
  sound: '<path d="M4.5 9.5v5h3.5l4.5 4v-13l-4.5 4H4.5Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4.5 9.5v5h3.5l4.5 4v-13l-4.5 4H4.5Z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
  shuffle:
    '<path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.2 3.4-2.8M13.1 9.8C13.9 8.2 14.9 7 16.5 7H20"/><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  sparkle:
    '<path d="M12 4c.6 3.9 2.3 5.6 6.2 6.2-3.9.6-5.6 2.3-6.2 6.2-.6-3.9-2.3-5.6-6.2-6.2C9.7 9.6 11.4 7.9 12 4Z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  trophy:
    '<path d="M8 4.5h8v4.5a4 4 0 0 1-8 0V4.5Z"/><path d="M8 6.5H5.5a2.5 2.5 0 0 0 3 3.6M16 6.5h2.5a2.5 2.5 0 0 1-3 3.6M12 13v3.5M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5"/>',
  dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>',
  library:
    '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  layers: '<path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Z"/><path d="m4 12.5 8 4.5 8-4.5M4 16.5 12 21l8-4.5"/>',
  bolt: '<path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12l1-7Z"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14 .2 9-5.5 14-13 14Z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
  speed:
    '<path d="M4.5 16a7.5 7.5 0 1 1 15 0"/><path d="m12 16 4-5"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>',
  empty:
    '<rect x="10" y="16" width="52" height="40" rx="8" stroke-dasharray="3 4"/><circle cx="31" cy="34" r="8"/><path d="m37 40 7 7"/>',
};

/**
 * Returns the SVG markup for an icon.
 * @param {keyof typeof paths} name
 * @param {{ size?: number, viewBox?: string, label?: string }} [options]
 */
export function icon(name, { size, label } = {}) {
  const body = paths[name] || '';
  const viewBox = name === 'empty' ? '0 0 72 72' : '0 0 24 24';
  const sizeAttr = size ? ` width="${size}" height="${size}"` : '';
  const a11y = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"';
  return `<svg viewBox="${viewBox}"${sizeAttr} fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${a11y}>${body}</svg>`;
}
