// Create tab: turn a run into a puzzle code, and play pasted ones.

import { AXES, PUZZLE_TOL } from './constants.js';
import { clamp, posEl, speedEl } from './dom.js';
import { clearGraphPoints, drawGraph, graphTypeFor, setCreateMetric } from './graph.js';
import { refreshBall2Chip } from './input.js';
import { setMode, updatePuzzleStatus } from './puzzles.js';
import { lastTrace, resetRun, sampleAt, t } from './sim.js';
import { authorState, boosts, clearPieces, fricZones, graphType, loadPieces, mode, secondBalls, setAuthorState, setGraphType, setPuzzleGraded, setTestPuzzle, setTestSolved, targets, testPuzzle, walls } from './state.js';

const METRIC_KEY = { position: 'x', distance: 'd', velocity: 'v' };   // graph type → sample field
export const cpJson = document.getElementById('cpJson'), cpMsg = document.getElementById('cpMsg');
export function cpSay(text, cls) { cpMsg.textContent = text; cpMsg.className = cls || ''; }
function makePuzzleJson() {
  if (!lastTrace || !lastTrace[0] || lastTrace[0].samples.length < 2) { cpSay('Launch a run first — the puzzle is made from its graph.', 'err'); return; }
  const metric = document.querySelector('input[name=cpMetric]:checked').value, key = METRIC_KEY[metric];
  const samples = lastTrace[0].samples, T = AXES.position.t, pts = [];
  for (let i = 0; i <= T * 4; i++) pts.push([i / 4, +clamp(sampleAt(samples, key, i / 4), key === 'v' ? -1e9 : 0, key === 'v' ? 1e9 : Math.floor(AXES.position.y)).toFixed(2)]);
  if (key === 'v' && Math.min(...pts.map(q => q[1])) < 0) { cpSay('That run\'s velocity goes negative, which the graph can\'t show. Try a different run.', 'err'); return; }
  cpJson.value = '#' + encodeURIComponent(JSON.stringify({ format: 'launcher-puzzle', version: 1, metric, tolerance: PUZZLE_TOL, target: pts }));
  cpSay('Copy the code above and paste it after the page url - this link will load your puzzle directly.', 'ok');
}
// Validate pasted JSON and turn it into a puzzle object (or throw with a readable message).
// Accepts bare JSON or a link with the puzzle after a # or ? (raw, URL-encoded or base64) → the JSON text.
export function puzzleTextFromInput(input) {
  let t = String(input).trim();
  if (t[0] !== '{') {
    const m = t.match(/[#?]([\s\S]*)$/); if (m) t = m[1];
    t = t.replace(/^puzzle=/, '');
    const raw = t;
    try { t = decodeURIComponent(raw); } catch (e) {}
    if (t[0] !== '{') { try { t = atob(raw); } catch (e) {} }
  }
  return t;
}
export function parsePuzzleJson(input) {
  const text = puzzleTextFromInput(input);
  let d; try { d = JSON.parse(text); } catch (e) { throw new Error('That isn\'t valid JSON.'); }
  if (!d || d.format !== 'launcher-puzzle') throw new Error('That JSON isn\'t a Launcher puzzle.');
  if (!METRIC_KEY[d.metric]) throw new Error('Puzzle metric must be "position", "distance" or "velocity".');
  const pts = d.target;
  if (!Array.isArray(pts) || pts.length < 2 || !pts.every(q => Array.isArray(q) && q.length === 2 && isFinite(q[0]) && isFinite(q[1]))) throw new Error('Puzzle target must be a list of [time, value] pairs.');
  for (let i = 1; i < pts.length; i++) if (!(pts[i][0] > pts[i - 1][0])) throw new Error('Target times must increase.');
  const tol = d.tolerance == null ? PUZZLE_TOL : +d.tolerance;
  if (!(tol > 0 && tol <= 5)) throw new Error('Tolerance must be between 0 and 5.');
  return { id: 'imported', metric: d.metric, stars: 0, tol, target: { kind: 'poly', key: METRIC_KEY[d.metric], pts: pts.map(q => ({ t: q[0], x: q[1] })) } };
}
function snapshotTrack() { return JSON.stringify({ boosts, walls, targets, fricZones, secondBalls, pos: posEl.value, speed: speedEl.value }); }
function restoreTrack(str) {
  const d = JSON.parse(str);
  loadPieces(d);
  posEl.value = d.pos; speedEl.value = d.speed;
  posEl.dispatchEvent(new Event('input')); speedEl.dispatchEvent(new Event('input'));
  refreshBall2Chip();
}
function startTest(P) {
  if (!testPuzzle) setAuthorState(snapshotTrack());          // park the author's own track (only the first time)
  setTestPuzzle(P); setTestSolved(false); setPuzzleGraded(false);
  clearPieces(); refreshBall2Chip();
  setGraphType(graphTypeFor(P.metric));
  document.getElementById('graphTabs').hidden = true;
  document.getElementById('cpBuild').hidden = true; document.getElementById('cpBack').hidden = false;
  updatePuzzleStatus(); resetRun();
}
export function exitTest() {
  setTestPuzzle(null); setTestSolved(false);
  if (authorState) { restoreTrack(authorState); setAuthorState(null); }
  document.getElementById('graphTabs').hidden = (mode === 'puzzle');
  document.getElementById('cpBuild').hidden = false; document.getElementById('cpBack').hidden = true;
  updatePuzzleStatus();
  if (mode === 'create') { [...document.querySelectorAll('#graphTabs button')].forEach(b => b.classList.toggle('active', b.dataset.g === graphType)); resetRun(); }
}
document.getElementById('cpMake').addEventListener('click', makePuzzleJson);
// The radio also decides which graph the Create tab shows (no axis menu there)
document.querySelectorAll('input[name=cpMetric]').forEach(r => r.addEventListener('change', () => {
  setCreateMetric(r.value); setGraphType(graphTypeFor(r.value)); clearGraphPoints();
  [...document.querySelectorAll('#graphTabs button')].forEach(b => b.classList.toggle('active', b.dataset.g === graphType));
  drawGraph();
}));
document.getElementById('cpCopy').addEventListener('click', async () => {
  if (!cpJson.value) { cpSay('Nothing to copy yet.', 'err'); return; }
  try { await navigator.clipboard.writeText(cpJson.value); }
  catch (e) { cpJson.select(); document.execCommand('copy'); }
  cpSay('Copied.', 'ok');
});
document.getElementById('cpLoad').addEventListener('click', () => {
  try { startTest(parsePuzzleJson(cpJson.value)); cpSay('Puzzle loaded — build a track that matches the dashed line.', 'ok'); }
  catch (e) { cpSay(e.message, 'err'); }
});
document.getElementById('cpBack').addEventListener('click', () => { exitTest(); cpSay('Back to your own track.', 'ok'); });
document.getElementById('modeTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b && b.dataset.mode) setMode(b.dataset.mode);
});
