// Model constants and the fixed graph axes.

export const TRACK_LEN = 21;   // world is 21 m long; the ruler only labels up to 20
export const BALL_R    = 0.28;
export const WALL_HW   = 0.25;       // wall half-thickness (m) — drawn width is 2*WALL_HW
export const CREEP_TIME = 0.25;      // s — how long the struck-from ball takes to close up to the struck ball's start spot
const BALL_VR   = 0.35;       // drawn ball radius (m)
// A wall's x is where the BALL'S CENTER sits when it hits from the left (always an integer, since
// x snaps to 1 m). The wall body stands WALL_D further right, so the ball touches its face
// instead of overlapping it. From the right the ball stops at x + 2*WALL_D.
export const WALL_D    = WALL_HW + BALL_VR;
export let   FRICTION_DECEL = 2;     // deceleration under friction (m/s^2) — dev-tunable
export const BOOST_DV  = 4;          // speed change pad: starting value (m/s); the pad's ± buttons step it by TARGET_STEP
export const FRIC_LEN  = 2;          // friction patch length (m)
export const TARGET_STEP = 2;        // target-speed increment (m/s)
export const TARGET_MAX  = 12;       // max target speed in either direction (m/s); negative sends the marble back
export const MAX_TIME  = 60;         // hard safety cap (s)
export const RUN_TIME_CAP = 5;       // everything stops when the 5 s graph window is filled
export const MASS      = 1;          // kg (KE = ½·m·v²)
export const PUZZLE_TOL = 0.9;       // max deviation (m or m/s) allowed when matching a puzzle's target line

// Fixed graph axes (always from zero). Position is always 0–20 m (the world itself is 21 m long).
export const AXES = {
  position: { t: 5, y: 20.5 },   // shows a little past 20 m so the line isn't cut off
  velocity: { t: 5, y: 12 },
  both: { t: 5, yv: 12, yd: 20.5 },   // velocity (left axis) + distance (right axis)
};

export function setFriction(a) { FRICTION_DECEL = a; }   // dev panel's friction slider
