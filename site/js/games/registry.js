/**
 * Game registry: the single list of every game in the library.
 *
 * To add a game, create `games/<id>/index.js` exporting a default
 * `mount(ctx)` function and add an entry below. The library, search,
 * categories, cards and the shared game page all read from this list.
 *
 * Fields
 *   id           URL-safe identifier, also the folder name
 *   title        display name
 *   description  one sentence for the card
 *   categories   category ids (the first one is shown on the card)
 *   difficulty   1 (easy) to 3 (hard), with `difficultyLabel`
 *   tags         extra search terms
 *   howTo        short paragraph for the "How to play" panel
 *   controls     [{ keys: string[], action: string }] for the controls panel
 *   stats        [{ key, label }] shown above the stage, in order
 *   record       { key, label, format, lowerIsBetter } shown on the card
 *   pausable     shell shows Pause/Resume and pauses on tab switch
 *   styles       game ships its own `style.css` next to index.js
 *   stage        'plain' for a light stage background, 'flush' for no padding
 *   load         dynamic import, so a game's code loads only when opened
 */

export const games = [
  // ---------------------------------------------------------------- Classics
  {
    id: 'snake',
    title: 'Snake',
    description: 'Steer a growing snake toward food without running into the walls or your own tail.',
    categories: ['classics'],
    difficulty: 1,
    difficultyLabel: 'Easy',
    tags: ['grid', 'retro', 'endless'],
    howTo:
      'Eat the terracotta dots to grow. The snake speeds up as it gets longer. Hitting a wall or yourself ends the run.',
    controls: [
      { keys: ['↑', '↓', '←', '→'], action: 'Steer' },
      { keys: ['W', 'A', 'S', 'D'], action: 'Steer' },
      { keys: ['Swipe'], action: 'Steer on touch' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'length', label: 'Length' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./snake/index.js'),
  },
  {
    id: 'blocks',
    title: 'Block Stacker',
    description: 'Rotate and drop falling shapes to complete rows before the stack reaches the top.',
    categories: ['classics'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['tetromino', 'falling', 'puzzle', 'lines'],
    howTo:
      'Fill a row from edge to edge to clear it. Clearing several rows at once scores more. Every ten lines the pieces fall faster.',
    controls: [
      { keys: ['←', '→'], action: 'Move' },
      { keys: ['↑', 'X'], action: 'Rotate' },
      { keys: ['Z'], action: 'Rotate back' },
      { keys: ['↓'], action: 'Soft drop' },
      { keys: ['Space'], action: 'Hard drop' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'lines', label: 'Lines' },
      { key: 'level', label: 'Level' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./blocks/index.js'),
  },
  {
    id: '2048',
    title: '2048',
    description: 'Slide numbered tiles together and merge matching pairs on a calm little 4 × 4 board.',
    categories: ['classics', 'brain'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['numbers', 'merge', 'tiles', 'puzzle'],
    howTo:
      'Every move slides all tiles as far as they go. Two equal tiles that touch merge into one. Reach the 2048 tile, then keep going if you like.',
    controls: [
      { keys: ['↑', '↓', '←', '→'], action: 'Slide' },
      { keys: ['W', 'A', 'S', 'D'], action: 'Slide' },
      { keys: ['Swipe'], action: 'Slide on touch' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'tile', label: 'Top tile' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    styles: true,
    stage: 'plain',
    load: () => import('./2048/index.js'),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    description: 'Clear the field using the numbers as clues and flag every hidden mine.',
    categories: ['classics', 'brain'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['logic', 'mines', 'grid', 'puzzle'],
    howTo:
      'Each number tells you how many mines touch that cell. Your first click is always safe. Click a revealed number whose mines are all flagged to open its neighbors.',
    controls: [
      { keys: ['Click'], action: 'Reveal' },
      { keys: ['Right-click'], action: 'Flag' },
      { keys: ['Long press'], action: 'Flag on touch' },
      { keys: ['Arrows'], action: 'Move focus' },
      { keys: ['Enter'], action: 'Reveal' },
      { keys: ['F'], action: 'Flag' },
    ],
    stats: [
      { key: 'mines', label: 'Mines' },
      { key: 'time', label: 'Time' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best-beginner', label: 'Best', format: 'clock', lowerIsBetter: true },
    styles: true,
    stage: 'plain',
    load: () => import('./minesweeper/index.js'),
  },
  {
    id: 'breakout',
    title: 'Breakout',
    description: 'Keep the ball in play and clear every brick across five increasingly tricky walls.',
    categories: ['classics', 'arcade'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['bricks', 'paddle', 'ball'],
    howTo:
      'Bounce the ball off your paddle to break bricks. Where the ball hits the paddle sets its angle. Striped bricks need two hits.',
    controls: [
      { keys: ['←', '→'], action: 'Move paddle' },
      { keys: ['Mouse', 'Drag'], action: 'Move paddle' },
      { keys: ['Space', 'Click'], action: 'Launch ball' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'lives', label: 'Lives' },
      { key: 'level', label: 'Level' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./breakout/index.js'),
  },
  {
    id: 'pong',
    title: 'Pong',
    description: 'A quiet rally against the computer. First to seven points takes the match.',
    categories: ['classics'],
    difficulty: 1,
    difficultyLabel: 'Easy',
    tags: ['paddle', 'tennis', 'versus', 'retro'],
    howTo:
      'Return the ball past the computer paddle. The ball speeds up with every hit, and the edge of your paddle sends it at sharper angles.',
    controls: [
      { keys: ['↑', '↓'], action: 'Move paddle' },
      { keys: ['W', 'S'], action: 'Move paddle' },
      { keys: ['Mouse', 'Drag'], action: 'Move paddle' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'player', label: 'You' },
      { key: 'cpu', label: 'Computer' },
      { key: 'wins', label: 'Wins' },
    ],
    record: { key: 'wins', label: 'Wins' },
    pausable: true,
    load: () => import('./pong/index.js'),
  },

  // ---------------------------------------------------------------- Arcade
  {
    id: 'updraft',
    title: 'Updraft',
    description: 'Tap to lift a paper glider through gaps in the columns. One button, endless tries.',
    categories: ['arcade'],
    difficulty: 3,
    difficultyLabel: 'Hard',
    tags: ['flappy', 'one button', 'glider', 'endless'],
    howTo:
      'Each tap gives the glider a little lift while gravity pulls it down. Fly through the gaps; the columns speed up and the gaps narrow as you go.',
    controls: [
      { keys: ['Space', '↑', 'W'], action: 'Flap' },
      { keys: ['Click', 'Tap'], action: 'Flap' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./updraft/index.js'),
  },
  {
    id: 'lane-splitter',
    title: 'Lane Splitter',
    description: 'Ride a motorcycle down a busy highway, weave through traffic and chase the next close call.',
    categories: ['racing', 'arcade'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['motorcycle', 'moto', 'traffic', 'driving', 'road'],
    howTo:
      'Traffic gets faster the longer you ride. Throttle for more points, brake to find a gap, and slip past cars closely for near-miss bonuses.',
    controls: [
      { keys: ['←', '→'], action: 'Steer' },
      { keys: ['A', 'D'], action: 'Steer' },
      { keys: ['↑', 'W'], action: 'Throttle' },
      { keys: ['↓', 'S'], action: 'Brake' },
      { keys: ['Touch'], action: 'Hold and drag to steer' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'distance', label: 'Distance' },
      { key: 'speed', label: 'Speed' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./lane-splitter/index.js'),
  },
  {
    id: 'asteroid-belt',
    title: 'Asteroid Belt',
    description: 'Pilot a small ship through drifting rocks. Break them apart before they break you.',
    categories: ['arcade'],
    difficulty: 3,
    difficultyLabel: 'Hard',
    tags: ['space', 'shooter', 'asteroids', 'ship'],
    howTo:
      'Large rocks split into smaller, faster ones. The ship keeps its momentum, and the screen wraps around at every edge. Clear a wave to start the next.',
    controls: [
      { keys: ['←', '→'], action: 'Rotate' },
      { keys: ['↑', 'W'], action: 'Thrust' },
      { keys: ['Space'], action: 'Fire' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'lives', label: 'Lives' },
      { key: 'wave', label: 'Wave' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./asteroid-belt/index.js'),
  },
  {
    id: 'dune-runner',
    title: 'Dune Runner',
    description: 'Sprint across warm desert dunes, hop over cacti and duck under low-flying birds.',
    categories: ['arcade'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['runner', 'endless', 'jump', 'desert'],
    howTo: 'Hold jump for a higher leap. The runner speeds up over time, and birds start appearing once you get going.',
    controls: [
      { keys: ['Space', '↑', 'W'], action: 'Jump' },
      { keys: ['↓', 'S'], action: 'Duck' },
      { keys: ['Tap'], action: 'Jump on touch' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'speed', label: 'Pace' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    load: () => import('./dune-runner/index.js'),
  },
  {
    id: 'aim-trainer',
    title: 'Aim Trainer',
    description: 'Hit as many targets as you can in a timed round and watch your accuracy improve.',
    categories: ['arcade'],
    difficulty: 1,
    difficultyLabel: 'Easy',
    tags: ['targets', 'mouse', 'reflex', 'click'],
    howTo:
      'Targets shrink while they wait, so be quick. Missed clicks lower your accuracy. Rounds last 30 or 60 seconds.',
    controls: [
      { keys: ['Click', 'Tap'], action: 'Hit target' },
      { keys: ['P', 'Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'hits', label: 'Hits' },
      { key: 'accuracy', label: 'Accuracy' },
      { key: 'reaction', label: 'Avg time' },
      { key: 'time', label: 'Time' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best-30', label: 'Best' },
    pausable: true,
    load: () => import('./aim-trainer/index.js'),
  },

  // ---------------------------------------------------------------- Brain / Chill
  {
    id: 'word-rain',
    title: 'Word Rain',
    description: 'Words drift down from the top. Type each one before it touches the ground.',
    categories: ['brain'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['typing', 'keyboard', 'words', 'wpm', 'speed'],
    howTo:
      'Start typing any falling word; it completes on its own once spelled correctly. A word that reaches the ground costs a life. Words get longer and faster every level.',
    controls: [
      { keys: ['Type'], action: 'Spell a falling word' },
      { keys: ['Enter'], action: 'Clear what you typed' },
      { keys: ['Esc'], action: 'Pause' },
    ],
    stats: [
      { key: 'score', label: 'Score' },
      { key: 'wpm', label: 'WPM' },
      { key: 'accuracy', label: 'Accuracy' },
      { key: 'lives', label: 'Lives' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best' },
    pausable: true,
    styles: true,
    load: () => import('./word-rain/index.js'),
  },
  {
    id: 'pairs',
    title: 'Pairs',
    description: 'Turn over cards two at a time and find every matching pair in as few moves as you can.',
    categories: ['brain'],
    difficulty: 1,
    difficultyLabel: 'Easy',
    tags: ['memory', 'cards', 'match', 'concentration'],
    howTo:
      'Flip two cards. Matching cards stay face up, others turn back over. Try a bigger board when the small one feels easy.',
    controls: [
      { keys: ['Click', 'Tap'], action: 'Flip a card' },
      { keys: ['Tab'], action: 'Move between cards' },
      { keys: ['Enter', 'Space'], action: 'Flip focused card' },
    ],
    stats: [
      { key: 'moves', label: 'Moves' },
      { key: 'pairs', label: 'Pairs' },
      { key: 'time', label: 'Time' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'moves-4x4', label: 'Fewest moves', lowerIsBetter: true },
    styles: true,
    stage: 'plain',
    load: () => import('./pairs/index.js'),
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    description: 'Fill the grid so every row, column and box holds the numbers one to nine.',
    categories: ['brain'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['numbers', 'logic', 'grid', 'puzzle'],
    howTo:
      'Every puzzle has exactly one solution. Conflicting numbers are marked as you go. Use notes to keep track of candidates.',
    controls: [
      { keys: ['Click', 'Arrows'], action: 'Select cell' },
      { keys: ['1–9'], action: 'Enter number' },
      { keys: ['N'], action: 'Toggle notes' },
      { keys: ['Backspace'], action: 'Erase' },
      { keys: ['Ctrl', 'Z'], action: 'Undo' },
    ],
    stats: [
      { key: 'time', label: 'Time' },
      { key: 'filled', label: 'Filled' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best-easy', label: 'Best', format: 'clock', lowerIsBetter: true },
    styles: true,
    stage: 'plain',
    load: () => import('./sudoku/index.js'),
  },
  {
    id: 'reaction-time',
    title: 'Reaction Time',
    description: 'Wait for the panel to change color, then click as fast as you can. Five tries per round.',
    categories: ['brain'],
    difficulty: 1,
    difficultyLabel: 'Easy',
    tags: ['reflex', 'speed', 'click', 'ms'],
    howTo:
      'Click when the panel turns terracotta. Clicking early counts as a false start. Your average over five tries is your round score.',
    controls: [
      { keys: ['Click', 'Tap'], action: 'React' },
      { keys: ['Space', 'Enter'], action: 'React' },
    ],
    stats: [
      { key: 'last', label: 'Last' },
      { key: 'average', label: 'Average' },
      { key: 'attempt', label: 'Try' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best', format: 'ms', lowerIsBetter: true },
    styles: true,
    stage: 'flush',
    load: () => import('./reaction-time/index.js'),
  },
  {
    id: 'echo',
    title: 'Echo',
    description: 'Watch a pattern of tiles light up, then repeat it. Each round adds one more step.',
    categories: ['brain'],
    difficulty: 2,
    difficultyLabel: 'Medium',
    tags: ['memory', 'sequence', 'pattern', 'simon'],
    howTo:
      'Watch the sequence, then tap the tiles in the same order. One wrong tile ends the game. Sound is optional and off by default.',
    controls: [
      { keys: ['Click', 'Tap'], action: 'Repeat the pattern' },
      { keys: ['1–9'], action: 'Press a tile' },
    ],
    stats: [
      { key: 'level', label: 'Level' },
      { key: 'progress', label: 'Step' },
      { key: 'best', label: 'Best' },
    ],
    record: { key: 'best', label: 'Best', format: 'level' },
    styles: true,
    stage: 'plain',
    load: () => import('./echo/index.js'),
  },
];

export const gameById = (id) => games.find((game) => game.id === id);

export const primaryCategory = (game) => game.categories[0];
