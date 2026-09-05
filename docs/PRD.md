# CircuitLab — PRD

**A 1:1 front-end replica of Tinkercad Circuits.**
No backend. No auth. No server compile. Everything runs in the browser.

Version 1.0 · Owner: Sagar · Status: Approved for build

---

## 1. Product definition

### 1.1 What we are building

A browser-based electronics design + simulation editor that reproduces the complete
Tinkercad Circuits experience: drag components onto a 2-D workspace, wire them together
on a breadboard, configure them in an inspector, write Arduino code as blocks or text,
press **Start Simulation**, and watch the circuit come alive — LEDs light, motors spin,
servos sweep, the LCD prints, the multimeter reads, the oscilloscope traces, and an
over-current part burns out with a puff of smoke.

### 1.2 What we are explicitly NOT building

| Not in scope | Why |
|---|---|
| Server-side C++ → .hex compilation | Front-end only. Replaced by an in-browser Arduino interpreter (§5.3). |
| User accounts, sharing, Classrooms, Gallery backend | Front-end only. Replaced by local-first storage + file import/export. |
| The Tinkercad 3D editor / Codeblocks | Separate products. |
| Autodesk trade dress, the Tinkercad name/logo, Arduino word mark | Trademarks. We ship our own identity and call the board "Uno-compatible". |

### 1.3 Non-negotiable success criteria

1. Every component category and every part listed in §4 exists, is draggable, has correct
   terminals, has an inspector, and has a simulation behaviour.
2. All three breadboards (Mini/Small/Full) with correct internal net topology.
3. Wiring feels identical: click-drag terminal→terminal, right-angle routing with rounded
   corners, colour by number key, bendable, deletable.
4. Simulation is electrically real: a Modified Nodal Analysis solver, not a lookup table.
5. Code editor supports **Blocks**, **Blocks + Text**, and **Text** with live two-way sync
   from blocks, plus Serial Monitor, Serial Plotter, error console, and breakpoint debugger.
6. Undo/redo, copy/paste, multi-select, rotate, notes, zoom-to-fit — all with Tinkercad's
   keyboard shortcuts.
7. Ships as a static Next.js export. Opens with no network.

---

## 2. Reference behaviour captured from the live product

These were measured directly from a live Tinkercad Circuits embed, not guessed. They are
binding on the implementation.

| Fact | Value |
|---|---|
| Render technology | **SVG**, zero `<canvas>`. 61 nested SVGs on a simple design. |
| Scene root | `<svg width="100%" height="100%">` → one `<g transform="scale(z,z) translate(tx,ty)">` |
| Z-order | A fixed stack of **21 sibling `<g>` layers** inside the zoom group |
| Component node | `<g id="..." transform="translate(x,y) rotate(deg) scale(sx,sy)">` |
| Grid pitch | **10 units** = 0.1 in (Uno header pins measured at x = −61, −51, −41, −31, −21, −11, −1, 9) |
| Drag snap | **5 units** (half-pitch) |
| Terminal node | `<g class="terminal">` + `<desc class="terminalname">D13</desc>` + `<desc class="terminaltype">breadboard_female</desc>` + `<desc class="terminalgroup">ae1</desc>` + a `<line>` giving origin **and exit direction** (25 units long) |
| Wire geometry | `M…L…` with `A10,10` arc corners → **10-unit corner radius** |
| Wire painting | Drawn twice: 5 px halo underneath, 2.5 px coloured core on top |
| Selection colour | `#3B8ED7` |
| Terminal-group highlight | `#7FBF34`, a line spanning the 5 holes of the group |
| Breadboard net names | `ae1…ae30`, `fj1…fj30`, rails `w`, `x`, `y`, `z` |
| Board PCB blue | `#316E99` · silkscreen `#FFFFFF` · headers `#292C2D` / `#3C4042` |
| Breadboard body | `#E6E6E6` · hole ring `#D1D1D1`/`#BFBFBF` · hole bore `#383838` |
| Canvas background | `#F4F5F6` |

