// The puzzle rows: data, menu, grading and the result pop-ups.

import { endAnnotate, startAnnotate } from './annotate.js';
import { AXES, PUZZLE_TOL } from './constants.js';
import { exitTest } from './create.js';
import { drawGraph, graphTypeFor } from './graph.js';
import { refreshBall2Chip } from './input.js';
import { balls, resetRun, running } from './sim.js';
import { activePuzzle, clearPieces, currentPuzzle, graphType, mode, puzzleGraded, setCurrentPuzzle, setGraphType, setModeValue, setPuzzleGraded, setTestSolved, testPuzzle, testSolved } from './state.js';
import { fitStage } from './ui.js';

// 5 distance + 5 position + 5 velocity challenges (three menu rows of five, keyed by graph type). No names or hints — the player just
// reads the target line off the graph and matches it. Each target carries its own axis key
// ('d' distance, 'x' position or 'v' velocity). The rest are placeholders that unlock progressively.
// (The position row keeps its old ids pos6–pos10 so players' saved progress still matches.)
export const PUZZLES = {
  distance: [   // distance starts at 0 whatever the launch position, so no flat target here
    { id: 'dist1', metric: 'distance', stars: 1, target: { kind: 'poly', key: 'd', pts: [{ t: 0, x: 0 }, { t: 5, x: 15 }] } },   // steady 3 m/s: 15 m in 5 s
    { id: 'dist2', metric: 'distance', stars: 1,   // same 3 m/s, but stops at 9 m (at 3 s) and stays there
      target: { kind: 'poly', key: 'd', pts: [{ t: 0, x: 0 }, { t: 3, x: 9 }, { t: 5, x: 9 }] } },
    { id: 'dist3', metric: 'distance', stars: 1,
      target: { kind: 'poly', key: 'd', pts: [{ t: 0, x: 0 }, { t: 1, x: 3 }, { t: 5, x: 7 }] } },
    { id: 'dist4', metric: 'distance', stars: 2 },
    { id: 'dist5', metric: 'distance', stars: 2 },
  ],
  position: [
    { id: 'pos6', metric: 'position', stars: 2,   // up to 20 m at 2.5 s and back down to 0 (ping-pong)
      target: { kind: 'poly', key: 'x', pts: [{ t: 0, x: 0 }, { t: 0.25, x: 2 }, { t: 0.5, x: 4 }, { t: 0.75, x: 6 }, { t: 1, x: 8 }, { t: 1.25, x: 10 }, { t: 1.5, x: 12 }, { t: 1.75, x: 14 }, { t: 2, x: 16 }, { t: 2.25, x: 18 }, { t: 2.5, x: 19.99 }, { t: 2.75, x: 18.02 }, { t: 3, x: 16.02 }, { t: 3.25, x: 14.02 }, { t: 3.5, x: 12.02 }, { t: 3.75, x: 10.02 }, { t: 4, x: 8.02 }, { t: 4.25, x: 6.02 }, { t: 4.5, x: 4.02 }, { t: 4.75, x: 2.02 }, { t: 5, x: 0.02 }] } },
    { id: 'pos7', metric: 'position', stars: 3,
      target: { kind: 'poly', key: 'x', pts: [{ t: 0, x: 1 }, { t: 3, x: 7 }, { t: 5, x: 1 }] } },
    { id: 'pos8', metric: 'position', stars: 3,   // 3 m/s, a burst to 15 m at 3 s, then a slow creep to about 18 m
      target: { kind: 'poly', key: 'x', pts: [{ t: 0, x: 0 }, { t: 0.25, x: 0.75 }, { t: 0.5, x: 1.5 }, { t: 0.75, x: 2.25 }, { t: 1, x: 3 }, { t: 1.25, x: 3.75 }, { t: 1.5, x: 4.5 }, { t: 1.75, x: 5.25 }, { t: 2, x: 6.01 }, { t: 2.25, x: 8.23 }, { t: 2.5, x: 10.48 }, { t: 2.75, x: 12.73 }, { t: 3, x: 14.98 }, { t: 3.25, x: 16.14 }, { t: 3.5, x: 16.39 }, { t: 3.75, x: 16.64 }, { t: 4, x: 16.89 }, { t: 4.25, x: 17.14 }, { t: 4.5, x: 17.39 }, { t: 4.75, x: 17.64 }, { t: 5, x: 17.89 }] } },
    { id: 'pos9', metric: 'position', stars: 3,   // 2 m/s, a pause at 4 m, a dash to 14 m at 4 s, then back down to about 4 m
      target: { kind: 'poly', key: 'x', pts: [{ t: 0, x: 0 }, { t: 0.25, x: 0.5 }, { t: 0.5, x: 1 }, { t: 0.75, x: 1.5 }, { t: 1, x: 2 }, { t: 1.25, x: 2.5 }, { t: 1.5, x: 3 }, { t: 1.75, x: 3.5 }, { t: 2, x: 3.99 }, { t: 2.25, x: 4 }, { t: 2.5, x: 4 }, { t: 2.75, x: 4 }, { t: 3, x: 4.04 }, { t: 3.25, x: 6.54 }, { t: 3.5, x: 9.04 }, { t: 3.75, x: 11.54 }, { t: 4, x: 13.97 }, { t: 4.25, x: 11.47 }, { t: 4.5, x: 8.97 }, { t: 4.75, x: 6.47 }, { t: 5, x: 3.97 }] } },
    { id: 'pos10', metric: 'position', stars: 3 },
  ],
  velocity: [
    { id: 'vel1', metric: 'velocity', stars: 2, target: { kind: 'flat', key: 'v', value: 3 } },
    { id: 'vel2', metric: 'velocity', stars: 2,   // 5 m/s to 1.75 s, then drops to 1 m/s and holds
      target: { kind: 'poly', key: 'v', pts: [{ t: 0, x: 5 }, { t: 0.25, x: 5 }, { t: 0.5, x: 5 }, { t: 0.75, x: 5 }, { t: 1, x: 5 }, { t: 1.25, x: 5 }, { t: 1.5, x: 5 }, { t: 1.75, x: 5 }, { t: 2, x: 1.53 }, { t: 2.25, x: 1 }, { t: 2.5, x: 1 }, { t: 2.75, x: 1 }, { t: 3, x: 1 }, { t: 3.25, x: 1 }, { t: 3.5, x: 1 }, { t: 3.75, x: 1 }, { t: 4, x: 1 }, { t: 4.25, x: 1 }, { t: 4.5, x: 1 }, { t: 4.75, x: 1 }, { t: 5, x: 1 }] } },
    { id: 'vel3', metric: 'velocity', stars: 3,   // 5 m/s steady to 2 s, then slowing to a stop at 4.5 s
      target: { kind: 'poly', key: 'v', pts: [{ t: 0, x: 5 }, { t: 0.25, x: 5 }, { t: 0.5, x: 5 }, { t: 0.75, x: 5 }, { t: 1, x: 5 }, { t: 1.25, x: 5 }, { t: 1.5, x: 5 }, { t: 1.75, x: 5 }, { t: 2, x: 5 }, { t: 2.25, x: 4.51 }, { t: 2.5, x: 4.01 }, { t: 2.75, x: 3.51 }, { t: 3, x: 3.01 }, { t: 3.25, x: 2.51 }, { t: 3.5, x: 2.01 }, { t: 3.75, x: 1.51 }, { t: 4, x: 1.01 }, { t: 4.25, x: 0.51 }, { t: 4.5, x: 0.01 }, { t: 4.75, x: 0 }, { t: 5, x: 0 }] } },
    { id: 'vel4', metric: 'velocity', stars: 2 },
    { id: 'vel5', metric: 'velocity', stars: 3 },
  ],
};
export const solvedPuzzles = new Set();
try { (JSON.parse(localStorage.getItem('launcher-puzzles') || '[]')).forEach(id => solvedPuzzles.add(id)); } catch (e) {}
solvedPuzzles.delete('shared');
export function savePuzzles() { try { localStorage.setItem('launcher-puzzles', JSON.stringify([...solvedPuzzles])); } catch (e) {} }
let devUnlockAll = false;   // dev mode (type "dev") opens every level
function puzzleUnlocked(list, i) { return devUnlockAll || !!list[i].unlocked || i % 5 === 0 || solvedPuzzles.has(list[i - 1].id); }
// linear-interpolate a polyline target's position at time tt (clamped to the ends)
export function interpPoly(pts, tt) {
  if (tt <= pts[0].t) return pts[0].x;
  for (let i = 1; i < pts.length; i++) {
    if (tt <= pts[i].t) { const a = pts[i - 1], b = pts[i]; return a.x + (b.x - a.x) * (tt - a.t) / (b.t - a.t); }
  }
  return pts[pts.length - 1].x;
}
function stars(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

export function renderPuzzles() {
  for (const [key, rowId] of [['distance', 'pzRow1'], ['position', 'pzRow2'], ['velocity', 'pzRow3']]) {
    const row = document.getElementById(rowId); row.innerHTML = '';
    PUZZLES[key].forEach((p, i) => {
      const unlocked = puzzleUnlocked(PUZZLES[key], i), solved = solvedPuzzles.has(p.id);
      const btn = document.createElement('button');
      btn.className = 'pzBtn' + (unlocked ? '' : ' locked') + (solved ? ' solved' : '')
        + (currentPuzzle && currentPuzzle.id === p.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = unlocked
        ? '<span class="pzMark">' + (solved ? '✓' : '') + '</span><span class="pzStars">' + stars(p.stars) + '</span>'
        : '<span class="pzLock">🔒</span>';
      btn.addEventListener('click', () => selectPuzzle(p));
      row.appendChild(btn);
    });
  }
}

export function updatePuzzleStatus() {
  const el = document.getElementById('puzzleStatus');
  const P = activePuzzle();
  if (!P) { el.hidden = true; return; }
  el.hidden = false;
  if (P === testPuzzle) {
    el.innerHTML = '<span class="psGoal">Loaded puzzle — match the dashed line.</span>' + (testSolved ? '<span class="psSolved">✓ Solved</span>' : '');
    return;
  }
  if (P.id === 'shared') { el.hidden = true; return; }                                   // linked puzzle: no stars, no Solved
  const solved = solvedPuzzles.has(P.id), playable = !!P.target;
  el.innerHTML = (playable ? '' : '<span class="psGoal">Coming soon — not built yet.</span>')
    + (solved ? '<span class="psSolved">✓ Solved</span>' : '');
}

// Puzzle tab: with no puzzle chosen only the menu shows; choosing one reveals the world + graph.
function syncPuzzleView() {
  const puzzle = mode === 'puzzle', menu = puzzle && !currentPuzzle;
  document.getElementById('puzzlePanel').hidden = !menu;
  document.body.classList.toggle('pz-menu', menu);
  document.getElementById('pzBack').hidden = !(puzzle && currentPuzzle);
}
function clearTrack() { clearPieces(); refreshBall2Chip(); }
export function selectPuzzle(p) {
  clearTrack();
  setCurrentPuzzle(p); setGraphType(graphTypeFor(p.metric)); setPuzzleGraded(false);
  hideWin(); syncPuzzleView(); renderPuzzles(); updatePuzzleStatus();
  resetRun();   // switching puzzles always starts from a clean track
}
function backToMenu() {
  hideWin(); setCurrentPuzzle(null); syncPuzzleView(); renderPuzzles(); updatePuzzleStatus(); resetRun();
}
document.getElementById('pzBack').addEventListener('click', backToMenu);

// ─── Puzzle results: solved celebration (confetti), miss pop-up, grading, and tab switching (setMode) ──
const winEl = document.getElementById('winOverlay'), confC = document.getElementById('confetti');
let confetti = [], confRaf = 0;
function nextPuzzle() {
  if (currentPuzzle && currentPuzzle.id === 'shared') return null;     // a linked puzzle has no "next"
  const all = [...PUZZLES.distance, ...PUZZLES.position, ...PUZZLES.velocity];
  const i = all.findIndex(p => currentPuzzle && p.id === currentPuzzle.id);
  const n = all[i + 1];
  if (!n) return null;
  const list = PUZZLES[n.metric];
  return puzzleUnlocked(list, list.indexOf(n)) ? n : null;
}
const tryEl = document.getElementById('tryOverlay');
function hideWin() { tryEl.hidden = true; endAnnotate(); winEl.hidden = true; cancelAnimationFrame(confRaf); confetti = []; }
function showWin() {
  const nx = nextPuzzle();
  document.getElementById('winNext').hidden = !nx;
  winEl.hidden = false;
  const W = confC.width = window.innerWidth, H = confC.height = window.innerHeight, cx = confC.getContext('2d');
  const cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ff9f43'];
  confetti = Array.from({ length: 160 }, () => ({
    x: Math.random() * W, y: -Math.random() * H * 0.8 - 10, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
    vy: 120 + Math.random() * 160, vx: (Math.random() - 0.5) * 80, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 8,
    c: cols[(Math.random() * cols.length) | 0] }));
  let last = performance.now();
  (function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    cx.clearRect(0, 0, W, H);
    confetti = confetti.filter(p => p.y < H + 20);
    for (const p of confetti) {
      p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(p.y / 30) * 0.6; p.a += p.va * dt;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    }
    if (confetti.length) confRaf = requestAnimationFrame(tick);
  })(last);
}
function tryAgain() { hideWin(); clearTrack(); if (currentPuzzle) setGraphType(graphTypeFor(currentPuzzle.metric)); resetRun(); }   // fresh graph with the goal showing, empty world
document.getElementById('tryAnnotate').addEventListener('click', startAnnotate);
document.getElementById('tryAgain').addEventListener('click', tryAgain);
document.getElementById('annotTry').addEventListener('click', tryAgain);
const revise = () => hideWin();
document.getElementById('tryRevise').addEventListener('click', revise);
document.getElementById('annotRevise').addEventListener('click', revise);   // keep the track, settings and graph exactly as they were
document.getElementById('winBack').addEventListener('click', backToMenu);
document.getElementById('winNext').addEventListener('click', () => { const n = nextPuzzle(); if (n) selectPuzzle(n); else backToMenu(); });

export function gradePuzzle(runEnded) {   // runEnded: the run stopped early (e.g. left the screen) — treat its last value as held to 5 s
  const P = activePuzzle();
  const isTest = P && P === testPuzzle;
  if (puzzleGraded || !P || !P.target) return;   // graded once per run — even a puzzle solved before celebrates again
  const win = AXES.position.t;                         // grade once the 5 s window is filled
  const s = balls[0].samples.filter(p => p.t <= win);
  if (!s.length) return;
  if (s[s.length - 1].t < win - 0.05) {
    if (!runEnded) return;
    const last = s[s.length - 1]; s.push({ t: win, x: last.x, v: last.v, d: last.d });
  }
  setPuzzleGraded(true);
  const tgt = P.target, key = tgt.key, tol = P.tol || PUZZLE_TOL;
  let pass = false, maxDev = 0;
  if (tgt.kind === 'flat') {                           // value stays near a constant
    for (const p of s) maxDev = Math.max(maxDev, Math.abs(p[key] - tgt.value));
    pass = (maxDev <= tol);
  } else if (tgt.kind === 'poly') {                    // value tracks the target shape
    for (const p of s) maxDev = Math.max(maxDev, Math.abs(p[key] - interpPoly(tgt.pts, p.t)));
    pass = (maxDev <= tol);
  }
  if (pass) {
    if (isTest) { setTestSolved(true); }
    else if (P.id !== 'shared') { solvedPuzzles.add(P.id); savePuzzles(); renderPuzzles(); }   // a linked puzzle isn't part of saved progress
    updatePuzzleStatus();
    if (!isTest && mode === 'puzzle') showWin();
  } else if (!isTest && mode === 'puzzle') tryEl.hidden = false;   // a beat to think before revising
}
export function setMode(m) {
  if (mode === 'create' && m !== 'create' && testPuzzle) exitTest();      // leaving Create ends a loaded puzzle
  const prevMode = mode;
  setModeValue(m);
  if (m === 'puzzle' && prevMode !== 'puzzle') { setCurrentPuzzle(null); clearTrack(); }   // entering Puzzle starts at the menu with an empty track
  hideWin();
  [...document.querySelectorAll('#modeTabs button')].forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  const puzzle = m === 'puzzle', create = m === 'create';
  refreshBall2Chip();
  syncPuzzleView();
  document.getElementById('createPanel').hidden = !create;
  document.body.classList.toggle('mode-create', create);
  fitStage();
  document.getElementById('graphTabs').hidden = puzzle || (create && !!testPuzzle);
  if (puzzle) {
    renderPuzzles();
    updatePuzzleStatus(); if (!running) resetRun(); else drawGraph();
  } else {
    updatePuzzleStatus();
    [...document.querySelectorAll('#graphTabs button')].forEach(b => b.classList.toggle('active', b.dataset.g === graphType));
    if (!running) resetRun(); else drawGraph();
  }
}


export function setDevUnlockAll(b) { devUnlockAll = b; }
