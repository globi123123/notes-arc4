/**
 * Colors for canvas artwork. These mirror the CSS tokens so the games feel
 * like part of the same product.
 */
export const palette = {
  bg: '#f5f4ef',
  surface: '#fbfaf7',
  sunken: '#efede6',
  strong: '#e7e3d8',
  border: '#e3dfd4',
  borderStrong: '#d2ccbe',
  ink: '#22211f',
  inkSoft: '#3a3835',
  muted: '#67645d',
  faint: '#8b877e',
  accent: '#c6613f',
  accentDeep: '#a54f30',
  accentSoft: '#f4e4da',
  sage: '#7c8b6f',
  sageDeep: '#5f6d54',
  sageSoft: '#e5e9dd',
  slate: '#5e7389',
  slateSoft: '#e1e6ea',
  mustard: '#d2a44e',
  mustardSoft: '#f3e8cf',
  rose: '#c98a80',
  clay: '#a6714e',
  teal: '#5f8c88',
  cream: '#fbf7ee',
  night: '#1f1e1c',
};

export const FONT = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const font = (size, weight = 600) => `${weight} ${size}px ${FONT}`;
