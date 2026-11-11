// Painting the world canvas: ground, ruler, track pieces, marbles.

import { drawReplayMarks } from './annotate.js';
import { RUN_TIME_CAP, TRACK_LEN, WALL_D, WALL_HW } from './constants.js';
import { PAD_L, PAD_R, ballRadius, groundY, mToPx, sceneC, sceneDims, sx } from './dom.js';
import { INK, darken, drawClock, drawPieceSign, drawTube, getCss, handFont, ink, lighten, miniBtn, panel3D, panelShaded, roundRect, signPost } from './draw.js';
import { balls, lastTrace, replaying, running, sampleAt, t } from './sim.js';
import { boosts, fricZones, secondBalls, selected, targets, walls } from './state.js';

export function fit(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  return { w, h, dpr };
}

let motionMap = false;
const motionMapBtn = document.getElementById('motionMapBtn');
motionMapBtn.addEventListener('click', () => { motionMap = !motionMap; motionMapBtn.classList.toggle('on', motionMap); motionMapBtn.setAttribute('aria-pressed', motionMap); drawScene(); });
export function drawScene() {
  const { w, h, dpr } = fit(sceneC);
  sx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sx.clearRect(0, 0, w, h);
  const gY = groundY();

  // ground — a solid mass below the surface, with a lighter top soil band (cel-shaded depth)
  const groundCol = getCss('--ground');
  sx.fillStyle = darken(groundCol, 0.12); sx.fillRect(0, gY, w, h - gY);
  sx.fillStyle = lighten(groundCol, 0.14); sx.fillRect(0, gY, w, 7);           // surface soil

  // friction patches — rough ground SET INTO the surface (sits below it, not on top)
  const fricCol = getCss('--fric'), FD = 26;
  for (const z of fricZones) {
    const xa = mToPx(z.x), xb = mToPx(Math.min(TRACK_LEN, z.x + z.len)), w2 = xb - xa;
    sx.fillStyle = fricCol; sx.fillRect(xa, gY, w2, FD);
    sx.fillStyle = darken(fricCol, 0.2); sx.fillRect(xa, gY + FD * 0.58, w2, FD * 0.42);  // shade block
    // gritty speckles
    sx.save(); sx.beginPath(); sx.rect(xa, gY, w2, FD); sx.clip();
    sx.fillStyle = darken(fricCol, 0.45);
    for (let px = xa + 6; px < xb - 2; px += 9) for (let r2 = 0; r2 < 2; r2++) {
      const py = gY + 8 + r2 * 9 + (Math.floor(px) % 2 ? 0 : 4);
      sx.beginPath(); sx.arc(px + r2 * 4, py, 1.5, 0, 7); sx.fill();
    }
    sx.restore();
    // side + bottom outline (the top edge is the surface line, stroked below)
    ink(2.5); sx.beginPath(); sx.moveTo(xa, gY); sx.lineTo(xa, gY + FD); sx.lineTo(xb, gY + FD); sx.lineTo(xb, gY); sx.stroke();
    // end grips (resize handles)
    sx.fillStyle = lighten(fricCol, 0.25);
    roundRect(sx, xa - 3, gY - 3, 6, FD + 6, 3); sx.fill(); ink(2); sx.stroke();
    roundRect(sx, xb - 3, gY - 3, 6, FD + 6, 3); sx.fill(); ink(2); sx.stroke();
    z._sign = drawPieceSign((xa + xb) / 2, gY, 'friction', fricCol, '#4a2410', Math.round(z.len) + 'm');
  }

  // the surface line itself — bold, the ball rolls along here
  ink(3); sx.beginPath(); sx.moveTo(0, gY); sx.lineTo(w, gY); sx.stroke();

  // distance ticks + labels (down in the ground)
  sx.font = handFont(13, 600); sx.textAlign = 'center';
  for (let m = 0; m <= TRACK_LEN; m += 5) {
    const gxp = mToPx(m);
    ink(1.5); sx.beginPath(); sx.moveTo(gxp, gY); sx.lineTo(gxp, gY + 8); sx.stroke();
    sx.fillStyle = getCss('--ink'); sx.fillText(m + ' m', gxp, gY + 24);
  }

  // where each piece sits, written below it (skipped on multiples of 5 — the ruler already says so)
  sx.font = handFont(18, 700); sx.textAlign = 'center'; sx.fillStyle = getCss('--ink');   // 1.5× the old 12 px
  const posLabel = (m, px) => { if (Math.abs(m / 5 - Math.round(m / 5)) < 1e-6) return; sx.fillText(+m.toFixed(1) + ' m', px, gY + 48); };
  for (const b of boosts) posLabel(b.x, mToPx(b.x));
  for (const g of targets) posLabel(g.x, mToPx(g.x));
  for (const w of walls) posLabel(w.x, mToPx(w.x + WALL_D));
  for (const b of secondBalls) posLabel(b.x, mToPx(b.x));
  for (const z of fricZones) { posLabel(z.x, mToPx(z.x)); posLabel(z.x + z.len, mToPx(z.x + z.len)); }

  // speed change pads: green when adding speed (+dv), red when removing it (−dv)
  for (const b of boosts) drawPad(b, getCss(b.dv < 0 ? '--cut' : '--boost'), b.dv < 0 ? '#4a0a0a' : '#06381f', b.dv < 0 ? '−' : '+');

  // target-speed launchers — draw the sign here; the tube is drawn after the balls
  const tCol = getCss('--target');
  for (const g of targets) {
    const gx2 = mToPx(g.x), timed = g.time != null;
    const r = ballRadius(), L = 2.9 * r, H = 2 * r + 8;
    const tcy = gY - r, tubeTop = tcy - H / 2;
    g._tube = { cx: gx2, cy: tcy, L, H, top: tubeTop };

    // the sign (fixed size), on a post down to the tube
    const sw = 112, sh = 58, sbot = tubeTop - 6, sTop = sbot - sh, X = gx2 - sw / 2, Y = sTop;
    signPost(gx2, sbot, tubeTop + 2, tCol);
    panel3D(X, Y, sw, sh, 12, tCol);
    sx.textAlign = 'center'; sx.textBaseline = 'middle';

    // Row B — speed stepper (m/s next to the number)
    const sy = Y + 19;
    const minus = miniBtn(X + 14, sy, 9, '–', tCol, INK);
    const plus  = miniBtn(X + sw - 14, sy, 9, '+', tCol, INK);
    sx.fillStyle = '#fff'; sx.textBaseline = 'middle';
    sx.font = handFont(20, 800); const nw = sx.measureText('' + g.mag).width;
    sx.font = handFont(11, 600); const uw = sx.measureText(' m/s').width;
    const gx0 = gx2 - (nw + uw) / 2; sx.textAlign = 'left';
    sx.font = handFont(20, 800); sx.fillText(g.mag, gx0, sy);
    sx.font = handFont(11, 600); sx.fillText(' m/s', gx0 + nw, sy + 1);
    sx.textAlign = 'center';

    // Row C — timer (clock to add; just the number once a time is set)
    const cy = Y + sh - 13;
    let tMinus = null, tPlus = null, tToggle = null;
    if (!timed) {
      drawClock(gx2, cy, 8, lighten(tCol, 0.5));
      tToggle = { x: gx2 - 12, y: cy - 12, w: 24, h: 24 };
    } else {
      tMinus = miniBtn(X + 14, cy, 7, '–', darken(tCol, 0.05), '#fff');
      tPlus  = miniBtn(X + sw - 14, cy, 7, '+', darken(tCol, 0.05), '#fff');
      // clock icon stays beside the whole-second value; tap the pair to clear the timer
      const ts = '@ ' + Math.round(g.time) + 's';
      sx.font = handFont(15, 700); const tw = sx.measureText(ts).width;
      const gw = 16 + 5 + tw, cx0 = gx2 - gw / 2;
      drawClock(cx0 + 8, cy, 8, lighten(tCol, 0.5));
      sx.fillStyle = '#fff'; sx.textAlign = 'left'; sx.fillText(ts, cx0 + 21, cy + 1); sx.textAlign = 'center';
      tToggle = { x: cx0 - 3, y: cy - 11, w: gw + 6, h: 22 };
    }

    sx.textBaseline = 'alphabetic';
    g._ui = { bounds: { x: X, y: Y, w: sw, h: sh }, gx: gx2, gTop: tubeTop,
              tube: { x: gx2 - L / 2, y: tubeTop, w: L, h: H },
              minus, plus, tMinus, tPlus, tToggle, timed };
  }

  // walls — a chunky brick wall standing on the surface (pink = bouncy)
  for (const wl of walls) {
    const wallCol = getCss(wl.bouncy ? '--bumper' : '--wall');
    const ppm = (sceneDims().w - PAD_L - PAD_R) / TRACK_LEN;
    const wx = mToPx(wl.x + WALL_D), ww = Math.max(14, 2 * WALL_HW * ppm), wT = gY - 48, wh = gY - wT, wl0 = wx - ww / 2;
    roundRect(sx, wl0, wT, ww, wh, 5); sx.fillStyle = wallCol; sx.fill();
    // flat shade block down the right third
    sx.save(); roundRect(sx, wl0, wT, ww, wh, 5); sx.clip();
    sx.fillStyle = darken(wallCol, 0.2); sx.fillRect(wl0 + ww * 0.66, wT, ww * 0.34, wh);
    // brick courses (offset every other row)
    sx.strokeStyle = INK; sx.lineWidth = 1.8; sx.lineCap = 'round';
    let row = 0;
    for (let yb = wT + 9; yb < gY; yb += 9) {
      sx.beginPath(); sx.moveTo(wl0, yb); sx.lineTo(wl0 + ww, yb); sx.stroke();
      const jx = wx + (row % 2 ? -ww / 4 : ww / 4);
      sx.beginPath(); sx.moveTo(jx, yb); sx.lineTo(jx, yb - 9); sx.stroke();
      row++;
    }
    sx.restore();
    roundRect(sx, wl0, wT, ww, wh, 5); ink(2.5); sx.stroke();
    wl._sign = drawPieceSign(wx, wT, wl.bouncy ? 'bouncy\nwall' : 'wall', wallCol, '#1c242e');
  }

  // launch marker
  sx.strokeStyle = 'rgba(255,255,255,0.22)'; sx.setLineDash([5, 5]); sx.lineWidth = 1.5; sx.lineCap = 'round';
  sx.beginPath(); sx.moveTo(mToPx(0), gY - 70); sx.lineTo(mToPx(0), gY); sx.stroke();
  sx.setLineDash([]);

  // position map: a light dot at each whole second of the run, labelled 0s, 1s, 2s…
  if (motionMap) {
    const traces = (replaying && lastTrace) ? lastTrace : balls;
    sx.font = handFont(14, 700); sx.textAlign = 'left'; sx.textBaseline = 'middle';
    for (const tr of traces) {
      const sm = tr.samples; if (!sm || !sm.length) continue;
      const tEnd = replaying ? Math.min(t, sm[sm.length - 1].t) : sm[sm.length - 1].t;
      let row = 0, prevPx = null; const placed = [];                   // placed: boxes already drawn, so a bounce back over old dots steps down instead of overlapping
      for (let tt = 0; tt <= RUN_TIME_CAP + 1e-9 && tt <= tEnd + 1e-6; tt++) {
        const px = mToPx(sampleAt(sm, 'x', tt));
        if (prevPx !== null && Math.abs(px - prevPx) < 26) row++;      // stalled: step down a row; later dots stay level with it
        prevPx = px;
        const label = tt + 's', lw = sx.measureText(label).width;
        const x0 = px - 7, x1 = px + 8 + lw + 8;
        while (placed.some(p => p.row === row && x0 < p.x1 && x1 > p.x0)) row++;
        placed.push({ row, x0, x1 });
        const dy = 14 + row * 17;                                      // up near the top
        sx.fillStyle = 'rgba(255,255,255,0.5)';                         // 50% white field behind the label
        roundRect(sx, px + 8, dy - 9, lw + 8, 18, 5); sx.fill();
        sx.beginPath(); sx.arc(px, dy, 5, 0, Math.PI * 2);
        sx.fillStyle = lighten(tr.color, 0.45); sx.globalAlpha = 0.9; sx.fill(); sx.globalAlpha = 1;
        sx.strokeStyle = tr.color; sx.lineWidth = 1.5; sx.stroke();
        sx.fillStyle = getCss('--ink'); sx.fillText(label, px + 12, dy + 1);
      }
    }
  }

  // all balls, each in its own colour (resting ones drawn first, mover on top)
  for (const b of balls) if (!b.moving) drawBall(mToPx(b.x), gY, b.color);
  for (const b of balls) if (b.moving) drawBall(mToPx(b.x), gY, b.color);

  // target tubes drawn over the balls (so a ball sits fully inside); jiggle when fired
  for (const g of targets) {
    const u = g._tube; if (!u) continue;
    let jx = 0, jy = 0;
    if (running && g._shake > 0.02) { jx = (Math.random() * 2 - 1) * 8 * g._shake; jy = (Math.random() * 2 - 1) * 5 * g._shake; }
    drawTube(u.cx + jx, u.cy + jy, u.L, u.H, tCol);
  }
  drawSelection();
  drawReplayMarks();   // annotate replay: blinking red / blue rings
}

