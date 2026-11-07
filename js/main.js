// LAUNCHER — entry point: start the loop and open a puzzle from the URL.
//
// The modules, roughly bottom-up (each only imports from the ones above it,
// apart from the few back-edges noted):
//   constants.js  track length, run time cap, puzzle tolerance — no imports
//   state.js      what mode we're in, which puzzle, the placed track pieces
//   dom.js        canvas handles + metres-to-pixels geometry
//   draw.js       theme colours and the hand-drawn cartoon helpers
//   sim.js        live run state (t, x, v, balls), physics, run control, main loop
//   scene.js      painting the world canvas
//   graph.js      painting the graph canvas, pinned points, the axis menu
//   annotate.js   the circle, the time lines and the replay loop
//   input.js      drag & drop, tooltips, delete confirmation
//   puzzles.js    the three puzzle rows: data, menu, grading, result pop-ups
//   create.js     turning a run into a puzzle code, and playing pasted ones
//   ui.js         control wiring, theme toggle, logo, dev panel
//
// Shared state lives in state.js and sim.js. Other modules may READ an imported
// value and see it change (ES module imports are live bindings), but only the
// owning module may assign to it — hence the setters at the foot of state.js.

import { cpJson, cpSay, parsePuzzleJson, puzzleTextFromInput } from './create.js';
import { posEl, posVal, speedEl, speedVal } from './dom.js';
import { getCss } from './draw.js';
import { drawGraph } from './graph.js';
import { refreshBall2Chip } from './input.js';
import { selectPuzzle, setMode } from './puzzles.js';
import { drawScene } from './scene.js';
import { frame } from './sim.js';
import { applyTheme, drawCartoonBall, theme } from './ui.js';

// Every other module only defines things; all the start-up work happens here, in
// order, so nothing runs before the module it depends on has finished loading.
applyTheme(theme);
drawCartoonBall(document.getElementById('logoBall'), getCss('--ball'));
drawCartoonBall(document.getElementById('ball2Icon'), getCss('--ball2'));   // palette icon = the second ball as it appears
refreshBall2Chip();

// Always start at the defaults (a browser reload would otherwise restore the last slider positions)
posEl.value = 5; speedEl.value = 2; posVal.textContent = '5 m'; speedVal.textContent = '2 m/s';
setMode('sandbox');   // open on Sandbox (also resets the run)
// A puzzle code after the URL (…/#%7B…, raw JSON, or …/?puzzle=…) opens that puzzle on its own, in Puzzle mode
// (also when the code is pasted into the address bar of an already-open page → hashchange).
function loadPuzzleFromUrl() {
  const text = puzzleTextFromInput(location.hash || location.search);
  if (text[0] !== '{') return;                     // not a puzzle link — ignore
  try {
    const P = parsePuzzleJson(text); P.id = 'shared';
    setMode('puzzle'); selectPuzzle(P);
  } catch (e) {
    setMode('create'); cpJson.value = location.hash || location.search; cpSay(e.message, 'err');
  }
}
loadPuzzleFromUrl();
window.addEventListener('hashchange', loadPuzzleFromUrl);
requestAnimationFrame(frame);
// redraw once the hand-drawn font has loaded so canvas labels pick it up
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawScene(); drawGraph(); });
