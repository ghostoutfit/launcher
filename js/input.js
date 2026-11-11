// Drag & drop of track pieces (or click a chip, then click the track), selection (× button,
// Delete / Backspace, arrow-key nudges), hover tooltips, delete confirmation.

import { BALL_R, BOOST_DV, FRIC_LEN, RUN_TIME_CAP, TARGET_MAX, TARGET_STEP, TRACK_LEN, WALL_D } from './constants.js';
import { PAD_L, PAD_R, ballRadius, clamp, groundY, mToPx, posEl, pxToM, sceneC, sceneDims } from './dom.js';
import { getCss } from './draw.js';
import { drawScene } from './scene.js';
import { replaying, running, worldChanged, x } from './sim.js';
import { boosts, fricZones, mode, removePiece, secondBalls, selected, setSelected, targets, walls } from './state.js';

let pieceId = 1;
let drag = null;             // { kind:'new'|'armed'|'move'|'resize'|'ball', piece, el?, ghost? } — 'armed': a chip was clicked, the next click on the track places it
let lastClick = null;        // { el, time } — used to detect a double-click on a piece
let confirmPiece = null;     // { piece, el } awaiting delete confirmation
const inBox = (mx, my, b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
const inCircle = (mx, my, c) => c && Math.hypot(mx - c.cx, my - c.cy) <= c.r + 2;

// Selection: the last-clicked piece gets a × button (drawn by scene.js) and takes the keyboard.
function select(piece, el) {
  if (selected && selected.el === el) return;
  setSelected({ piece, el });
  const f = document.activeElement;                 // a focused slider would also take the arrow keys
  if (f && f !== document.body && f.blur) f.blur();
  drawScene();
}
function deselect() { if (!selected) return; setSelected(null); drawScene(); }
const overDelBtn = (mx, my) => selected && inCircle(mx, my, { ...selected.el._del, r: (selected.el._del?.r || 0) + 4 });

// Interactive controls on a target sign (direction / speed / timer). Checked before any drag.
function hitTargetControl(mx, my) {
  for (const g of targets) {
    const u = g._ui; if (!u) continue;
    if (inCircle(mx, my, u.minus)) return { g, kind: 'magMinus' };
    if (inCircle(mx, my, u.plus)) return { g, kind: 'magPlus' };
    if (inCircle(mx, my, u.tMinus)) return { g, kind: 'timeMinus' };
    if (inCircle(mx, my, u.tPlus)) return { g, kind: 'timePlus' };
    if (inBox(mx, my, u.tToggle)) return { g, kind: 'timeToggle' };
  }
  return null;
}
function applyTargetControl(c) {
  const g = c.g;
  if (c.kind === 'magMinus') g.mag = clamp(g.mag - TARGET_STEP, -TARGET_MAX, TARGET_MAX);
  else if (c.kind === 'magPlus') g.mag = clamp(g.mag + TARGET_STEP, -TARGET_MAX, TARGET_MAX);
  else if (c.kind === 'timeToggle') g.time = (g.time == null) ? 2 : null;
  else if (c.kind === 'timeMinus') g.time = clamp(Math.round(g.time) - 1, 0, RUN_TIME_CAP - 1);
  else if (c.kind === 'timePlus') g.time = clamp(Math.round(g.time) + 1, 0, RUN_TIME_CAP - 1);
}

// +/- steppers on a speed change sign
function hitPadControl(mx, my) {
  for (const el of boosts) {
    const u = el._ui; if (!u) continue;
    if (inCircle(mx, my, u.minus)) return { el, kind: 'minus' };
    if (inCircle(mx, my, u.plus)) return { el, kind: 'plus' };
  }
  return null;
}
function applyPadControl(c) {
  const dir = c.kind === 'plus' ? TARGET_STEP : -TARGET_STEP;
  let nv = clamp(c.el.dv + dir, -TARGET_MAX, TARGET_MAX);
  if (nv === 0) nv = dir;                               // a 0 m/s change does nothing — step past it
  c.el.dv = nv;
}

function hitPiece(mx, my) {
  const gY = groundY();
  // targets own a tall sign — test its full bounds or the tube
  for (const g of targets) {
    const u = g._ui;
    if (u && (inBox(mx, my, u.bounds) || inBox(mx, my, u.tube)))
      return { type: 'target', el: g };
  }
  // walls & boosts: their body on the ground, or their floating sign
  for (const wl of walls) if (Math.abs(mToPx(wl.x + WALL_D) - mx) < 14 && my >= gY - 50 && my <= gY + 6 || inBox(mx, my, wl._sign))
    return { type: 'wall', el: wl };
  for (const b of boosts) if (Math.abs(mToPx(b.x) - mx) < 22 && my >= gY - 17 && my <= gY + 6 || inBox(mx, my, b._sign))
    return { type: 'boost', el: b };
  // second balls: grab the sphere itself
  const br = Math.max(12, (BALL_R / TRACK_LEN) * (sceneDims().w - PAD_L - PAD_R) * 1.25);
  for (const bb of secondBalls) if (Math.abs(mToPx(bb.x) - mx) < br + 3 && my >= gY - 2 * br - 4 && my <= gY + 6)
    return { type: 'ball2', el: bb };
  // friction patch: rough ground set into the surface (resize edges) or its sign
  for (const z of fricZones) {
    const xa = mToPx(z.x), xb = mToPx(z.x + z.len);
    if ((mx >= xa - 6 && mx <= xb + 6 && my >= gY - 4 && my <= gY + 28)) {
      const edge = Math.abs(mx - xa) <= 7 ? 'l' : Math.abs(mx - xb) <= 7 ? 'r' : null;
      return { type: 'friction', el: z, edge };
    }
    if (inBox(mx, my, z._sign)) return { type: 'friction', el: z, edge: null };
  }
  return null;
}

function makeGhost(piece) {
  const g = document.createElement('div'); g.id = 'dragGhost';
  if (piece === 'boost') { g.textContent = '+' + BOOST_DV + ' m/s'; g.style.background = getCss('--boost'); g.style.color = '#063'; }
  else if (piece === 'wall') { g.textContent = 'wall'; g.style.background = getCss('--wall'); g.style.color = '#1c242e'; }
  else if (piece === 'target') { g.textContent = '6 m/s'; g.style.background = getCss('--target'); g.style.color = '#231141'; }
  else if (piece === 'ball2') { g.textContent = '● marble'; g.style.background = getCss('--ball2'); g.style.color = '#0a1f3a'; }
  else { g.textContent = 'friction 2 m'; g.style.background = getCss('--fric'); g.style.color = '#3a1c08'; }
  document.body.appendChild(g); return g;
}
function moveGhost(g, cx, cy) { g.style.left = cx + 'px'; g.style.top = cy + 'px'; }

const snap = m => Math.round(m);   // placement snaps to 1 m increments
// Pieces (everything except friction patches, which may overlap anything) must stay at least
// MIN_GAP m apart, measured between their bodies (a wall's body stands WALL_D right of its x).
const MIN_GAP = 2;
const bodyX = (piece, x) => piece === 'wall' ? x + WALL_D : x;
function spacingOk(piece, x, self) {
  const bx = bodyX(piece, x);
  const others = [...boosts.map(e => [e, 'boost']), ...walls.map(e => [e, 'wall']), ...targets.map(e => [e, 'target']), ...secondBalls.map(e => [e, 'ball2'])];
  return others.every(([e, k]) => e === self || Math.abs(bodyX(k, e.x) - bx) >= MIN_GAP - 1e-9);
}
// Nearest legal snapped x to `want` (null if the track is too crowded).
function nearestSlot(piece, want, self) {
  const hi = piece === 'wall' ? TRACK_LEN - 1 : TRACK_LEN;
  for (let d = 0; d <= TRACK_LEN; d++) {
    for (const x of d ? [want - d, want + d] : [want]) {
      if (x >= 0 && x <= hi && spacingOk(piece, x, self)) return x;
    }
  }
  return null;
}
// Adds a piece near m metres and returns it (null if there was no room).
function placePiece(type, m) {
  let el;
  if (type !== 'friction') {
    if (type === 'ball2' && (secondBalls.length >= 1 || mode !== 'sandbox')) return null;
    const x = nearestSlot(type, clamp(snap(type === 'wall' ? m - WALL_D : m), 0, TRACK_LEN), null);
    if (x === null) return null;                    // no room: nothing is placed
    if (type === 'boost') boosts.push(el = { id: pieceId++, x, dv: BOOST_DV, used: false });
    else if (type === 'wall') walls.push(el = { id: pieceId++, x, bouncy: false });
    else if (type === 'target') targets.push(el = { id: pieceId++, x, mag: 6, dir: 1, time: null, used: false });
    else { secondBalls.push(el = { id: pieceId++, x }); refreshBall2Chip(); }
  }
  else fricZones.push(el = { id: pieceId++, x: clamp(snap(m - FRIC_LEN / 2), 0, TRACK_LEN - FRIC_LEN), len: FRIC_LEN });
  return el;
}
function placeAt(piece, clientX) {
  const el = placePiece(piece, pxToM(clientX - sceneC.getBoundingClientRect().left));
  if (el) setSelected({ piece, el });               // the new piece is selected, ready for arrow keys
  worldChanged();
}

// Arrow keys: move the selected piece 1 m, hopping over any spot that is too close to another piece.
function nudge(dir) {
  const { piece, el } = selected;
  if (piece === 'friction') {
    const nx = clamp(el.x + dir, 0, TRACK_LEN - el.len);
    if (nx === el.x) return;
    el.x = nx;
  } else {
    const hi = piece === 'wall' ? TRACK_LEN - 1 : TRACK_LEN;
    let nx = el.x + dir;
    while (nx >= 0 && nx <= hi && !spacingOk(piece, nx, el)) nx += dir;
    if (nx < 0 || nx > hi) return;
    el.x = nx;
  }
  worldChanged();
}

function overScene(cx, cy) {
  const r = sceneC.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

// Only one extra ball is allowed — dim the chip and block its drag once placed.
const ball2Chip = document.querySelector('.chip.ball2');
export function refreshBall2Chip() { if (!ball2Chip) return; ball2Chip.classList.toggle('disabled', secondBalls.length >= 1); ball2Chip.classList.toggle('gone', mode !== 'sandbox'); }   // marble 2 only in Sandbox

// Start a drag from a palette chip (create new piece). A click without dragging "arms" the chip
// instead: its label follows the cursor and the next click on the track places it — no need to
// hold the button down (hard on a touchpad).
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('pointerdown', e => {
    e.preventDefault();
    const piece = chip.dataset.piece;
    if (piece === 'ball2' && (secondBalls.length >= 1 || mode !== 'sandbox')) return;  // one extra marble max; Sandbox only
    drag = { kind: 'new', piece, chip, ghost: makeGhost(piece), downX: e.clientX, downY: e.clientY, moved: false };
    moveGhost(drag.ghost, e.clientX, e.clientY);
  });
});
function arm() { drag.kind = 'armed'; drag.chip.classList.add('armed'); drag.ghost.classList.add('armed'); }
function cancelArmed() { if (!drag || drag.kind !== 'armed') return; drag.ghost.remove(); drag.chip.classList.remove('armed'); drag = null; }
// While armed, the next press anywhere is handled here first: on the track it places the piece,
// on the same chip it cancels, and anywhere else it cancels and then does whatever it normally does.
window.addEventListener('pointerdown', e => {
  if (!drag || drag.kind !== 'armed') return;
  const piece = drag.piece, chip = e.target.closest && e.target.closest('.chip');
  cancelArmed();
  if (overScene(e.clientX, e.clientY)) { e.preventDefault(); e.stopPropagation(); placeAt(piece, e.clientX); }
  else if (chip && chip.dataset.piece === piece) { e.preventDefault(); e.stopPropagation(); }
}, true);

