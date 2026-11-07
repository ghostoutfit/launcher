// Painting the graph canvas: axes, grid, target line, the run curve, pinned points and the axis menu.

import { annotating, drawAnnotations } from './annotate.js';
import { AXES, TRACK_LEN } from './constants.js';
import { clamp, graphC, gx, speedEl } from './dom.js';
import { INK, getCss, handFont, roundRect } from './draw.js';
import { drawMarbleAt, fit } from './scene.js';
import { balls, lastTrace, launchX, replaying, running, t } from './sim.js';
import { activePuzzle, graphType, mode, secondBalls } from './state.js';

// The position-type axis can show Position / Distance; the velocity-type axis Velocity / Speed (click the axis title in Sandbox).
// Puzzles and the Create tab force one graph instead: forcedGraph() is that graph's name, or null in the free Sandbox.
let posMode = 'x', velMode = 'v', createMetric = 'position';   // createMetric: the Create tab's radio choice
const POS_SPECS = { x: { key: 'x', label: 'Position', unit: 'm' }, d: { key: 'd', label: 'Distance', unit: 'm' } };
const VEL_SPECS = { v: { key: 'v', label: 'Velocity', unit: 'm/s' }, sp: { key: 'sp', label: 'Speed', unit: 'm/s' } };
function forcedGraph() { const P = activePuzzle(); return P ? P.metric : mode === 'create' ? createMetric : null; }
export const graphTypeFor = metric => metric === 'velocity' ? 'velocity' : 'position';   // which graph tab shows a metric
function posSpec() { const f = forcedGraph(); return POS_SPECS[f ? (f === 'distance' ? 'd' : 'x') : posMode]; }
function velSpec() { return VEL_SPECS[forcedGraph() ? 'v' : velMode]; }
function graphSpec() { return graphType === 'position' ? posSpec() : velSpec(); }
// value of a graph key for a sample (or live ball) o of trace b — sp is derived from v
function metricVal(b, o, key) { return key === 'sp' ? Math.abs(o.v) : o[key]; }

