# Harmony Launcher

A single-page canvas physics sandbox: launch a marble along a 21 m track, drop
track pieces in its way (speed pads, target-speed gates, friction pads, walls),
and watch its distance, position and velocity graphed against time. A **Puzzle**
tab asks the student to build a track whose graph matches a target graph (a row
of distance, position and velocity puzzles), and a **Create** tab turns any run
into a shareable puzzle in whichever of the three graphs you pick. No build step
and no dependencies — just `index.html`, `style.css`, and ES modules in `js/`
that the browser loads directly.

- **Run it:** serve the folder (`python3 -m http.server 8101`) and open
  `http://localhost:8101`. It must be *served*, not opened as a `file://` path:
  browsers refuse to load ES modules over `file://`.
- **Share a puzzle:** paste a puzzle code after the page URL's `#` and it opens
  as its own puzzle.

## The one idea

The marble's state — its position `x`, distance travelled `d` and velocity `v` — is advanced a tiny step
at a time (`step()`), and every frame its current values are saved as a
**sample** `{t, x, v, d}`. The graph is just those samples drawn as a line.
Everything else is either a track piece that changes `v` when the marble reaches
it, or drawing code.

Position and distance are different on purpose: `x` is where the marble is on the
track (so it depends on the launch position), while `d` is how far it has
travelled since launch (always starts at 0, and keeps growing after a bounce).

## Code map

`index.html` is the markup, `style.css` the look (theme colours are variables at
the top; the `@media (min-width: 1100px)` block is the wide-screen layout), and
everything else is an ES module in `js/`. Banner comments (`// ─── … ───`) mark
the sections inside the longer files.

Modules are listed bottom-up: each mostly imports from the ones above it.

**`constants.js`** — track length (`TRACK_LEN`), marble size, the 5 s run limit
(`RUN_TIME_CAP`), the puzzle tolerance (`PUZZLE_TOL`), and `AXES`, which fixes
the graph ranges. Imports nothing.

**`state.js`** — the state several modules share: which `mode` we are in, the
selected puzzle, and the placed track pieces (`boosts`, `fricZones`, `walls`,
`targets`, `secondBalls`). The piece lists are mutated in place — `clearPieces`,
`loadPieces`, `removePiece` — so every module keeps pointing at the same array.

**`dom.js`** — handles to the page's canvases and sliders, plus the scene
geometry: `mToPx` / `pxToM` convert metres on the track to pixels.

**`draw.js`** — `getCss` reads a theme colour once and remembers it (the cache is
cleared when the day/night toggle flips). The rest are the chunky outlined
cartoon helpers: `roundRect`, `panel3D`, `signPost`, `drawTube`, `drawClock`.

**`sim.js`** — the running simulation, and the owner of the live state `t`, `x`,
`v`, `balls` and `running`. `step()` advances the marble one small time step
(friction slows it, `firstWallHit` stops or bounces it, `firstBallHit` handles a
collision with a second marble, and pieces fire as the marble crosses them).
`launch` starts a run, `resetRun` puts everything back, `worldChanged` is called
after any edit, `sampleAt` reads a value at any time from the saved samples, and
`frame()` is the main loop — it advances the physics, saves a sample, then
redraws, and does no work when nothing is running.

**`scene.js`** — `drawScene()` paints the ground, ruler, track pieces, the
Position Map dots and the marbles.

**`graph.js`** — `drawGraph()` paints the axes, grid, the dashed target line and
the marble's curve. `posMode` / `velMode` choose what each axis shows (Position
or Distance, Velocity or Speed); in Sandbox you click the axis title to open that
menu, and `forcedGraph()` turns it off in Puzzle and Create, where the puzzle's
graph — or Create's Position / Distance / Velocity radio — decides instead.
Clicking the graph also pins a coordinate (time snaps to half seconds).

**`annotate.js`** — after a missed puzzle the student can circle a region and draw
up to three vertical time lines (in a puzzle, only on the puzzle's own graph).
**Replay** loops the saved run over the circle's time span; at each line it
pauses and blinks a red ring (the student's ball) and a blue ring (where the
target graph puts the ball) on the world. It plays back saved samples, so no
physics runs. In a velocity puzzle the pause isn't frozen: both balls run at
their velocities for 1 s from the line, repeating for 3 s (the goal ball starts
from the chosen launch position, even if that is out of reach).

**`input.js`** — drag & drop (`hitPiece` finds what was clicked, `placePiece`
snaps a new piece to a free 1 m slot), the hover tooltips in `TIPS`, and the
double-click delete confirmation.

**`puzzles.js`** — `PUZZLES` holds three rows of five, keyed by graph type: 5
distance, 5 position and 5 velocity. Each has a target line (`flat` or `poly`) on
its own axis key (`d`, `x` or `v`); some are still placeholders with no target.
`renderPuzzles` draws the menu, `selectPuzzle` opens one, `gradePuzzle` compares
the run to the target (largest gap must be under `PUZZLE_TOL`) and shows the
solved pop-up or the miss pop-up, and `setMode` switches between the three tabs.

**`create.js`** — `makePuzzleJson` turns the last run into a puzzle code (`#` plus
URL-encoded JSON) using whichever graph is picked, `parsePuzzleJson` checks one,
and `startTest` lets you play it in place.

**`ui.js`** — control wiring, the light/dark theme (`applyTheme`), the logo and
palette marble icons, and the dev panel: type **`dev`** for a friction slider,
logo tuning, "Clear level progress" and **Show all puzzles**, which also unlocks
every puzzle.

**`main.js`** — the entry point. Every other module only *defines* things; all the
start-up work happens here in order, so nothing runs before the module it depends
on has loaded. It also opens a puzzle code found in the page address.

### One thing to know about the modules

An `import` is a **live binding**: a module can read `t`, `balls` or `mode` and see
the current value, but only the module that declares it may assign to it —
assigning to an import throws. That is why state several modules write goes
through a setter (`setGraphType`, `setPuzzleGraded`, …) at the foot of `state.js`,
and why the piece lists are mutated in place rather than reassigned.


## Puzzle codes

A code is `#` plus URL-encoded JSON:
`{format: "launcher-puzzle", version: 1, metric, tolerance, target}`.
`metric` is `"position"`, `"distance"` or `"velocity"`, and `target` is a list of
`[time, value]` points every 0.25 s. The graph a puzzle opens in comes from `metric`.

## Dev tools

- Type **`dev`** anywhere to open the dev panel (see Dev tools above).
- Puzzle codes can be tested by pasting `#…` after the URL, or into the Create box.
