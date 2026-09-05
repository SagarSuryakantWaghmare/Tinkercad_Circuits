import { getPartDef } from '@/parts/registry';
import type { PartInstance, Wire } from '@/state/design';

/**
 * Starter circuits.
 *
 * Each one is a complete, working design — components, wiring and code — that
 * drops into the workspace and runs the moment Start Simulation is pressed.
 * They are written in a tiny DSL so a starter reads like a wiring list rather
 * than a wall of object literals.
 */

export type StarterCategory = 'basic' | 'arduino' | 'microbit' | 'assemblies';

export interface Starter {
  id: string;
  name: string;
  category: StarterCategory;
  blurb: string;
  build: () => StarterContent;
}

export interface StarterContent {
  parts: PartInstance[];
  wires: Wire[];
  /** Arduino sketch, for designs built around an Uno. */
  code?: string;
  /** MicroPython program, for designs built around a micro:bit. */
  python?: string;
}

type PartSpec = [alias: string, type: string, x: number, y: number, props?: Record<string, string | number>];
type WireSpec = [from: string, fromTerminal: string, to: string, toTerminal: string, colour?: string];

let uid = 0;
const nextId = (p: string) => `${p}_s${Date.now().toString(36)}${(uid++).toString(36)}`;

function build(
  parts: PartSpec[],
  wires: WireSpec[],
  code?: string,
  python?: string,
): StarterContent {
  const ids = new Map<string, string>();
  const out: PartInstance[] = [];

  parts.forEach(([alias, type, x, y, props], i) => {
    const def = getPartDef(type);
    if (!def) return;
    const id = nextId('p');
    ids.set(alias, id);
    out.push({
      id,
      type,
      x,
      y,
      rotation: 0,
      mirrored: false,
      props: { ...(def.defaults as Record<string, string | number>), ...(props ?? {}) },
      z: i + 1,
    });
  });

  const outWires: Wire[] = [];
  for (const [fa, ft, ta, tt, colour] of wires) {
    const from = ids.get(fa);
    const to = ids.get(ta);
    if (!from || !to) continue;
    outWires.push({
      id: nextId('w'),
      a: { kind: 'terminal', partId: from, terminal: ft },
      b: { kind: 'terminal', partId: to, terminal: tt },
      waypoints: [],
      color: colour ?? '0',
      type: 'wire',
    });
  }

  return { parts: out, wires: outWires, code, python };
}

// ─── Basic ───────────────────────────────────────────────────────────────────

