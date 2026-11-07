// Control wiring, light/dark theme, logo icons and the dev panel.

import { AXES, FRICTION_DECEL, setFriction } from './constants.js';
import { launchBtn, posEl, posVal, replayFastBtn, speedEl, speedVal } from './dom.js';
import { INK, cssCache, darken, getCss } from './draw.js';
import { drawGraph } from './graph.js';
import { closeDeleteConfirm, refreshBall2Chip } from './input.js';
import { PUZZLES, renderPuzzles, savePuzzles, setDevUnlockAll, solvedPuzzles } from './puzzles.js';
import { drawScene } from './scene.js';
import { clearReplay, launch, replay, resetRun, step, v, worldChanged } from './sim.js';
import { clearPieces, mode, setGraphType } from './state.js';

speedEl.addEventListener('input', () => {
  speedVal.textContent = parseInt(speedEl.value, 10) + ' m/s';
  worldChanged();
});
posEl.addEventListener('input', () => {
  posVal.textContent = parseInt(posEl.value, 10) + ' m';
  worldChanged();
});
document.getElementById('graphTabs').addEventListener('click', e => {
  const btn = e.target.closest('button'); if (!btn || !btn.dataset.g) return;   // (the annotate buttons live in this row too)
  setGraphType(btn.dataset.g);
  [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
  drawGraph();
});
launchBtn.addEventListener('click', launch);
replayFastBtn.addEventListener('click', () => replay(1));
document.getElementById('resetBtn').addEventListener('click', () => {
  clearReplay();                       // nothing to replay after a reset
  replayFastBtn.disabled = true;
  resetRun();
});
document.getElementById('clearBtn').addEventListener('click', () => { clearPieces(); refreshBall2Chip(); closeDeleteConfirm(); worldChanged(); });
// Create tab (wide): fix the stage to the viewport so only #scrollArea scrolls
export function fitStage() {
  const st = document.getElementById('stage');
  if (document.body.classList.contains('mode-create') && window.innerWidth >= 1100) {
    st.style.height = Math.max(520, window.innerHeight - st.getBoundingClientRect().top - window.scrollY - 12) + 'px';
  } else st.style.height = '';
}
window.addEventListener('resize', () => { fitStage(); drawScene(); drawGraph(); });

// ─── Light / dark theme (light by default) ──────────────────────────────────────
const themeBtn = document.getElementById('themeToggle');
export function applyTheme(mode) {
  for (const k in cssCache) delete cssCache[k];
  if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  themeBtn.textContent = mode === 'dark' ? '☀️' : '🌙';
  drawScene(); drawGraph();
}
export let theme = 'light';
try { if (localStorage.getItem('launcher-theme') === 'dark') theme = 'dark'; } catch (e) {}
themeBtn.addEventListener('click', () => {
  theme = (theme === 'dark') ? 'light' : 'dark';
  try { localStorage.setItem('launcher-theme', theme); } catch (e) {}
  applyTheme(theme);
});

// The logo's red ball: the world ball's cartoon style (flat fill, shade crescent, bold outline, highlight).
export function drawCartoonBall(canvas, col) {
  const c = canvas.getContext('2d'), S = canvas.width, R = S * 0.44, m = S / 2, k = S / 100;
  c.clearRect(0, 0, S, S);
  c.beginPath(); c.arc(m, m, R, 0, 7); c.fillStyle = col; c.fill();
  c.save(); c.beginPath(); c.arc(m, m, R, 0, 7); c.clip();
  c.fillStyle = darken(col, 0.22); c.beginPath(); c.arc(m + R * 0.42, m + R * 0.42, R, 0, 7); c.fill(); c.restore();
  c.beginPath(); c.arc(m, m, R, 0, 7); c.strokeStyle = INK; c.lineWidth = 7 * k; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.arc(m - R * 0.34, m - R * 0.34, R * 0.17, 0, 7); c.fill();
}

// ─── Dev tools (type "dev"): puzzle gallery + hidden tuning panel ───────────────────
// Dev: a gallery of mini target graphs for every stored puzzle (opened from the dev panel).
function showPuzzleGallery() {
  let ov = document.getElementById('devGallery'); if (ov) ov.remove();
  ov = document.createElement('div'); ov.id = 'devGallery';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.55);overflow:auto;padding:24px;display:flex;justify-content:center';
  const card = document.createElement('div');
  card.style.cssText = 'background:' + getCss('--panel') + ';color:' + getCss('--ink') + ';border:3px solid ' + getCss('--line') + ';border-radius:16px;padding:18px 22px;max-width:1100px;width:100%;align-self:flex-start;font-family:inherit';
  card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:20px">All puzzles</b><button id="devGalClose" style="padding:6px 12px;font-weight:700">Close</button></div>';
  const rows = [['Distance', PUZZLES.distance], ['Position', PUZZLES.position], ['Velocity', PUZZLES.velocity]];
  for (const [title, list] of rows) {
    const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'font-weight:800;margin:12px 0 6px;color:' + getCss('--muted');
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px';
    for (const P of list) {
      const cell = document.createElement('div'); cell.style.cssText = 'border:2px solid ' + getCss('--line') + ';border-radius:10px;padding:4px;background:' + getCss('--panel-2');
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 240; cv.style.cssText = 'width:100%;display:block';
      const cap = document.createElement('div'); cap.textContent = P.id + (P.target ? '' : ' — no target yet'); cap.style.cssText = 'font-size:12px;font-weight:700;margin-top:2px';
      cell.append(cv, cap); grid.appendChild(cell);
      const c = cv.getContext('2d'), W = 400, H = 240, L = 34, R = 10, T = 10, B = 26;
      const yMax = P.metric === 'velocity' ? AXES.velocity.y : AXES.position.y, tMax = 5;
      const X = tt => L + tt / tMax * (W - L - R), Y = v => H - B - v / yMax * (H - T - B);
      c.strokeStyle = getCss('--line'); c.lineWidth = 1; c.fillStyle = getCss('--muted'); c.font = '16px sans-serif';
      for (let tt = 0; tt <= tMax; tt++) { c.beginPath(); c.moveTo(X(tt), T); c.lineTo(X(tt), H - B); c.stroke(); c.textAlign = 'center'; c.fillText(tt, X(tt), H - 8); }
      const step = P.metric === 'velocity' ? 3 : 5;
      for (let v = 0; v <= yMax; v += step) { c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(v, L - 4, Y(v) + 5); }
      if (P.target) {
        c.strokeStyle = getCss('--accent'); c.lineWidth = 3.5; c.lineJoin = 'round'; c.beginPath();
        if (P.target.kind === 'flat') { c.moveTo(X(0), Y(P.target.value)); c.lineTo(X(tMax), Y(P.target.value)); }
        else P.target.pts.forEach((q, i) => i ? c.lineTo(X(q.t), Y(q.x)) : c.moveTo(X(q.t), Y(q.x)));
        c.stroke();
      }
    }
    card.append(h, grid);
  }
  ov.appendChild(card); document.body.appendChild(ov);
  const close = () => ov.remove();
  card.querySelector('#devGalClose').addEventListener('click', close);
  ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
}

