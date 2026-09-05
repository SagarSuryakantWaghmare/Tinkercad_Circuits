# CircuitLab — build status

Against the phase plan in [PRD.md](./PRD.md) §7.

| Phase | Status |
|---|---|
| 0 · Repo, Next.js, stores, docs | **done** |
| 1 · SVG canvas, pan/zoom, selection, transform model | **done** |
| 2 · Part framework, registry, inspector, panel, drag-to-place | **done** |
| 3 · Wiring: routing, arc corners, two-pass paint, colours | **done** |
| 4 · Breadboards ×3, net extraction, group highlight | **done** |
| 5 · MNA solver, companion models, DC + transient | **done** |
| 6 · Full catalogue, all categories | **done** — 156 parts / 12 categories |
| 7 · MCU: lexer, parser, VM, Arduino core + libraries | **done** |
| 8 · Code panel, serial monitor + plotter, errors, debugger | **done** |
| 9 · Blockly, C++ generator, three code views | **done** |
| 10 · Instruments | **done** |
| 11 · Starters, notes, dashboard, import/export | **done** |
| 12 · Polish: shortcuts, failure effects, perf, static export | **done** |
| 13 · On-part controls, second wave of parts, debugger, editor | **done** — see [REMAINING.md](./REMAINING.md) |

## Phase 13 in brief

- **On-part controls.** Sensors carry a visible slider, meters carry their own
  range buttons, instruments carry knobs — matching how the reference product
  works, and replacing invisible drag areas that nobody could find.
- **Sixteen more parts**, including a multiplexed 4-digit display, an IR remote
  that actually drives the IR receiver, an incandescent lamp with filament
  inrush, a relay module and seven 74HC logic packages with every gate wired.
- **A real debugger**: step over, a variable inspector reading the paused scope,
  and breakpoints that survive saving a design.
- **Editor**: right-click menu, a shortcuts sheet, on-canvas component names,
  elapsed simulated time, zoom to selection, and jumper-vs-wire routing.
- **Three interpreter bugs fixed**, found by running every starter headlessly:
  float division truncating like integer division, library class declarations
  being dropped, and the most vexing parse. See REMAINING.md § Phase E.

## What is deliberately not built

**micro:bit edge-connector breakout.** Without a mating model a breakout board
is a part you cannot wire to anything.

**Accounts, sharing, embedding, Classrooms.** Out of scope by the brief: this
build is front-end only. The equivalents are local designs in IndexedDB and
`Send To → Design file` for moving one anywhere.

**Server-side compilation.** Not possible without a backend. Arduino code runs
on the interpreter in `sim/mcu` instead — see PRD §5.3 for why, and for how an
`avr8js` + compile-service path would slot in later.

**Interactive lessons.** Tinkercad's guided lesson sidebar with step validation
is a curriculum-delivery layer rather than an editor feature.

## Trade dress

No third-party word marks or logos anywhere in the UI or on any part: the
microcontroller board is "Uno R3" with functional pin names only, and the
product is CircuitLab. Every dependency is MIT or Apache-2.0 — nothing GPL or
AGPL — per the licensing audit that seeded this project.

## Running it

```bash
npm run dev     # http://localhost:8470
npm run build   # static export to ./out — no server needed
```

Dev-only console handles: `window.__cl` (stores, part registry, starter list,
netlist builder) and `window.__sim` (`sim.debugNets()` returns solver
diagnostics, per-device state, pin states and the serial buffer; `sim.step(dt)`
advances the simulation by hand, which is how the starters were verified
without waiting on animation frames).