const basics: Starter[] = [
  {
    id: 'basic-led',
    name: 'LED and Battery',
    category: 'basic',
    blurb: 'The first circuit: a coin cell lighting an LED through a resistor.',
    build: () =>
      build(
        [
          ['bat', 'battery-coin', -220, 0],
          ['r', 'resistor', 0, -120, { resistance: 220 }],
          ['led', 'led', 160, 0, { color: 'red' }],
        ],
        [
          ['bat', '+', 'r', 'a', '1'],
          ['r', 'b', 'led', 'anode', '1'],
          ['led', 'cathode', 'bat', '-', '0'],
        ],
      ),
  },
  {
    id: 'basic-switch',
    name: 'Switch a Light',
    category: 'basic',
    blurb: 'A slide switch in series with an LED — flip it while the sim runs.',
    build: () =>
      build(
        [
          ['bat', 'battery-9v', -280, 40],
          ['sw', 'slideswitch', -60, -140],
          ['r', 'resistor', 120, -140, { resistance: 470 }],
          ['led', 'led', 280, 40, { color: 'green' }],
        ],
        [
          ['bat', '+', 'sw', 'common', '1'],
          ['sw', '1', 'r', 'a', '1'],
          ['r', 'b', 'led', 'anode', '1'],
          ['led', 'cathode', 'bat', '-', '0'],
        ],
      ),
  },
  {
    id: 'basic-dimmer',
    name: 'Dimmer',
    category: 'basic',
    blurb: 'Turn the knob to change the current through the LED.',
    build: () =>
      build(
        [
          ['bat', 'battery-9v', -300, 40],
          ['pot', 'potentiometer', -60, -140, { resistance: 10000 }],
          ['r', 'resistor', 140, -140, { resistance: 220 }],
          ['led', 'led', 300, 40, { color: 'yellow' }],
        ],
        [
          ['bat', '+', 'pot', 'terminal1', '1'],
          ['pot', 'wiper', 'r', 'a', '2'],
          ['r', 'b', 'led', 'anode', '2'],
          ['led', 'cathode', 'bat', '-', '0'],
        ],
      ),
  },
  {
    id: 'basic-divider',
    name: 'Voltage Divider',
    category: 'basic',
    blurb: 'Two resistors and a multimeter — measure the midpoint.',
    build: () =>
      build(
        [
          ['psu', 'power-supply', -420, 0, { voltage: 9, currentLimit: 1 }],
          ['r1', 'resistor', -60, -120, { resistance: 1000 }],
          ['r2', 'resistor', -60, 120, { resistance: 2200 }],
          ['dmm', 'multimeter', 280, 0, { mode: 'voltage' }],
        ],
        [
          ['psu', '+', 'r1', 'a', '1'],
          ['r1', 'b', 'r2', 'a', '2'],
          ['r2', 'b', 'psu', '-', '0'],
          ['r2', 'a', 'dmm', 'positive', '1'],
          ['r2', 'b', 'dmm', 'negative', '0'],
        ],
      ),
  },
  {
    id: 'basic-motor',
    name: 'Motor and Switch',
    category: 'basic',
    blurb: 'A hobby motor driven straight from a battery pack.',
    build: () =>
      build(
        [
          ['bat', 'battery-pack-4aa', -320, 0],
          ['sw', 'slideswitch', -40, -160],
          ['m', 'dc-motor', 240, 0, { ratedVoltage: 6 }],
        ],
        [
          ['bat', '+', 'sw', 'common', '1'],
          ['sw', '1', 'm', 'terminal1', '1'],
          ['m', 'terminal2', 'bat', '-', '0'],
        ],
      ),
  },
  {
    id: 'basic-scope',
    name: 'Waveforms on a Scope',
    category: 'basic',
    blurb: 'A function generator into an oscilloscope — change the wave and watch.',
    build: () =>
      build(
        [
          ['fg', 'function-generator', -320, 0, { wave: 'sine', frequency: 200, amplitude: 4 }],
          ['scope', 'oscilloscope', 220, 0, { timePerDiv: 0.001, voltsPerDiv: 2 }],
        ],
        [
          ['fg', 'positive', 'scope', 'CH1+', '1'],
          ['fg', 'negative', 'scope', 'CH1-', '0'],
        ],
      ),
  },
];

// ─── Arduino ─────────────────────────────────────────────────────────────────

