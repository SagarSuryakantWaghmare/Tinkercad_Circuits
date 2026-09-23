import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { BoardShadow, DipBody, HeaderStrip, Silk } from '../primitives';

/**
 * ATmega328P development board, pin-compatible with the ubiquitous "Uno" form
 * factor. Trade dress is deliberately our own: no third-party word marks or
 * logos on the silkscreen, only the functional pin names.
 *
 * Geometry: 2.7 × 2.1 inch → 270 × 210 world units. Header pitch is the
 * standard 10 units; the two digital groups sit where they do on the real
 * board, with the USB connector occupying the left of the top edge.
 */

const W = 270;
const H = 210;
const TOP_Y = -95;
const BOT_Y = 95;

/** Digital header, left group: SCL SDA AREF GND D13 D12 D11 D10 D9 D8 */
const DIG_HI = ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'];
const DIG_HI_X0 = -61;

/** Digital header, right group: D7 D6 D5 D4 D3 D2 D1 D0 */
const DIG_LO = ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'];
const DIG_LO_X0 = 45;

/** Power header: NC IOREF RESET 3.3V 5V GND GND VIN */
const POWER = ['NC', 'IOREF', 'RESET', '3.3V', '5V', 'GND1', 'GND2', 'VIN'];
const POWER_X0 = -75;

/** Analog header: A0 … A5 */
const ANALOG = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const ANALOG_X0 = 15;

const PWM_PINS = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);

function buildTerminals(): TerminalDef[] {
  const t: TerminalDef[] = [];

  DIG_HI.forEach((name, i) => {
    t.push({
      name,
      type: 'breadboard_female',
      x: DIG_HI_X0 + i * 10,
      y: TOP_Y,
      dir: [0, -1],
      // Every GND pad on the board is one net.
      group: name === 'GND' ? 'gnd' : undefined,
      role: name === 'GND' ? 'gnd' : PWM_PINS.has(name) ? 'pwm' : 'digital',
    });
  });

  DIG_LO.forEach((name, i) => {
    t.push({
      name,
      type: 'breadboard_female',
      x: DIG_LO_X0 + i * 10,
      y: TOP_Y,
      dir: [0, -1],
      role: PWM_PINS.has(name) ? 'pwm' : 'digital',
    });
  });

  POWER.forEach((name, i) => {
    t.push({
      name,
      type: 'breadboard_female',
      x: POWER_X0 + i * 10,
      y: BOT_Y,
      dir: [0, 1],
      group: name.startsWith('GND') ? 'gnd' : undefined,
      role: name.startsWith('GND') ? 'gnd' : 'power',
    });
  });

  ANALOG.forEach((name, i) => {
    t.push({
      name,
      type: 'breadboard_female',
      x: ANALOG_X0 + i * 10,
      y: BOT_Y,
      dir: [0, 1],
      role: 'analog',
    });
  });

  return t;
}

const LABEL = (n: string) =>
  n === 'GND1' || n === 'GND2' ? 'GND' : n === 'NC' ? '' : n;