Consequence: **we render in SVG with the same layer stack, the same 10-unit pitch, the same
terminal descriptor model, and the same two-pass wire painting.** This is the single most
important architectural decision and it is settled by observation.

---

## 3. Feature inventory

### 3.1 Editor shell

- **Top bar** — logo, editable design name, Notes-visibility toggle, **Start/Stop
  Simulation**, **Send To** (export), **Share** (disabled/local), **Code** toggle, product
  switcher.
- **Left rail on canvas** — Zoom-to-fit, Zoom in/out.
- **Toolbar above canvas** — Undo, Redo, Rotate, Delete, Notes, Annotation visibility,
  Wire-colour picker, Wire-type picker, Component-view switch (Top / Wires / Schematic).
- **Right dock** — Components panel with: view selector (`Basic` / `All` / `Starters`),
  search box, category list, part cards with thumbnail + name, and drag-out-to-place.
- **Starters drawer** — Basic, Arduino, micro:bit, Circuit Assemblies. Drag a whole
  pre-wired circuit (components + wires + code) into the workspace.
- **Inspector** — a floating card anchored to the selected part; name field, per-part
  property fields (§4), rotate/mirror/delete buttons.
- **Code panel** — slides up from the bottom; mode selector `Blocks` / `Blocks + Text` /
  `Text`; Blockly workspace; read-only or editable CodeMirror; library manager;
  Serial Monitor + Serial Plotter tabs; error console; debugger controls.
- **Notes** — sticky annotations anchored to the canvas or to a component.

### 3.2 Canvas interactions

| Action | Behaviour |
|---|---|
| Pan | drag empty space · space+drag · middle-drag |
| Zoom | wheel · pinch · `Ctrl +/−` · buttons |
| Zoom to fit | `F` |
| Place | drag from panel, or click part then click canvas |
| Select | click · shift-click to add · marquee drag |
| Move | drag; snaps to 5-unit grid; snaps into breadboard holes |
| Rotate | `R` — 30° for free parts, 90° when socketed |
| Mirror | inspector button |
| Delete | `Del` / `Backspace` |
| Copy / Paste / Duplicate | `Ctrl+C` / `Ctrl+V` / `Ctrl+D` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Select all | `Ctrl+A` |
| Wire | click a terminal → click intermediate points → click target terminal; `Esc` cancels |
| Wire colour | select wire, press `0`–`9` |
| Wire bend | drag a segment; drag a corner |
| Note | `N` create · `Shift+N` toggle visibility |
| Terminal hint | hovering a terminal shows its name + highlights its whole net group in `#7FBF34` |

### 3.3 Simulation

- **Start Simulation** switches the app into run mode: the netlist is extracted, the solver
  initialises, the MCU interpreter boots, and a fixed-step loop begins.
- Live, per-frame: LED brightness/colour, 7-seg and LCD glyphs, motor rotation animation,
  servo arm angle, buzzer audio (WebAudio), NeoPixel colours, relay clack, meter readouts.
- **Interactive during run**: press buttons, flip switches, turn pots, slide the light
  level on an LDR, set temperature on the TMP36, set distance on the ultrasonic sensor,
  wave the PIR, tilt the micro:bit.
- **Failure modes**: exceeding a part's power/current rating turns it red, shows a
  lightning/burn overlay and a warning toast; shorting a battery warns.
- **Instruments**: multimeter (V/A/Ω/continuity), power supply (V + current limit),
  function generator (sine/square/triangle/sawtooth, amplitude, frequency, DC offset),
  oscilloscope (2-channel, time/div, volts/div, trigger).
- **Serial Monitor** — 9600/…/115200 baud, TX box, timestamp, autoscroll, clear.
- **Serial Plotter** — parses numeric lines, plots multiple traces.

### 3.4 Code

- **Blocks**: Output, Input, Notification, Control, Math, Variables, Functions — the
  Tinkercad block set, colour-matched.