export function drawGraph() {
  const both = graphType === 'both';
  const { w, h, dpr } = fit(graphC);
  gx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gx.clearRect(0, 0, w, h);
  const base = AXES[graphType];
  const tMax = base.t;
  const padL = 52, padR = 16, padB = 34;
  const x0 = padL, x1 = w - padR;
  const X = tt => x0 + (tt / tMax) * (x1 - x0);
  graphPanels = []; graphGeom = { x0, x1, tMax };

  // Draw one metric's plot (own y-axis + own time numbers) into the band [ty, by].
  // opts.caption adds the "time (s)" label; opts.vgrid adds vertical time gridlines
  // bounded to this panel (so stacked panels stay separate, not seamless).
  function drawPanel(metric, ty, by, opts) {
    opts = opts || {};
    const yMax = metric.yMax;
    const Y = vv => by + (vv / yMax) * (ty - by);
    graphPanels.push({ key: metric.key, unit: metric.unit, ty, by, yMax });

    // vertical time gridlines (integer seconds), kept within this panel
    if (opts.vgrid) {
      gx.strokeStyle = getCss('--line'); gx.lineWidth = 1;
      for (let tt = 0; tt <= tMax + 1e-9; tt += 1) {
        const xx = X(tt); gx.beginPath(); gx.moveTo(xx, ty); gx.lineTo(xx, by); gx.stroke();
      }
    }

    // horizontal gridlines + y-axis labels
    gx.font = handFont(13, 400); gx.lineWidth = 1;
    gx.textAlign = 'right'; gx.textBaseline = 'middle';
    const gridStep = (metric.unit === 'm') ? 5 : 3;   // position: gridlines every 5 m (matches the world's ruler); velocity every 3 m/s
    for (let vv = 0; vv <= yMax + 1e-9; vv += gridStep) {
      const yy = Y(vv);
      gx.strokeStyle = getCss('--line'); gx.beginPath(); gx.moveTo(x0, yy); gx.lineTo(x1, yy); gx.stroke();
      gx.fillStyle = getCss('--muted'); gx.fillText(vv.toFixed(yMax < 4 ? 1 : 0), x0 - 8, yy);
    }

    // time axis: major ticks every 1 s (labelled) + minor ticks every 0.5 s
    gx.strokeStyle = getCss('--line'); gx.fillStyle = getCss('--muted');
    gx.textAlign = 'center'; gx.textBaseline = 'top';
    for (let tt = 0; tt <= tMax + 1e-9; tt += 0.5) {
      const xx = X(tt), major = Math.abs(tt - Math.round(tt)) < 1e-9;
      gx.lineWidth = 1; gx.beginPath(); gx.moveTo(xx, by); gx.lineTo(xx, by + (major ? 6 : 3)); gx.stroke();
      if (major) gx.fillText(tt.toFixed(0), xx, by + 9);
    }
    if (opts.caption) { gx.fillStyle = getCss('--muted'); gx.fillText('time (s)', (x0 + x1) / 2, by + 22); }

    // y-axis title
    gx.save(); gx.translate(14, (ty + by) / 2); gx.rotate(-Math.PI / 2);
    gx.textAlign = 'center'; gx.textBaseline = 'bottom';
    const title = metric.label + ' (' + metric.unit + ')' + (forcedGraph() ? '' : ' ▾');
    gx.fillStyle = getCss('--muted'); gx.fillText(title, 0, 0);
    const titleW = gx.measureText(title).width; gx.restore();
    graphPanels[graphPanels.length - 1].titleHit = forcedGraph() ? null : { x0: 0, x1: 26, y0: (ty + by) / 2 - titleW / 2 - 4, y1: (ty + by) / 2 + titleW / 2 + 4 };

    // traces (clipped to the plot area). During replay the full completed curve
    // stays on screen (lastTrace) instead of rebuilding as the ball re-runs.
    const traces = (replaying && lastTrace) ? lastTrace : balls;
    gx.save(); gx.beginPath(); gx.rect(x0, ty, x1 - x0, by - ty); gx.clip();
    gx.lineWidth = 2.4; gx.lineJoin = 'round'; gx.lineCap = 'round';
    // The velocity axis starts at 0, so negative speeds can't be drawn: break the line there
    // and remember where it first went negative so we can flag it below.
    const isNeg = metric.key === 'v';   // axes start at 0, so a negative value can't be drawn
    let negT = null;
    for (const b of traces) {
      if (b.samples.length < 2) continue;
      gx.strokeStyle = b.color; gx.beginPath();
      // Segments touching the visible range are drawn (the plot clip trims them at the axis), so the
      // steep line where the value drops below / rises back above zero still shows; fully negative
      // stretches are skipped.
      let prev = null, pv = 0;
      for (const s of b.samples) {
        const sv = metricVal(b, s, metric.key);
        if (isNeg && sv < -1e-9 && (negT === null || s.t < negT)) negT = s.t;
        if (prev && !(isNeg && pv < -1e-9 && sv < -1e-9)) { gx.moveTo(X(prev.t), Y(pv)); gx.lineTo(X(s.t), Y(sv)); }
        prev = s; pv = sv;
      }
      gx.stroke();
    }
    gx.restore();

    if (negT !== null) {   // alert beside the vertical line where the value first went negative
      const what = 'Velocity';
      const lines = [what + ' has', 'become negative -', 'graph not shown'];
      const compact = (by - ty) < 150;                    // 'both' view panels are short
      const fs = compact ? 13 : 18, lh = compact ? 16 : 22, bh = compact ? 22 : 30;
      const canSwitch = !forcedGraph();
      const btnText = 'Show Speed';
      gx.font = handFont(fs, 700);
      const aw = Math.max(...lines.map(l => gx.measureText(l).width), canSwitch ? gx.measureText(btnText).width + 16 : 0) + 24;
      const ah = lines.length * lh + 12 + (canSwitch ? bh + 8 : 0);
      const lx = X(negT);
      let ax = lx + 12;                                   // right of the line, else left of it
      if (ax + aw > x1 - 4) ax = lx - 12 - aw;
      ax = Math.max(x0 + 4, ax);
      const ay = Math.max(2, by - ah - 8);                // bottom rests just above the time axis (may rise above the panel top) so the button is always visible
      gx.fillStyle = getCss('--cut'); roundRect(gx, ax, ay, aw, ah, 9); gx.fill();
      gx.strokeStyle = INK; gx.lineWidth = 2; gx.stroke();
      gx.fillStyle = '#4a0a0a'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
      lines.forEach((l, i) => gx.fillText(l, ax + aw / 2, ay + 6 + lh / 2 + i * lh + 1));
      if (canSwitch) {
        const bx = ax + 8, bw = aw - 16, byy = ay + ah - bh - 6;
        gx.fillStyle = getCss('--panel'); roundRect(gx, bx, byy, bw, bh, 7); gx.fill(); gx.stroke();
        gx.fillStyle = INK; gx.fillText(btnText, bx + bw / 2, byy + bh / 2 + 1);
        graphPanels[graphPanels.length - 1].altBtn = { x0: bx, x1: bx + bw, y0: byy, y1: byy + bh, set: () => { velMode = 'sp'; } };
      }
      gx.textBaseline = 'alphabetic';
    }

    // Marbles on the graph. Before a run: start-value marbles at t = 0 (the launch settings).
    // While the sim is collecting data: one marble riding the head of each curve (gone the
    // moment collection stops — offscreen or timed out — leaving just the finished curve).
    if (running) {
      for (const b of balls) {
        const last = b.samples[b.samples.length - 1];
        const cx = replaying ? Math.max(x0, Math.min(x1, X(t))) : X(last.t);
        const val = replaying ? metricVal(b, b, metric.key) : metricVal(b, last, metric.key);
        if (isNeg && val < -1e-9) continue;                          // off the axis: no marble
        drawMarbleAt(gx, cx, Y(val), 6.5, b.color);                  // centered on the true value
      }
    } else if (!replaying && !(balls[0] && balls[0].samples.length >= 2)) {
      const mx = X(0);
      const launchV = parseInt(speedEl.value, 10) || 0;
      const kk = metric.key, isVel = kk === 'v' || kk === 'sp';
      const startVal = isVel ? launchV : kk === 'x' ? launchX : 0;       // distance / displacement start at 0
      const marks = [{ val: startVal, color: getCss('--ball') }];
      for (const sb of secondBalls) marks.push({ val: kk === 'x' ? sb.x : 0, color: getCss('--ball2') });
      for (const m of marks) drawMarbleAt(gx, mx, Y(m.val), 6.5, m.color);
    }

    // puzzle target overlay: the goal graph the player is trying to match
    const AP = activePuzzle();
    if (AP && AP.target && metric.key === AP.target.key) {
      const tgt = AP.target;
      const clampY = xv => Math.max(ty + 1, Math.min(by - 1, Y(xv)));
      gx.save();
      gx.strokeStyle = getCss('--accent'); gx.lineWidth = 2.4; gx.setLineDash([7, 5]);
      gx.beginPath();
      let labelY;
      if (tgt.kind === 'flat') {                   // flat line at a fixed value
        const yy = clampY(tgt.value); labelY = yy;
        gx.moveTo(x0, yy); gx.lineTo(x1, yy);
      } else if (tgt.kind === 'poly') {            // piecewise-linear target shape
        tgt.pts.forEach((p, i) => { const px = X(p.t), py = clampY(p.x); i ? gx.lineTo(px, py) : gx.moveTo(px, py); });
        labelY = clampY(tgt.pts[tgt.pts.length - 1].x);
      }
      gx.stroke(); gx.setLineDash([]);
      gx.restore();
    }
  }

  if (both) {
    // Two separate panels in one graph's height: each has its own time numbers,
    // with blank space between them (not a seamless shared axis). No time label.
    const padT = 14, numH = 18, gap = 22, botPad = 10;
    const panelH = (h - padT - botPad - 2 * numH - gap) / 2;
    const ty1 = padT, by1 = ty1 + panelH;
    const ty2 = by1 + numH + gap, by2 = ty2 + panelH;
    drawPanel({ ...velSpec(), yMax: base.yv }, ty1, by1, { vgrid: true });
    drawPanel({ ...posSpec(), yMax: base.yd }, ty2, by2, { vgrid: true });
  } else {
    const spec = graphSpec();
    drawPanel({ key: spec.key, label: spec.label, unit: spec.unit, yMax: base.y }, 14, h - padB, { caption: true });
  }
  drawGraphPoint();
  drawAnnotations();
}