// The selected piece: a dashed outline round its sign (or round the marble) and a × button on
// its top-right corner. The button's hit circle is saved on the piece as _del.
function drawSelection() {
  if (!selected) return;
  const { piece, el } = selected;
  let b = piece === 'target' ? el._ui && el._ui.bounds : el._sign;
  if (piece === 'ball2') { const r = ballRadius(), cx = mToPx(el.x), cy = groundY() - r; b = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }; }
  if (!b) return;
  const P = 5, R = 10, { w } = sceneDims();
  sx.save();
  sx.setLineDash([6, 4]); sx.lineWidth = 2.5; sx.strokeStyle = getCss('--accent');
  roundRect(sx, b.x - P, b.y - P, b.w + 2 * P, b.h + 2 * P, 12); sx.stroke();
  sx.restore();
  const cx = Math.min(w - R - 2, b.x + b.w + P), cy = Math.max(R + 2, b.y - P);
  sx.beginPath(); sx.arc(cx, cy, R, 0, 7); sx.fillStyle = getCss('--cut'); sx.fill(); ink(2); sx.stroke();
  sx.strokeStyle = '#fff'; sx.lineWidth = 2.5; sx.lineCap = 'round';
  sx.beginPath(); sx.moveTo(cx - 4, cy - 4); sx.lineTo(cx + 4, cy + 4); sx.moveTo(cx + 4, cy - 4); sx.lineTo(cx - 4, cy + 4); sx.stroke();
  el._del = { cx, cy, r: R };
}

