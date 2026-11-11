// Shared world and selection state (what mode we are in, which puzzle, the placed track pieces).

export let graphType = 'position';
export let mode = 'sandbox';           // 'sandbox' | 'puzzle' | 'create'
export let currentPuzzle = null;       // the selected puzzle object in puzzle mode
export let testPuzzle = null;          // an imported puzzle being played in the Create tab (null = authoring)
export let testSolved = false;
export let authorState = null;         // the author's own track, parked while they play an imported puzzle
// the puzzle currently being graded / drawn as a dashed target (puzzle tab, or a loaded puzzle in Create)
export function activePuzzle() { return mode === 'puzzle' ? currentPuzzle : mode === 'create' ? testPuzzle : null; }
export let puzzleGraded = false;       // whether the current run has been graded against the puzzle
export const boosts = [];             // {id, x, dv, used}  — speed change pad (dv may be + or −)
export const fricZones = [];          // {id, x, len}
export const walls = [];              // {id, x, bouncy}  — x is the ball's contact position (see WALL_D)
export const targets = [];            // {id, x, mag, dir, time, used}  — target-speed gates
export const secondBalls = [];        // {id, x}  — stationary balls that get hit (equal-mass swap)

// The track-piece lists are mutated in place, never reassigned, so every module
// keeps pointing at the same array. These are the only ways they change.
export let selected = null;           // { piece, el } — the last-clicked track piece (× button, Delete key, arrow nudges)
export function clearPieces() { for (const a of [boosts, fricZones, walls, targets, secondBalls]) a.length = 0; selected = null; }
export function loadPieces(d) {
  clearPieces();
  boosts.push(...d.boosts); fricZones.push(...d.fricZones);
  walls.push(...d.walls); targets.push(...d.targets); secondBalls.push(...d.secondBalls);
}
export function removePiece(arr, el) { const i = arr.indexOf(el); if (i >= 0) arr.splice(i, 1); if (selected && selected.el === el) selected = null; }

// Setters for the state above (modules may read an import, but only its own module may assign).
export function setGraphType(g) { graphType = g; }
export function setModeValue(m) { mode = m; }
export function setCurrentPuzzle(p) { currentPuzzle = p; }
export function setTestPuzzle(p) { testPuzzle = p; }
export function setTestSolved(b) { testSolved = b; }
export function setAuthorState(s) { authorState = s; }
export function setPuzzleGraded(b) { puzzleGraded = b; }
export function setSelected(s) { selected = s; }
