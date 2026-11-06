# Harmony Launcher

A single-page canvas physics sandbox: launch a marble along a 21 m track, drop
track pieces in its way (speed pads, target-speed gates, friction pads, walls),
and watch its distance, position and velocity graphed against time. A **Puzzle**
tab asks the student to build a track whose graph matches a target graph (a row
of distance, position and velocity puzzles), and a **Create** tab turns any run
into a shareable puzzle in whichever of the three graphs you pick. No build step, no dependencies —
everything lives in `index.html`.

- **Run it:** serve the folder (`python3 -m http.server 8101`) and open
  `http://localhost:8101`.
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

## Code map — `index.html`

Line numbers are approximate (they drift as the file is edited); the banner
comments (`// ─── … ───`) in the file are the real landmarks.

**11–307 · Styles (CSS).** The look of the page. Colors are variables at the top
(light and dark themes). The grid at `#stage` (67) lays out the page; the
`@media (min-width: 1100px)` block (80) is the wide-screen layout — launch controls
down the left, world and graph in the middle, track pieces down the right.

**309–466 · Page markup (HTML).** The header tabs (315), then `#stage` (323):
`#controls` (the left launch panel, 325), `#sceneWrap` (the world canvas, 351),
`#createPanel` (354), `#puzzlePanel` (the puzzle menu, 375), `#graphCard`
(390, with the Position / Velocity / Both graph tabs) and `#sidebar`
(the track-piece palette, 408). Below it sit the overlays: delete confirm (436),
the miss pop-up `#tryOverlay` (446) and the solved pop-up `#winOverlay` (457).
In Create on a wide screen, the world, puzzle box and graph share one scrolling
column, `#scrollArea` (350).

**467–771 · The model (JavaScript starts here).** Everything the simulation is made of.
- **468 · Overview comment** — how the script is ordered.
- **472 · Model constants** — track length (`TRACK_LEN`), marble size, the 5 s
  run limit (`RUN_TIME_CAP`) and the puzzle tolerance (`PUZZLE_TOL`).
- **492 · State** — the live variables: `mode` (sandbox / puzzle / create),
  `balls` (each marble and its saved samples), `running`, `t`, `x`, `v`, and the
  lists of track pieces (`boosts`, `fricZones`, `walls`, `targets`, `secondBalls`).
  `AXES` (518) fixes the graph ranges for each graph type.
- **537 · Elements / 549 · Scene geometry** — handles to the page's canvases and
  buttons, and `mToPx` / `pxToM`, which convert metres on the track to pixels.
- **558 · Physics** — `step()` (594) moves the marble one small time step: friction
  slows it, `firstWallHit` (572) stops or bounces it, and `firstBallHit` (583) handles
  a collision with a second marble. Pieces fire when the marble crosses them.
- **643 · Run control** — `doLaunch` (671) starts a run, `resetRun` (695) puts
  everything back, `worldChanged` (708) is called after any edit (it clears the
  graph and greys out replay), and `sampleAt` (662) reads a value at any time
  from the saved samples.
- **713 · Main loop** — `frame()` (714) runs every screen refresh: it advances the
  physics while a run is going, saves a sample, then redraws. When nothing is
  running it does no work.

**772–1357 · Drawing the world and graph.** Painting numbers as pixels on a canvas.
- **772 · Scene rendering** — `drawScene()` (783) paints the ground, ruler, track
  pieces, the Position Map dots (the whole-second dots near the top) and the
  marbles. `drawPad` (960) draws a speed pad.
- **1024 · Graph rendering** — `posMode` / `velMode` (1027) choose what each axis
  shows: Position or Distance, Velocity or Speed (in Sandbox, click the axis title
  to open the menu). `forcedGraph()` (1030) turns that menu off in Puzzle and
  Create, where the puzzle's graph (or Create's Position / Distance / Velocity
  radio) is used instead. `drawGraph()` (1038) paints the axes, grid, the target
  line (puzzles) and the marble's curve.
- **1208 · Graph points** — `drawGraphPoint` (1303): clicking the graph pins a
  coordinate (time snaps to half seconds).
- **1210 · Annotate** — after a missed puzzle, the student can circle a region and
  draw up to three time arrows; `drawAnnotations` (1235) paints them.

**1358–1453 · Colour + cartoon helpers.** `getCss` (1360) reads a theme color once
and remembers it (cleared when the day/night toggle flips). The rest are small
drawing helpers for the chunky outlined look: `roundRect`, `lighten`, `ink`,
`panel3D`, `signPost`, `drawTube`, `drawClock`.

**1454–1767 · Input.** How the student interacts.
- **1454 · Drag & drop** — `hitPiece` (1495) finds what was clicked, `placePiece`
  (1555) drops a new piece and snaps it to a free 1 m slot, and
  `refreshBall2Chip` (1575) shows the Marble 2 chip only in Sandbox.
- **1633 · Hover tooltips** — `TIPS` (1634) holds one short line per element.
- **1736 · Wiring** — connects buttons and sliders to the simulation; `fitStage`
  (1760) pins the Create layout to the window height.

**1768–1909 · Small features.**
- **1768 · Light / dark theme** — `applyTheme` (1770).
- **1786 · Delete confirmation** — double-click a piece to remove it.
- **1813 · Logo + palette marble icons** — `drawCartoonBall`.
- **1827 · Dev tools** — type `dev` anywhere: a panel with a friction slider,
  logo tuning, "Clear level progress", **Show all puzzles** (`showPuzzleGallery`,
  1829) and a checkbox for whether the Create world stays fixed while scrolling.
  It also unlocks every puzzle.

**1910–2110 · Puzzle mode.**
- **1910 · Puzzle data** — `PUZZLES` (1915): three rows of five, keyed by graph type —
  5 distance, 5 position and 5 velocity puzzles. Each has a target line (`flat` or
  `poly`) on its own axis key (`d`, `x` or `v`); some are still placeholders with
  no target. Opening a puzzle switches the graph to its type. `renderPuzzles` (1961)
  draws the menu and `selectPuzzle` (2002) opens one.
- **2013 · Puzzle results** — `gradePuzzle` (2059) compares the run to the target
  (largest gap must be under `PUZZLE_TOL`), then shows the solved pop-up
  (`showWin`, 2027) or the miss pop-up (Annotate / Revise / Start fresh).
  `setMode` (2087) switches between the three tabs.

**2111–2195 · Create tab.** `makePuzzleJson` (2115) turns the last run into a
puzzle code (`#` + URL-encoded JSON) using whichever graph is picked — Position,
Distance or Velocity (`METRIC_KEY` maps that name to the sample field) —
`parsePuzzleJson` (2137) checks one, and `startTest` (2157) lets you play it in place.

**2196–end · Init.** `loadPuzzleFromUrl` (2200) opens a puzzle code found in the
page address (and again whenever the `#` part changes), then the frame loop starts.

## Puzzle codes

A code is `#` plus URL-encoded JSON:
`{format: "launcher-puzzle", version: 1, metric, tolerance, target}`.
`metric` is `"position"`, `"distance"` or `"velocity"`, and `target` is a list of
`[time, value]` points every 0.25 s. The graph a puzzle opens in comes from `metric`.

## Dev tools

- Type **`dev`** anywhere to open the dev panel (see Dev tools above).
- Puzzle codes can be tested by pasting `#…` after the URL, or into the Create box.