// Hidden dev slider (type "dev") to tune friction deceleration.
(function(){
  let seq = '';
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    seq = (seq + e.key.toLowerCase()).slice(-3);
    if (seq === 'dev') {
      let box = document.getElementById('devBox');
      if (box) { box.remove(); setDevUnlockAll(false); renderPuzzles(); return; }
      setDevUnlockAll(true); renderPuzzles();
      box = document.createElement('div'); box.id = 'devBox';
      box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:50;background:#141a24;border:1px solid #2a3442;border-radius:8px;padding:8px 10px;font:12px sans-serif;color:#8a97a8;display:flex;flex-direction:column;gap:6px';
      const row = (id, label, min, max, step, val, unit) => '<label style="display:flex;gap:8px;align-items:center">' + label +
        ' <input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><span id="' + id + 'V">' + val + '</span>' + unit + '</label>';
      const lw = document.getElementById('logoWrap'), lv = n => parseFloat(getComputedStyle(lw).getPropertyValue(n));
      box.innerHTML = row('devFric', 'friction a', 0.5, 8, 0.1, FRICTION_DECEL.toFixed(1), ' m/s²')
        + row('devLbs', 'logo ball size', 1, 30, 0.1, lv('--lbs'), ' %')
        + row('devLbx', 'logo ball x', -10, 110, 0.1, lv('--lbx'), ' %')
        + row('devLby', 'logo ball y', -10, 110, 0.1, lv('--lby'), ' %');
      const clr = document.createElement('button'); clr.textContent = 'Clear level progress';
      clr.style.cssText = 'padding:5px 8px;font-size:12px;align-self:flex-start';
      clr.addEventListener('click', () => { solvedPuzzles.clear(); savePuzzles(); renderPuzzles(); });
      box.appendChild(clr);
      const gal = document.createElement('button'); gal.textContent = 'Show all puzzles';
      gal.style.cssText = 'padding:5px 8px;font-size:12px;align-self:flex-start';
      gal.addEventListener('click', showPuzzleGallery);
      box.appendChild(gal);
      const fx = document.createElement('label'); fx.style.cssText = 'display:flex;gap:6px;align-items:center';
      fx.innerHTML = '<input type="checkbox" id="devWorldFixed"> Create: keep world fixed (only puzzle maker + graph scroll)';
      fx.firstChild.checked = document.body.classList.contains('create-world-fixed');
      fx.firstChild.addEventListener('change', e => document.body.classList.toggle('create-world-fixed', e.target.checked));
      box.appendChild(fx);
      document.body.appendChild(box);
      const s = box.querySelector('#devFric'), vlab = box.querySelector('#devFricV');
      s.addEventListener('input', () => { setFriction(parseFloat(s.value)); vlab.textContent = FRICTION_DECEL.toFixed(1); worldChanged(); });
      for (const [id, v] of [['devLbs', '--lbs'], ['devLbx', '--lbx'], ['devLby', '--lby']]) {
        const inp = box.querySelector('#' + id), out = box.querySelector('#' + id + 'V');
        inp.addEventListener('input', () => { lw.style.setProperty(v, inp.value); out.textContent = inp.value; });
      }
    }
  });
})();
