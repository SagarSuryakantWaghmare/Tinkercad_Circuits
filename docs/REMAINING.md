# Completion plan — closing the gap to Tinkercad Circuits

Written after inspecting a live Tinkercad design's rendered DOM, which exposes
their internal part class names and — more usefully — the names of their
**on-part interactive controls**. Those names are the evidence behind Phase A.

Observed control classes: `slider-brightness`, `slider-temperature`,
`slider-tilt`, `target_area` / `target_line` / `target_range`,
`button-volt` / `button-ampere` / `button-resistance` (+ `-active` variants),
`orientation-north/south/east/west`, `rpm`, `gas1/gas2/gas3`, `knob`,
`servohorn`, `battery_aa_1_cell` … `battery_aa_4_cell`.

**Status: every phase below is complete.** What each one turned into is
recorded under it; the summary lives in [STATUS.md](STATUS.md).

---

## Phase A — On-part interactive controls ✅

Tinkercad does **not** use drag-anywhere gestures for sensors. Each sensor
carries a visible control you grab, and the meter carries its own mode buttons.
Ours used invisible drag areas, which worked but was not discoverable.

| Part | Tinkercad control | Now |
|---|---|---|
| Photoresistor | brightness slider + light-source icon | log slider, moon → sun icons |
| Temperature sensor | temperature slider, °C readout | −40…125 °C slider |
| Tilt sensor | tilt slider with orientation arrows | on-part toggle |
| Ultrasonic | draggable **target line** with a range band | target line, 0–400 cm |
| Multimeter | **V / A / Ω / continuity buttons on the meter face** | four face buttons, dial follows |
| Gas sensor | gas concentration slider | slider |
| Force / flex / soil / water / sound | sliders | sliders |
| PIR | motion toggle | toggle |
| Power supply | voltage + current knobs | two turnable knobs |
| Function generator | wave buttons, freq/ampl knobs | four wave buttons + two knobs |
| Oscilloscope | time/div, volts/div knobs | two detented knobs |

Built as one reusable control set in `src/parts/simControls.tsx`
(`PartSlider`, `PartButton`, `PartToggle`, `PartKnob`, `TargetLine`). Controls
that must persist — a meter's range, a supply's voltage — write the document
through the new `ArtProps.setProp`; transient sensor readings still go through
`interact`.

## Phase B — Components still missing ✅

Sixteen parts added, taking the catalogue from 140 to 156.

- **4-digit 7-segment display** — twelve pins, multiplexed, with the
  persistence-of-vision decay a scanned display needs to read steadily
- **IR Remote** — a 21-key handset; holding a key transmits its NEC code and
  every IR receiver in the design pulls its OUT line low
- **Incandescent lamp** — tungsten filament with a real cold/hot resistance
  ratio, so the inrush current is visible before it settles
- **Battery cell-count art** — 1–8 cells drawn end to end, terminals following
- **Relay module (5V)** — on-board driver, active-high/low, screw block
- **Photo-interrupter** — emitter, slot and phototransistor
- **Bi-colour LED**, **IR LED**
- **Trimmer capacitor**, **crystal oscillator**
- **74HC02 / 04 / 08 / 32 / 86** — every gate on the die wired, not just the first
- **74HC138** 3-to-8 decoder, **74HC4051** 8-channel analog multiplexer

Every DIP part in the catalogue also grew visible legs, from one change to
`DipBody`.

The **micro:bit edge-connector breakout** was deliberately left out: without a
mating model it would be a part you cannot wire to anything, which is worse
than not shipping it.

## Phase C — Arduino code panel ✅

- **Step Over** while paused — one statement at a time, in both the C++ and the
  MicroPython VM
- **Variable inspector** — a Variables tab listing the paused scope chain
- **Copy code** to the clipboard
- **Clear breakpoints** from the panel
- **Panel maximise / restore**
- Breakpoints saved in a design are now restored when it runs again; they used
  to be dropped unless the gutter was clicked in that session

## Phase D — Editor completeness ✅

- **Right-click context menu** — duplicate, rotate, mirror, stacking order,
  zoom to selection, add a note, delete, shortcuts; right-clicking a part
  selects it first
- **Keyboard shortcuts dialog** (`?`, or the toolbar button)
- **Component name shown on the canvas**, counter-rotated so it stays upright
- **Simulation elapsed-time readout** next to the component count
- **Zoom to selection** (`Shift F`), **mirror** (`M`), **stacking order**
  (`[` / `]`), **start/stop** (`S`), **code panel** (`C`)
- **Wire type** — jumpers now draw as straight leads rather than orthogonal
  routes, so the setting means something

## Phase E — Verify ✅

`tsc --noEmit` clean, `eslint src` clean, `next build` (static export) clean,
and all 33 starters run headlessly with no parse error, no runtime error, no
singular matrix and Newton converged.

Three real bugs surfaced while verifying, all fixed:

1. **`x / 3.0` truncated like integer division.** C decides this from operand
   *types*, and `3.0` holds a whole number, so testing the values was always
   going to be wrong. Division now asks a static `isRealExpr` predicate.
   `analogRead(A0) * (5.0 / 1023.0)` — the most common line in any sketch —
   silently returned zero before this.
2. **Library class declarations were dropped.** `LiquidCrystal lcd(12, 11, 5,
   4, 3, 2);` was skipped because `LiquidCrystal` is declared by no line in the
   file, so the parser did not recognise it as a type.
3. **…and then parsed as a function prototype** once it was recognised — the
   most vexing parse. Resolved the way C++ does: parentheses that cannot hold
   parameter declarations make it a construction.

The LCD and NeoPixel starters were broken by (2) and (3); both now render text
and colours.
