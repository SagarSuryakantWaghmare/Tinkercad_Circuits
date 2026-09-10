# CircuitLab — Improvement Plan

What we build next, why, and how we will know it worked.

[STATUS.md](STATUS.md) records what exists. [REMAINING.md](REMAINING.md)
recorded the plan that closed the last round of gaps. This one looks forward: it
compares us against Tinkercad Circuits feature by feature, and marks the places
where we should stop copying it and beat it instead.

---

## 0. How this document was produced

Three inputs, kept separate so the reader can tell fact from judgement:

1. **A code audit** of this repository. Every claim about *our* behaviour was
   checked against the source, not remembered.
2. **Measurements against the running app**, driving the simulator through the
   dev handles. Every number here was measured — see
   [Appendix A](#appendix-a--our-measurements).
3. **Research into Tinkercad Circuits**, including a read of their shipped
   simulation bundle (`circuits-compiled.js`), which contains their device
   models, failure thresholds and message strings. Quoted thresholds and
   messages in §3.1 are verbatim from that bundle, not inferred from behaviour.

Judgement calls are marked as such.

---

## 1. The ten things that matter most

Ordered by value per unit of work.

This was the opening assessment. Status is kept current, because a plan that
still describes solved problems is worse than no plan.

| # | Item | Status |
|---|---|---|
| 1 | A shared failure framework across all parts | **done** |
| 2 | Surface the failure to the user | **done** — badge on the part, panel with the remedy |
| 3 | Fail the things Tinkercad *can't* | **done** — batteries, resistors, transistors, motors, and a dead short |
| 4 | Properties for the components that have none | **in progress** — 65 of 165 have them, up from 58 of 156 |
| 5 | Breadboard size as a property | **done** — three parts became one |
| 6 | Per-board code | **done** — two Unos can run different sketches |
| 7 | Wire bend points | **done** — drag to reshape, double-click to add |
| 8 | Sparse solver | **partly** — ceiling moved 150 → 250 components; 500 still needs it |
| 9 | Component descriptions | **done** — panel hover and inspector |
| 10 | Bill of materials export | **done** — Send To → Component list |

---

## 2. Where we stand today (measured)

The figures below are the **original audit**, kept as the baseline the work was
measured against. Where they have moved, the current value follows.

```
156 → 165 components across 12 categories   Tinkercad: 110 across the same 12
 33 → 26 marked "Basic"                     Tinkercad: 26 (matched deliberately)
 58 → 65 have editable properties         → 100 still have none
  4 → most can fail                         (was resistor, capacitor, LED, fuse only)
  4 programmable boards, each with its own program now
  2 languages                               Arduino C++, MicroPython
 33 starter circuits                        Tinkercad: 67 — still a gap
```

Our twelve category headings turn out to match theirs exactly — General, Input,
Output, Power, Breadboards, Microcontrollers, Instruments, Integrated Circuits,
Power Control, Networking, Connectors, Logic. Their **Networking category is
empty**: the ESP8266 was withdrawn for security reasons and is now shown with a
deprecation notice. We ship three working parts there.

Simulation throughput, measured on this machine:

| Components | Solver nodes | Before | After reusing the LU buffer |
|---|---|---|---|
| 20 | 40 | 37× real time | **44×** |
| 60 | 120 | 2.8× | **9.5×** |
| 120 | 240 | 2.7× | **4.2×** |
| 240 | 480 | 0.2 – 0.5× | **0.69×** |
| 500 | 1000 | — | **0.15×** |

The solver was allocating a fresh copy of the whole matrix on every Newton
iteration — over a megabyte at a few hundred unknowns, several iterations a
timestep, a thousand timesteps a second. Reusing one buffer roughly tripled
throughput in the middle of the range.

Practical ceiling is now around **250 connected components** rather than 150.
Getting to 500 at real time still needs the sparse solver: the forward and
back substitutions are O(n²) regardless of how sparse the matrix is, and at
1000 unknowns that is two million multiply-adds per solve on a matrix with
perhaps five thousand nonzeros.

Two things already right: an empty breadboard contributes **0 solver nodes**
(unconnected terminals are pruned), and netlist extraction is not a bottleneck
(6.2 ms at 240 components).

---

## 3. Gap analysis

### 3.1 Failure and damage — the headline

This is the most valuable area in the document, because it is simultaneously the
feature our own testing showed to be the most compelling, **and** the weakest
part of the product we are measured against.

#### What Tinkercad actually does

Their model has exactly two states, and no modal ever appears for component
damage:

- **Warning** — a black-and-white `!` badge on the part. It keeps working.
- **Breakdown** — a **red 16-point starburst with a yellow outline** drawn over
  the part (`fill:#FF0000; stroke:#F7E60B; opacity:0.7`). No smoke, no charring,
  no animation.

The reason is written to the SVG group's `title` and shown as a **hover
tooltip**. Nothing is logged; there is no failure history.

Their messages already state the measured value and the rating. Verbatim:

> `Current through the LED is %1, while absolute maximum is %2.`
> `Current through I/O pin(s) %1 exceeds the absolute maximum of %2. This may permanently damage the Arduino.`
> `Capacitor picked up %1, while maximum voltage rating is %2.`
> `Supply voltage is %1, while permitted range is between %2 and %3.`

Their thresholds, useful directly as implementation targets:

| Part | Warning | Breakdown |
|---|---|---|
| LED | > 20 mA | ≥ 120 mA |
| Arduino pin | > 20 mA | > 40 mA (or > 200 mA total across pins) |
| Light bulb | — | > 0.25 A (48 Ω) |
| Vibration motor | — | > 0.1 A (50 Ω) |
| Op-amp / comparator | — | supply > 36 V, or output > 20 mA |
| Optocoupler LED | — | reverse V < −6 V |

Two important behavioural details: the simulation **never halts** on component
damage, and the state is **not latched** — their LED model actively clears
`breakdown` when current drops back, so turning a potentiometer down makes the
explosion disappear and the part work again.

**Crucially, large classes of part cannot fail at all in Tinkercad:** resistors,
potentiometers, all discrete transistors (NPN, PNP, nMOS, pMOS — only the TIP120
module has a model), diodes, inductors, buttons, switches, the LDR, the solar
cell, **every battery**, and the **plain DC motor and gearmotor**. There is no
short-circuit string anywhere in their bundle. Shorting a battery produces
nothing at all.

#### What we do

Damage lives entirely in `src/sim/devices/passive.ts` and covers four parts:

| Part | Trigger | Delay |
|---|---|---|
| Resistor | > 0.5 W | instant |
| Capacitor | reverse volts if polarised, or > 1.5 × rated | instant |
| LED | > `LED_I_MAX` | 50 ms |
| Fuse | over-current | per rating |

Problems, in order of severity:

1. **It is silent.** Measured: 9 V straight onto an LED draws 5.73 A, the part
   chars and stops emitting — and `warnings` is `[]`, `errors` is `[]`, run
   state stays `running`. Tinkercad at least puts a starburst and a hover
   tooltip on it. We give the user nothing but darker artwork.
2. **Nothing else can fail.** Motors, servos, transistors, regulators, relays,
   solenoids, bulbs, speakers, displays, every IC and the microcontrollers are
   all indestructible.
3. **The rules are ad-hoc.** The LED integrates overload for 50 ms; the resistor
   fails the instant it crosses 0.5 W. There is no shared concept of a rating, a
   thermal time constant, or a failure mode.
4. **The resistor mutates state inside `output()`** — the rendering path, not the
   integration path. It works only because `output()` happens to run once per
   published frame.
5. **Ratings are hard-coded.** The resistor is permanently a quarter-watt part.

#### Where we already win, and where we can win big

We should be honest that Tinkercad's messages are *already* numeric, so "we give
numbers" is not a differentiator. These are:

- **We already beat them on the resistor.** Ours burns at > 0.5 W; theirs cannot
  fail at any power. Keep it, expose the wattage as a property, and extend the
  same treatment to the parts they refuse to model.
- **Fail what they can't.** A battery shorted with a wire, a transistor with no
  base resistor, a stalled DC motor — the three classic beginner mistakes — all
  produce *silence* in Tinkercad. Modelling them is a straightforward win.
- **Say what to do about it.** Their message states the current and the limit.
  None of their strings suggest a remedy. We know the supply voltage, the
  forward drop and the rated current, so we can compute one:

  > **LED burnt out.** 5.73 A flowed through a part rated 20 mA.
  > A 9 V supply needs about **390 Ω** in series with this LED.
  > *[Add a resistor]*

- **Keep the evidence.** Their damage clears the moment the condition does, and
  nothing is logged, so the proof vanishes before a student can read it. Latch
  the damage (which is also what real hardware does), keep a **failure log** for
  the run, and give an explicit "replace component" action.
- **Offer a protect mode.** A toggle that pauses and explains *instead* of
  destroying. Nothing equivalent exists in Tinkercad, and a teacher would leave
  it on.

*Judgement:* we should adopt their two-tier warning/breakdown split — it is a
good design — but not their transient behaviour or their hover-only surfacing.

### 3.2 Component properties — "exact component implementation"

**98 of 156 components expose no properties at all.**

Worth being precise about the benchmark here: Tinkercad is *worse*. Only about
**19 of their 110 components** carry any editable property. Their resistor has no
tolerance (the gold band is decorative), **battery voltage is not editable** at
all, breadboards have no size property, and the plain DC motor has none either —
only the encoder variant exposes RPM.

So this is not a parity gap. It is an opportunity: configurability is a place
where a modest amount of work puts us clearly ahead of the product we are
measured against.

| Category | Without properties | Examples |
|---|---|---|
| Input | 31 of 35 | pushbutton, photoresistor, TMP36, PIR, gas sensor |
| ICs | 17 of 17 | 555, op-amp, comparator, 74HC595, CD4017 |
| Logic | 17 of 26 | flip-flops, latches, adders, decoders |
| Output | 9 of 25 | bar graph, NeoPixel, LED matrix, stepper |
| Connectors | 7 of 8 | headers, USB, screw terminal |
| Microcontrollers | 4 of 4 | all boards |
| Power | 4 of 8 | 9 V battery, coin cell, 4×AA pack |
| Breadboards | 3 of 3 | all three |
| Networking | 3 of 3 | ESP8266, HC-05, nRF24L01 |

Priority additions:

- ~~**Breadboard** — `size` (Mini / Small / Full)~~ **done**; `colour` still todo.
- **Batteries** — `voltage`, `capacity`, `internalResistance`. Internal
  resistance is already what makes a short behave sanely; exposing it turns the
  battery into a teaching instrument.
- **Resistor** — `powerRating`, so the failure model in §3.1 stops assuming ¼ W.
- **LEDs and displays** — forward voltage and rated current per colour, so
  failure thresholds come from the part rather than one global constant.
  (Tinkercad's own forward voltages, for reference: red 1.8, orange 1.93,
  yellow 1.95, green 2.2, blue 3.45, white 3.1 V.)
- **Switches** — `normallyOpen`, `momentary`, `poles`.
- **Sensors** — per-part ranges, and `model` where real variants differ.
- **Op-amp / comparator** — `supplyRails`, `railToRail`, output current limit.
- **Microcontrollers** — `clockSpeed`, `variant`.

### 3.3 Catalogue

On raw count we are ahead — 156 against roughly 60–70 — so parity is not about
volume. It is about two things.

**First: two of our parts are decoration.** The `mcp3008` (8-channel ADC) and
`eeprom-24lc256` declare a `model` that no `defineDevice` registers. Measured:
the netlist lists them, `makeDevice()` returns null, `Simulation.build()` drops
them, and `warnings` and `errors` are both empty. You can place one, wire it
carefully, and nothing happens — with nothing to say why. Fix both models, and
add a **dev-time assertion that every part's `model` resolves**, which is a few
lines in the registry and would have caught this.

**Second: existence is not implementation.** The test for each of our 156 parts:

1. Are the **terminals** right, and named as the datasheet names them?
2. Is there an **electrical model**, or is it just artwork?
3. Are there **properties** worth configuring?
4. Can it **fail** the way the real part fails?
5. Does its **art respond** to simulation state?

Anything below 4/5 is not really implemented. Producing that scored table across
the catalogue is itself a deliverable.

**Third: the specific parts they have and we do not.** Their catalogue is 110
components; ours is 156 over the same twelve headings. What they have that we
lack:

| Missing part | Note |
|---|---|
| **Potato Battery**, **Lemon Battery** | Real palette entries. Novelty, but exactly the kind of thing a classroom enjoys, and trivial to model as a weak cell with high internal resistance. |
| **micro:bit with Breakout** | A separate microcontroller entry. We skipped a breakout on the grounds that it could not be wired to anything — but they ship it as a *board*, which is the answer: the breakout and the micro:bit are one part. |
| **DC Motor with encoder** | Exposes an RPM property and reports position. |
| **Dual Timer (556)** | We have the 555 only. |
| **LM339 quad / LM393 dual comparator** | We have a generic comparator, not the specific parts. |
| **PCF8574 8-port I2C expander** | |
| **Schmitt triggers**, **3-input and 4-input gate ICs** | Inverting Schmitt, quad NAND Schmitt, triple 3-input NAND/AND/NOR, dual 4-input NAND/AND. |
| **DIP switch variants** | DPST, SPST×4, SPST×6 — we ship one DIP switch. |
| **NeoPixel ring/strip sizes** | They ship ten discrete NeoPixel parts (1 single, 3 ring sizes, 6 strip lengths). We ship three. A `length` property is the better answer than ten entries. |

Also missing, and not components: **bill-of-materials export** (one of their
three view modes) and **.BRD export** for Eagle.

**Starters:** they ship 67 across five groups (10 basic, 27 Arduino, 10
micro:bit, 3 circuit assemblies, 17 miscellaneous). We ship 33. Their Arduino
set closely tracks the stock Arduino IDE examples, which is a sensible model to
copy.

### 3.4 Breadboards

We ship three — `breadboard-mini` (17 columns, no rails), `breadboard-small`
(30 columns, rails), `breadboard` (63 columns, rails). Only `breadboard-small`
carries the `basic` flag, so the default **Basic** panel view shows exactly one,
and a user testing the app concluded that was all we had.

The fix is better than promoting the other two: make **size a property of a
single breadboard part**. One panel entry, a Mini/Small/Full selector in the
inspector, resizing in place without re-placing and re-wiring.

Tinkercad ships them as three separate entries with no size property of their
own, and only Breadboard Small in the Basic view — the identical arrangement,
and presumably the identical confusion. Their own descriptions are worth
matching for accuracy, since ours should say the same thing:

> **Breadboard** — full-size, 63 rows, 10 columns, two pairs of power rails.
> **Breadboard Small** — half-size, 30 rows, 10 columns, two pairs of power rails.
> **Breadboard Mini** — quarter-size, 17 rows, 10 columns, no power rails.

### 3.5 Microcontrollers and code

**We are level on boards, not ahead.** Tinkercad ships four programmable entries
— Arduino Uno R3, ATtiny, micro:bit, and **micro:bit with Breakout** — over two
simulated architectures. We ship four (Uno R3, Nano, ATtiny85, micro:bit) over
the same two. We have the Nano; they have the breakout variant.

Neither product has an ESP32, a Mega, a Pico or any Wi-Fi/BLE capability, and
that absence is the single most-cited reason people leave Tinkercad for other
simulators. It is the largest strategic opportunity in this document and also
the largest piece of work — deliberately *not* in the plan below, but where the
plan should go next.

*Unresolved:* sources disagree on whether Tinkercad's micro:bit text mode is
strictly MicroPython or a MakeCode-flavoured Python — their bundle embeds the
BBC MicroPython sources, but their own guidance elsewhere implies otherwise.
Worth settling by testing before we claim compatibility as a differentiator.

**The significant limitation on our side:** `Simulation.propsFor` hands every
`mcu-*` device the same `design.code.text`, and every micro:bit the same
`design.code.python`. Two Unos necessarily run identical sketches, so two boards
talking to each other over serial cannot be built. Code must move from one field
on the document to a per-board field, with the panel selecting the board.

**Code panel parity** — we match them on modes (Blocks / Blocks+Text / Text),
serial monitor, serial plotter, breakpoints, resume, step, and the one-way
Blocks→Text warning. We are ahead with a dedicated Variables tab (they require
hovering a variable while paused). Remaining work:

- **Import a sketch.** Neither product can open a `.ino`; Autodesk has publicly
  declined to build it. Cheap for us, and a real differentiator.
- **Undo in the code editor** — they don't have it.
- **Custom libraries.** They allow none, ever, and the workaround is pasting
  source into the sketch. We already have a library manager; letting a user add
  one is an obvious extension.
- **Close the built-in library gap.** They ship 14, we ship 11. Missing on our
  side: **Adafruit LED Backpack, Keypad, SD, and LiquidCrystal I2C**.
- Watch expressions, conditional breakpoints, step-into/out, a call stack.
- Hover-a-variable-while-paused, in addition to the Variables tab.

### 3.6 Editor UX

Verified problems:

- **Wires cannot be reshaped after drawing.** Waypoints are stored and rendered
  but `finishWire` is the only writer. Tinkercad lets you **drag a point on an
  existing wire to bend it** and **double-click a wire to add a repositionable
  node**. This is a straight parity gap.
- **No component descriptions.** `PartDef` has no `description` field and no
  part carries help text. A learner who does not know what a 74HC595 is has no
  way to find out in-app.
- **The "Basic" set is mis-curated.** Ours contains `timer-555`, `74hc595`,
  `logic-toggle` and `logic-probe`, but no DC motor, no servo, no ultrasonic
  sensor, and only one breadboard. For reference, Tinkercad's Basic view is 26
  parts in this order, and it is a sound list to start from:

  > Resistor · LED · Pushbutton · Potentiometer · Capacitor · Slideswitch ·
  > 9V Battery · Coin Cell 3V · 1.5V Battery · Breadboard Small · micro:bit ·
  > Arduino Uno R3 · Vibration Motor · DC Motor · Micro Servo · Hobby Gearmotor ·
  > NPN Transistor · LED RGB · Diode · Photoresistor · Soil Moisture Sensor ·
  > Ultrasonic Distance Sensor · PIR Sensor · Piezo · Temperature Sensor [TMP36] ·
  > Multimeter

  Note what is *absent* from it: no 555, no shift register, no logic parts, and
  no LCD. Beginners get discrete components and boards; everything else is one
  dropdown away.
- **No bill of materials.** Tinkercad's third view mode exports a component
  list. We have Top / Wires / Schematic and no equivalent.
- **The inspector floats over the canvas** at top-right and can cover the part
  being edited.
- **The layout does not adapt.** At a narrow viewport the toolbar overflows, the
  Start Simulation button wraps to two lines, and the panel takes about half the
  width. There are no responsive breakpoints.
- **No alignment or distribute tools**, no snap-to-part guides.
- **No history panel** — though `designStore` already stores a human-readable
  `label` with every undo entry, so listing them is nearly free.

We are already ahead on shortcuts: Tinkercad publishes no Circuits shortcut
reference at all, and we ship a `?` dialog.

### 3.7 Performance

Measured in §2: we fall below real time between 240 and 480 solver nodes,
because `Circuit` uses a **dense** matrix with LU decomposition — O(n³) per
Newton iteration on a matrix that is in practice very sparse.

Worth knowing: Tinkercad is *also* slow, and visibly so — a documented Arduino
forum thread reports stock Blink running at roughly 20 s per cycle instead of 2,
and leaving their code panel open silently forces a slower debug execution mode.
Being reliably real-time at 500 components would be a competitive feature, not
just an internal cleanup.

Fixes, in increasing order of effort:

1. **Sparse storage and sparse LU** with a fill-reducing ordering. The real fix.
2. **Reuse the factorisation** across Newton iterations where only nonlinear
   stamps changed, and across timesteps where nothing changed.
3. **Skip the solve** entirely for a quiescent circuit.

---

## 4. Where we should beat Tinkercad

Parity is the floor. These are worth building *because* the reference product
does not have them — each is backed by a specific, sourced weakness.

1. **Fail the parts they can't.** Shorting a battery, a transistor with no base
   resistor, a stalled motor — all silent in Tinkercad. (§3.1)
2. **Say what to do about it.** Their messages state the fault; none suggest a
   remedy. Ours can compute the resistor value that would have prevented it.
3. **A failure log that persists.** Theirs clears the instant the condition does
   and is never recorded.
4. **A "protect components" mode** — pause and explain instead of destroying.
5. **Probe-free measurement.** Live V and I on hover; the multimeter stays for
   readings you want pinned to the canvas.
6. **Import a sketch, and allow custom libraries.** Both refused by Autodesk;
   both straightforward for us.
7. **Real multi-board designs.** Per-board code makes two boards over serial a
   first-class scenario. (§3.5)
8. **Undo in the code editor**, and a visible history panel for the canvas —
   the labels already exist.
9. **Reliably real-time at 500 components.** They are slow and it is documented.
10. **Offline and instant.** We are a static export with no account and no
    server. Tinkercad is online-only with a mandatory Autodesk account, and has
    documented Chromebook failures in an education install base. Making this an
    installable offline PWA is a short step and structurally impossible for them.

Also worth noting for later: **no modern microcontroller exists in Tinkercad at
all**. ESP32, Mega, Pico, and anything with Wi-Fi are the single biggest reason
users leave. That is the strategic prize once the foundations below are solid.

---

## 5. Implementation plan

Seven phases, each independently shippable and independently verifiable.

### P1 — Failure framework and explanations
*Do this first: highest value, most visible, and the area where the competition
is weakest.*

| Task | Files | Status |
|---|---|---|
| `Rating` / hold-time helpers; a `damage` output every part publishes | `src/sim/devices/types.ts` | **done** |
| Adopt a two-tier **warning / breakdown** split | `src/sim/devices/types.ts` | **done** |
| Move the resistor's mutation out of `output()` into `commit()` | `src/sim/devices/passive.ts` | **done** |
| Structured `FailureReport` — part, cause, measured value, rating, **suggested fix** | `src/sim/devices/types.ts`, `src/sim/Simulation.ts` | **done** |
| `Device.check()` for faults visible in the wiring, before any solve | `src/sim/devices/types.ts`, `src/sim/Simulation.ts` | **done** |
| **Battery short-circuit and over-current** — silent in Tinkercad | `src/sim/devices/sources.ts` | **done** |
| Bulb, motors, solenoid, piezo/speaker | `src/sim/devices/output.ts`, `extras.ts` | **done** |
| Warning badge and damage overlay, drawn generically from part bounds | `src/canvas/items/DamageMark.tsx` | **done** |
| Failure log panel with the remedy, click-to-select | `src/editor/FailurePanel.tsx` | **done** |
| Extend failure to BJT/Darlington, regulator, optocoupler | `src/sim/devices/semiconductors.ts` | **done** — ratings come from the part, not one constant |
| MCU pin over-current — 20 mA warn / 40 mA break / 200 mA total | `src/sim/devices/mcu.ts` | **done** — and the port stops driving, where theirs carries on |
| Logic ICs — real supply rail, supply limits, output current | `src/sim/devices/digital.ts` | **done** — outputs follow the measured rail instead of a hard-coded 5 V |
| "Protect components" toggle | `src/state/editorStore.ts`, `src/sim/Simulation.ts` | **done** |

**Verified.** Confirmed on screen: the badge on the damaged part, the panel
naming the fault and its remedy, the Protect switch sparing the same circuit,
the breadboard resizing between its three sizes, and all 33 starters running
with no spurious failure. One bug found and fixed in the process — the
simulator published its failure array by reference, so the panel never
re-rendered and every earlier failure was invisible.

A 9 V battery straight onto an LED reports *"Current
through the LED reached 5.73 A, past its absolute maximum of 50 mA"* and
suggests **390 Ω** — the correct E12 value, computed from the supply the
circuit contains rather than from the LED's sagged terminal voltage. A 5 V bulb
on 9 V warns as it flares and then goes open; the same bulb on 5 V survives
untouched. A wire across the battery terminals is caught structurally. All 33
starters run with no spurious failures.

Use Tinkercad's published thresholds (§3.1) as the starting values for parts we
both have; they are sane and it makes cross-checking easy.

**Done when:** every part with a physical rating can fail; each failure names
the cause, the measured value, the rating and a suggested fix; failures are
logged for the run; the protect toggle prevents damage.

> **Framework note.** `PartDef.size` and `.origin` may now be functions of
> props (`sizeOf` / `originOf`), which any variable-geometry part needs — the
> NeoPixel strip `length` property in §3.3 can use the same mechanism instead
> of shipping seven more catalogue entries.

### P2 — Component properties
Give the 98 property-less parts real settings, per §3.2 — starting with
breadboard size, battery voltage/capacity/internal resistance, resistor power
rating, and LED/display electrical ratings, which P1 needs for its numbers.

**Done when:** no component has an empty inspector unless it genuinely has
nothing to configure.

### P3 — Catalogue audit and parity
Score all 156 parts against the five-point rubric in §3.3 and publish the table.
~~Write the missing `mcp3008` and `eeprom` models, and add the registry
assertion that every part's model resolves.~~ **done.**

Parts from the §3.3 table:

| Part | Status |
|---|---|
| Potato and lemon batteries | **done** — 0.9 V behind ~800 Ω, so an LED stays dark |
| 74HC14 / 74HC132 Schmitt triggers | **done** |
| Triple 3-input and dual 4-input gate packages | **done** |
| LM339 / LM393 comparators | **done** — open collector, so they wired-OR |
| Bill-of-materials export | **done** — Send To → Component list |
| micro:bit with breakout | todo |
| DC motor with encoder | todo |
| 556 dual timer | todo |
| PCF8574 I2C expander | todo |
| DIP switch variants — better as a `ways` property than three parts | todo |
| NeoPixel `length` property instead of seven more entries | todo |

The catalogue is 165 parts against Tinkercad's 110.

**Done when:** the rubric table is published, every part scores 4 or 5, a part
whose model does not resolve fails the build rather than shipping inert, and
nothing in Tinkercad's 110 lacks a counterpart here.

### P4 — Discoverability
| Task | Status |
|---|---|
| Breadboard size as a property, replacing three catalogue entries | **done** |
| Migrate saved designs off the old breadboard ids without shrinking them | **done** |
| Re-curate the Basic set against the 26-part reference in §3.6 | **done** — now one ordered list in the registry, not a flag in fifteen files |
| `description` on `PartDef`, surfaced in the panel and inspector | **done** — starting set plus the parts reached for next |
| `pinout` help for multi-pin parts | todo |
| Recently used and favourites | todo |
| Grow the starter library toward their 67 | todo |

**Done when:** a first-time user finds a full-size breadboard, a servo and an
LCD without being told where to look.

### P5 — Canvas and editing
| Task | Status |
|---|---|
| Wire bend points — drag to reshape, double-click to add | **done** (parity with Tinkercad) |
| Live voltage on hover | **done** — no multimeter needed |
| History panel from the labels already stored | **done** — jump to any earlier edit |
| Responsive breakpoints | **done** — checked at 1024 and 800 |
| Alignment and distribute | todo |

**Done when:** a wire can be reshaped after drawing, hovering shows live values,
and the editor is usable at 1024 px wide. — **met.**

### P6 — Simulation performance
| Task | Status |
|---|---|
| Stop reallocating the matrix every Newton iteration | **done** — roughly triples throughput mid-range |
| Sparse matrix and sparse LU with a fill-reducing ordering | todo |
| Reuse factorisations across iterations | todo |
| Skip solves for a quiescent circuit | todo |

**Done when:** 500 components run at ≥ 1× real time. **Not met** — the ceiling
moved from ~150 to ~250 components. The remaining cost is structural: forward
and back substitution are O(n²) however sparse the matrix is, so 1000 unknowns
means two million multiply-adds per solve against perhaps five thousand
nonzeros. That needs the sparse factorisation, not another allocation tweak.

### P7 — Code and debugging
| Task | Status |
|---|---|
| Per-board code | **done** — verified with two Unos running different sketches |
| Import a `.ino`/`.py` | todo |
| Custom libraries, and the four missing built-ins | todo |
| Undo in the code editor | todo |
| Watch expressions, conditional breakpoints, step into/out, call stack | todo |

**Done when:** two Arduinos in one design run different sketches and talk to
each other over serial. — **first half met**; per-board serial monitors are
still shared.

### Beyond the plan
Modern microcontrollers — ESP32, Mega, Pico — and with them Wi-Fi/BLE. The
biggest prize and the biggest job; revisit once P1–P7 have landed.

---

## 6. Non-goals

Unchanged from [STATUS.md](STATUS.md): no accounts, sharing, embedding or
classroom management; no server-side compilation; no guided lessons. This build
is front-end only by design, and every item above respects that. Note that being
offline and account-free is treated here as a *feature* (§4.10), not a
limitation.

---

## Appendix A — our measurements

Taken against the dev build through `window.__cl` / `window.__sim`.

**Catalogue**

```
total 156   basic 33   with properties 58   socketable 99
breadboards 3   connectors 8   general 10   ics 17   input 35
instruments 4   logic 26   microcontrollers 4   networking 3
output 25   power 8   powercontrol 13
```

**9 V battery straight onto an LED**

```
current      5.73 A        (part is rated 20 mA)
after 400 steps            burnt: true, brightness: 0
warnings     []            ← nothing told the user
errors       []
runState     running
after restart              burnt: false — damage is transient
```

**Solver throughput** — LED + resistor pairs, no breadboard:

```
 20 components →  40 nodes → 0.03 ms/step → 37.5× real time
 60 components → 120 nodes → 0.36 ms/step →  2.78×
120 components → 240 nodes → 0.37 ms/step →  2.68×
240 components → 480 nodes → 1.91 ms/step →  0.52×   ← below real time
240 components → 480 nodes → 4.26 ms/step →  0.23×   ← under sustained load
```

**Netlist extraction** — 240 components, 480 nets: 6.2 ms. Not a bottleneck.
An empty breadboard of any size yields 0 nets and 0 devices.

**Decorative parts** — placing an `mcp3008`, an `eeprom-24lc256` and an `led`:

```
netlist devices     ['mcp3008', 'eeprom', 'led']
bound in simulation ['led']                        ← the other two were dropped
warnings            []
errors              []
```

---

## Appendix B — Tinkercad reference data

Extracted from their shipped `circuits-compiled.js`. Useful as implementation
targets; recorded here so the next person does not have to re-derive it.

**Failure thresholds**

| Part | Warning | Breakdown |
|---|---|---|
| LED | > 20 mA | ≥ 120 mA |
| RGB LED | — | > 20 mA per channel |
| Arduino I/O pin | > 20 mA | > 40 mA, or > 200 mA total |
| Light bulb (48 Ω) | — | > 0.25 A |
| Vibration motor (50 Ω) | — | > 0.1 A |
| Op-amp / comparator | — | supply > 36 V, output > 20 mA |
| Optocoupler LED | — | reverse V < −6 V |

**LED forward voltages:** red 1.8, orange 1.93, yellow 1.95, green 2.2,
blue 3.45, white 3.1 V.

**Cannot fail in Tinkercad, at any conditions:** resistors, potentiometers, all
discrete transistors, diodes, inductors, buttons, switches, LDR, solar cell,
every battery, plain DC motor and gearmotor. No short-circuit detection exists.

**Their failure UI:** red 16-point starburst (`#FF0000` fill, `#F7E60B` stroke,
0.7 opacity) for breakdown; a black-and-white `!` badge for warning; reason in a
hover tooltip only; nothing logged; state clears when the condition clears; the
simulation never halts.

**Their catalogue shape** — 110 components over the same twelve headings we use:

```
General 6   Input 20   Output 25   Power 6   Breadboards 3
Microcontrollers 4   Instruments 4   Integrated Circuits 6
Power Control 12   Networking 0 (ESP8266 withdrawn)   Connectors 2   Logic 22
```

**Their configurable components** — the complete list, ~19 of 110:

| Part | Properties |
|---|---|
| Resistor, Potentiometer | resistance |
| Capacitor | capacitance |
| Polarized Capacitor | capacitance, voltage rating |
| Inductor | inductance |
| Zener Diode | zener voltage |
| LED | colour (green, yellow, orange, blue, red, white) |
| LED RGB | pinout (RCBG, RCGB, BRCG) |
| 7 Segment Display | common (anode / cathode) |
| 7-Segment Clock Display | address, colour |
| LCD 16×2 (I2C) | address, type (MCP23008 / PCF8574) |
| Micro Servo | type (positional / continuous) |
| DC Motor with encoder | RPM |
| 1.5 V Battery | count (1–4), type (AA / AAA), built-in switch |
| Power Supply | voltage, current |
| Function Generator | frequency, amplitude, DC offset, function |
| Oscilloscope | time per division |
| Multimeter | mode (amperage / voltage / resistance) |

Everything else in their catalogue has no editable value beyond its name and
label visibility.

**Their built-in Arduino libraries** (14): Adafruit LED Backpack, Adafruit
LiquidCrystal, EEPROM, IRremote, Keypad, LiquidCrystal, LiquidCrystal I2C,
Adafruit NeoPixel, SD, Servo, SoftwareSerial, SPI, Stepper, Wire.

**Their starters** (67): Basic 10, Arduino 27, micro:bit 10, Circuit Assemblies
3, Miscellaneous 17.
