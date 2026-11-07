// Canvas handles and metres-to-pixels scene geometry.

import { BALL_R, TRACK_LEN } from './constants.js';

export const sceneC = document.getElementById('scene');
export const sx = sceneC.getContext('2d');
export const graphC = document.getElementById('graph');
export const gx = graphC.getContext('2d');
export const speedEl = document.getElementById('speed');
export const speedVal = document.getElementById('speedVal');
export const posEl = document.getElementById('pos');
export const posVal = document.getElementById('posVal');
export const launchBtn = document.getElementById('launchBtn');
export const replayFastBtn = document.getElementById('replayFastBtn');

// ─── Scene geometry ───────────────────────────────────────────────────────────
export const PAD_L = 24, PAD_R = 24;
export function sceneDims() { return { w: sceneC.clientWidth, h: sceneC.clientHeight }; }
export function groundY() { return sceneDims().h - 56; }   // surface line; solid ground fills below it
export function ballRadius() { const { w } = sceneDims(); return Math.max(12, (BALL_R / TRACK_LEN) * (w - PAD_L - PAD_R) * 1.25); }
export function mToPx(m) { const { w } = sceneDims(); return PAD_L + (m / TRACK_LEN) * (w - PAD_L - PAD_R); }
export function pxToM(pxX) { const { w } = sceneDims(); return clamp(((pxX - PAD_L) / (w - PAD_L - PAD_R)) * TRACK_LEN, 0, TRACK_LEN); }
export function clamp(a, lo, hi) { return Math.max(lo, Math.min(hi, a)); }
