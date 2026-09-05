# CircuitLab — Front-End Architecture

Companion to [PRD.md](./PRD.md). This document is binding on implementation.

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, `src/`, static-exportable) | Requested. Routing + build pipeline; no server code is used. |
| Language | **TypeScript** (strict) | The sim engine is too intricate for JS. |
| UI | **React 19** | — |
| Styling | **Tailwind v4** + CSS variables for the design tokens | Fast, and part art needs raw SVG anyway. |
| Rendering | **SVG** (hand-authored React components) | Measured: Tinkercad is 100 % SVG. Gives us DOM hit-testing, CSS animation, crisp zoom, and free PNG/SVG export. |
| State | **Zustand** + Immer, with a snapshot ring for undo/redo | Same pattern as the sibling 3D project; solver runs outside React. |
| Blocks | **Blockly** (Apache-2.0) | Only permissive block editor. |
| Text editor | **CodeMirror 6** (MIT) | Modern, tree-sitter-ish, breakpoint gutter support. |
| Charts | inline SVG (oscilloscope/plotter are custom, not a chart lib) | Needs ring buffers at 60 fps. |
| Audio | **WebAudio** | Piezo/speaker tones. |
| Storage | **IndexedDB** (`idb-keyval`) + localStorage for prefs | Local-first, offline. |
| Math | own dense LU + sparse CSR solver | No permissive JS SPICE worth the weight; MNA is ~600 lines. |

**Licence rule inherited from the audit that seeded this project: nothing GPL or AGPL, ever.**
Every dependency above is MIT or Apache-2.0.

---

## 2. Module map

```
src/
├─ app/
│  ├─ layout.tsx                     root shell, fonts, theme vars
│  ├─ page.tsx                       dashboard: my designs, starters, new
│  └─ editor/[id]/page.tsx           the editor (client component)
│
├─ editor/                           ── UI SHELL ─────────────────────────────
│  ├─ EditorRoot.tsx                 composition: TopBar + Canvas + Dock + CodePanel
│  ├─ topbar/                        TopBar, DesignName, SimButton, SendToMenu
│  ├─ toolbar/                       Undo, Rotate, Delete, Notes, WireColor, ViewSwitch
│  ├─ dock/                          ComponentPanel, CategoryList, PartCard, SearchBox,
│  │                                 StartersDrawer
│  ├─ inspector/                     Inspector shell + field widgets (number, select,
│  │                                 colour, slider, unit-value, toggle)
│  ├─ code/                          CodePanel, ModeSwitch, BlocklyHost, TextEditor,
│  │                                 LibraryManager, SerialMonitor, SerialPlotter,
│  │                                 ErrorConsole, DebugBar
│  └─ instruments/                   Multimeter, PowerSupply, FunctionGen, Scope faces
│
├─ canvas/                           ── SVG SCENE ────────────────────────────
│  ├─ CanvasRoot.tsx                 <svg> + viewport transform + input router
│  ├─ LayerStack.tsx                 the fixed 21-layer <g> stack (§4)
│  ├─ Viewport.ts                    pan/zoom math, screen⇄world, fit-to-content
│  ├─ InputController.ts             pointer state machine (idle/pan/drag/wire/marquee)
│  ├─ items/PlacedPart.tsx           <g transform> wrapper + hit area + art
│  ├─ items/WireItem.tsx             two-pass painted path
│  ├─ items/NoteItem.tsx
│  ├─ overlays/SelectionOverlay.tsx  bbox, handles, rotate affordance
│  ├─ overlays/TerminalOverlay.tsx   hover dot, name tooltip, group highlight
│  ├─ overlays/MarqueeOverlay.tsx
│  └─ routing/orthoRoute.ts          right-angle route + 10-unit arc corners
│
├─ parts/                            ── COMPONENT LIBRARY ────────────────────
│  ├─ types.ts                       PartDef, TerminalDef, PropSchema, ArtProps
│  ├─ registry.ts                    id → PartDef, category index, search index
│  ├─ primitives/                    shared SVG atoms: Pin, DipBody, Leg, Silk,
│  │                                 ResistorBands, Bulb, PcbBoard, HoleGrid
│  └─ <category>/<part>/
│        def.ts                      metadata + terminals + props
│        Art.tsx                      SVG art (accepts live sim state)
│        model.ts                     electrical/behavioural model
│
├─ sim/                              ── SIMULATION ───────────────────────────
│  ├─ Simulation.ts                  orchestrator + fixed-step loop + snapshot commit
│  ├─ net/
│  │   ├─ UnionFind.ts
│  │   └─ buildNetlist.ts            placement + wires + breadboards → Netlist
│  ├─ mna/
│  │   ├─ Matrix.ts                  sparse CSR, LU with partial pivoting
│  │   ├─ Circuit.ts                 stamp API, node map, branch map
│  │   ├─ solveDC.ts                 Newton–Raphson + Gmin/source stepping
│  │   └─ transient.ts               backward-Euler / trapezoidal companions
│  ├─ devices/                       one file per electrical model, registered by part id
│  ├─ mcu/
│  │   ├─ McuEngine.ts               interface (interpreter today, avr8js later)
│  │   ├─ lexer.ts parser.ts ast.ts  Arduino-C++ front end
│  │   ├─ Interpreter.ts             tree-walking VM, cycle-budgeted, resumable
│  │   ├─ runtime/core.ts            pinMode…Serial, millis, tone, interrupts
│  │   └─ runtime/libs/*             Servo, LiquidCrystal, NeoPixel, Wire, SPI, EEPROM…
│  └─ instruments/                   meter maths + ring buffers
│
├─ code/
│  ├─ blockly/blocks.ts generators.ts toolbox.ts theme.ts
│  └─ arduino/highlight.ts completions.ts snippets.ts
│
├─ state/
│  ├─ designStore.ts                 document: parts, wires, notes, code  (undoable)
│  ├─ editorStore.ts                 ephemeral UI: selection, tool, viewport, panels
│  ├─ simStore.ts                    run state + latest snapshot (not undoable)
│  └─ history.ts                     snapshot ring, coalescing, transaction API
│
├─ persist/                          idb store, autosave, import/export, png, ino
└─ lib/                              geometry, ids, units, colour, hotkeys
```