const arduino: Starter[] = [
  {
    id: 'ard-blink',
    name: 'Blink',
    category: 'arduino',
    blurb: 'An LED on pin 13 turning on and off once a second.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 200],
          ['r', 'resistor', -60, -120, { resistance: 220 }],
          ['led', 'led', 120, -120, { color: 'red' }],
        ],
        [
          ['uno', 'D13', 'r', 'a', '4'],
          ['r', 'b', 'led', 'anode', '4'],
          ['led', 'cathode', 'uno', 'GND', '0'],
        ],
        `// Blink an LED once a second.

void setup()
{
  pinMode(13, OUTPUT);
}

void loop()
{
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`,
      ),
  },
  {
    id: 'ard-fade',
    name: 'Fade',
    category: 'arduino',
    blurb: 'PWM brightness ramping up and down on pin 9.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 200],
          ['r', 'resistor', -60, -120, { resistance: 220 }],
          ['led', 'led', 120, -120, { color: 'blue' }],
        ],
        [
          ['uno', 'D9', 'r', 'a', '5'],
          ['r', 'b', 'led', 'anode', '5'],
          ['led', 'cathode', 'uno', 'GND', '0'],
        ],
        `// Fade an LED with PWM.

int brightness = 0;
int step = 5;

void setup()
{
  pinMode(9, OUTPUT);
}

void loop()
{
  analogWrite(9, brightness);
  brightness = brightness + step;
  if (brightness <= 0 || brightness >= 255) {
    step = -step;
  }
  delay(20);
}
`,
      ),
  },
  {
    id: 'ard-button',
    name: 'Button Controls an LED',
    category: 'arduino',
    blurb: 'Read a pushbutton with the internal pull-up and light an LED.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 240],
          ['btn', 'pushbutton', -220, -140],
          ['r', 'resistor', 60, -140, { resistance: 220 }],
          ['led', 'led', 240, -140, { color: 'green' }],
        ],
        [
          ['uno', 'D2', 'btn', '1a', '5'],
          ['btn', '2a', 'uno', 'GND', '0'],
          ['uno', 'D13', 'r', 'a', '4'],
          ['r', 'b', 'led', 'anode', '4'],
          ['led', 'cathode', 'uno', 'GND', '0'],
        ],
        `// The button pulls pin 2 to ground when pressed.

void setup()
{
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop()
{
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
`,
      ),
  },
  {
    id: 'ard-analog',
    name: 'Read a Potentiometer',
    category: 'arduino',
    blurb: 'Print the knob position to the serial monitor and plot it.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 240],
          ['pot', 'potentiometer', -160, -160, { resistance: 10000 }],
        ],
        [
          ['uno', '5V', 'pot', 'terminal1', '1'],
          ['pot', 'wiper', 'uno', 'A0', '5'],
          ['pot', 'terminal2', 'uno', 'GND', '0'],
        ],
        `// Print the knob position; open the Plotter tab to graph it.

void setup()
{
  Serial.begin(9600);
}

void loop()
{
  int value = analogRead(A0);
  Serial.println(value);
  delay(50);
}
`,
      ),
  },
  {
    id: 'ard-servo',
    name: 'Servo Sweep',
    category: 'arduino',
    blurb: 'Sweep a servo from 0 to 180 degrees and back.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 240],
          ['servo', 'micro-servo', 260, -160],
        ],
        [
          ['uno', '5V', 'servo', 'power', '1'],
          ['uno', 'GND', 'servo', 'gnd', '0'],
          ['uno', 'D9', 'servo', 'signal', '3'],
        ],
        `#include <Servo.h>

Servo arm;

void setup()
{
  arm.attach(9);
}

void loop()
{
  for (int angle = 0; angle <= 180; angle += 2) {
    arm.write(angle);
    delay(15);
  }
  for (int angle = 180; angle >= 0; angle -= 2) {
    arm.write(angle);
    delay(15);
  }
}
`,
      ),
  },
  {
    id: 'ard-nightlight',
    name: 'Photoresistor Night Light',
    category: 'arduino',
    blurb: 'An LED that brightens as the light level falls. Drag the sensor to dim it.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 260],
          ['ldr', 'photoresistor', -260, -170],
          ['rd', 'resistor', -260, -40, { resistance: 10000 }],
          ['r', 'resistor', 100, -170, { resistance: 220 }],
          ['led', 'led', 280, -170, { color: 'white' }],
        ],
        [
          ['uno', '5V', 'ldr', 'terminal1', '1'],
          ['ldr', 'terminal2', 'rd', 'a', '5'],
          ['ldr', 'terminal2', 'uno', 'A0', '5'],
          ['rd', 'b', 'uno', 'GND', '0'],
          ['uno', 'D9', 'r', 'a', '4'],
          ['r', 'b', 'led', 'anode', '4'],
          ['led', 'cathode', 'uno', 'GND', '0'],
        ],
        `// Darker room, brighter LED.

void setup()
{
  Serial.begin(9600);
  pinMode(9, OUTPUT);
}

void loop()
{
  int light = analogRead(A0);
  int brightness = map(light, 0, 1023, 255, 0);
  analogWrite(9, brightness);
  Serial.print("light ");
  Serial.println(light);
  delay(50);
}
`,
      ),
  },
  {
    id: 'ard-lcd',
    name: 'LCD Hello',
    category: 'arduino',
    blurb: 'Print text and a running counter to a 16 × 2 character display.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 300],
          ['lcd', 'lcd-16x2', 0, -140],
          ['pot', 'potentiometer', -320, 20, { resistance: 10000 }],
        ],
        [
          ['uno', '5V', 'lcd', 'VDD', '1'],
          ['uno', 'GND', 'lcd', 'VSS', '0'],
          ['uno', 'GND', 'lcd', 'RW', '0'],
          ['uno', '5V', 'lcd', 'LED+', '1'],
          ['uno', 'GND', 'lcd', 'LED-', '0'],
          ['uno', '5V', 'pot', 'terminal1', '1'],
          ['pot', 'wiper', 'lcd', 'V0', '2'],
          ['pot', 'terminal2', 'uno', 'GND', '0'],
          ['uno', 'D12', 'lcd', 'RS', '5'],
          ['uno', 'D11', 'lcd', 'E', '5'],
          ['uno', 'D5', 'lcd', 'DB4', '6'],
          ['uno', 'D4', 'lcd', 'DB5', '6'],
          ['uno', 'D3', 'lcd', 'DB6', '6'],
          ['uno', 'D2', 'lcd', 'DB7', '6'],
        ],
        `#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
int seconds = 0;

void setup()
{
  lcd.begin(16, 2);
  lcd.print("Hello, circuit!");
}

void loop()
{
  lcd.setCursor(0, 1);
  lcd.print("Uptime: ");
  lcd.print(seconds);
  lcd.print("s");
  seconds = seconds + 1;
  delay(1000);
}
`,
      ),
  },
  {
    id: 'ard-melody',
    name: 'Piezo Melody',
    category: 'arduino',
    blurb: 'Play a short tune on a piezo buzzer. Turn your sound on.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 220],
          ['piezo', 'piezo', 200, -160],
        ],
        [
          ['uno', 'D8', 'piezo', 'terminal1', '6'],
          ['piezo', 'terminal2', 'uno', 'GND', '0'],
        ],
        `// A short melody on pin 8.

int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup()
{
  pinMode(8, OUTPUT);
}

void loop()
{
  for (int i = 0; i < 8; i++) {
    tone(8, notes[i], 250);
    delay(300);
  }
  noTone(8);
  delay(800);
}
`,
      ),
  },
  {
    id: 'ard-rgb',
    name: 'RGB Colour Mixer',
    category: 'arduino',
    blurb: 'Cycle an RGB LED through the colour wheel with PWM.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 240],
          ['rgb', 'led-rgb', 160, -180, { common: 'cathode' }],
          ['r1', 'resistor', -160, -180, { resistance: 220 }],
          ['r2', 'resistor', -160, -100, { resistance: 220 }],
          ['r3', 'resistor', -160, -20, { resistance: 220 }],
        ],
        [
          ['uno', 'D9', 'r1', 'a', '1'],
          ['r1', 'b', 'rgb', 'red', '1'],
          ['uno', 'D10', 'r2', 'a', '4'],
          ['r2', 'b', 'rgb', 'green', '4'],
          ['uno', 'D11', 'r3', 'a', '5'],
          ['r3', 'b', 'rgb', 'blue', '5'],
          ['rgb', 'common', 'uno', 'GND', '0'],
        ],
        `// Walk an RGB LED around the colour wheel.

int hue = 0;

void setup()
{
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
}

void loop()
{
  int r = 128 + 127 * sin(hue * 0.017453);
  int g = 128 + 127 * sin((hue + 120) * 0.017453);
  int b = 128 + 127 * sin((hue + 240) * 0.017453);
  analogWrite(9, r);
  analogWrite(10, g);
  analogWrite(11, b);
  hue = hue + 2;
  if (hue >= 360) {
    hue = 0;
  }
  delay(20);
}
`,
      ),
  },
  {
    id: 'ard-ultrasonic',
    name: 'Distance Sensor',
    category: 'arduino',
    blurb: 'Measure distance with an ultrasonic sensor. Drag it to change the range.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 260],
          ['us', 'ultrasonic-4pin', 0, -180],
        ],
        [
          ['uno', '5V', 'us', 'VCC', '1'],
          ['uno', 'GND', 'us', 'GND', '0'],
          ['uno', 'D9', 'us', 'TRIG', '5'],
          ['uno', 'D10', 'us', 'ECHO', '4'],
        ],
        `// Ping and time the echo. 29.1 us per cm, there and back.

void setup()
{
  Serial.begin(9600);
  pinMode(9, OUTPUT);
  pinMode(10, INPUT);
}

void loop()
{
  digitalWrite(9, LOW);
  delayMicroseconds(2);
  digitalWrite(9, HIGH);
  delayMicroseconds(10);
  digitalWrite(9, LOW);

  long duration = pulseIn(10, HIGH);
  long cm = duration / 58;
  Serial.print("distance ");
  Serial.println(cm);
  delay(200);
}
`,
      ),
  },
  {
    id: 'ard-temp',
    name: 'Temperature Logger',
    category: 'arduino',
    blurb: 'Convert a TMP36 reading to °C and plot it.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 240],
          ['tmp', 'temperature-sensor', -180, -170],
        ],
        [
          ['uno', '5V', 'tmp', 'power', '1'],
          ['tmp', 'vout', 'uno', 'A0', '5'],
          ['tmp', 'gnd', 'uno', 'GND', '0'],
        ],
        `// TMP36: 500 mV at 0 C, 10 mV per degree.

void setup()
{
  Serial.begin(9600);
}

void loop()
{
  int raw = analogRead(A0);
  float volts = raw * 5.0 / 1024.0;
  float celsius = (volts - 0.5) * 100.0;
  Serial.println(celsius);
  delay(200);
}
`,
      ),
  },
  {
    id: 'ard-traffic',
    name: 'Traffic Light',
    category: 'arduino',
    blurb: 'Three LEDs sequencing like a set of traffic signals.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 260],
          ['r1', 'resistor', -200, -200, { resistance: 220 }],
          ['r2', 'resistor', -200, -120, { resistance: 220 }],
          ['r3', 'resistor', -200, -40, { resistance: 220 }],
          ['led1', 'led', 40, -200, { color: 'red' }],
          ['led2', 'led', 40, -120, { color: 'yellow' }],
          ['led3', 'led', 40, -40, { color: 'green' }],
        ],
        [
          ['uno', 'D13', 'r1', 'a', '1'],
          ['r1', 'b', 'led1', 'anode', '1'],
          ['led1', 'cathode', 'uno', 'GND', '0'],
          ['uno', 'D12', 'r2', 'a', '3'],
          ['r2', 'b', 'led2', 'anode', '3'],
          ['led2', 'cathode', 'uno', 'GND', '0'],
          ['uno', 'D11', 'r3', 'a', '4'],
          ['r3', 'b', 'led3', 'anode', '4'],
          ['led3', 'cathode', 'uno', 'GND', '0'],
        ],
        `// Red, amber, green — in order.

void setup()
{
  pinMode(13, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(11, OUTPUT);
}

void loop()
{
  digitalWrite(13, HIGH);
  delay(3000);
  digitalWrite(12, HIGH);
  delay(800);
  digitalWrite(13, LOW);
  digitalWrite(12, LOW);
  digitalWrite(11, HIGH);
  delay(3000);
  digitalWrite(11, LOW);
  digitalWrite(12, HIGH);
  delay(800);
  digitalWrite(12, LOW);
}
`,
      ),
  },
  {
    id: 'ard-neopixel',
    name: 'NeoPixel Rainbow',
    category: 'arduino',
    blurb: 'Chase a rainbow around an addressable LED ring.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 300],
          ['ring', 'neopixel-ring', 60, -180, { count: 12 }],
        ],
        [
          ['uno', '5V', 'ring', 'VDD', '1'],
          ['uno', 'GND', 'ring', 'VSS', '0'],
          ['uno', 'D6', 'ring', 'DIN', '4'],
        ],
        `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel ring(12, 6);
int offset = 0;

void setup()
{
  ring.begin();
  ring.setBrightness(120);
}

void loop()
{
  for (int i = 0; i < 12; i++) {
    int hue = (i * 30 + offset) % 360;
    int r = 128 + 127 * sin(hue * 0.017453);
    int g = 128 + 127 * sin((hue + 120) * 0.017453);
    int b = 128 + 127 * sin((hue + 240) * 0.017453);
    ring.setPixelColor(i, r, g, b);
  }
  ring.show();
  offset = offset + 6;
  delay(40);
}
`,
      ),
  },
  {
    id: 'ard-shift',
    name: 'Shift Register Counter',
    category: 'arduino',
    blurb: 'Drive eight LEDs from three pins with a 74HC595.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', -260, 320],
          ['sr', '74hc595', 60, 0],
          ['bar', 'bar-graph', 60, -220],
          ['r', 'resistor', -140, -120, { resistance: 470 }],
        ],
        [
          ['uno', '5V', 'sr', 'VCC', '1'],
          ['uno', 'GND', 'sr', 'GND', '0'],
          ['uno', '5V', 'sr', 'MR', '1'],
          ['uno', 'GND', 'sr', 'OE', '0'],
          ['uno', 'D11', 'sr', 'DS', '5'],
          ['uno', 'D12', 'sr', 'SHCP', '4'],
          ['uno', 'D8', 'sr', 'STCP', '6'],
          ['sr', 'Q0', 'bar', 'A1', '2'],
          ['sr', 'Q1', 'bar', 'A2', '2'],
          ['sr', 'Q2', 'bar', 'A3', '2'],
          ['sr', 'Q3', 'bar', 'A4', '2'],
          ['sr', 'Q4', 'bar', 'A5', '2'],
          ['sr', 'Q5', 'bar', 'A6', '2'],
          ['sr', 'Q6', 'bar', 'A7', '2'],
          ['sr', 'Q7', 'bar', 'A8', '2'],
          ['bar', 'K1', 'r', 'a', '0'],
          ['r', 'b', 'uno', 'GND', '0'],
          ['bar', 'K2', 'r', 'a', '0'],
          ['bar', 'K3', 'r', 'a', '0'],
          ['bar', 'K4', 'r', 'a', '0'],
          ['bar', 'K5', 'r', 'a', '0'],
          ['bar', 'K6', 'r', 'a', '0'],
          ['bar', 'K7', 'r', 'a', '0'],
          ['bar', 'K8', 'r', 'a', '0'],
        ],
        `// Count in binary on eight LEDs using three Arduino pins.

int dataPin = 11;
int clockPin = 12;
int latchPin = 8;
int value = 0;

void setup()
{
  pinMode(dataPin, OUTPUT);
  pinMode(clockPin, OUTPUT);
  pinMode(latchPin, OUTPUT);
}

void loop()
{
  digitalWrite(latchPin, LOW);
  shiftOut(dataPin, clockPin, MSBFIRST, value);
  digitalWrite(latchPin, HIGH);
  value = value + 1;
  if (value > 255) {
    value = 0;
  }
  delay(120);
}
`,
      ),
  },
];