// ─── Click the graph to mark a coordinate (t snaps to 0.5 s); click a point again to remove it ──
export let graphPanels = [], graphGeom = null;
const clearPointsBtn = document.getElementById('clearPoints');
clearPointsBtn.addEventListener('click', () => { graphPoints = []; drawGraph(); });
let graphPoints = [];               // [{ key, t, val }]
function drawGraphPoint() {
  clearPointsBtn.hidden = graphPoints.length === 0;
  for (const pt of graphPoints) {
    const P = graphPanels.find(p => p.key === pt.key); if (!P) continue;
    const { x0, x1, tMax } = graphGeom;
    const px = x0 + (pt.t / tMax) * (x1 - x0), py = P.by + (pt.val / P.yMax) * (P.ty - P.by);
    const label = '(' + pt.t + ' s, ' + pt.val + ' ' + P.unit + ')';
    gx.save();
    gx.fillStyle = getCss('--ink'); gx.strokeStyle = getCss('--panel'); gx.lineWidth = 2;
    gx.beginPath(); gx.arc(px, py, 5, 0, Math.PI * 2); gx.fill(); gx.stroke();
    gx.font = handFont(14, 700); gx.textBaseline = 'middle';
    const tw = gx.measureText(label).width + 12, left = px + 10 + tw > x1;
    const bx = left ? px - 10 - tw : px + 10, by2 = Math.max(P.ty + 12, py - 16);
    gx.fillStyle = getCss('--panel'); gx.strokeStyle = getCss('--ink'); gx.lineWidth = 1.5;
    roundRect(gx, bx, by2 - 11, tw, 22, 6); gx.fill(); gx.stroke();
    gx.fillStyle = getCss('--ink'); gx.textAlign = 'left'; gx.fillText(label, bx + 6, by2);
    gx.restore();
  }
}
// Menu opened by clicking an axis title: pick which quantity that axis graphs.
const axisMenu = document.getElementById('axisMenu');
function openAxisMenu(panel, cx, cy) {
  const isPos = panel.unit === 'm';
  const opts = isPos ? POS_SPECS : VEL_SPECS, cur = isPos ? posMode : velMode;
  axisMenu.innerHTML = '';
  for (const k of Object.keys(opts)) {
    const b = document.createElement('button'); b.textContent = opts[k].label; b.className = k === cur ? 'on' : '';
    b.addEventListener('click', ev => { ev.stopPropagation(); if (isPos) setPosMode(k); else setVelMode(k); graphPoints = []; closeAxisMenu(); drawGraph(); });
    axisMenu.appendChild(b);
  }
  axisMenu.hidden = false;
  axisMenu.style.left = Math.min(cx + 6, innerWidth - axisMenu.offsetWidth - 6) + 'px';
  axisMenu.style.top = Math.min(cy, innerHeight - axisMenu.offsetHeight - 6) + 'px';
}
function closeAxisMenu() { axisMenu.hidden = true; }
document.addEventListener('pointerdown', e => { if (!axisMenu.hidden && !axisMenu.contains(e.target)) closeAxisMenu(); }, true);
graphC.addEventListener('click', e => {
  if (!graphGeom || annotating) return;
  const r = graphC.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const { x0, x1, tMax } = graphGeom;
  for (const p of graphPanels) {
    const a = p.altBtn;
    if (a && mx >= a.x0 && mx <= a.x1 && my >= a.y0 && my <= a.y1) { a.set(); graphPoints = []; drawGraph(); return; }
    const t = p.titleHit;
    if (t && mx >= t.x0 && mx <= t.x1 && my >= t.y0 && my <= t.y1) { openAxisMenu(p, e.clientX, e.clientY); return; }
  }
  const P = graphPanels.find(p => my >= p.ty - 6 && my <= p.by + 6); if (!P) return;
  const t = Math.round(clamp((mx - x0) / (x1 - x0), 0, 1) * tMax * 2) / 2;   // nearest half second
  const val = Math.min(Math.round(clamp((P.by - my) / (P.by - P.ty), 0, 1) * P.yMax), P.key === 'x' ? TRACK_LEN - 1 : 1e9);
  const at = graphPoints.findIndex(q => q.key === P.key && q.t === t && q.val === val);
  if (at >= 0) graphPoints.splice(at, 1);            // clicking an existing point removes it
  else graphPoints.push({ key: P.key, t, val });
  drawGraph();
});


function setPosMode(k) { posMode = k; }
function setVelMode(k) { velMode = k; }
export function setCreateMetric(m) { createMetric = m; }
export function clearGraphPoints() { graphPoints = []; }