// A push pad (speed change, +dv or −dv): a pad on the ground + a sign whose +/- row sits above the
// value. The pad jiggles (half the target's shake) when it fires. sgn is '+' or '−'.
function drawPad(el, col, fgDark, sgn) {
  const gY = groundY();
  const bx = mToPx(el.x), padW = 40, padH = 15, top = gY - padH;
  let jx = 0, jy = 0;
  if (running && el._shake > 0.02) { jx = (Math.random() * 2 - 1) * 4 * el._shake; jy = (Math.random() * 2 - 1) * 2.5 * el._shake; }
  const pxc = bx + jx, pyt = top + jy;
  panelShaded(pxc - padW / 2, pyt, padW, padH, 6, col);
  ink(2.6);
  for (let k = 0; k < 3; k++) {
    const cxp = pxc - 11 + k * 10;
    sx.beginPath(); sx.moveTo(cxp - 4, pyt + 4); sx.lineTo(cxp + 4, pyt + padH / 2); sx.lineTo(cxp - 4, pyt + padH - 4); sx.stroke();
  }
  // sign: three rows — big +/−, the value, then the − / + buttons (own row so the value never covers them)
  const bw = 86, bh = 62, bbot = top - 12, BY = bbot - bh, BX = bx - bw / 2;
  signPost(bx, bbot, top, col);
  panelShaded(BX, BY, bw, bh, 11, col);
  // Row 1 — a big + or −
  sx.fillStyle = fgDark; sx.textAlign = 'center'; sx.textBaseline = 'middle';
  sx.font = handFont(24, 800); sx.fillText(sgn, bx, BY + 13);
  // Row 2 — value m/s;  Row 3 — (− button) … (+ button)
  const minus = miniBtn(BX + 13, BY + 49, 9, '–', col, INK);
  const plus  = miniBtn(BX + bw - 13, BY + 49, 9, '+', col, INK);
  sx.fillStyle = fgDark;
  const dvTxt = (el.dv < 0 ? '−' : '+') + Math.abs(el.dv);
  sx.font = handFont(15, 800); const nw = sx.measureText(dvTxt).width;
  sx.font = handFont(10, 700); const uw = sx.measureText(' m/s').width;
  const gx0 = bx - (nw + uw) / 2; sx.textAlign = 'left';
  sx.font = handFont(15, 800); sx.fillText(dvTxt, gx0, BY + 33);
  sx.font = handFont(10, 700); sx.fillText(' m/s', gx0 + nw, BY + 33);
  sx.textAlign = 'center'; sx.textBaseline = 'alphabetic';
  el._ui = { minus, plus };
  el._sign = { x: BX, y: BY, w: bw, h: bh };
}