// ─── Circuit assemblies ──────────────────────────────────────────────────────

const assemblies: Starter[] = [
  {
    id: 'asm-glow',
    name: 'Glow',
    category: 'assemblies',
    blurb: 'A simple lit assembly — battery, switch and LED, ready to 3D print around.',
    build: () =>
      build(
        [
          ['bat', 'battery-coin', -240, 0],
          ['sw', 'slideswitch', -40, -140],
          ['r', 'resistor', 120, -140, { resistance: 100 }],
          ['led', 'led', 280, 0, { color: 'white' }],
        ],
        [
          ['bat', '+', 'sw', 'common', '1'],
          ['sw', '1', 'r', 'a', '1'],
          ['r', 'b', 'led', 'anode', '1'],
          ['led', 'cathode', 'bat', '-', '0'],
        ],
      ),
  },
  {
    id: 'asm-move',
    name: 'Move',
    category: 'assemblies',
    blurb: 'A servo that sweeps back and forth — the motion assembly.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', 0, 240],
          ['servo', 'micro-servo', 280, -160],
          ['btn', 'pushbutton', -240, -160],
        ],
        [
          ['uno', '5V', 'servo', 'power', '1'],
          ['uno', 'GND', 'servo', 'gnd', '0'],
          ['uno', 'D9', 'servo', 'signal', '3'],
          ['uno', 'D2', 'btn', '1a', '5'],
          ['btn', '2a', 'uno', 'GND', '0'],
        ],
        `#include <Servo.h>

Servo arm;

void setup()
{
  arm.attach(9);
  pinMode(2, INPUT_PULLUP);
}

void loop()
{
  if (digitalRead(2) == LOW) {
    arm.write(180);
  } else {
    arm.write(0);
  }
  delay(20);
}
`,
      ),
  },
  {
    id: 'asm-spin',
    name: 'Spin',
    category: 'assemblies',
    blurb: 'A motor driven through a transistor, so the Arduino can switch it.',
    build: () =>
      build(
        [
          ['uno', 'uno-r3', -240, 260],
          ['q', 'tip120', 120, 0],
          ['rb', 'resistor', -60, -80, { resistance: 1000 }],
          ['d', 'diode', 300, -140],
          ['m', 'dc-motor', 320, 60, { ratedVoltage: 6 }],
          ['bat', 'battery-pack-4aa', 460, -160],
        ],
        [
          ['uno', 'D9', 'rb', 'a', '4'],
          ['rb', 'b', 'q', 'base', '4'],
          ['q', 'emitter', 'uno', 'GND', '0'],
          ['q', 'emitter', 'bat', '-', '0'],
          ['bat', '+', 'm', 'terminal1', '1'],
          ['m', 'terminal2', 'q', 'collector', '2'],
          ['d', 'cathode', 'bat', '+', '1'],
          ['d', 'anode', 'q', 'collector', '2'],
        ],
        `// Switch a motor with a Darlington transistor. The diode catches the
// inductive kick when the motor turns off.

void setup()
{
  pinMode(9, OUTPUT);
}

void loop()
{
  analogWrite(9, 180);
  delay(2000);
  analogWrite(9, 0);
  delay(1000);
}
`,
      ),
  },
];