---

## 3. Data model

```ts
// ─── document (undoable) ──────────────────────────────────────────────
interface Design {
  id: string; name: string; version: 1;
  parts:  Record<PartInstanceId, PartInstance>;
  wires:  Record<WireId, Wire>;
  notes:  Record<NoteId, Note>;
  code:   { mode: 'blocks'|'blocks+text'|'text'; blocksXml: string; text: string;
            libraries: string[]; breakpoints: number[] };
  view:   { pan: Vec2; zoom: number };
}

interface PartInstance {
  id: PartInstanceId;
  type: string;                      // PartDef.id
  x: number; y: number;              // world units, snapped to 5
  rotation: 0|30|60|…|330;           // 90° steps when socketed
  mirrored: boolean;
  name?: string;                     // user label
  props: Record<string, PropValue>;  // resistance, colour, capacity…
  z: number;                         // paint order within the layer
  locked?: boolean;
}

interface Wire {
  id: WireId;
  a: TerminalRef; b: TerminalRef;    // {partId, terminalName} | {free: Vec2}
  waypoints: Vec2[];                 // user bends, in world units
  color: WireColorKey;               // 0-9
  type: 'wire'|'jumper';
}
```

### Terminal descriptor — the load-bearing abstraction

Copied from the real product's DOM model:

```ts
interface TerminalDef {
  name: string;                      // "D13", "ae1", "+", "COL1"
  type: 'breadboard_male'            // a component leg that plugs in
      | 'breadboard_female'          // a socket that accepts a leg
      | 'wire'                       // wire-only tie point
      | 'probe';                     // instrument lead
  x: number; y: number;              // local coords, in 10-unit pitch space
  dir: [number, number];             // unit vector the wire leaves along
  group?: string;                    // internal-short group ("ae1", "rail_w")
  role?: 'power'|'gnd'|'analog'|'digital'|'pwm'|'passive';
}
```

`group` is what makes breadboards work with no special-casing: the breadboard part simply
declares 400 terminals with 100 distinct `group` values, and `buildNetlist` unions any
terminals that share a `(partInstance, group)` key. The exact same mechanism gives an IC its
internally-tied pins.

### PartDef

```ts
interface PartDef<P = any> {
  id: string; name: string; category: CategoryId;
  keywords: string[];
  size: { w: number; h: number };    // world units for bbox/hit area
  origin: Vec2;                      // rotation centre
  terminals: TerminalDef[] | ((props: P) => TerminalDef[]);   // dynamic for DIP-N, NeoPixel-N
  props: PropSchema[];               // drives the inspector, no bespoke UI per part
  defaults: P;
  Art: React.FC<ArtProps<P>>;        // pure SVG; receives props + live sim state
  Thumb?: React.FC;                  // panel card art (defaults to Art at fixed scale)
  model?: DeviceModelFactory;        // electrical behaviour
  socketable?: boolean;              // snaps into breadboard holes
  rotationStep?: 30 | 90;
}
```

`props` is a declarative schema — `{ key, label, kind:'number'|'select'|'color'|'slider'|
'unit', unit?, options?, min?, max?, step? }` — so the Inspector is one generic component
rendering any part. No part ships its own inspector UI.

