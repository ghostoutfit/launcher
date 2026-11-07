// Colour lookup and the hand-drawn cartoon drawing helpers.

import { sx } from './dom.js';
import { t, x } from './sim.js';

export const cssCache = {};   // theme colours only change on the day/night toggle (applyTheme clears this), so read each once
export function getCss(name) { return name in cssCache ? cssCache[name] : (cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim()); }
export function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixC(hex, target, t) { const [r, g, b] = hexRgb(hex); const f = c => Math.round(c + (target - c) * t); return `rgb(${f(r)},${f(g)},${f(b)})`; }
export const lighten = (hex, t) => mixC(hex, 255, t);
export const darken  = (hex, t) => mixC(hex, 0, t);

export const INK = '#1a2230';                 // bold outline colour
export const handFont = (size, weight) => (weight || 600) + ' ' + size + "px 'Lexend', system-ui, sans-serif";
export function ink(width) { sx.strokeStyle = INK; sx.lineWidth = width; sx.lineJoin = 'round'; sx.lineCap = 'round'; }

// A flat two-tone panel: solid fill + a darker bottom "shade block" + bold ink outline.
export function panelShaded(x, y, w, h, r, hex) {
  roundRect(sx, x, y, w, h, r); sx.fillStyle = hex; sx.fill();
  sx.save(); roundRect(sx, x, y, w, h, r); sx.clip();
  sx.fillStyle = darken(hex, 0.18); sx.fillRect(x, y + h * 0.62, w, h * 0.38);  // flat shade block
  sx.restore();
  roundRect(sx, x, y, w, h, r); ink(2.5); sx.stroke();
}

// A flat panel with a solid fill and a bold, smooth ink outline (no gradient, no shadow).
export function panel3D(x, y, w, h, r, hex) {
  roundRect(sx, x, y, w, h, r);
  sx.fillStyle = hex; sx.fill();
  ink(2.5); sx.stroke();
}

// A little post connecting a sign down to its element, with an outlined knob where they meet.
export function signPost(cx, topY, botY, hex) {
  ink(2.5); sx.beginPath(); sx.moveTo(cx, topY); sx.lineTo(cx, botY); sx.stroke();
  sx.beginPath(); sx.arc(cx, botY, 3.6, 0, 7); sx.fillStyle = hex; sx.fill(); ink(2); sx.stroke();
}

// A floating display sign (flat outlined panel on a post) with a hand-lettered label + optional sub-line.
export function drawPieceSign(cx, elTopY, label, hex, fg, sub) {
  sx.font = handFont(17, 700);
  const lines = String(label).split('\n');                  // '\n' in the label = a second line
  const tw = Math.max(...lines.map(l => sx.measureText(l).width));
  let sw = Math.max(54, tw + 26), sh = sub ? 42 : lines.length > 1 ? 48 : 30;
  const syBot = elTopY - 15, syTop = syBot - sh;
  signPost(cx, syTop + sh, elTopY, hex);
  panelShaded(cx - sw / 2, syTop, sw, sh, 10, hex);
  sx.fillStyle = fg; sx.textAlign = 'center'; sx.textBaseline = 'middle';
  sx.font = handFont(17, 700);
  if (lines.length > 1) lines.forEach((l, i) => sx.fillText(l, cx, syTop + 14 + i * 19));
  else sx.fillText(label, cx, sub ? syTop + 15 : syTop + sh / 2 + 1);
  if (sub) {
    sx.font = handFont(13, 600); sx.fillStyle = lighten(hex, 0.55);
    sx.fillText(sub, cx, syTop + 31);
  }
  sx.textBaseline = 'alphabetic';
  return { x: cx - sw / 2, y: syTop, w: sw, h: sh };
}

// A small flat outlined round button (used for +/- on the target sign). Returns its hit circle.
export function miniBtn(cx, cy, rad, label, hex, fg) {
  sx.beginPath(); sx.arc(cx, cy, rad, 0, 7); sx.fillStyle = lighten(hex, 0.2); sx.fill();
  ink(2); sx.stroke();
  sx.fillStyle = fg; sx.font = handFont(Math.round(rad * 1.9), 400);
  sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText(label, cx, cy + 1);
  sx.textBaseline = 'alphabetic';
  return { cx, cy, r: rad };
}

// A horizontal tube (pipe) the ball shoots out of.
export function drawTube(cx, cy, L, H, hex) {
  const x = cx - L / 2, y = cy - H / 2, r = Math.min(H / 2, 11);
  roundRect(sx, x, y, L, H, r); sx.fillStyle = hex; sx.fill();
  sx.save(); roundRect(sx, x, y, L, H, r); sx.clip();
  sx.fillStyle = darken(hex, 0.18); sx.fillRect(x, cy + H * 0.1, L, H * 0.4);   // shade block
  sx.restore();
  roundRect(sx, x, y, L, H, r); ink(2.5); sx.stroke();
  // open ends (dark holes the ball enters/leaves through)
  sx.fillStyle = darken(hex, 0.42);
  sx.beginPath(); sx.ellipse(x + 4.5, cy, 3, H / 2 - 5, 0, 0, 7); sx.fill();
  sx.beginPath(); sx.ellipse(x + L - 4.5, cy, 3, H / 2 - 5, 0, 0, 7); sx.fill();
}

// A little clock face with two hands (used for the timer control + the timed gate).
export function drawClock(cx, cy, r, face) {
  sx.beginPath(); sx.arc(cx, cy, r, 0, 7); sx.fillStyle = face; sx.fill(); ink(1.8); sx.stroke();
  ink(1.8);
  sx.beginPath();
  sx.moveTo(cx, cy); sx.lineTo(cx, cy - r * 0.6);
  sx.moveTo(cx, cy); sx.lineTo(cx + r * 0.5, cy + r * 0.15);
  sx.stroke();
}
