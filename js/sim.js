// The running simulation: live state, physics, run control, main loop.

import { annotPlay, endAnnotate, tickAnnotPlay } from './annotate.js';
import { BALL_R, CREEP_TIME, FRICTION_DECEL, MASS, MAX_TIME, RUN_TIME_CAP, TRACK_LEN, WALL_D } from './constants.js';
import { launchBtn, posEl, replayFastBtn, speedEl } from './dom.js';
import { getCss } from './draw.js';
import { drawGraph } from './graph.js';
import { gradePuzzle } from './puzzles.js';
import { drawScene } from './scene.js';
import { boosts, fricZones, mode, secondBalls, setPuzzleGraded, targets, walls } from './state.js';

export let v0 = 2, launchX = 5;
let playbackRate = 1;           // 1 = normal (rabbit), 0.5 = half speed (turtle)
let lastRun = null;             // { v0, x0 } of the last launch, so replay repeats it
let bounceAt = null;            // contact point of a bouncy-wall reflection this frame (adds a v = 0 sample)
export let replaying = false;          // true during a replay: show the full stored curve + a moving marble
export let lastTrace = null;           // [{color, samples}] — the completed run kept on screen during replay
let runCaptured = false;        // whether lastTrace has been captured for the current (fresh) run
export let running = false, ballStopped = false, t = 0;
export let v = 0, x = 0;             // live state of whichever ball is currently moving
export let balls = [];              // every ball: {launcher, x, v, moving, color, d, samples:[{t,x,v,d}]}
let movingBall = null;       // the one ball currently in motion (null when all at rest)
let heldGate = null;         // a timed target holding the ball in its tube until its trigger time
let lastFrame = 0;

const ke = () => 0.5 * MASS * v * v;
function onFrictionZone(px) { return fricZones.some(z => px >= z.x && px <= z.x + z.len); }

// A piece at px is crossed when the ball moves from a to b through it (either direction).
function crossed(px, a, b) { return (px > a && px <= b) || (px < a && px >= b); }
function firstCrossed(arr, a, b, activeOnly) {
  let hit = null;
  for (const p of arr) {
    if (activeOnly && p.used) continue;
    if (crossed(p.x, a, b) && (!hit || Math.abs(p.x - a) < Math.abs(hit.x - a))) hit = p;
  }
  return hit;
}
// Nearest wall face the ball's center reaches between a and b → { wall, cp } (cp = center at contact).
function firstWallHit(a, b) {
  const s = Math.sign(b - a); if (!s) return null;
  let hit = null;
  for (const wall of walls) {
    const cp = s > 0 ? wall.x : wall.x + 2 * WALL_D;
    if (crossed(cp, a, b) && (!hit || Math.abs(cp - a) < Math.abs(hit.cp - a))) hit = { wall, cp };
  }
  return hit;
}
// Nearest resting ball the moving ball reaches between a and b. Contact is when the
// centers are one diameter apart, so the contact point sits just short of the ball.
function firstBallHit(a, b) {
  const s = Math.sign(b - a); if (!s) return null;
  let hit = null;
  for (const ball of balls) {
    if (ball === movingBall || ball.moving) continue;
    const cp = ball.x - s * 2 * BALL_R;
    if (crossed(cp, a, b) && (!hit || Math.abs(cp - a) < Math.abs(hit.cp - a))) hit = { ball, cp };
  }
  return hit;
}