`Art` receives `{ props, state, selected, simulating }` where `state` is that instance's
slice of the sim snapshot — this is how an LED's `Art` renders its glow from solved current
without any imperative DOM code.

---

## 4. Rendering architecture

### 4.1 Viewport
One `<svg width="100%" height="100%">`; inside it a single group:

```html
<g transform="scale(z, z) translate(tx, ty)">
```

Scale-then-translate (matching the observed product), so `tx/ty` are in world units and pan
maths stays zoom-independent. Screen→world is `(sx/z - tx, sy/z - ty)`.

### 4.2 The layer stack
A fixed ordered stack of `<g>` layers, mirroring the 21 observed on the real product,
collapsed to the 12 we actually need:

| # | Layer | Contents |
|---|---|---|
| 0 | `grid` | dot grid, only above a zoom threshold |
| 1 | `board-shadow` | breadboard/board drop shadows |
| 2 | `wire-shadow` | `#BFBFBF` under-stroke of wires |
| 3 | `parts` | all `PlacedPart` art |
| 4 | `part-overlay` | per-part sim overlays (LED glow, smoke, warning) |
| 5 | `wires` | two-pass wire paths |
| 6 | `wire-labels` | net voltage labels in debug view |
| 7 | `terminal-highlight` | `#7FBF34` group highlights |
| 8 | `terminals` | hover dots + hit areas |
| 9 | `selection` | bbox, handles |
| 10 | `interaction` | ghost part while dragging, in-progress wire, marquee |
| 11 | `notes` | annotations (always on top) |

Layers are React components reading from the store with narrow selectors, so moving one part
re-renders one `<g>`, not the scene.

### 4.3 Wire painting (measured behaviour)
Each wire emits **two `<path>` elements with the identical `d`**:
- halo: `stroke-width: 5`, colour `#BFBFBF` normally / `#3B8ED7` when selected, in layer 2
- core: `stroke-width: 2.5`, the wire colour, in layer 5

`d` is generated by `orthoRoute()`: terminal A → its `dir` stub → orthogonal Manhattan path
through waypoints → target `dir` stub → terminal B, with every corner replaced by
`A10,10 <sweep> 0,<flag> x,y` — the 10-unit arc corner observed in the product.

### 4.4 Performance
- Part art is `React.memo`'d on `(props, stateSlice, selected)`.
- The sim snapshot is a plain frozen object swapped atomically once per rAF; components
  subscribe to `snapshot.parts[id]` by reference equality.
- Hit-testing uses a transparent `<rect class="hitarea">` per part rather than the art
  geometry — matches the product's `hitarea` class and avoids per-path raycasts.
- Above ~300 parts the grid layer and terminal dots switch off automatically.

---

## 5. Simulation architecture

### 5.1 Pipeline

```
Design  ──buildNetlist──▶  Netlist  ──stamp──▶  MNA system  ──solve──▶  node V, branch I
   │                          │                                              │
   │                          └── terminal → net index map ◀─────────────────┘
   │                                                                          ▼
   └──────────────────────────────── device models ◀───────── SimSnapshot ────┘
                                          ▲
                                    McuEngine (pin drive / pin sense)
```

### 5.2 Netlist
`buildNetlist(design)`:
1. Every terminal of every placed part becomes a node candidate.
2. Union terminals sharing `(instanceId, group)`.
3. Union terminals joined by a wire.
4. Union a socketed part's leg with the breadboard hole it sits in — determined
   **geometrically**: leg world position rounded to the 10-unit hole lattice.
5. Ground selection: prefer an explicit GND terminal; else the most-connected net.
6. Emit `Netlist { nets, terminalToNet, devices }`, memoised until the design changes.

### 5.3 MNA
Standard formulation `[G B; C D][v; j] = [i; e]`. Each device implements:

```ts
interface DeviceModel {
  stampStatic?(c: Circuit): void;                 // once per topology change
  stampDynamic?(c: Circuit, dt: number): void;    // per timestep (C, L)
  stampNonlinear?(c: Circuit, v: Float64Array): void;  // per NR iteration
  commit?(v: Float64Array, dt: number): void;     // update internal state
  readOut?(v: Float64Array): DeviceOut;           // → snapshot (brightness, rpm…)
}
```

Nonlinear parts linearise around the last iterate (diode: `Is·(e^{v/nVt}−1)` → `Geq` + `Ieq`).
Convergence: NR to `1e-9` rel, ≤100 iterations, then Gmin stepping, then source stepping,
then report "circuit did not converge" the way the real product does.

### 5.4 MCU engine — front-end-only Arduino

