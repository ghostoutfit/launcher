# Harmony Launcher

A physics sandbox that runs in the browser. Students launch a marble along a
21 m track, put track pieces in its way (speed changes, target-speed launchers,
friction pads, walls, a second marble), and watch its position, distance and
speed graphed against time.

It has three tabs:

- **Sandbox** — build any track and experiment.
- **Puzzle** — build a track whose graph matches a target graph. There are three
  rows of five puzzles: distance, position and speed.
- **Create** — turn any run into a puzzle code you can share, or paste a code in
  to play it.

There is **no build step and nothing to install**: the browser runs the files in
this folder exactly as they are.

---

## Contents

1. [Run it](#run-it)
2. [What's in the folder](#whats-in-the-folder)
3. [How it works, in one minute](#how-it-works-in-one-minute)
4. [Where do I change…?](#where-do-i-change)
5. [The modules, one by one](#the-modules-one-by-one)
6. [House rules](#house-rules)
7. [Controls](#controls)
8. [Puzzle codes](#puzzle-codes)
9. [Dev tools](#dev-tools)
10. [Checking a change](#checking-a-change)

---

## Run it

1. Open a terminal in this folder.
2. Run `python3 -m http.server 8101` (any static web server works).
3. Open <http://localhost:8101> in a browser.

Double-clicking `index.html` will **not** work. The code is split into
*ES modules* (JavaScript files that `import` from each other), and browsers
refuse to load modules from a `file://` address. They have to come from a server,
even a local one.

To publish it, copy the folder to any static host (GitHub Pages and the like).
Nothing runs on the server.

---

## What's in the folder

```
index.html        the page: every panel, button and slider (text you see on buttons lives here)
style.css         the look: colours, sizes, layout, light and dark themes
js/               the behaviour, one file ("module") per job — see below
  tips.js         ← the text of every hover tooltip, all in one place
  …               the other modules
help/             pictures for the help pop-up (the ? button)
favicon.png       browser-tab icon
harmony-ramp.png  the logo
README.md         this file
```

---

## How it works, in one minute

**The one idea.** The marble has a position `x`, a distance travelled `d` and a
velocity `v`. Many times a second the simulation moves it forward a tiny step in
time (`step()` in `sim.js`) and saves a **sample**, `{t, x, v, sp, d}` (`sp` is
the speed, `|v|`). The graph is
just those samples drawn as a line. Everything else is either a track piece that
changes `v` when the marble reaches it, or code that draws things.

Position and distance are different on purpose. `x` is *where* the marble is on
the track, so it depends on the launch position. `d` is *how far it has
travelled* since launch: it always starts at 0 and keeps growing after a bounce.

**One frame**, about 60 times a second while a run is going:

```
frame()  ──►  step(): move the marble, fire any piece it crossed
         ──►  save a sample {t, x, v, d}
         ──►  drawScene()  (the world, top canvas)
         ──►  drawGraph()  (the graph, bottom canvas)
```

When nothing is running, `frame()` does no work. Editing the track instead
calls `worldChanged()`, which clears the old run and redraws once.

The world and the graph are each one `<canvas>` (a drawing surface), redrawn
from scratch every time. They are pictures, not page elements, so clicks on them
are worked out by position (`hitPiece()` in `input.js` asks "which piece is under
this point?").

---

## Where do I change…?

| I want to change… | Edit | Look for |
|---|---|---|
| A **tooltip's wording** | `js/tips.js` | the tip's key, e.g. `launch:` |
| The **help pop-up** (the **?** button) | `index.html` | `#helpOverlay`, near the end; its pictures are in `help/` |
| A **button or heading label** | `index.html` | the visible text |
| A **pop-up or status message** | `index.html` (pop-ups), `js/puzzles.js` (puzzle status), `js/create.js` (`cpSay(…)` messages) | the sentence |
| A **colour** | `style.css` | the variables at the top (`:root` = light theme, `[data-theme="dark"]` = dark) |
| **Sizes / layout** | `style.css` | the element's `#id` or `.class`. Two layouts: the `@media (min-width: 1100px) and (min-aspect-ratio: 16/9)` block is the three-column wide layout; the `@media not all and …` block is the one-column layout for narrower or taller windows (launch controls, then track pieces, then the rest) |
| The **puzzles** | `js/puzzles.js` | `PUZZLES` |
| **Physics numbers** (track length, friction, run length, puzzle tolerance) | `js/constants.js` | the named constant |
| What a **track piece does** to the marble | `js/sim.js` | `step()` |
| How a **track piece looks** | `js/scene.js` | `drawScene()`, `drawPad()` |
| The **graph** (axes, lines, axis menu) | `js/graph.js` | `drawGraph()` |
| **Mouse, touch and keyboard** behaviour | `js/input.js` | the banner comments (`// ─── … ───`) |

---

## The modules, one by one

Each file in `js/` does one job. They are listed roughly **bottom-up**: a module
mostly uses (imports) the ones listed above it. Longer files are divided into
sections by banner comments, `// ─── Section name ───`.

**`constants.js`** — fixed numbers: track length (`TRACK_LEN`), marble size,
the 5 s run limit (`RUN_TIME_CAP`), the puzzle tolerance (`PUZZLE_TOL`), and
`AXES`, which fixes the graph ranges. Imports nothing.

**`tips.js`** — the text of every hover tooltip, grouped by screen area (top bar,
launch controls, Create tab, graph, track pieces). It contains only text, so it
can be reviewed and copy edited without reading any code. Imports nothing.
See [Tooltips](#tooltips) for how the page finds each tip.

**`state.js`** — the state several modules share: which tab (`mode`) is open,
the selected puzzle, the placed track pieces (`boosts`, `fricZones`, `walls`,
`targets`, `secondBalls`), and the `selected` piece (the one showing a × button).

**`dom.js`** — handles to the page's canvases and sliders, plus the track
geometry: `mToPx` / `pxToM` convert metres on the track to pixels and back.

**`draw.js`** — `getCss` reads a theme colour from `style.css` (and remembers it
until the day/night toggle flips), plus the chunky outlined cartoon drawing
helpers: `roundRect`, `panel3D`, `signPost`, `drawTube`, `drawClock`, `miniBtn`.

**`sim.js`** — the simulation itself, and the owner of the live run state `t`,
`x`, `v`, `balls` and `running`.
- `step()` advances the marble one small time step: friction slows it,
  `firstWallHit` stops or bounces it, `firstBallHit` handles hitting the second
  marble, and pieces fire as the marble crosses them.
- `launch()` starts a run, `replay()` repeats the last one, `resetRun()` puts
  everything back, and `worldChanged()` is called after any edit to the track.
- `sampleAt()` reads a value at any time from the saved samples.
- `frame()` is the main loop described above.

**`scene.js`** — `drawScene()` paints the world: ground, ruler, track pieces,
the Position Map dots, the marbles, and the selected piece's dashed outline
and × button.

**`graph.js`** — `drawGraph()` paints the axes, grid, the dashed target line and
each marble's curve.
- In Sandbox, clicking the y-axis title (or the big triangle beside it) opens a
  menu to switch Position ↔ Distance or Speed ↔ Velocity (`posMode` / `velMode`).
  Speed is the default; this menu is the only place velocity is graphed.
- In Puzzle and Create the puzzle decides the graph instead (`forcedGraph()`),
  and the triangle is hidden.
- Clicking the graph pins a coordinate; time snaps to half seconds.

**`annotate.js`** — after a missed puzzle the student can draw up to three
vertical time lines on the graph.
- **Replay** loops the saved run (the whole 5 s).
- At each line it pauses and blinks two rings on the world: red where the
  student's marble was, blue where the target graph says it should be.
- It plays back saved samples, so no physics runs.
- In a speed puzzle the pause keeps moving: both marbles run at their
  speeds for 1 s from the line, repeating for 3 s.

**`input.js`** — everything the pointer and keyboard do on the track:
- **Placing pieces.** Drag a chip from the *Track pieces* palette onto the
  track, *or* click the chip and then click the track. The second way was added
  for touchpads (e.g. Chromebooks), where holding a button down while moving is
  hard. `placePiece()` snaps each piece to a free 1 m slot.
- **Moving and resizing.** Drag a placed piece; drag a friction pad's ends to
  resize it. `hitPiece()` works out what is under the pointer.
- **Selecting and deleting.** The last piece clicked or placed is selected:
  ← → move it 1 m, Backspace/Delete or its × button removes it. Double-click
  also offers a delete.
- **Touch.** A finger drag on a chip never scrolls the page, and a drag the
  browser interrupts (`pointercancel`) is cleaned up.
- **Showing tooltips** (the text comes from `tips.js`).

**`puzzles.js`** — the puzzles and the Puzzle tab.
- `PUZZLES` holds three rows of five, keyed by graph type. Each has a target line
  (`flat` or `poly`) on its own axis (`d`, `x` or `v`); a few are still
  placeholders with no target.
- `renderPuzzles()` draws the menu, and `selectPuzzle()` opens one.
- `gradePuzzle()` compares the run to the target (the largest gap must be under
  `PUZZLE_TOL`) and shows the "solved" or "not quite yet" pop-up.
- `setMode()` switches between the three tabs.

**`create.js`** — the Create tab. `makePuzzleJson()` turns the last run into a
puzzle code, `parsePuzzleJson()` checks a pasted one, and `startTest()` lets you
play it in place.

**`ui.js`** — wiring for the controls, the light/dark theme (`applyTheme()`), the
logo and palette marble icons, and the hidden dev panel.

**`main.js`** — the starting point, loaded by `index.html`. Modules set up their
own buttons and listeners as they load. Everything that must happen *in order*
at start-up (theme, defaults, opening a puzzle from the URL, starting the loop)
happens here, after every module has loaded.

---

## House rules

Conventions this code follows. Please keep to them, so the next person can find
things.

### Tooltips

All tooltip text lives in **`js/tips.js`**, never in the HTML or other code.
- An element names its tip with a key: `<button data-tip="launch">`. The key
  points to `launch: '…'` in `tips.js`.
- Track pieces and the × button look up their keys in `input.js` (`'wall'`,
  `'wallBouncy'`, `'deletePiece'`, …).
- A palette chip's tip is its piece's tip plus one shared hint
  (`CHIP_HINT`), so that hint is written only once.

To **add** a tooltip, add `myKey: 'Text.'` to `tips.js` and `data-tip="myKey"`
to the element. A key that doesn't exist in `tips.js` shows no tooltip and
prints a warning in the browser console, so typos are easy to find.

### Special characters

Characters outside plain ASCII (–, −, ±, …, ✓, ★, 🔒, …) are written as
escapes, so they display correctly whatever encoding a server or editor assumes:
- **In JavaScript strings:** `'–'` (–). Emoji above `￿` use braces,
  e.g. `'\u{1F512}'` (🔒).
- **In HTML:** `&#x2013;`.

`tips.js` lists the codes it uses at the top. Code *comments* may use the plain
characters, since they never appear on screen.

### Colours and contrast

- **Colours are CSS variables** at the top of `style.css`: one set for the light
  theme and one for dark. Use a variable rather than a new hex code, so both
  themes keep working.
- **Text must meet WCAG AA contrast:** 4.5:1, or 3:1 for large text (24 px, or
  bold 18.7 px). The [WAVE](https://wave.webaim.org/) browser extension checks
  this.
- **Some variables exist only to pass contrast.** Use them for text:

  | Variable | Use it for |
  |---|---|
  | `--muted` | quiet labels |
  | `--accent-fill` | blue button backgrounds (`--accent` is for outlines and highlights) |
  | `--star` | puzzle stars |
  | `--ok` / `--err` | green and red text (the bright `--boost` / `--cut` piece colours are too light for text on cream) |

### Shared state

An `import` is a **live binding**: a module that imports `t`, `balls` or `mode`
always sees the current value. However, only the module that declares a
variable may assign to it; assigning to an import is an error. So:
- State that several modules change goes through a setter at the foot of
  `state.js` (`setSelected`, `setGraphType`, …).
- The piece lists are changed in place (`clearPieces`, `loadPieces`,
  `removePiece`), never replaced with a new array, so every module keeps
  pointing at the same list.

### Tuning values

When a number is being tuned by eye, put it on a slider in the dev panel (see
below) rather than editing and reloading. Hard-code it once the right value is
found.

---

## Controls

| Action | Mouse / touchpad | Touchscreen | Keyboard |
|---|---|---|---|
| Add a piece | drag a chip onto the track, **or** click the chip then click the track | tap the chip, then tap the track | — |
| Cancel adding | click the chip again | tap the chip again | Esc |
| Move a piece | drag it | drag it | select it, then ← → (1 m) |
| Delete a piece | click it, then its red ×; or drag it off the track; or double-click | tap it, then its × | select it, then Backspace / Delete |
| Deselect | click off the track | tap off the track | Esc |
| Set the launch position | drag the waiting marble, or use the slider | same | slider + arrow keys |

Clicking a wall also switches it between plain and bouncy.

---

## Puzzle codes

A puzzle code is `#` followed by URL-encoded JSON:

```
{ format: "launcher-puzzle", version: 1, metric, tolerance, target }
```

- `metric` is `"position"`, `"distance"` or `"speed"`, and it decides which
  graph the puzzle opens in. (Older codes that say `"velocity"` load as speed
  puzzles.)
- `target` is a list of `[time, value]` points, one every 0.25 s, plus the
  moments the motion changes all at once (a speed change, a wall, a bounce), so
  the target doesn't cut corners between 0.25 s points. On the position and
  distance graphs that's one extra point, the corner. On the speed graph an
  instant jump is two points at the same time (before and after), drawn as a
  vertical step; the grader also checks the run 0.1 s either side of it.

To play one, add it to the page address after the `#`, or paste it into the
Create tab's box.

---

## Dev tools

- **Dev panel.** Type `dev` anywhere on the page (not in a text box) to open it.
  It has:
  - a friction slider and logo tuning sliders;
  - **Clear level progress**;
  - **Show all puzzles**, which also unlocks every puzzle.

  Type `dev` again to close it.
- **Testing a puzzle code.** Paste `#…` after the page address, or into the
  Create box.
- **Saved progress.** Solved puzzles are stored in the browser under the
  `localStorage` key `launcher-puzzles`.

---

## Checking a change

There are no automated tests yet. Before committing:

1. Reload the page with the browser's developer console open, and check there
   are **no red errors and no `tips.js` warnings**.
2. Try the change in **both themes** (the moon/sun button, top right) and at a
   narrow and a wide window.
3. If you touched track pieces or input: add, move, select and delete a piece,
   by dragging *and* by click-then-click.
4. If you touched colours or text: run **WAVE** and check there are no new
   contrast errors.
