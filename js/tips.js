// Every hover tooltip in the app, in one place for review and copy editing. Screen readers read
// the same text: each control's tip is also its spoken description (see the end of this file).
//
// Elements in index.html name their tip with data-tip="<key>" (e.g. data-tip="launch"); track
// pieces and the × delete button look theirs up from input.js. A key used but missing here
// logs a warning in the console.
//
// Special characters are written as escapes so they render on every browser and device:
//   –  –  en dash (ranges: 0–15 m)        −  −  minus sign
//   …  …  ellipsis                         ±  ±  plus-minus

const PIECES = {
  boost:      'Speed change: adds to the marble\'s speed (+) or takes some away (−).',
  target:     'Target speed: sets the marble to the speed on its sign. Its timer can hold the marble until a set time.',
  friction:   'Friction pad: slows the marble while it\'s on it. Drag its ends to resize.',
  wall:       'Wall: stops the marble. Click it to make it bouncy.',
  wallBouncy: 'Bouncy wall: sends the marble back at the same speed. Click it for a plain wall.',
  ball2:      'Marble 2 (M2): sits still until the first marble hits it, then takes its speed.',
};

export const TIPS = {
  // ── Top bar ──
  modeTabs:       'Sandbox: build any track. Puzzle: match the graph. Create: turn a run into a puzzle to share, or load one.',
  themeToggle:    'Switch between day and night.',
  help:           'How to use Launcher: the controls, each track piece, and making your own puzzles.',
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
  graph:          'Motion graph: each marble\'s position or speed against time.',

  // ── Track pieces, on the track ──
  ...PIECES,
  deletePiece:    'Delete this piece (or press Backspace).',
};

// Palette chips: the same tip as the piece on the track (keys chip-boost, chip-target, …) — what it does,
// not how to place it (the help covers that).
for (const k of Object.keys(PIECES)) TIPS['chip-' + k] = PIECES[k];

const warned = new Set();
export function tipText(key) {
  if (!key) return null;
  if (!(key in TIPS)) { if (!warned.has(key)) { warned.add(key); console.warn('tips.js: no tip named "' + key + '"'); } return null; }
  return TIPS[key];
}

// ─── Screen readers: the tips above, read aloud ───────────────────────────────
// A control takes the tip a mouse would show over it: its nearest data-tip, the same rule as on
// hover. It's linked as the control's description (aria-describedby → a hidden copy of the
// text), which a screen reader reads after the control's name: "Launch, button. Release the
// marble…". The palette chips can't take the keyboard focus, so their tip goes inside them as
// text only screen readers see. A control's own tip that starts with its name ("Target speed:
// …") leaves the name off, so it isn't read twice. Run once at start-up.
const nameOf = el => (el.getAttribute('aria-label') || (el.labels && el.labels[0] ? el.labels[0].innerText : el.innerText) || '').replace(/\s+/g, ' ').trim();
function spokenTip(key, name) {
  const text = tipText(key);
  if (!text || !name || !text.startsWith(name + ': ')) return text;
  const rest = text.slice(name.length + 2);
  return rest[0].toUpperCase() + rest.slice(1);
}
export function describeControlsWithTips() {
  const store = document.createElement('div'); store.id = 'tipDescriptions'; store.hidden = true;
  let n = 0;
  for (const el of document.querySelectorAll('button, input, select, textarea')) {
    const host = el.closest('[data-tip]');
    const text = host && spokenTip(host.dataset.tip, host === el ? nameOf(el) : '');   // a shared tip (e.g. the mode tabs') stays whole
    if (!text) continue;
    const d = document.createElement('span'); d.id = 'tipFor' + (++n); d.textContent = text;
    store.appendChild(d); el.setAttribute('aria-describedby', d.id);
  }
  for (const chip of document.querySelectorAll('.chip[data-tip]')) {
    const text = spokenTip(chip.dataset.tip, nameOf(chip.querySelector('.ctxt')));
    if (!text) continue;
    const d = document.createElement('span'); d.className = 'srOnly'; d.textContent = text;
    chip.appendChild(d);
  }
  document.body.appendChild(store);
}