`McuEngine` interface:
```ts
interface McuEngine {
  load(source: string): Diagnostic[];       // parse; [] = ok
  reset(): void;
  run(cycles: number): void;                // resumable; returns at delay/blocking IO
  pinDrive(pin: number): Drive;             // {mode:'out'|'in'|'inputPullup', v, rSeries}
  pinSense(pin: number, v: number): void;   // solver → MCU
  serialOut(): string[];  serialIn(s: string): void;
  breakpointHit?: { line: number; scope: Record<string, unknown> };
}
```

Implementation `InterpreterEngine`:
- **lexer → parser → AST** for the Arduino C++ subset (declarations, functions, structs,
  classes-as-library-objects, arrays, pointers-as-refs, all operators, control flow,
  preprocessor `#define`/`#include`).
- **Tree-walking VM with an explicit continuation stack**, so `delay()` suspends mid-tree and
  resumes on the next tick. No blocking, no Web Worker needed for correctness.
- **Cycle budget**: each statement carries a nominal cycle cost; `run(cycles)` returns when
  spent, keeping sketch time locked to simulated time (16 MHz nominal).
- **Arduino core + 11 libraries** implemented natively in TS against the pin/bus API, not
  interpreted — fast and exact.
- Digital output → solver as a 5 V source with 25 Ω series. `INPUT` → 100 MΩ. `INPUT_PULLUP`
  → 20 kΩ to 5 V. `analogWrite` → PWM duty averaged over the solver step. `analogRead` →
  10-bit quantised net voltage.

Isolated behind the interface so a compile-service + `avr8js` path can be added later
without touching the editor.

### 5.5 Loop and snapshot
`Simulation.tick()` runs on rAF, integrating fixed 100 µs substeps up to the elapsed wall
time (capped so a slow frame cannot spiral). Every frame it builds an immutable
`SimSnapshot { t, parts: Record<id, DeviceOut>, nets: Float64Array, serial: string[],
scope: RingBuffer[] }` and publishes it to `simStore`. React renders from the snapshot only.

---

## 6. State & history

- `designStore` holds the document. Every mutation goes through `transact(fn, label)` which
  applies via Immer and pushes the previous state into a bounded snapshot ring (100 entries).
  Drags coalesce: one transaction opened on pointerdown, committed on pointerup.
- `editorStore` holds selection, active tool, viewport, panel visibility, hover — never
  undoable, never persisted except viewport.
- `simStore` holds `running`, the current snapshot, and instrument settings.
- Autosave: `designStore` subscribes with a 800 ms debounce → IndexedDB.

---

## 7. Coordinate & unit conventions

| Quantity | Value |
|---|---|
| 1 world unit | 0.01 in (0.254 mm) |
| Breadboard / header pitch | **10 units** |
| Drag snap | **5 units** |
| Wire corner radius | **10 units** |
| Wire core / halo stroke | **2.5 / 5 units** |
| Terminal direction stub | **25 units** |
| Default zoom | 1.0 · range 0.1 – 6.0 |

Part art is authored in this unit space directly — an Uno is 685 × 533 units, a
400-pt breadboard is 640 × 210 units. No per-part scale factors.

---

## 8. Design tokens

```
--canvas-bg      #F4F5F6      --select        #3B8ED7
--wire-shadow    #BFBFBF      --net-highlight #7FBF34
--pcb-blue       #316E99      --silk          #FFFFFF
--header-dark    #292C2D      --header-mid    #3C4042
--bb-body        #E6E6E6      --bb-ring       #D1D1D1
--bb-ring2       #BFBFBF      --bb-bore       #383838
--warn           #E3B341      --danger        #C11F1F
```

Wire colour palette bound to number keys `0`–`9`:
`#171919` black · `#C11F1F` red · `#CC7A00` orange · `#E6C619` yellow · `#3D9E36` green ·
`#2E63B8` blue · `#7B3FB5` violet · `#8A5A2B` brown · `#9B9B9B` grey · `#FFFFFF` white.

---

## 9. Testing strategy

- **Solver**: golden-value unit tests against hand-computed circuits (divider, RC step, diode
  clamp, BJT switch, op-amp inverting) — tolerance 1e-6.
- **Netlist**: fixture designs → expected net partitions.
- **Interpreter**: a corpus of real Arduino sketches → expected serial output traces.
- **Routing**: property test that `orthoRoute` output is axis-aligned between arcs and starts
  along each terminal's `dir`.
- **Visual**: headless screenshots of every part at 4 rotations (per the sibling project's
  lesson: WebGL/SVG panes need headless capture, not the in-app browser).

---

## 10. Build order

Phases as listed in PRD §7. Each phase ends with the app running and demoable; no phase
leaves the tree broken.
