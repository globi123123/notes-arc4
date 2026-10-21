import { getTheme } from './theme.js';

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

/**
 * Board and text colors for canvas games that draw their own light board.
 * Gameplay colors (pieces, balls, targets) stay in `palette`; only the
 * surfaces around them follow the light / dark theme.
 */
const SURFACES = {
  light: {
    board: '#fbfaf7',
    boardAlt: '#f3efe5',
    frame: '#efede6',
    grid: 'rgba(34,33,31,0.045)',
    floor: 'rgba(34,33,31,0.04)',
    ink: '#22211f',
    inkSoft: '#3a3835',
    muted: '#67645d',
    faint: '#8b877e',
    line: '#e3dfd4',
    lineStrong: '#d2ccbe',
    strong: '#e7e3d8',
    raised: '#fbfaf7',
    shadow: 'rgba(34,33,31,0.06)',
    veil: 'rgba(245,244,239,0.25)',
    brickTough: '#3a3835',
    hit: '#5f6d54',
    accentInk: '#b5573a',
    skyTop: '#eef1f3',
    skyBottom: '#f7f4ee',
    ground: '#e3e7e3',
  },
  dark: {
    board: '#262522',
    boardAlt: '#2b2a26',
    frame: '#1c1b19',
    grid: 'rgba(255,255,255,0.05)',
    floor: 'rgba(255,255,255,0.03)',
    ink: '#ece9e2',
    inkSoft: '#5d5952',
    muted: '#aba79e',
    faint: '#85817a',
    line: '#3a3834',
    lineStrong: '#4a4741',
    strong: '#3a3834',
    raised: '#312f2c',
    shadow: 'rgba(0,0,0,0.3)',
    veil: 'rgba(29,28,26,0.35)',
    brickTough: '#d2ccc1',
    hit: '#95b886',
    accentInk: '#e8946f',
    skyTop: '#1e2226',
    skyBottom: '#23221f',
    ground: '#2a2e29',
  },
};

export const surfaces = () => SURFACES[getTheme()];