// The ball waiting at the launch position can be dragged along the track to set it.
function overStartBall(mx, my) {
  if (running || replaying) return false;
  const gY = groundY(), br = ballRadius(), cx = mToPx(parseInt(posEl.value, 10));
  return Math.hypot(mx - cx, my - (gY - br)) <= br + 6;
}
function setLaunchFromPx(mx) {
  const m = clamp(Math.round(pxToM(mx)), +posEl.min, +posEl.max);
  if (String(m) !== posEl.value) { posEl.value = m; posEl.dispatchEvent(new Event('input')); }
}
// Start a drag on an existing placed piece (move / remove), or tap a target's sign controls
sceneC.addEventListener('pointerdown', e => {
  const r = sceneC.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  // the selected piece's × button comes first, then on-sign controls, then dragging
  if (overDelBtn(mx, my)) {
    e.preventDefault();
    deletePiece(selected.piece, selected.el);
    return;
  }
  const ctl = hitTargetControl(mx, my);
  if (ctl) {
    e.preventDefault();
    applyTargetControl(ctl);
    setSelected({ piece: 'target', el: ctl.g });
    worldChanged();
    return;
  }
  const bctl = hitPadControl(mx, my);
  if (bctl) {
    e.preventDefault();
    applyPadControl(bctl);
    setSelected({ piece: 'boost', el: bctl.el });
    worldChanged();
    return;
  }
  const hit = hitPiece(mx, my);
  if (!hit) {
    deselect();
    if (overStartBall(mx, my)) {            // grab the waiting ball to set the launch position
      e.preventDefault(); sceneC.setPointerCapture(e.pointerId);
      drag = { kind: 'ball' }; setLaunchFromPx(mx);
    }
    return;
  }
  e.preventDefault();
  sceneC.setPointerCapture(e.pointerId);
  select(hit.type, hit.el);
  // grabbing a friction patch's end → resize; its middle → move
  const kind = (hit.type === 'friction' && hit.edge) ? 'resize' : 'move';
  drag = { kind, piece: hit.type, el: hit.el, edge: hit.edge, downX: e.clientX, downY: e.clientY, moved: false };
});