function UnoArt({ state }: ArtProps<Record<string, never>>) {
  const led13 = Number(state?.led13 ?? 0);
  const ledTx = Number(state?.ledTx ?? 0);
  const ledRx = Number(state?.ledRx ?? 0);
  const powered = state ? Number(state.powered ?? 1) : 0;

  return (
    <g>
      <BoardShadow w={W} h={H} rx={6} />

      {/* PCB with the characteristic notched outline */}
      <path
        d={`M${-W / 2 + 6},${-H / 2}
            L${W / 2 - 22},${-H / 2}
            L${W / 2},${-H / 2 + 22}
            L${W / 2},${H / 2 - 6}
            Q${W / 2},${H / 2} ${W / 2 - 6},${H / 2}
            L${-W / 2 + 6},${H / 2}
            Q${-W / 2},${H / 2} ${-W / 2},${H / 2 - 6}
            L${-W / 2},${-H / 2 + 6}
            Q${-W / 2},${-H / 2} ${-W / 2 + 6},${-H / 2} Z`}
        fill={C.pcbBlue}
        stroke={C.pcbBlueDark}
        strokeWidth={1}
      />

      {/* mounting holes */}
      {[
        [-124, 38],
        [128, -26],
        [8, -60],
      ].map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle cx={x} cy={y} r={6.5} fill="#F0F2F4" />
          <circle cx={x} cy={y} r={3.4} fill="#20455F" />
        </g>
      ))}

      {/* USB type-B connector, protruding off the left of the top edge */}
      <g>
        <rect x={-W / 2 - 10} y={-H / 2 + 12} width={62} height={48} rx={2} fill="#C6CBD1" />
        <rect x={-W / 2 - 10} y={-H / 2 + 12} width={62} height={48} rx={2} fill="none" stroke="#9AA1A8" strokeWidth={1} />
        <rect x={-W / 2 - 6} y={-H / 2 + 18} width={40} height={36} rx={1.5} fill="#A8AEB5" />
        <rect x={-W / 2 - 2} y={-H / 2 + 24} width={28} height={24} rx={1} fill="#5A6169" />
      </g>

      {/* barrel power jack, bottom-left */}
      <g>
        <rect x={-W / 2 - 8} y={H / 2 - 62} width={54} height={46} rx={3} fill="#1B1D1F" />
        <circle cx={-W / 2 + 6} cy={H / 2 - 39} r={13} fill="#0E0F10" />
        <circle cx={-W / 2 + 6} cy={H / 2 - 39} r={4} fill="#3A3E42" />
      </g>

      {/* headers */}
      <HeaderStrip x={DIG_HI_X0} y={TOP_Y} count={DIG_HI.length} />
      <HeaderStrip x={DIG_LO_X0} y={TOP_Y} count={DIG_LO.length} />
      <HeaderStrip x={POWER_X0} y={BOT_Y} count={POWER.length} />
      <HeaderStrip x={ANALOG_X0} y={BOT_Y} count={ANALOG.length} />

      {/*
        Pin labels, rotated to run along the pin as on the real silkscreen.
        The top row is anchored 30 from its header rather than 15: rotating by
        -90 with a start anchor makes the text grow upward, i.e. back toward
        that header, so at 15 everything longer than ten units — six of the
        seven label widths, RESET worst at nearly seven over — was printed
        across the black shroud and its sockets. The bottom row grows away
        from its own header, so 15 is right there, and the two rows end up
        about the same distance clear of their shrouds.
      */}
      <g>
        {DIG_HI.map((n, i) => (
          <Silk
            key={n}
            x={DIG_HI_X0 + i * 10}
            y={TOP_Y + 30}
            size={5.6}
            rotate={-90}
            anchor="start"
            weight={600}
          >
            {PWM_PINS.has(n) ? `~${LABEL(n)}` : LABEL(n)}
          </Silk>
        ))}
        {DIG_LO.map((n, i) => (
          <Silk
            key={n}
            x={DIG_LO_X0 + i * 10}
            y={TOP_Y + 30}
            size={5.6}
            rotate={-90}
            anchor="start"
            weight={600}
          >
            {PWM_PINS.has(n) ? `~${LABEL(n)}` : LABEL(n)}
          </Silk>
        ))}
        {POWER.map((n, i) => (
          <Silk
            key={n}
            x={POWER_X0 + i * 10}
            y={BOT_Y - 15}
            size={5.4}
            rotate={-90}
            anchor="end"
            weight={600}
          >
            {LABEL(n)}
          </Silk>
        ))}
        {ANALOG.map((n, i) => (
          <Silk
            key={n}
            x={ANALOG_X0 + i * 10}
            y={BOT_Y - 15}
            size={5.6}
            rotate={-90}
            anchor="end"
            weight={600}
          >
            {n}
          </Silk>
        ))}
        <Silk x={30} y={TOP_Y + 48} size={6.5} weight={700}>
          DIGITAL (PWM ~)
        </Silk>
        <Silk x={POWER_X0 + 35} y={BOT_Y - 48} size={6.5} weight={700}>
          POWER
        </Silk>
        <Silk x={ANALOG_X0 + 25} y={BOT_Y - 48} size={6.5} weight={700}>
          ANALOG IN
        </Silk>
      </g>

      {/* microcontroller */}
      <g transform={`translate(22,6)`}>
        <DipBody w={120} h={44} />
        <Silk x={0} y={-6} size={7.5} fill="#C9CED3" weight={600}>
          ATMEGA328P
        </Silk>
        <Silk x={0} y={6} size={6} fill="#9BA1A7" weight={500}>
          PU
        </Silk>
      </g>

      {/* crystal */}
      <rect x={98} y={-58} width={30} height={16} rx={7} fill="#B7BCC2" stroke="#8C9197" />

      {/* reset button, left of the digital header as on the real board */}
      <g>
        <rect x={-76} y={-56} width={26} height={22} rx={2} fill="#2E3134" />
        <circle cx={-63} cy={-45} r={7} fill="#C43B3B" />
        <Silk x={-63} y={-28} size={5.5} weight={600}>
          RESET
        </Silk>
      </g>

      {/* status LEDs */}
      <StatusLed x={-88} y={-26} lit={led13} label="L" hex="#E6C619" />
      <StatusLed x={-88} y={-12} lit={ledTx} label="TX" hex="#E6C619" />
      <StatusLed x={-88} y={2} lit={ledRx} label="RX" hex="#E6C619" />
      <StatusLed x={-88} y={16} lit={powered} label="ON" hex="#3FBF4F" />

      {/* voltage regulator */}
      <rect x={98} y={28} width={34} height={22} rx={2} fill="#1F2123" />
      <rect x={98} y={24} width={34} height={6} rx={1} fill="#9AA1A8" />

      {/* electrolytic caps */}
      {[[105, 68], [126, 68]].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r={11} fill="#2C4A8C" stroke="#1E3466" />
          <path d={`M${x - 11},${y} A11,11 0 0,1 ${x},${y - 11} L${x},${y} Z`} fill="#C9CDD3" opacity={0.8} />
        </g>
      ))}

      {/* ICSP header */}
      <g>
        {[0, 1, 2].map((c) =>
          [0, 1].map((r) => (
            <rect
              key={`${c}${r}`}
              x={W / 2 - 34 + c * 10 - 3}
              y={-14 + r * 10 - 3}
              width={6}
              height={6}
              rx={1}
              fill={C.solderPad}
            />
          )),
        )}
        <Silk x={W / 2 - 24} y={8} size={5} weight={600}>
          ICSP
        </Silk>
      </g>

      <Silk x={22} y={36} size={9.5} weight={800} fill="#DCE8F2">
        UNO R3
      </Silk>
    </g>
  );
}