export function step(dt) {
  const sub = 6, h = dt / sub;
  for (let i = 0; i < sub && !ballStopped; i++) {
    // friction opposes motion (works in either direction)
    const decel = onFrictionZone(x) ? FRICTION_DECEL : 0;
    if (decel > 0 && v !== 0) {
      const s = Math.sign(v), nv = v - s * decel * h;
      v = (Math.sign(nv) !== s) ? 0 : nv;
    }
    if (Math.abs(v) <= 1e-4) { v = 0; ballStopped = true; break; }
    const nx = x + v * h;
    // wall: the ball's center reaches the wall face (x going right, x + 2*WALL_D going left).
    // Plain walls stop it dead; bouncy walls reflect it at the same speed.
    const wh = firstWallHit(x, nx);
    if (wh) {
      x = wh.cp;
      if (wh.wall.bouncy) { v = -v; bounceAt = wh.cp; continue; }
      v = 0; ballStopped = true; break;
    }
    // second ball: equal-mass elastic hit → this ball stops dead, the other takes its speed
    const hit = firstBallHit(x, nx);
    if (hit) {
      movingBall.x = hit.cp; movingBall.v = 0; movingBall.moving = false;  // incoming ball stops, touching
      // ...then eases forward onto the struck ball's start spot, staying one diameter behind it
      movingBall.creep = { from: hit.cp, to: hit.ball.x, s: Math.sign(nx - x), t0: t, other: hit.ball };
      hit.ball.moving = true; hit.ball.v = v;                              // struck ball takes the speed
      movingBall = hit.ball;
      x = hit.ball.x;                        // keep v; continue as the struck ball
      continue;
    }
    // target-speed gate
    const g = firstCrossed(targets, x, nx, true);
    if (g) {
      if (g.time != null && t < g.time) {       // too early → the tube holds the marble until its time
        x = g.x; v = 0; ballStopped = true; heldGate = g; break;
      }
      x = g.x;
      const vNew = g.dir * g.mag;
      v = vNew; g.used = true; g._shake = 1;    // kick off the tube's shake
      continue;
    }
    // speed change pad (+ΔV or −ΔV)
    const b = firstCrossed(boosts, x, nx, true);
    if (b) { x = b.x; v += b.dv; b.used = true; b._shake = 1; continue; }
    x = nx;
    // the right/left edges are NOT walls: let the ball coast offscreen and keep going
  }
}

// ─── Run control ──────────────────────────────────────────────────────────────
// Build the ball set: the red launcher at 0, then the blue second balls where placed.
function buildBalls(launchV, x0) {
  balls = [{ launcher: true, x: x0 || 0, v: launchV, moving: false, color: getCss('--ball'), d: 0, samples: [] }];
  for (const b of secondBalls) balls.push({ launcher: false, x: b.x, v: 0, moving: false, color: getCss('--ball2'), d: 0, samples: [] });
}
function seedSamples() { for (const b of balls) b.samples = [{ t: 0, x: b.x, v: b.v, d: 0 }]; }
// Snapshot the current trajectories as the static curve to keep on screen during
// replay, flat-extended to the right edge so the curve spans the whole time axis.
function snapshotTrace(extend = true) {
  return balls.map(b => {
    const s = b.samples.slice();
    const last = s[s.length - 1];
    if (extend && last && last.t < RUN_TIME_CAP) s.push({ t: RUN_TIME_CAP, x: last.x, v: last.v, d: last.d });
    return { color: b.color, samples: s };
  });
}

// value of `key` at time tt, linearly interpolated along a sample list
export function sampleAt(samples, key, tt) {
  if (tt <= samples[0].t) return samples[0][key];
  for (let i = 1; i < samples.length; i++) {
    if (tt <= samples[i].t) { const a = samples[i - 1], b = samples[i]; return a[key] + (b[key] - a[key]) * (tt - a.t) / ((b.t - a.t) || 1); }
  }
  return samples[samples.length - 1][key];
}

// Run the ball from (xLaunch, vLaunch) played back at `rate` (1 = normal, 0.5 = half).
function doLaunch(vLaunch, xLaunch, rate, isReplay) {
  endAnnotate(); v0 = vLaunch; launchX = xLaunch; playbackRate = rate;
  replaying = !!isReplay; runCaptured = false; setPuzzleGraded(false);
  boosts.forEach(b => { b.used = false; b._shake = 0; });
  targets.forEach(g => { g.used = false; g._shake = 0; });
  heldGate = null;
  buildBalls(v0, launchX);
  movingBall = balls[0]; movingBall.moving = true;
  running = true; ballStopped = false; t = 0; x = launchX; v = v0;
  seedSamples();
  lastFrame = performance.now();
  launchBtn.disabled = true;
  lastRun = { v0, x0: launchX };
  replayFastBtn.disabled = false;
}
export function launch() { doLaunch(parseInt(speedEl.value, 10), parseInt(posEl.value, 10), 1, false); }
// Replay repeats the last run exactly, at the given rate, keeping the finished
// graph on screen with a marble running along it.
export function replay(rate) {
  if (!lastRun) return;
  if (!lastTrace) lastTrace = snapshotTrace();
  doLaunch(lastRun.v0, lastRun.x0, rate, true);
}

