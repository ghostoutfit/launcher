# Harmony Launcher

A single-page canvas physics sandbox: launch a marble along a 21 m track, drop
track pieces in its way (speed pads, target-speed gates, friction pads, walls),
and watch its position and velocity graphed against time. A **Puzzle** tab asks
the student to build a track whose graph matches a target graph, and a **Create**
tab turns any run into a shareable puzzle. No build step, no dependencies —
everything lives in `index.html`.

- **Run it:** serve the folder (`python3 -m http.server 8101`) and open
  `http://localhost:8101`.
- **Share a puzzle:** paste a puzzle code after the page URL's `#` and it opens
  as its own puzzle.

## The one idea

The marble's state — its position `x` and velocity `v` — is advanced a tiny step
at a time (`step()`), and every frame its current values are saved as a
**sample** `{t, x, v, d}`. The graph is just those samples drawn as a line.
Everything else is either a track piece that changes `v` when the marble reaches
it, or drawing code.

## Code map — `index.html`

Line numbers are approximate (they drift as the file is edited); the banner
comments (`// ─── … ───`) in the file are the real landmarks.

**10–306 · Styles (CSS).** The look of the page. Colors are variables at the top
(light and dark themes). The grid at `#stage` (66) lays out the page; the
`@media (min-width: 1100px)` block (79) is the wide-screen layout — launch controls
down the left, world and graph in the middle, track pieces down the right.

**308–464 · Page markup (HTML).** The header tabs (310), then `#stage` (322):
`#controls` (the left launch panel, 324), `#sceneWrap` (the world canvas, 350),
`#createPanel` (353), `#puzzlePanel` (the puzzle menu, 373), `#graphCard`
(388) and `#sidebar` (the track-piece palette, 406). Below it sit the overlays:
delete confirm (434), the miss pop-up `#tryOverlay` (444) and the solved pop-up
`#winOverlay` (455). In Create on a wide screen, the world, puzzle box and graph
share one scrolling column, `#scrollArea` (349).

**465–768 · The model (JavaScript starts here).** Everything the simulation is made of.
- **466 · Overview comment** — how the script is ordered.
- **470 · Model constants** — track length (`TRACK_LEN`), marble size, the 5 s
  run limit (`RUN_TIME_CAP`) and the puzzle tolerance (`PUZZLE_TOL`).
- **490 · State** — the live variables: `mode` (sandbox / puzzle / create),
  `balls` (each marble and its saved samples), `running`, `t`, `x`, `v`, and the
  lists of track pieces (`boosts`, `fricZones`, `walls`, `targets`, `secondBalls`).
  `AXES` (516) fixes the graph ranges.
- **535 · Elements / 547 · Scene geometry** — handles to the page's canvases and
  buttons, and `mToPx` / `pxToM`, which convert metres on the track to pixels.
- **556 · Physics** — `step()` (592) moves the marble one small time step: friction
  slows it, `firstWallHit` stops or bounces it, and `firstBallHit` handles a
  collision with a second marble. Pieces fire when the marble crosses them.
- **641 · Run control** — `doLaunch` (669) starts a run, `resetRun` (693) puts
  everything back, `worldChanged` (706) is called after any edit (it clears the
  graph and greys out replay), and `sampleAt` (660) reads a value at any time
  from the saved samples.
- **711 · Main loop** — `frame()` (712) runs every screen refresh: it advances the
  physics while a run is going, saves a sample, then redraws. When nothing is
  running it does no work.

**770–1349 · Drawing the world and graph.** Painting numbers as pixels on a canvas.
- **770 · Scene rendering** — `drawScene()` (781) paints the ground, ruler, track
  pieces, the Position Map dots (the whole-second dots near the top) and the
  marbles. `drawPad` (958) draws a speed pad.
- **1022 · Graph rendering** — `drawGraph()` (1034) paints the axes, grid, the
  target line (puzzles) and the marble's curve; the axis menu (1320) lets the
  student switch between position/distance and velocity/speed.
- **1204 · Graph points** — `drawGraphPoint` (1299): clicking the graph pins a
  coordinate (time snaps to half seconds).
- **1206 · Annotate** — after a missed puzzle, the student can circle a region and
  draw up to three time arrows; `drawAnnotations` (1231) paints them.

**1354–1448 · Colour + cartoon helpers.** `getCss` (1356) reads a theme color once
and remembers it (cleared when the day/night toggle flips). The rest are small
drawing helpers for the chunky outlined look: `roundRect`, `lighten`, `ink`,
`panel3D`, `signPost`, `drawTube`, `drawClock`.

**1450–1730 · Input.** How the student interacts.
- **1450 · Drag & drop** — `hitPiece` (1491) finds what was clicked, `placePiece`
  (1551) drops a new piece and snaps it to a free 1 m slot, and
  `refreshBall2Chip` (1571) shows the Marble 2 chip only in Sandbox.
- **1629 · Hover tooltips** — `TIPS` (1630) holds one short line per element.
- **1732 · Wiring** — connects buttons and sliders to the simulation; `fitStage`
  (1756) pins the Create layout to the window height.

**1764–1904 · Small features.**
- **1764 · Light / dark theme** — `applyTheme` (1766).
- **1782 · Delete confirmation** — double-click a piece to remove it.
- **1809 · Logo + palette marble icons** — `drawCartoonBall`.
- **1823 · Dev tools** — type `dev` anywhere: a panel with a friction slider,
  logo tuning, "Clear level progress", **Show all puzzles** (`showPuzzleGallery`,
  1825) and a checkbox for whether the Create world stays fixed while scrolling.
  It also unlocks every puzzle.

**1906–2104 · Puzzle mode.**
- **1906 · Puzzle data** — `PUZZLES` (1910): 5 simpler position, 5 harder
  position and 5 velocity puzzles. Each has a target line (`flat` or `poly`);
  some are still placeholders with no target. `renderPuzzles` (1954) draws the menu
  and `selectPuzzle` (1996) opens one.
- **2007 · Puzzle results** — `gradePuzzle` (2053) compares the run to the target
  (largest gap must be under `PUZZLE_TOL`), then shows the solved pop-up
  (`showWin`, 2021) or the miss pop-up (Annotate / Revise / Start fresh).
  `setMode` (2081) switches between the three tabs.

**2105–2182 · Create tab.** `makePuzzleJson` (2108) turns the last run into a
puzzle code (`#` + URL-encoded JSON), `parsePuzzleJson` (2130) checks one,
and `startTest` (2150) lets you play it in place.

**2183–end · Init.** `loadPuzzleFromUrl` (2187) opens a puzzle code found in the
page address (and again whenever the `#` part changes), then the frame loop starts.

## Dev tools

- Type **`dev`** anywhere to open the dev panel (see Dev tools above).
- Puzzle codes can be tested by pasting `#…` after the URL, or into the Create box.