// ─── micro:bit ───────────────────────────────────────────────────────────────

const microbit: Starter[] = [
  {
    id: 'mb-heart',
    name: 'Beating Heart',
    category: 'microbit',
    blurb: 'The first micro:bit program: a heart that pulses on the 5 x 5 display.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *

while True:
    display.show(Image.HEART)
    sleep(400)
    display.show(Image.HEART_SMALL)
    sleep(400)
`,
      ),
  },
  {
    id: 'mb-name-badge',
    name: 'Name Badge',
    category: 'microbit',
    blurb: 'Scroll a message across the display over and over.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *

while True:
    display.scroll("Hello!")
    display.show(Image.HAPPY)
    sleep(600)
`,
      ),
  },
  {
    id: 'mb-dice',
    name: 'Shake for Dice',
    category: 'microbit',
    blurb: 'Shake the board (or press SHAKE) to roll a number from 1 to 6.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *
import random

display.show(Image.DIAMOND_SMALL)

while True:
    if accelerometer.was_gesture('shake'):
        roll = random.randint(1, 6)
        display.show(roll)
        print("rolled", roll)
        sleep(1500)
        display.show(Image.DIAMOND_SMALL)
    sleep(50)
`,
      ),
  },
  {
    id: 'mb-buttons',
    name: 'Button Counter',
    category: 'microbit',
    blurb: 'A counts up, B counts down. Press the buttons while it runs.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *

count = 0
display.show(count)

while True:
    if button_a.was_pressed():
        count += 1
        display.show(count)
        print("count", count)
    if button_b.was_pressed():
        count -= 1
        display.show(count)
        print("count", count)
    sleep(50)
`,
      ),
  },
  {
    id: 'mb-led',
    name: 'micro:bit Drives an LED',
    category: 'microbit',
    blurb: 'Blink an external LED wired to pin 0 through a resistor.',
    build: () =>
      build(
        [
          ['mb', 'microbit', 0, -60],
          ['r', 'resistor', -160, 260, { resistance: 100 }],
          ['led', 'led', 60, 260, { color: 'red' }],
        ],
        [
          ['mb', '0', 'r', 'a', '1'],
          ['r', 'b', 'led', 'anode', '1'],
          ['led', 'cathode', 'mb', 'GND', '0'],
        ],
        undefined,
        `from microbit import *

while True:
    pin0.write_digital(1)
    display.show(Image.YES)
    sleep(500)
    pin0.write_digital(0)
    display.clear()
    sleep(500)
`,
      ),
  },
  {
    id: 'mb-dimmer',
    name: 'Fade an LED',
    category: 'microbit',
    blurb: 'Pulse-width modulation on pin 0 ramps the brightness up and down.',
    build: () =>
      build(
        [
          ['mb', 'microbit', 0, -60],
          ['r', 'resistor', -160, 260, { resistance: 100 }],
          ['led', 'led', 60, 260, { color: 'blue' }],
        ],
        [
          ['mb', '0', 'r', 'a', '5'],
          ['r', 'b', 'led', 'anode', '5'],
          ['led', 'cathode', 'mb', 'GND', '0'],
        ],
        undefined,
        `from microbit import *

while True:
    for level in range(0, 1024, 64):
        pin0.write_analog(level)
        sleep(30)
    for level in range(1023, -1, -64):
        pin0.write_analog(level)
        sleep(30)
`,
      ),
  },
  {
    id: 'mb-tilt',
    name: 'Tilt the Dot',
    category: 'microbit',
    blurb: 'A dot that slides across the display as you drag the board to tilt it.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *

while True:
    x = accelerometer.get_x()
    y = accelerometer.get_y()
    col = min(max(int((x + 1000) * 5 / 2000), 0), 4)
    row = min(max(int((y + 1000) * 5 / 2000), 0), 4)
    display.clear()
    display.set_pixel(col, row, 9)
    sleep(60)
`,
      ),
  },
  {
    id: 'mb-thermometer',
    name: 'Thermometer',
    category: 'microbit',
    blurb: 'Read the on-board temperature sensor and scroll it in degrees.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *

while True:
    degrees = temperature()
    display.scroll(str(degrees))
    print("temperature", degrees)
    sleep(1000)
`,
      ),
  },
  {
    id: 'mb-music',
    name: 'Play a Melody',
    category: 'microbit',
    blurb: 'Press A for a tune, B for a single note. Turn your sound on.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *
import music

display.show(Image.MUSIC_QUAVER)

while True:
    if button_a.was_pressed():
        music.play(music.BIRTHDAY)
    if button_b.was_pressed():
        music.pitch(440, 400)
    sleep(50)
`,
      ),
  },
  {
    id: 'mb-compass',
    name: 'Compass',
    category: 'microbit',
    blurb: 'An arrow that points north as you rotate the board.',
    build: () =>
      build(
        [['mb', 'microbit', 0, 0]],
        [],
        undefined,
        `from microbit import *

arrows = [Image.ARROW_N, Image.ARROW_NE, Image.ARROW_E, Image.ARROW_SE,
          Image.ARROW_S, Image.ARROW_SW, Image.ARROW_W, Image.ARROW_NW]

while True:
    heading = compass.heading()
    index = int((heading + 22) / 45) % 8
    display.show(arrows[index])
    sleep(100)
`,
      ),
  },
];

export const STARTERS: Starter[] = [...basics, ...arduino, ...assemblies, ...microbit];

export const STARTER_CATEGORIES: { id: StarterCategory; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'arduino', label: 'Arduino' },
  { id: 'microbit', label: 'micro:bit' },
  { id: 'assemblies', label: 'Circuit Assemblies' },
];