- **Blocks + Text**: split view, blocks left, generated C++ right, read-only, live-synced.
- **Text**: full editor, C++ syntax highlighting, autocomplete on the Arduino API,
  bracket matching, line numbers, breakpoint gutter.
- **Blocks → Text is one-way.** Switching to Text warns that it cannot be undone.
- **Libraries**: a library manager listing the built-in libraries (Servo, LiquidCrystal,
  Adafruit_NeoPixel, SoftwareSerial, Wire, SPI, EEPROM, Stepper, TimerOne, IRremote,
  Adafruit_LiquidCrystal).
- **Debugger**: click the gutter to set a breakpoint; on hit, execution pauses, Resume and
  Step Over appear, hovering a variable shows its live value.
- **Error console**: auto-opens on a parse/type error, points at the line.
- **Export**: download `.ino`.

### 3.5 Project / files (local-first)

- Dashboard listing saved designs with thumbnails, rename, duplicate, delete.
- Autosave to IndexedDB.
- **Send To / Export**: `.circuit.json` (our native format), `.ino`, component list as CSV,
  and PNG of the canvas.
- **Import**: `.circuit.json`.

---

## 4. Component catalogue

`P` = has inspector properties. `S` = has an electrical simulation model.
`I` = interactive during simulation.

### 4.1 Breadboards
| Part | Notes |
|---|---|
| Breadboard Mini (170 pt) | 17 columns × (a–e / f–j), no power rails |
| Breadboard Small (400 pt) | 30 columns, 4 rails `w x y z` |
| Breadboard (830 pt, Full+) | 63 columns, 4 rails, centre gutter |

### 4.2 General (passive)
Resistor `P S` (E24 value + tolerance + power) ·
Capacitor (ceramic) `P S` ·
Electrolytic Capacitor `P S` (polarised, reverse-voltage failure) ·
Inductor `P S` ·
Diode `S` (1N4148) ·
Zener Diode `P S` ·
Schottky Diode `S` ·
Bridge Rectifier `S` ·
Fuse `P S` (blows) ·
Thermistor NTC `P S I` ·
Trimmer Resistor `P S I`

### 4.3 Input
Pushbutton `S I` ·
Pushbutton 12 mm `S I` ·
Slideswitch SPDT `S I` ·
Toggle Switch `S I` ·
DIP Switch (2/4/8) `P S I` ·
Rotary Potentiometer `P S I` ·
Trimmer Potentiometer `P S I` ·
Slide Potentiometer `P S I` ·
Photoresistor (LDR) `S I` ·
Phototransistor `S I` ·
Photodiode `S I` ·
Temperature Sensor [TMP36] `S I` ·
Flex Sensor `S I` ·
Force Sensor (FSR) `S I` ·
Soil Moisture Sensor `S I` ·
Gas Sensor `S I` ·
Flame Sensor `S I` ·
Water Level Sensor `S I` ·
PIR Motion Sensor `S I` ·
Ultrasonic Distance Sensor (4-pin HC-SR04) `S I` ·
Ultrasonic Distance Sensor (3-pin PING) `S I` ·
IR Receiver `S I` · IR Remote `I` ·
Tilt Sensor `S I` ·
Vibration Sensor `S I` ·
Hall Effect Sensor `S I` ·
Magnetic Reed Switch `S I` ·
Sound Sensor / Microphone `S I` ·
Rotary Encoder `S I` ·
Keypad 4×4 `S I` ·
Joystick `S I` ·
Limit Switch `S I` ·
RTC Module DS1307 `S`