function StatusLed({
  x,
  y,
  lit,
  label,
  hex,
}: {
  x: number;
  y: number;
  lit: number;
  label: string;
  hex: string;
}) {
  const on = lit > 0.02;
  return (
    <g>
      {on && <circle cx={x} cy={y} r={9} fill={hex} opacity={0.35 * Math.min(1, lit)} />}
      <rect
        x={x - 4}
        y={y - 2.6}
        width={8}
        height={5.2}
        rx={0.8}
        fill={on ? hex : '#6E7C86'}
        opacity={on ? 0.6 + 0.4 * Math.min(1, lit) : 1}
      />
      <Silk x={x - 11} y={y} size={5.2} anchor="end" weight={600}>
        {label}
      </Silk>
    </g>
  );
}

export const UnoR3 = definePart({
  id: 'uno-r3',
  name: 'Uno R3',
  category: 'microcontrollers',
  keywords: ['arduino', 'uno', 'atmega328', 'microcontroller', 'board', 'mcu'],
  basic: true,
  size: { w: W + 22, h: H },
  origin: { x: W / 2 + 11, y: H / 2 },
  substrate: true,
  rotationStep: 90,
  model: 'mcu-atmega328p',
  terminals: buildTerminals(),
  props: [],
  defaults: {},
  Art: UnoArt,
  summary:
    'A programmable board with 14 digital pins, 6 analog inputs and a 16 MHz ATmega328P. Wire parts to its pins and write code that reads or drives them.',
  learn: [
    {
      title: 'Power',
      body:
        '5V — regulated output for logic and small sensors.\n3.3V — a smaller regulated output.\nGND — the reference all voltages are measured against; every device must share it.\nVIN — external supply input, typically 7–12 V.',
    },
    {
      title: 'Digital pins (D0 – D13)',
      body:
        'Each can be an INPUT you read with digitalRead, or an OUTPUT you drive HIGH/LOW with digitalWrite. Pins with a ~ (D3, 5, 6, 9, 10, 11) also do PWM via analogWrite for LED dimming or motor speed.',
    },
    {
      title: 'Analog pins (A0 – A5)',
      body:
        'Read a voltage from 0–5 V with analogRead — it returns 0…1023. Use these for potentiometers, light sensors, and other analog inputs. A4/A5 double as the I2C bus (SDA/SCL).',
    },
    {
      title: 'Your first sketch',
      body:
        'void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n\nThis blinks the LED on pin 13. Press Start Simulation to run it.',
    },
    {
      title: 'Tips',
      body:
        '• Open the Code panel (C key) to switch between Blocks and Text.\n• Red = 5V, black = GND. Every device needs both.\n• Add a resistor in series with every LED (220 Ω works).\n• Click a line number to set a breakpoint and inspect variables.',
    },
  ],
});