// ─── Hover tooltips: one brief line per element ───────────────────────────────
const TIPS = {
  boost:    'Speed change: adds its value to the marble\'s speed (+ speeds up, − slows down). Use ± to change it in steps of 2.',
  target:   'Target speed: sets the marble to the speed shown (use – to go negative, back toward the start). A timer holds the marble until that time.',
  friction: 'Friction pad: slows the marble while it\'s on it. Drag its ends to resize.',
  wall:     'Wall: stops the marble. Click it to make it bouncy.',
  wallBouncy: 'Bouncy wall: reflects the marble at the same speed. Click it to make it a plain wall.',
  ball2:    'Marble 2 (M2): waits at rest. When hit, it takes the first marble\'s speed and the first stops.',
};
const tipEl = document.getElementById('tip');
function showTip(text, cx, cy) {
  if (!text) { tipEl.style.display = 'none'; return; }
  tipEl.textContent = text; tipEl.style.display = 'block';
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.max(6, Math.min(innerWidth - w - 6, cx + 14)) + 'px';
  tipEl.style.top = (cy + 18 + h > innerHeight ? cy - h - 10 : cy + 18) + 'px';
}
// palette chips get their text from TIPS; any element with data-tip shows it on hover
document.querySelectorAll('.chip').forEach(c => { c.dataset.tip = TIPS[c.dataset.piece] + ' Drag it onto the track, or click it and then click the track.'; });
document.addEventListener('pointermove', e => {
  if (drag || e.target === sceneC) return;
  const el = e.target.closest && e.target.closest('[data-tip]');
  showTip(el ? el.dataset.tip : null, e.clientX, e.clientY);
});
document.addEventListener('pointerleave', () => showTip(null));
sceneC.addEventListener('pointerleave', () => showTip(null));