### 4.4 Output
LED (5 mm; red/green/blue/yellow/white/orange/IR) `P S` ·
LED 10 mm `P S` ·
RGB LED (common cathode / common anode) `P S` ·
LED Bar Graph (10-seg) `S` ·
7-Segment Display 1-digit `P S` ·
7-Segment Display 4-digit `S` ·
LED Matrix 8×8 `S` ·
NeoPixel (single WS2812) `S` ·
NeoPixel Ring (12/16/24) `P S` ·
NeoPixel Strip `P S` ·
LCD 16×2 `S` · LCD 16×2 I²C `S` · LCD 20×4 `S` ·
OLED SSD1306 128×64 `S` ·
DC Motor `P S` ·
Hobby Gearmotor `P S` ·
Micro Servo (positional) `S` ·
Continuous-Rotation Servo `S` ·
Stepper Motor (unipolar / bipolar) `P S` ·
Vibration Motor `S` ·
Piezo Buzzer `S` (WebAudio) ·
Speaker `S` ·
Solenoid `S` ·
Relay Coil indicator `S`

### 4.5 Power
9 V Battery `P S` ·
1.5 V AA Battery `P S` (series count) ·
1.5 V AAA Battery `P S` ·
3 V Coin Cell `P S` ·
Battery Pack 4×AA `P S` ·
9 V Battery + Barrel Connector `S` ·
Solar Panel `P S I` (illumination slider) ·
Bench Power Supply `P S I` ·
VCC / GND rail symbols `S`

### 4.6 Microcontrollers
Uno-compatible board (ATmega328P) `S` ·
Nano-compatible board `S` ·
ATtiny85 `S` ·
micro:bit v2 `S I` (accelerometer, compass, buttons A/B, 5×5 LED, speaker) ·
micro:bit breakout `S`

### 4.7 Instruments
Multimeter `P S I` (V / A / Ω / continuity) ·
Bench Power Supply `P S I` ·
Function Generator `P S I` ·
Oscilloscope (2-ch) `P S I`

### 4.8 Integrated circuits
555 Timer `S` ·
Op-Amp (single / dual) `S` ·
Comparator LM339 `S` ·
Voltage Regulator 7805 / LM317 `P S` ·
Shift Register 74HC595 `S` ·
Shift Register 74HC165 `S` ·
Decade Counter CD4017 `S` ·
Binary Counter CD4026 `S` ·
BCD → 7-seg CD4511 `S` ·
H-Bridge L293D `S` ·
Darlington Array ULN2003A `S` ·
Optocoupler 4N35 `S` ·
ADC MCP3008 `S` ·
EEPROM 24LC256 `S`

### 4.9 Power control
NPN Transistor (BJT) `P S` ·
PNP Transistor (BJT) `P S` ·
NPN Darlington TIP120 `S` ·
PNP Darlington TIP125 `S` ·
N-channel MOSFET `P S` ·
P-channel MOSFET `P S` ·
Power MOSFET IRF520 `S` ·
Relay SPDT `P S` ·
Relay DPDT `P S` ·
Solid-State Relay `S` ·
Motor Driver L293D `S` ·
Motor Driver DRV8833 `S` ·
Voltage Regulator (5 V / 3.3 V) `P S` ·
SCR / Triac `S`

### 4.10 Connectors
8-pin Header (male) · 8-pin Header (female) · 40-pin Header ·
USB Type-B Connector · Screw Terminal Block (2/3-way) ·
Jumper Wire · Alligator Clip Lead · Barrel Jack · JST Connector

### 4.11 Logic
AND · OR · NOT · NAND · NOR · XOR · XNOR · Buffer (each `P` for input count) ·
D Flip-Flop · JK Flip-Flop · SR Latch · T Flip-Flop ·
Half Adder · Full Adder · 4-bit Adder ·
2→1 / 4→1 / 8→1 Multiplexer · 1→4 Demultiplexer ·
3→8 Decoder · 8→3 Encoder · BCD Decoder ·
4-bit Comparator · 4-bit Counter · 4-bit Shift Register ·
Clock Generator `P I` · Logic Toggle `I` · Logic Probe/LED

### 4.12 Networking
ESP8266 Wi-Fi Module (non-programmable, as in Tinkercad) ·
Bluetooth HC-05 (non-programmable) ·
nRF24L01 (non-programmable)