// A flat cartoon ball on the ground line at gY: solid fill, flat shade block, bold outline, shine.
function drawBall(bx, gY, ballCol) {
  const r = ballRadius();
  const cyb = gY - r;
  sx.beginPath(); sx.arc(bx, cyb, r, 0, Math.PI * 2); sx.fillStyle = ballCol; sx.fill();
  // flat shade crescent (a darker offset disc clipped to the ball)
  sx.save(); sx.beginPath(); sx.arc(bx, cyb, r, 0, Math.PI * 2); sx.clip();
  sx.fillStyle = darken(ballCol, 0.22);
  sx.beginPath(); sx.arc(bx + r * 0.42, cyb + r * 0.42, r, 0, Math.PI * 2); sx.fill();
  sx.restore();
  sx.beginPath(); sx.arc(bx, cyb, r, 0, Math.PI * 2); ink(2.5); sx.stroke();
  // flat round highlight
  sx.fillStyle = 'rgba(255,255,255,0.92)';
  sx.beginPath(); sx.arc(bx - r * 0.34, cyb - r * 0.34, r * 0.17, 0, 7); sx.fill();
}

// A small marble (same shaded style as the ball) for graph start-value markers.
export function drawMarbleAt(c, cx, cy, r, col) {
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = col; c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
  c.fillStyle = darken(col, 0.22);
  c.beginPath(); c.arc(cx + r * 0.42, cy + r * 0.42, r, 0, 7); c.fill();
  c.restore();
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.beginPath(); c.arc(cx - r * 0.34, cy - r * 0.34, r * 0.17, 0, 7); c.fill();
  c.restore();
}