// Cursor hint when hovering placed pieces (resize vs grab) + tooltip
sceneC.addEventListener('pointermove', e => {
  if (drag) { showTip(null); if (drag.kind === 'armed') sceneC.style.cursor = 'copy'; return; }
  const r = sceneC.getBoundingClientRect();
  if (overDelBtn(e.clientX - r.left, e.clientY - r.top)) { sceneC.style.cursor = 'pointer'; showTip('Delete this piece (or press Backspace)', e.clientX, e.clientY); return; }
  const hit = hitPiece(e.clientX - r.left, e.clientY - r.top);
  sceneC.style.cursor = !hit ? (overStartBall(e.clientX - r.left, e.clientY - r.top) ? 'grab' : 'default') : (hit.type === 'friction' && hit.edge) ? 'ew-resize' : 'grab';
  showTip(hit ? TIPS[hit.type === 'wall' && hit.el.bouncy ? 'wallBouncy' : hit.type] : null, e.clientX, e.clientY);
});

window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'ball') { setLaunchFromPx(e.clientX - sceneC.getBoundingClientRect().left); return; }
  if (drag.kind === 'new' || drag.kind === 'armed') {
    if (Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 6) drag.moved = true;
    moveGhost(drag.ghost, e.clientX, e.clientY);
  } else if (drag.kind === 'move') {
    if (Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 4) drag.moved = true;
    const r = sceneC.getBoundingClientRect();
    const m = pxToM(e.clientX - r.left);
    if (drag.piece === 'friction') drag.el.x = clamp(snap(m - drag.el.len / 2), 0, TRACK_LEN - drag.el.len);
    else {
      const want = clamp(snap(drag.piece === 'wall' ? m - WALL_D : m), 0, TRACK_LEN);
      const nx = nearestSlot(drag.piece, want, drag.el);   // stay ≥ MIN_GAP from other pieces
      if (nx !== null) drag.el.x = nx;
    }
    worldChanged();
  } else if (drag.kind === 'resize') {
    const r = sceneC.getBoundingClientRect();
    const z = drag.el, m = snap(pxToM(e.clientX - r.left));
    if (drag.edge === 'l') {           // left end moves; right end stays put
      const right = z.x + z.len, nl = clamp(m, 0, right - 1);
      z.x = nl; z.len = right - nl;
    } else {                           // right end moves; left end stays put
      const nr = clamp(m, z.x + 1, TRACK_LEN);
      z.len = nr - z.x;
    }
    worldChanged();
  }
});

