// Annotating a missed puzzle: the circle, the time lines, and the replay loop.

import { PUZZLE_TOL, RUN_TIME_CAP, TRACK_LEN } from './constants.js';
import { ballRadius, clamp, graphC, groundY, gx, mToPx, sx } from './dom.js';
import { getCss, handFont } from './draw.js';
import { clearGraphPoints, drawGraph, graphGeom, graphPanels, graphTypeFor } from './graph.js';
import { interpPoly } from './puzzles.js';
import { drawScene } from './scene.js';
import { balls, lastTrace, launchX, sampleAt, v } from './sim.js';
import { activePuzzle, graphType, mode, setGraphType, testPuzzle } from './state.js';

// ─── Annotate a missed puzzle: one circle + up to 3 time arrows (dots where each hits both lines) ──
// Both are stored in time (and panel-relative height), so they stay put when switching graph type.
export let annotating = false, annotCircle = null, annotArrows = [], annotDrag = null;   // arrows: up to 3 of { t, key, f } (f = height reached, as a fraction of the panel)
export function endAnnotate() {
  stopAnnotPlay();
  const was = annotating;
  annotating = false; annotCircle = null; annotArrows = []; annotDrag = null;
  document.getElementById('annotBar').hidden = true; document.getElementById('annotBtns').hidden = true; graphC.style.cursor = '';
  if (graphC.dataset.tipOrig) graphC.dataset.tip = graphC.dataset.tipOrig;
  if (was) {
    document.getElementById('graphTabs').hidden = (mode === 'puzzle') || (mode === 'create' && !!testPuzzle);
    const P = activePuzzle(); if (P) setGraphType(graphTypeFor(P.metric));
    [...document.querySelectorAll('#graphTabs button')].forEach(btn => btn.classList.toggle('active', btn.dataset.g === graphType));
  }
}
export function startAnnotate() {
  document.getElementById('tryOverlay').hidden = true;
  graphC.dataset.tipOrig = graphC.dataset.tipOrig || graphC.dataset.tip;
  annotating = true; annotCircle = null; annotArrows = []; clearGraphPoints();
  graphC.dataset.tip = '';                                  // no hover tooltip while annotating
  document.getElementById('annotBar').hidden = false; document.getElementById('annotBtns').hidden = false; graphC.style.cursor = 'crosshair';
  document.getElementById('graphTabs').hidden = false;      // let the student look at the other graph too
  [...document.querySelectorAll('#graphTabs button')].forEach(btn => btn.classList.toggle('active', btn.dataset.g === graphType));   // highlight the graph actually showing
  drawGraph();
}
const snapT = tt => Math.round(tt * 4) / 4;   // arrows land on the nearest 0.25 s
function annotTimeAt(mx) { const { x0, x1, tMax } = graphGeom; return clamp((mx - x0) / (x1 - x0), 0, 1) * tMax; }
export function drawAnnotations() {
  if (!annotating || !graphGeom) return;
  const { x0, x1, tMax } = graphGeom, TX = tt => x0 + (tt / tMax) * (x1 - x0);
  const pink = '#e0245e';
  gx.save(); gx.strokeStyle = pink; gx.fillStyle = pink; gx.lineWidth = 3.5; gx.lineCap = 'round';
  const ell = (cx, cy, rx, ry) => { gx.beginPath(); gx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2); gx.stroke(); };
  if (annotCircle) {
    const c = annotCircle, P = graphPanels.find(q => q.key === c.key);   // only on the graph it was drawn on
    if (P) { const ya = P.ty + c.f0 * (P.by - P.ty), yb = P.ty + c.f1 * (P.by - P.ty);
      ell((TX(c.t0) + TX(c.t1)) / 2, (ya + yb) / 2, Math.abs(TX(c.t1) - TX(c.t0)) / 2, Math.abs(yb - ya) / 2); }
  }
  if (annotPlay) { const px = TX(annotPlay.t), P0 = graphPanels[0], P1 = graphPanels[graphPanels.length - 1]; gx.lineWidth = 2; gx.setLineDash([5, 4]); gx.beginPath(); gx.moveTo(px, P0.ty); gx.lineTo(px, P1.by); gx.stroke(); gx.setLineDash([]); gx.lineWidth = 3.5; }   // replay playhead
  if (annotDrag) { const d = annotDrag; ell((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, Math.abs(d.x1 - d.x0) / 2, Math.abs(d.y1 - d.y0) / 2); }
  for (const arw of annotArrows) {
    const AP = activePuzzle(), xx = TX(arw.t);
    const P = graphPanels.find(q => q.key === arw.key);                 // hidden when that graph isn't showing
    if (P) {
      const Y = v => P.by + (v / P.yMax) * (P.ty - P.by);
      const tip = P.by - arw.f * (P.by - P.ty);
      gx.beginPath(); gx.moveTo(xx, P.by); gx.lineTo(xx, tip); gx.stroke();                // vertical line up from the time axis
      const dots = [];
      const own = balls[0] && balls[0].samples.length > 1 ? sampleAt(balls[0].samples, P.key, arw.t) : null;
      if (own !== null) dots.push({ y: Y(own), c: balls[0].color });
      if (AP && AP.target && AP.target.key === P.key) {
        const tg = AP.target; dots.push({ y: Y(tg.kind === 'flat' ? tg.value : interpPoly(tg.pts, arw.t)), c: getCss('--accent') });
      }
      for (const q of dots) {
        if (q.y < tip - 1 || q.y > P.by + 1) continue;                                       // dot appears once the arrow reaches that line
        gx.beginPath(); gx.arc(xx, q.y, 6, 0, Math.PI * 2); gx.fillStyle = q.c; gx.fill();
        gx.strokeStyle = pink; gx.lineWidth = 2.5; gx.stroke(); gx.fillStyle = pink; gx.lineWidth = 3.5;
      }
    }
  }
  gx.restore();
}
// ─── Annotate replay: loop the run over the circled time span; each arrow pauses it and blinks the two spots ──
// The loop plays the saved samples back (no physics). The circle's width is the span (no circle = the whole 5 s).
// At each arrow's time it holds ARROW_PAUSE seconds and blinks a red ring (the student's ball) and a blue ring (where the
// target graph puts the ball) on the world.
const ARROW_PAUSE = 1.5, LOOP_GAP = 0.5;
const BLINK_PHASE = 0.4;   // seconds the rings stay on, then off
// Velocity puzzles can't be read from a frozen spot, so at a pause both balls run at their velocities for VEL_LOOP seconds from the line, repeating for VEL_PAUSE seconds
const VEL_LOOP = 1, VEL_PAUSE = 3;
export let annotPlay = null;   // { t, hold, blink, mark, moving, lt, fired, last, restoreX } while looping
const annotReplayBtn = document.getElementById('annotReplay');
function annotSpan() {
  if (!annotCircle) return [0, RUN_TIME_CAP];
  return [annotCircle.t0, Math.min(RUN_TIME_CAP, Math.max(annotCircle.t1, annotCircle.t0 + 0.5))];
}
function runSamples() { return lastTrace && lastTrace[0] ? lastTrace[0].samples : balls[0].samples; }
// where the target graph puts the ball, as a spot on the track (a distance target counts from the launch spot; a velocity target is added up over time)
function idealX(tg, tt) {
  const val = u => tg.kind === 'flat' ? tg.value : interpPoly(tg.pts, u);
  if (tg.key === 'x') return val(tt);
  if (tg.key === 'd') return launchX + val(tt);
  let sum = 0; for (let u = 0; u < tt; u += 0.05) sum += val(u + 0.025) * Math.min(0.05, tt - u);
  return launchX + sum;
}
function startAnnotPlay() {
  if (!annotating || !balls[0] || balls[0].samples.length < 2) return;
  annotPlay = { t: annotSpan()[0], hold: 0, blink: 0, mark: null, fired: new Set(), last: performance.now(), restoreX: balls[0].x };
  annotReplayBtn.textContent = '■ Stop';
}
function stopAnnotPlay(redraw) {
  if (!annotPlay) return;
  balls[0].x = annotPlay.restoreX; annotPlay = null; annotReplayBtn.textContent = '▶ Replay';
  if (redraw) { drawScene(); drawGraph(); }
}
export function tickAnnotPlay(now) {
  const p = annotPlay, [a, b] = annotSpan(), dt = Math.min(0.05, (now - p.last) / 1000); p.last = now;
  p.blink += dt;
  if (p.hold > 0) {
    p.hold -= dt;
    if (p.moving && p.mark) p.lt = (p.lt + dt) % VEL_LOOP;
    if (p.hold <= 0) { p.mark = null; p.moving = false; if (p.t >= b - 1e-9) { p.t = a; p.fired.clear(); } }
  } else {
    p.t = clamp(p.t, a, b);
    const nt = Math.min(b, p.t + dt);
    const hit = annotArrows.filter(r => r.t >= p.t - 1e-9 && r.t <= nt && !p.fired.has(r)).sort((u, w) => u.t - w.t)[0];
    if (hit) { p.t = hit.t; p.fired.add(hit); p.mark = hit; p.moving = velPuzzle(); p.lt = 0; p.hold = p.moving ? VEL_PAUSE : ARROW_PAUSE; p.blink = 0; }
    else { p.t = nt; if (nt >= b) p.hold = LOOP_GAP; }
  }
  balls[0].x = sampleAt(runSamples(), 'x', p.mark && p.moving ? Math.min(RUN_TIME_CAP, p.mark.t + p.lt) : p.t);
  drawScene(); drawGraph();
}
// The spots on the world: while a line is being drawn / dragged (steady), or at a replay pause (blinking; for a velocity puzzle the balls run instead).
// Red ring = the student's ball, blue ring = where the target graph puts it. Where the student matched the target, one purple "nice!" ring instead.
function velPuzzle() { const AP = activePuzzle(); return !!(AP && AP.target && AP.target.key === 'v'); }
function replayMark() {   // { t: moment the rings sit at, at: the line's time (where "matched" is judged) } or null while blinked off
  if (annotDrag && annotDrag.obj) return { t: annotDrag.obj.t, at: annotDrag.obj.t };
  const p = annotPlay; if (!p || !p.mark) return null;
  if (p.moving) return { t: Math.min(RUN_TIME_CAP, p.mark.t + p.lt), at: p.mark.t };
  return Math.floor(p.blink / BLINK_PHASE) % 2 ? null : { t: p.t, at: p.t };
}
export function drawReplayMarks() {
  if (!annotating) return;
  const mk = replayMark(); if (!mk) return;
  const AP = activePuzzle(), tg = AP && AP.target, r = ballRadius() + 7, cy = groundY() - ballRadius();
  const mine = sampleAt(runSamples(), 'x', mk.t);
  let marks = [{ m: mine, col: '#e5372f', label: 'you' }];
  if (tg) {
    const own = sampleAt(runSamples(), tg.key, mk.at), want = tg.kind === 'flat' ? tg.value : interpPoly(tg.pts, mk.at);
    if (Math.abs(own - want) <= (AP.tol || PUZZLE_TOL)) marks = [{ m: mine, col: '#8e44ad', label: 'nice!' }];
    else marks.push({ m: clamp(idealX(tg, mk.t), 0, TRACK_LEN), col: '#2d8bd4', label: 'goal' });   // (a velocity target starts from the launch spot, even where that is out of reach)
  }
  sx.save(); sx.font = handFont(14, 700); sx.textAlign = 'center'; sx.textBaseline = 'bottom';
  for (const k of marks) {
    const px = mToPx(k.m);
    sx.beginPath(); sx.arc(px, cy, r, 0, Math.PI * 2);
    sx.globalAlpha = 0.28; sx.fillStyle = k.col; sx.fill(); sx.globalAlpha = 1;
    sx.strokeStyle = k.col; sx.lineWidth = 4.5; sx.stroke();
    sx.fillStyle = k.col; sx.fillText(k.label, px, cy - r - 3);
  }
  sx.restore();
}
annotReplayBtn.addEventListener('click', () => { if (annotPlay) stopAnnotPlay(true); else startAnnotPlay(); });
// the arrow (if any) under a point on the graph: its shaft or head, but not the time-axis strip where new arrows start
function arrowAt(mx, my) {
  if (!graphGeom) return -1;
  const { x0, x1, tMax } = graphGeom;
  return annotArrows.findIndex(arw => {
    const P = graphPanels.find(q => q.key === arw.key); if (!P) return false;
    const xx = x0 + (arw.t / tMax) * (x1 - x0), tip = P.by - arw.f * (P.by - P.ty);
    return Math.abs(mx - xx) <= 8 && my >= tip - 6 && my <= P.by - 4;
  });
}
function panelAt(my) { return graphPanels.find(q => my >= q.ty - 6 && my <= q.by + 6); }
graphC.addEventListener('pointerdown', e => {
  if (!annotating || !graphGeom) return;
  const r = graphC.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const hitArrow = arrowAt(mx, my);
  if (hitArrow >= 0) {                                                        // press an existing arrow: a plain click deletes it, a drag moves / resizes it
    const arw = annotArrows[hitArrow], P = graphPanels.find(q => q.key === arw.key);
    graphC.setPointerCapture(e.pointerId);
    annotDrag = { arrow: P, obj: arw, edit: true, sx: mx, sy: my, moved: false }; return;
  }
  const AP = activePuzzle(), only = AP && AP.target ? AP.target.key : null;     // in a puzzle, lines go on the puzzle's own graph only (not the other one in the Both view)
  const strip = graphPanels.find(q => my > q.by - 22 && my <= q.by + 34);       // the time axis → place the time marker
  const ax = strip && (!only || strip.key === only) ? strip : null;
  if (strip && !ax && mx >= graphGeom.x0 - 10 && mx <= graphGeom.x1 + 10) return;   // the other graph's axis: no line there (and no stray circle)
  graphC.setPointerCapture(e.pointerId);
  if (ax && mx >= graphGeom.x0 - 10 && mx <= graphGeom.x1 + 10) {            // drag up from the time axis → arrow
    if (annotArrows.length >= 3) annotArrows.shift();                     // a 4th arrow replaces the oldest
    const arw = { t: snapT(annotTimeAt(mx)), key: ax.key, f: 0 };
    annotArrows.push(arw); annotDrag = { arrow: ax, obj: arw }; drawGraph(); return;
  }
  annotCircle = null;                                                         // the old circle goes the moment a new one starts
  annotDrag = { x0: mx, y0: my, x1: mx, y1: my };
});
graphC.addEventListener('pointermove', e => {
  if (!annotating) return;
  const r = graphC.getBoundingClientRect();
  if (!annotDrag) { graphC.style.cursor = arrowAt(e.clientX - r.left, e.clientY - r.top) >= 0 ? 'pointer' : 'crosshair'; return; }
  if (annotDrag.arrow) {
    const D = annotDrag, P = D.arrow, mx = e.clientX - r.left, my = e.clientY - r.top;
    if (D.edit) { if (!D.moved && Math.hypot(mx - D.sx, my - D.sy) < 4) return; D.moved = true; D.obj.t = snapT(annotTimeAt(mx)); }   // dragging an existing arrow also slides it in time
    D.obj.f = clamp((P.by - my) / (P.by - P.ty), 0, 1); drawScene(); drawGraph(); return;
  }
  annotDrag.x1 = e.clientX - r.left; annotDrag.y1 = e.clientY - r.top; drawGraph();
});
graphC.addEventListener('pointerup', () => {
  if (!annotating || !annotDrag) return;
  const d = annotDrag; annotDrag = null;
  if (d.arrow) {
    const i = annotArrows.indexOf(d.obj);
    if (i >= 0 && (d.edit && !d.moved || d.obj.f * (d.arrow.by - d.arrow.ty) < 8)) annotArrows.splice(i, 1);   // a plain click on an arrow, or one dragged down to the axis, deletes it; a bare click on the axis makes none
    drawScene(); drawGraph(); return;
  }
  const P = panelAt((d.y0 + d.y1) / 2) || graphPanels[0];
  if (P && (Math.abs(d.x1 - d.x0) > 8 || Math.abs(d.y1 - d.y0) > 8)) {      // a new circle replaces the old one
    const f = y => (y - P.ty) / (P.by - P.ty);
    annotCircle = { key: P.key, t0: annotTimeAt(Math.min(d.x0, d.x1)), t1: annotTimeAt(Math.max(d.x0, d.x1)), f0: f(Math.min(d.y0, d.y1)), f1: f(Math.max(d.y0, d.y1)) };
  }
  drawGraph();
});