**Catalogue total: ~150 distinct parts across 11 categories.**

---

## 5. Simulation requirements

### 5.1 Netlist extraction
Union-Find over terminals, joined by (a) wires, (b) breadboard internal groups, (c) internal
shorts declared by a part. Produces `nets: Net[]` where each net has an id, a member terminal
list, and a solved node voltage.

### 5.2 Analog engine
Modified Nodal Analysis with:
- Linear stamps: R, V, I, VCVS/CCVS (op-amp, dependent sources), ideal switch.
- Companion models with Newton–Raphson for: diode, LED, Zener, BJT (Ebers–Moll),
  MOSFET (level-1), photodiode.
- Backward-Euler / trapezoidal companion models for C and L → transient analysis.
- Adaptive time step, convergence with Gmin stepping and source stepping fallback.
- Targets: **DC operating point, transient**. (AC sweep is not a Tinkercad feature.)

### 5.3 MCU engine — the front-end-only decision
Tinkercad compiles C++ on a server. We cannot. Therefore:

> We ship a **TypeScript Arduino-C++ interpreter**: lexer → parser → AST → tree-walking VM,
> covering the C++ subset that Arduino sketches actually use (types, arrays, structs, enums,
> pointers-as-references, functions, classes for library objects, control flow, operators,
> `#define`/`#include`), plus a faithful implementation of the Arduino core API and the 11
> bundled libraries.

The VM is driven by a cycle budget per simulation tick so `delay()`, `millis()`, `micros()`,
PWM and timers behave in real time relative to the analog solver. Digital pins present to the
MNA solver as an ideal source with series resistance (output) or a high-Z sense node (input).

The interpreter is isolated behind a `McuEngine` interface so a WASM `avr8js` + hex path can
be added later without touching the rest of the app.

### 5.4 Simulation loop
```
requestAnimationFrame
  └ for each substep (fixed dt, default 100 µs, adaptive):
      1. MCU: run cycle budget → pin drive changes
      2. Devices: update behavioural state (servo target, motor inertia, sensor value)
      3. Analog: stamp + solve MNA at t → node voltages, branch currents
      4. Devices: read back (LED current → brightness, motor current → rpm)
      5. Instruments: sample into ring buffers
  └ commit a render snapshot to React (throttled to 60 fps)
```
Solver runs off the React render path; the UI reads an immutable snapshot.

---

## 6. Quality bar

- 60 fps pan/zoom with 200 components and 400 wires on the canvas.
- Simulation keeps real-time on a mid-range laptop for a 20-component circuit.
- Full keyboard accessibility on the panel and inspector; canvas is mouse-first with
  keyboard nudge.
- Works offline after first load; static export, no server routes.
- Zero GPL/AGPL dependencies (per the licensing audit that seeded this project).

---

## 7. Delivery phases

| Phase | Contents |
|---|---|
| **0** | Repo, Next.js, Tailwind, stores, docs |
| **1** | SVG canvas: layer stack, pan/zoom, grid, selection, marquee, transform model |
| **2** | Part framework + registry + inspector + panel + drag-to-place; first 12 parts |
| **3** | Wiring: routing, corner radius, two-pass paint, colours, bend/split, terminal snap |
| **4** | Breadboards ×3 + net extraction + Union-Find + group highlight |
| **5** | MNA solver + companion models + DC/transient; LED/R/battery/switch live |
| **6** | Full catalogue build-out, all 11 categories |
| **7** | MCU: lexer/parser/VM + Arduino core API + peripherals |
| **8** | Code panel: CodeMirror text mode, libraries, Serial Monitor + Plotter, errors, debugger |
| **9** | Blockly blocks + C++ generator + Blocks/Blocks+Text/Text modes |
| **10** | Instruments: multimeter, PSU, function generator, oscilloscope |
| **11** | Starters, notes, dashboard, import/export, PNG, .ino |
| **12** | Polish: shortcuts, failure/smoke effects, perf pass, offline export |