window.addEventListener('pointerup', e => {
  if (!drag || drag.kind === 'armed') return;
  if (drag.kind === 'new') {
    if (!drag.moved && !overScene(e.clientX, e.clientY)) { arm(); return; }   // a click on the chip: wait for a click on the track
    drag.ghost.remove();
    if (overScene(e.clientX, e.clientY)) placeAt(drag.piece, e.clientX);
  } else if (drag.kind === 'move') {
    if (!overScene(e.clientX, e.clientY)) {
      // drop off the track → delete
      deletePiece(drag.piece, drag.el);
    } else if (!drag.moved) {
      // a click (no drag) on a piece — double-click asks to delete it
      const piece = drag.piece, el = drag.el, now = performance.now();
      if (piece === 'wall') { el.bouncy = !el.bouncy; worldChanged(); }   // click toggles bouncy
      if (lastClick && lastClick.el === el && now - lastClick.time < 400) {
        lastClick = null;
        openDeleteConfirm(piece, el, e.clientX, e.clientY);
      } else {
        lastClick = { el, time: now };
      }
    }
  }
  drag = null;
});
// The browser took the pointer over (on a touchscreen, usually a scroll or a long-press): drop
// a new piece's ghost, and leave a moved piece where it is.
window.addEventListener('pointercancel', () => {
  if (!drag || drag.kind === 'armed') return;
  if (drag.kind === 'new') drag.ghost.remove();
  drag = null;
});
// A press anywhere off the track clears the selection.
window.addEventListener('pointerdown', e => {
  if (e.target !== sceneC && !dcEl.contains(e.target)) deselect();
});

// Keyboard: Esc cancels / closes / deselects; Delete or Backspace removes the selected piece;
// ← → move it 1 m. Ignored while typing in a box or using a slider.
window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') {
    if (drag && drag.kind === 'armed') cancelArmed();
    else if (!dcEl.hidden) closeDeleteConfirm();
    else deselect();
    return;
  }
  if (!selected) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); closeDeleteConfirm(); deletePiece(selected.piece, selected.el); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); nudge(e.key === 'ArrowLeft' ? -1 : 1); }
});

function deletePiece(piece, el) {
  if (piece === 'boost') removePiece(boosts, el);
  else if (piece === 'wall') removePiece(walls, el);
  else if (piece === 'target') removePiece(targets, el);
  else if (piece === 'ball2') { removePiece(secondBalls, el); refreshBall2Chip(); }
  else removePiece(fricZones, el);
  worldChanged();
}

const dcEl = document.getElementById('deleteConfirm');
const dcName = document.getElementById('dcName');
const PIECE_NAMES = { boost: 'speed change', wall: 'wall', target: 'target speed', friction: 'friction pad', ball2: 'marble 2' };
function openDeleteConfirm(piece, el, cx, cy) {
  confirmPiece = { piece, el };
  dcName.textContent = (piece === 'wall' && el.bouncy) ? 'bouncy wall' : (PIECE_NAMES[piece] || 'piece');
  dcEl.hidden = false;
  let left = Math.min(cx + 12, window.innerWidth - dcEl.offsetWidth - 8);
  let top = Math.min(cy + 12, window.innerHeight - dcEl.offsetHeight - 8);
  dcEl.style.left = Math.max(8, left) + 'px';
  dcEl.style.top = Math.max(8, top) + 'px';
}
export function closeDeleteConfirm() { confirmPiece = null; dcEl.hidden = true; }
document.getElementById('dcCancel').addEventListener('click', closeDeleteConfirm);
document.getElementById('dcDelete').addEventListener('click', () => {
  if (confirmPiece) deletePiece(confirmPiece.piece, confirmPiece.el);
  closeDeleteConfirm();
});
// click outside closes the confirm popover
window.addEventListener('pointerdown', e => {
  if (dcEl.hidden) return;
  if (dcEl.contains(e.target)) return;
  if (e.target === sceneC) return;   // scene handler may reopen it for another piece
  closeDeleteConfirm();
}, true);
