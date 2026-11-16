// Every hover tooltip in the app, in one place for review and copy editing.
//
// Elements in index.html name their tip with data-tip="<key>" (e.g. data-tip="launch"); track
// pieces and the × delete button look theirs up from input.js. A key used but missing here
// logs a warning in the console.
//
// Special characters are written as escapes so they render on every browser and device:
//   –  –  en dash (ranges: 0–15 m)        −  −  minus sign
//   …  …  ellipsis                         ±  ±  plus-minus

const PIECES = {
  boost:      'Speed change: adds its value to the marble\'s speed (+ speeds up, − slows down). Use ± to change it in steps of 2.',
  target:     'Target speed: sets the marble to the speed shown (use – to go negative, back toward the start). A timer holds the marble until that time.',
  friction:   'Friction pad: slows the marble while it\'s on it. Drag its ends to resize.',
  wall:       'Wall: stops the marble. Click it to make it bouncy.',
  wallBouncy: 'Bouncy wall: reflects the marble at the same speed. Click it to make it a plain wall.',
  ball2:      'Marble 2 (M2): waits at rest. When hit, it takes the first marble\'s speed and the first stops.',
};

// Added after a piece's tip when hovering its chip in the Track pieces palette.
const CHIP_HINT = 'Drag it onto the track, or click it and then click the track.';

export const TIPS = {
  // ── Top bar ──
  modeTabs:       'Sandbox: build any track. Puzzle: match the graph. Create: turn a run into a puzzle to share, or load one.',
  themeToggle:    'Switch between day and night.',
  backToPuzzles:  'Return to the list of puzzles.',

  // ── Launch controls (left panel) ──
  launchPosition: 'Where the marble starts (0–15 m).',
  launchSpeed:    'How fast the marble starts, going right (0–10 m/s).',
  launch:         'Release the marble. The run records for 5 s, or until the marble leaves the screen.',
  replay:         'Replay the last run at the same speed.',
  reset:          'Clear the run and graph and put the marble back at its start.',
  clear:          'Remove every track piece.',
  positionMap:    'Draw a dot on the world where the marble is at each whole second (0 s, 1 s, 2 s…).',

  // ── Create tab ──
  makePuzzle:     'Turn the last run\'s graph into a shareable puzzle code.',
  copyCode:       'Copy the puzzle code to the clipboard.',
  loadAndPlay:    'Clear the track and play this puzzle yourself.',
  backToBuilding: 'Leave the puzzle and return to your own track.',

  // ── Graph ──
  graphTabs:      'Choose which graph to show.',
  graph:          'Motion graph: each marble\'s position or velocity against time.',

  // ── Track pieces, on the track ──
  ...PIECES,
  deletePiece:    'Delete this piece (or press Backspace).',
};

// Palette chips: the piece's tip + the hint (keys chip-boost, chip-target, …).
for (const k of Object.keys(PIECES)) TIPS['chip-' + k] = PIECES[k] + ' ' + CHIP_HINT;

const warned = new Set();
export function tipText(key) {
  if (!key) return null;
  if (!(key in TIPS)) { if (!warned.has(key)) { warned.add(key); console.warn('tips.js: no tip named "' + key + '"'); } return null; }
  return TIPS[key];
}