// ─── ATtiny85 ────────────────────────────────────────────────────────────────

export const ATtiny = definePart({
  id: 'attiny85',
  name: 'ATtiny',
  category: 'microcontrollers',
  keywords: ['attiny', 'attiny85', 'microcontroller', 'dip8', 'tiny'],
  size: { w: 90, h: 60 },
  origin: { x: 45, y: 30 },
  socketable: true,
  rotationStep: 90,
  model: 'mcu-attiny85',
  terminals: [
    { name: 'RESET/PB5', type: 'breadboard_male', x: -30, y: -25, dir: [0, -1], role: 'digital' },
    { name: 'PB3', type: 'breadboard_male', x: -10, y: -25, dir: [0, -1], role: 'digital' },
    { name: 'PB4', type: 'breadboard_male', x: 10, y: -25, dir: [0, -1], role: 'digital' },
    { name: 'GND', type: 'breadboard_male', x: 30, y: -25, dir: [0, -1], role: 'gnd' },
    { name: 'PB0', type: 'breadboard_male', x: 30, y: 25, dir: [0, 1], role: 'pwm' },
    { name: 'PB1', type: 'breadboard_male', x: 10, y: 25, dir: [0, 1], role: 'pwm' },
    { name: 'PB2', type: 'breadboard_male', x: -10, y: 25, dir: [0, 1], role: 'digital' },
    { name: 'VCC', type: 'breadboard_male', x: -30, y: 25, dir: [0, 1], role: 'power' },
  ],
  props: [],
  defaults: {},
  Art: () => (
    <g>
      {[-30, -10, 10, 30].map((x) => (
        <g key={x}>
          <rect x={x - 2} y={-25} width={4} height={11} fill={C.metal} />
          <rect x={x - 2} y={14} width={4} height={11} fill={C.metal} />
        </g>
      ))}
      <DipBody w={80} h={30} />
      <Silk x={4} y={-4} size={7} fill="#C9CED3" weight={600}>
        ATtiny85
      </Silk>
      <Silk x={4} y={5} size={5.5} fill="#9BA1A7" weight={500}>
        20PU
      </Silk>
    </g>
  ),
  summary:
    'An 8-pin AVR microcontroller with 5 usable I/O lines (PB0–PB4). No USB on-board — flash it from the Arduino IDE with an ISP programmer or a Digispark-style bootloader.',
  learn: [
    {
      title: 'Pins',
      body:
        'PB0, PB1 — do PWM via analogWrite.\nPB2, PB3, PB4 — plain digital I/O; PB2/3/4 also read analog voltages.\nRESET/PB5 — usually left as reset; sacrifice it for I/O only if you can still reprogram.',
    },
    {
      title: 'Power',
      body:
        'VCC — typically 5 V (works 2.7–5.5 V).\nGND — shared reference for every part.\nDraws a few mA; sleep modes drop that to microamps. No on-board regulator, so feed it clean logic-level power.',
    },
    {
      title: 'First program',
      body:
        'void setup() {\n  pinMode(0, OUTPUT); // PB0\n}\nvoid loop() {\n  digitalWrite(0, HIGH);\n  delay(500);\n  digitalWrite(0, LOW);\n  delay(500);\n}\n\nBlinks an LED wired PB0 → 220 Ω → LED → GND.',
    },
    {
      title: 'Tips',
      body:
        '• 8 KB flash, 512 B RAM — keep sketches small.\n• No hardware Serial; use SoftwareSerial or the on-chip USI.\n• Pick "ATtiny25/45/85" in the IDE and set clock to 8 MHz internal for portable timing.\n• Every LED still needs a series resistor.',
    },
  ],
});

export const MICROCONTROLLERS: PartDef<never>[] = [UnoR3, ATtiny] as unknown as PartDef<never>[];
