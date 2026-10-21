/**
 * Original card illustrations, drawn as inline SVG (320 x 200).
 * They use the shared palette so the library feels like one collection.
 */

const C = {
  ink: '#22211f',
  inkSoft: '#3a3835',
  muted: '#8b877e',
  line: '#d2ccbe',
  cream: '#fbfaf7',
  sunken: '#efede6',
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
};

const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';

const svg = (body, bg) =>
  `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="320" height="200" fill="${bg}"/>${body}</svg>`;

function snake() {
  let dots = '';
  for (let x = 20; x < 320; x += 20)
    for (let y = 20; y < 200; y += 20) dots += `<circle cx="${x}" cy="${y}" r="1.2" fill="${C.line}"/>`;
  return svg(
    `${dots}
    <path d="M60 140 H140 V80 H220 V120 H250" fill="none" stroke="${C.sageDeep}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M60 140 H140 V80 H220 V120 H250" fill="none" stroke="${C.sage}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 19" opacity=".55"/>
    <circle cx="252" cy="116" r="2.2" fill="${C.cream}"/><circle cx="252" cy="124" r="2.2" fill="${C.cream}"/>
    <circle cx="250" cy="160" r="9" fill="${C.accent}"/><path d="M250 151c1-4 4-6 7-6" stroke="${C.sageDeep}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    '#eef0e8',
  );
}

function blocks() {
  const s = 18;
  const cell = (cx, cy, color) =>
    `<rect x="${cx * s + 70}" y="${cy * s + 10}" width="${s - 2}" height="${s - 2}" rx="3" fill="${color}"/>`;
  const cells = [
    // stack
    [0, 9, C.slate],
    [1, 9, C.slate],
    [2, 9, C.mustard],
    [3, 9, C.mustard],
    [4, 9, C.sage],
    [5, 9, C.sage],
    [6, 9, C.accent],
    [8, 9, C.rose],
    [9, 9, C.rose],
    [0, 8, C.slate],
    [1, 8, C.teal],
    [2, 8, C.mustard],
    [3, 8, C.clay],
    [4, 8, C.sage],
    [6, 8, C.accent],
    [7, 8, C.accent],
    [8, 8, C.rose],
    [9, 8, C.teal],
    [0, 7, C.teal],
    [1, 7, C.teal],
    [3, 7, C.clay],
    [4, 7, C.clay],
    [5, 7, C.clay],
    [7, 7, C.accent],
    [9, 7, C.teal],
    [0, 6, C.teal],
    [9, 6, C.teal],
    // falling T
    [5, 2, C.mustard],
    [6, 2, C.mustard],
    [7, 2, C.mustard],
    [6, 3, C.mustard],
  ];
  const ghost = [
    [5, 6],
    [6, 6],
    [7, 6],
    [6, 7],
  ]
    .map(
      ([x, y]) =>
        `<rect x="${x * s + 71}" y="${y * s + 11}" width="${s - 4}" height="${s - 4}" rx="3" fill="none" stroke="${C.muted}" stroke-dasharray="3 3"/>`,
    )
    .join('');
  return svg(
    `<rect x="66" y="6" width="188" height="190" rx="10" fill="${C.cream}" stroke="${C.line}"/>
    ${ghost}${cells.map(([x, y, c]) => cell(x, y, c)).join('')}
    <rect x="70" y="${10 + 9 * s + s}" width="180" height="2" fill="${C.line}"/>`,
    '#f1ece3',
  );
}

function t2048() {
  const tiles = [
    [0, 0, '2', '#eee9de', C.ink],
    [1, 0, '4', '#e7dfcf', C.ink],
    [2, 0, '', null],
    [3, 0, '2', '#eee9de', C.ink],
    [0, 1, '8', '#ebc9a8', C.ink],
    [1, 1, '16', '#e4ad84', C.cream],
    [2, 1, '4', '#e7dfcf', C.ink],
    [3, 1, '', null],
    [0, 2, '64', '#cf7148', C.cream],
    [1, 2, '32', '#db8f66', C.cream],
    [2, 2, '128', C.mustard, C.cream],
    [3, 2, '8', '#ebc9a8', C.ink],
    [0, 3, '2048', C.ink, C.cream],
    [1, 3, '256', '#c99a43', C.cream],
    [2, 3, '', null],
    [3, 3, '2', '#eee9de', C.ink],
  ];
  const size = 38;
  const gap = 6;
  const ox = 160 - (size * 4 + gap * 3) / 2;
  const oy = 100 - (size * 4 + gap * 3) / 2;
  const body = tiles
    .map(([x, y, label, fill, color]) => {
      const px = ox + x * (size + gap);
      const py = oy + y * (size + gap);
      const base = `<rect x="${px}" y="${py}" width="${size}" height="${size}" rx="7" fill="${fill || '#e6dfd0'}"/>`;
      if (!label) return base;
      const fs = label.length >= 4 ? 11 : label.length === 3 ? 13 : 16;
      return `${base}<text x="${px + size / 2}" y="${py + size / 2 + fs * 0.36}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fs}" fill="${color}">${label}</text>`;
    })
    .join('');
  return svg(
    `<rect x="${ox - 8}" y="${oy - 8}" width="${size * 4 + gap * 3 + 16}" height="${size * 4 + gap * 3 + 16}" rx="12" fill="#ddd5c4"/>${body}`,
    C.mustardSoft,
  );
}

function minesweeper() {
  const cols = 9;
  const rows = 6;
  const s = 22;
  const ox = 160 - (cols * s) / 2;
  const oy = 100 - (rows * s) / 2;
  const revealed = {
    '0,3': '',
    '1,3': '1',
    '2,3': '1',
    '0,4': '',
    '1,4': '1',
    '2,4': '',
    '0,5': '',
    '1,5': '2',
    '2,5': '',
    '3,3': '2',
    '3,4': '1',
    '3,5': '',
    '4,4': '',
    '4,5': '1',
    '5,5': '1',
    '5,4': '2',
    '2,2': '1',
    '3,2': '3',
    '1,2': '1',
    '0,2': '',
  };
  const numColor = { 1: C.slate, 2: C.sageDeep, 3: C.accent };
  let body = '';
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const key = `${x},${y}`;
      const px = ox + x * s;
      const py = oy + y * s;
      if (key in revealed) {
        body += `<rect x="${px}" y="${py}" width="${s}" height="${s}" fill="${C.cream}" stroke="#e3dfd4"/>`;
        const n = revealed[key];
        if (n)
          body += `<text x="${px + s / 2}" y="${py + s / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="13" fill="${numColor[n]}">${n}</text>`;
      } else {
        body += `<rect x="${px + 1}" y="${py + 1}" width="${s - 2}" height="${s - 2}" rx="4" fill="#d9dfe5"/>`;
      }
    }
  }
  const fx = ox + 4 * s;
  const fy = oy + 2 * s;
  body += `<path d="M${fx + 8} ${fy + 17}V${fy + 5}l8 3.5-8 3.5" fill="${C.accent}" stroke="${C.accent}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const mx = ox + 7 * s + s / 2;
  const my = oy + 4 * s + s / 2;
  body += `<rect x="${ox + 7 * s}" y="${oy + 4 * s}" width="${s}" height="${s}" fill="${C.accentSoft}"/><circle cx="${mx}" cy="${my}" r="5.5" fill="${C.ink}"/><path d="M${mx - 8} ${my}h16M${mx} ${my - 8}v16M${mx - 5.5} ${my - 5.5}l11 11M${mx + 5.5} ${my - 5.5}l-11 11" stroke="${C.ink}" stroke-width="1.6" stroke-linecap="round"/>`;
  return svg(
    `<rect x="${ox - 8}" y="${oy - 8}" width="${cols * s + 16}" height="${rows * s + 16}" rx="10" fill="${C.cream}" stroke="${C.line}"/>${body}`,
    C.slateSoft,
  );
}

function breakout() {
  const colors = [C.accent, C.clay, C.mustard, C.sage, C.slate];
  let bricks = '';
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if ((r === 3 && c === 5) || (r === 4 && (c === 4 || c === 5 || c === 6))) continue;
      bricks += `<rect x="${32 + c * 33}" y="${24 + r * 16}" width="29" height="12" rx="3" fill="${colors[r]}"/>`;
    }
  }
  return svg(
    `${bricks}
    <path d="M196 102 L168 150" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round"/>
    <circle cx="168" cy="150" r="6" fill="${C.ink}"/>
    <rect x="128" y="172" width="64" height="9" rx="4.5" fill="${C.ink}"/>`,
    C.accentSoft,
  );
}

function pong() {
  return svg(
    `<path d="M160 18 V182" stroke="${C.line}" stroke-width="3" stroke-dasharray="8 8" stroke-linecap="round"/>
    <text x="118" y="56" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="34" fill="${C.line}">3</text>
    <text x="202" y="56" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="34" fill="${C.line}">2</text>
    <rect x="34" y="78" width="10" height="52" rx="5" fill="${C.ink}"/>
    <rect x="276" y="104" width="10" height="52" rx="5" fill="${C.slate}"/>
    <path d="M60 104 L188 128" stroke="${C.accent}" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" opacity=".6"/>
    <circle cx="196" cy="130" r="7" fill="${C.accent}"/>`,
    C.sunken,
  );
}

function updraft() {
  const column = (x, gapY, gap = 62) =>
    `<rect x="${x}" y="-10" width="40" height="${gapY - gap / 2 + 10}" rx="8" fill="${C.sage}"/>
     <rect x="${x - 4}" y="${gapY - gap / 2 - 14}" width="48" height="14" rx="6" fill="${C.sageDeep}"/>
     <rect x="${x}" y="${gapY + gap / 2}" width="40" height="${200 - gapY}" rx="8" fill="${C.sage}"/>
     <rect x="${x - 4}" y="${gapY + gap / 2}" width="48" height="14" rx="6" fill="${C.sageDeep}"/>`;
  return svg(
    `<circle cx="64" cy="44" r="16" fill="${C.cream}" opacity=".9"/>
    <path d="M26 64c10-10 26-10 34 0 8-6 20-4 24 4H26Z" fill="${C.cream}"/>
    <path d="M220 40c8-8 20-8 26 0 6-4 15-3 18 3h-44Z" fill="${C.cream}"/>
    ${column(150, 82)}${column(250, 120)}
    <path d="M0 186 Q80 170 160 186 T320 186 V200 H0Z" fill="#d9dccf"/>
    <g transform="translate(92 104) rotate(-14)">
      <path d="M-20 0 L18 -10 L-4 4 Z" fill="${C.accent}"/>
      <path d="M-20 0 L-4 4 L-10 12 Z" fill="${C.accentDeep}"/>
      <path d="M-4 4 L18 -10 L2 10 Z" fill="#dc805f"/>
    </g>
    <path d="M40 112 h22 M48 120 h14" stroke="${C.cream}" stroke-width="2.5" stroke-linecap="round"/>`,
    '#e6eeec',
  );
}

function laneSplitter() {
  const dashes = [0, 1, 2]
    .map((lane) => {
      const x = 112 + lane * 32;
      let d = '';
      for (let y = -10; y < 210; y += 36)
        d += `<rect x="${x - 1.5}" y="${y}" width="3" height="18" rx="1.5" fill="${C.cream}" opacity=".75"/>`;
      return d;
    })
    .join('');
  const car = (x, y, color, length = 42) =>
    `<g transform="translate(${x} ${y})"><rect x="-11" y="0" width="22" height="${length}" rx="6" fill="${color}"/><rect x="-8" y="7" width="16" height="9" rx="2.5" fill="${C.ink}" opacity=".55"/><rect x="-8" y="${length - 13}" width="16" height="6" rx="2" fill="${C.ink}" opacity=".45"/></g>`;
  let rumble = '';
  for (let y = -6; y < 210; y += 16) {
    rumble += `<rect x="76" y="${y}" width="6" height="8" fill="${C.accent}"/><rect x="76" y="${y + 8}" width="6" height="8" fill="${C.cream}"/>`;
    rumble += `<rect x="238" y="${y}" width="6" height="8" fill="${C.accent}"/><rect x="238" y="${y + 8}" width="6" height="8" fill="${C.cream}"/>`;
  }
  const bushes = [
    [36, 30],
    [52, 90],
    [28, 150],
    [270, 52],
    [290, 120],
    [272, 176],
  ]
    .map(
      ([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="11" fill="${C.sage}"/><circle cx="${x + 7}" cy="${y - 4}" r="7" fill="#93a084"/>`,
    )
    .join('');
  return svg(
    `${bushes}
    <rect x="82" y="0" width="156" height="200" fill="${C.inkSoft}"/>
    ${rumble}${dashes}
    ${car(128, 24, C.slate)}${car(192, 64, C.mustard, 54)}${car(96, 104, C.cream)}
    <g transform="translate(160 150)">
      <path d="M-10 6 L10 6 L6 34 L-6 34 Z" fill="${C.ink}" opacity=".18" transform="translate(3 4)"/>
      <rect x="-3" y="-6" width="6" height="12" rx="3" fill="${C.ink}"/>
      <rect x="-3" y="30" width="6" height="12" rx="3" fill="${C.ink}"/>
      <path d="M-6 2 Q0 -4 6 2 L5 30 Q0 34 -5 30 Z" fill="${C.accent}"/>
      <path d="M-12 6 H12" stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="0" cy="13" r="6" fill="${C.ink}"/><circle cx="-1.5" cy="11.5" r="2" fill="#55524d"/>
    </g>
    <path d="M150 196 v-8 M170 196 v-8" stroke="${C.cream}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
    '#ebe2d1',
  );
}

function asteroidBelt() {
  let stars = '';
  const pts = [
    [24, 30],
    [70, 160],
    [110, 22],
    [150, 180],
    [200, 40],
    [240, 150],
    [290, 26],
    [300, 120],
    [40, 100],
    [180, 110],
    [262, 84],
    [128, 70],
  ];
  for (const [x, y] of pts)
    stars += `<circle cx="${x}" cy="${y}" r="${(x + y) % 3 === 0 ? 1.6 : 1}" fill="#e9dccb" opacity=".7"/>`;
  const rock = (x, y, r, rot = 0) => {
    const n = 9;
    let d = '';
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + rot;
      const rr = r * (0.78 + ((i * 37) % 10) / 40);
      d += `${i === 0 ? 'M' : 'L'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
    }
    return `<path d="${d}Z" fill="#2e2c29" stroke="#d8cdbd" stroke-width="2" stroke-linejoin="round"/>`;
  };
  return svg(
    `${stars}${rock(82, 62, 30)}${rock(246, 132, 36, 0.6)}${rock(214, 46, 14, 1.2)}${rock(64, 152, 16, 0.3)}
    <g transform="translate(158 108) rotate(-28)">
      <path d="M0 -16 L11 13 L0 7 L-11 13 Z" fill="none" stroke="${C.cream}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-5 11 L0 22 L5 11" fill="${C.accent}"/>
    </g>
    <circle cx="140" cy="72" r="2.4" fill="${C.accent}"/><circle cx="130" cy="52" r="2.4" fill="${C.accent}"/>`,
    '#1f1e1c',
  );
}