export function resetRun() {
  endAnnotate();
  launchX = posEl ? parseInt(posEl.value, 10) : 0;
  running = false; replaying = false; lastTrace = null; runCaptured = false;
  ballStopped = false; t = 0; x = launchX; v = 0;
  targets.forEach(g => g._shake = 0); boosts.forEach(b => b._shake = 0);
  heldGate = null;
  buildBalls(0, launchX); movingBall = null;
  launchBtn.disabled = false;
  drawScene(); drawGraph();
}

// Any edit to the world discards the graph just made and disables replay.
export function worldChanged() {
  lastRun = null; replayFastBtn.disabled = true;
  resetRun();
}

// ─── Main loop ────────────────────────────────────────────────────────────────
export function frame(now) {
  if (annotPlay && !running) tickAnnotPlay(now);
  if (running) {
    const dt = Math.max(0, Math.min(0.05, (now - lastFrame) / 1000)) * playbackRate;   // rAF's timestamp can precede lastFrame (set at click) → never run backwards
    lastFrame = now;
    t += dt;
    // a timed tube that's been holding the ball shoots it out at its trigger time
    if (heldGate && t >= heldGate.time) {
      v = heldGate.dir * heldGate.mag;
      heldGate.used = true; heldGate._shake = 1;
      ballStopped = false; if (movingBall) movingBall.moving = true;
      heldGate = null;
    }
    if (!ballStopped) step(dt);           // the moving ball halts at a wall, but time marches on
    if (movingBall) { movingBall.x = x; movingBall.v = v; if (ballStopped) movingBall.moving = false; }
    for (const el of [...targets, ...boosts]) { if (el._shake) { el._shake *= 0.85; if (el._shake < 0.02) el._shake = 0; } }
    for (const b of balls) if (b.creep) {          // closing drift after a collision (v stays 0)
      const c = b.creep, k = Math.min(1, (t - c.t0) / CREEP_TIME), e = 1 - (1 - k) * (1 - k);
      const want = c.from + (c.to - c.from) * e, lim = c.other.x - c.s * 2 * BALL_R;
      b.x = c.s > 0 ? Math.min(want, lim) : Math.max(want, lim);
      if (k >= 1 && b.x === c.to) b.creep = null;
    }
    // record every ball's trajectory so each can be graphed on the same axes
    for (const b of balls) {
      let prev = b.samples[b.samples.length - 1];
      if (bounceAt !== null && b === movingBall) {   // a reflection passes through v = 0: speed dips to 0 and back
        const dd = prev.d + Math.abs(bounceAt - prev.x);
        prev = { t: (prev.t + t) / 2, x: bounceAt, v: 0, d: dd }; b.samples.push(prev);
      }
      b.d = prev.d + Math.abs(b.x - prev.x);
      b.samples.push({ t, x: b.x, v: b.v, d: b.d });
    }
    bounceAt = null;
    if ((mode === 'puzzle' || mode === 'create') && !replaying) gradePuzzle();
    // marble left the screen: stop collecting data and freeze the graph where it ended
    // (no flat extension), leaving the replay buttons ready
    if (x > TRACK_LEN || x < 0) {
      running = false; launchBtn.disabled = false;
      replayFastBtn.disabled = false;
      if (!replaying) { lastTrace = snapshotTrace(false); runCaptured = true; }
      if ((mode === 'puzzle' || mode === 'create') && !replaying) gradePuzzle(true);
    } else {
      // free to relaunch once the ball is truly at rest (not merely held by a tube)
      if (ballStopped && !heldGate) {
        launchBtn.disabled = false;
        // once a fresh run's motion is done, keep its curve so replay can re-trace it
        if (!replaying && !runCaptured) { lastTrace = snapshotTrace(); runCaptured = true; }
      }
      // run ends when the graph's time axis is filled (safety cap otherwise)
      if (t >= RUN_TIME_CAP || t >= MAX_TIME) {
        running = false; launchBtn.disabled = false;
        if (!replaying) { lastTrace = snapshotTrace(); runCaptured = true; }
      }
    }
    drawScene(); drawGraph();
  }
  requestAnimationFrame(frame);
}


export function clearReplay() { lastRun = null; lastTrace = null; }   // nothing to replay after a reset