function duneRunner() {
  return svg(
    `<circle cx="244" cy="62" r="26" fill="#efc7a2"/>
    <path d="M0 120 Q60 90 130 116 T260 106 T320 112 V200 H0Z" fill="#ead2b4"/>
    <path d="M0 150 Q90 126 180 148 T320 140 V200 H0Z" fill="#dfbd93"/>
    <rect x="0" y="164" width="320" height="36" fill="#d4ad80"/>
    <path d="M0 164 H320" stroke="${C.clay}" stroke-width="2" opacity=".5"/>
    <g fill="${C.sageDeep}">
      <rect x="226" y="122" width="12" height="42" rx="6"/>
      <path d="M232 146 h-10 a5 5 0 0 1 -5 -5 v-10" stroke="${C.sageDeep}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M232 138 h9 a5 5 0 0 0 5 -5 v-7" stroke="${C.sageDeep}" stroke-width="7" fill="none" stroke-linecap="round"/>
    </g>
    <g transform="translate(110 112)" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="4" cy="-10" r="7" fill="${C.ink}" stroke="none"/>
      <path d="M2 0 L-2 22"/>
      <path d="M-2 22 L-14 30 L-20 26"/>
      <path d="M-2 22 L10 34"/>
      <path d="M0 6 L14 12"/>
      <path d="M0 6 L-12 2"/>
    </g>
    <path d="M60 176 h18 M150 186 h10 M268 182 h16" stroke="${C.clay}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
    '#f6e9d9',
  );
}

function aimTrainer() {
  return svg(
    `<circle cx="196" cy="96" r="44" fill="${C.cream}"/>
    <circle cx="196" cy="96" r="44" fill="none" stroke="${C.accent}" stroke-width="8"/>
    <circle cx="196" cy="96" r="26" fill="none" stroke="${C.accent}" stroke-width="8"/>
    <circle cx="196" cy="96" r="9" fill="${C.accent}"/>
    <circle cx="74" cy="56" r="14" fill="none" stroke="${C.line}" stroke-width="3"/>
    <circle cx="96" cy="150" r="10" fill="none" stroke="${C.line}" stroke-width="3"/>
    <circle cx="276" cy="160" r="8" fill="none" stroke="${C.line}" stroke-width="3"/>
    <g stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round" transform="translate(212 110)">
      <circle r="12" fill="none"/><path d="M0 -20 v10 M0 10 v10 M-20 0 h10 M10 0 h10"/>
    </g>`,
    '#f1efe9',
  );
}

function wordRain() {
  const word = (x, y, text, w, highlight = 0) => {
    const typed = highlight
      ? `<text x="${x + 12}" y="${y + 17}" font-family="${FONT}" font-weight="600" font-size="13" fill="${C.accent}">${text.slice(0, highlight)}</text>`
      : '';
    return `<rect x="${x}" y="${y}" width="${w}" height="26" rx="13" fill="${C.cream}" stroke="${highlight ? C.accent : C.line}"/>
      <text x="${x + 12}" y="${y + 17}" font-family="${FONT}" font-weight="600" font-size="13" fill="${C.ink}">${text}</text>${typed}`;
  };
  return svg(
    `${word(40, 22, 'garden', 72)}${word(186, 44, 'lantern', 78)}${word(96, 86, 'quiet', 60, 3)}${word(220, 112, 'river', 62)}${word(30, 128, 'pixel', 60)}
    <path d="M126 64 v14 M216 24 v12 M66 108 v12" stroke="${C.slate}" stroke-width="2" stroke-linecap="round" opacity=".35"/>
    <rect x="60" y="160" width="200" height="28" rx="9" fill="${C.cream}" stroke="${C.ink}" stroke-width="1.5"/>
    <text x="74" y="179" font-family="${FONT}" font-weight="600" font-size="13" fill="${C.ink}">qui</text>
    <rect x="98" y="168" width="1.5" height="13" fill="${C.accent}"/>`,
    C.slateSoft,
  );
}

function pairs() {
  const card = (x, y, content) =>
    content
      ? `<rect x="${x}" y="${y}" width="44" height="58" rx="8" fill="${C.cream}" stroke="${C.line}"/>${content(x + 22, y + 29)}`
      : `<rect x="${x}" y="${y}" width="44" height="58" rx="8" fill="${C.accent}"/><rect x="${x + 5}" y="${y + 5}" width="34" height="48" rx="5" fill="none" stroke="#e39a7e" stroke-width="1.5"/><circle cx="${x + 22}" cy="${y + 29}" r="6" fill="none" stroke="#e39a7e" stroke-width="1.5"/>`;
  const circle = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="11" fill="${C.sage}"/>`;
  const tri = (cx, cy) =>
    `<path d="M${cx} ${cy - 12} L${cx + 12} ${cy + 9} L${cx - 12} ${cy + 9} Z" fill="${C.mustard}"/>`;
  const sq = (cx, cy) => `<rect x="${cx - 10}" y="${cy - 10}" width="20" height="20" rx="4" fill="${C.slate}"/>`;
  const xs = [56, 108, 160, 212];
  return svg(
    `${card(xs[0], 34, circle)}${card(xs[1], 34, null)}${card(xs[2], 34, tri)}${card(xs[3], 34, null)}
    ${card(xs[0], 104, null)}${card(xs[1], 104, circle)}${card(xs[2], 104, null)}${card(xs[3], 104, sq)}`,
    '#f2ede4',
  );
}

function sudoku() {
  const s = 18;
  const ox = 160 - (9 * s) / 2;
  const oy = 100 - (9 * s) / 2;
  const given = {
    '0,0': 5,
    '1,0': 3,
    '4,0': 7,
    '0,1': 6,
    '3,1': 1,
    '4,1': 9,
    '5,1': 5,
    '1,2': 9,
    '2,2': 8,
    '7,2': 6,
    '0,3': 8,
    '4,3': 6,
    '8,3': 3,
    '0,4': 4,
    '3,4': 8,
    '5,4': 3,
    '8,4': 1,
    '0,5': 7,
    '4,5': 2,
    '8,5': 6,
    '1,6': 6,
    '6,6': 2,
    '7,6': 8,
    '3,7': 4,
    '4,7': 1,
    '5,7': 9,
    '8,7': 5,
    '4,8': 8,
    '7,8': 7,
    '8,8': 9,
  };
  const entered = { '2,0': 4, '6,4': 7 };
  let body = `<rect x="${ox}" y="${oy}" width="${9 * s}" height="${9 * s}" fill="${C.cream}"/>`;
  body += `<rect x="${ox}" y="${oy + 4 * s}" width="${9 * s}" height="${s}" fill="${C.accentSoft}" opacity=".7"/><rect x="${ox + 6 * s}" y="${oy}" width="${s}" height="${9 * s}" fill="${C.accentSoft}" opacity=".7"/>`;
  body += `<rect x="${ox + 6 * s}" y="${oy + 4 * s}" width="${s}" height="${s}" fill="#efc9b7"/>`;
  for (let i = 0; i <= 9; i += 1) {
    const w = i % 3 === 0 ? 1.6 : 0.6;
    const col = i % 3 === 0 ? C.ink : C.line;
    body += `<path d="M${ox + i * s} ${oy}V${oy + 9 * s}M${ox} ${oy + i * s}H${ox + 9 * s}" stroke="${col}" stroke-width="${w}"/>`;
  }
  for (const [key, n] of Object.entries(given)) {
    const [x, y] = key.split(',').map(Number);
    body += `<text x="${ox + x * s + s / 2}" y="${oy + y * s + s / 2 + 4.5}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="11" fill="${C.ink}">${n}</text>`;
  }
  for (const [key, n] of Object.entries(entered)) {
    const [x, y] = key.split(',').map(Number);
    body += `<text x="${ox + x * s + s / 2}" y="${oy + y * s + s / 2 + 4.5}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="11" fill="${C.accent}">${n}</text>`;
  }
  return svg(body, '#f4f1ea');
}

function reactionTime() {
  return svg(
    `<circle cx="160" cy="100" r="120" fill="#cf7351" opacity=".55"/>
    <circle cx="160" cy="100" r="78" fill="#d47f5f" opacity=".6"/>
    <text x="160" y="104" text-anchor="middle" font-family="${FONT}" font-weight="650" font-size="40" letter-spacing="-1.5" fill="${C.cream}">214<tspan font-size="20" font-weight="550" dx="4">ms</tspan></text>
    <text x="160" y="134" text-anchor="middle" font-family="${FONT}" font-weight="550" font-size="12" letter-spacing="1.5" fill="#f7dccf">CLICK!</text>`,
    C.accent,
  );
}

function echo() {
  let tiles = '';
  const lit = { 4: C.accent, 2: '#e9b7a2' };
  for (let i = 0; i < 9; i += 1) {
    const x = 104 + (i % 3) * 38;
    const y = 42 + Math.floor(i / 3) * 38;
    tiles += `<rect x="${x}" y="${y}" width="32" height="32" rx="8" fill="${lit[i] || C.cream}" stroke="${lit[i] ? 'none' : C.line}"/>`;
  }
  return svg(
    `${tiles}
    <g fill="${C.muted}"><circle cx="134" cy="172" r="3.5" fill="${C.accent}"/><circle cx="148" cy="172" r="3.5" fill="${C.accent}"/><circle cx="162" cy="172" r="3.5" fill="${C.accent}"/><circle cx="176" cy="172" r="3.5" opacity=".4"/><circle cx="190" cy="172" r="3.5" opacity=".4"/></g>`,
    '#edefe8',
  );
}

const thumbnails = {
  snake,
  blocks,
  2048: t2048,
  minesweeper,
  breakout,
  pong,
  updraft,
  'lane-splitter': laneSplitter,
  'asteroid-belt': asteroidBelt,
  'dune-runner': duneRunner,
  'aim-trainer': aimTrainer,
  'word-rain': wordRain,
  pairs,
  sudoku,
  'reaction-time': reactionTime,
  echo,
};

const cache = new Map();

/** SVG markup for a game's card illustration. */
export function thumbnail(id) {
  if (!cache.has(id)) {
    const draw = thumbnails[id];
    cache.set(id, draw ? draw() : svg('', C.sunken));
  }
  return cache.get(id);
}

export const hasThumbnail = (id) => id in thumbnails;
