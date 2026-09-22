/**
 * micro:bit hardware state.
 *
 * Same role as the Arduino `Board`: the program writes intents here, the
 * device model reads them each solver step and stamps the circuit, then writes
 * the solved pin voltages back.
 */

export const MB_VCC = 3.3;
export const MB_PIN_COUNT = 21;

/** Only these pins are exposed on the part; the rest are internal. */
export const MB_EDGE_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20];

export const R_OUT = 30;
export const R_PULL = 22_000;

export type MbPinMode = 'unused' | 'digital-in' | 'digital-out' | 'analog-in' | 'analog-out' | 'touch';
export type MbPull = 'up' | 'down' | 'none';

export interface MbButton {
  pressed: boolean;
  /** Set on each press, cleared by `was_pressed()`. */
  latched: boolean;
  presses: number;
}

export interface MbTone {
  pin: number;
  frequency: number;
  /** Simulated seconds at which it stops; Infinity while a pitch is held. */
  until: number;
}

export class MicrobitBoard {
  /** 5 × 5 brightness, 0–9, row-major. */
  display = new Uint8Array(25);
  displayOn = true;

  buttonA: MbButton = { pressed: false, latched: false, presses: 0 };
  buttonB: MbButton = { pressed: false, latched: false, presses: 0 };
  /** The logo touch sensor on a v2. */
  logoTouched = false;

  modes: MbPinMode[] = new Array(MB_PIN_COUNT).fill('unused');
  pulls: MbPull[] = new Array(MB_PIN_COUNT).fill('none');
  /** Commanded output level, 0–1023. Digital HIGH is 1023. */
  outputs = new Float64Array(MB_PIN_COUNT);
  driving = new Uint8Array(MB_PIN_COUNT);
  /** Solved voltage on each pin, written back by the device model. */
  sensed = new Float64Array(MB_PIN_COUNT);

  /** Simulated seconds since reset. */
  time = 0;

  /** Milli-g on each axis; 0,0,-1000 is flat and face-up. */
  accel = { x: 0, y: 0, z: -1000 };
  gesture = 'face up';
  gestureLatched = new Set<string>();
  compassHeading = 0;
  compassCalibrated = true;
  temperature = 21;
  lightLevel = 128;
  soundLevel = 42;

  tone: MbTone | null = null;
  /** Volume 0–255, as `set_volume` sets it on a v2. */
  volume = 180;

  serialTx: string[] = [];
  private txPartial = '';
  serialRx: number[] = [];

  /** Set when a program constructs a NeoPixel strip on one of the pins. */
  neopixels: { pin: number; count: number; pixels: number[][] } | null = null;

  /** Messages queued by the radio module, shared by every board in a design. */
  radioQueue: string[] = [];
  radioOn = false;
  radioGroup = 0;
  onRadioSend?: (msg: string, group: number) => void;

  reset() {
    this.display.fill(0);
    this.displayOn = true;
    this.buttonA = { pressed: false, latched: false, presses: 0 };
    this.buttonB = { pressed: false, latched: false, presses: 0 };
    this.logoTouched = false;
    this.modes.fill('unused');
    this.pulls.fill('none');
    this.outputs.fill(0);
    this.driving.fill(0);
    this.sensed.fill(0);
    this.time = 0;
    this.accel = { x: 0, y: 0, z: -1000 };
    this.gesture = 'face up';
    this.gestureLatched.clear();
    this.compassHeading = 0;
    this.temperature = 21;
    this.lightLevel = 128;
    this.tone = null;
    this.serialTx = [];
    this.txPartial = '';
    this.serialRx = [];
    this.radioQueue = [];
    this.radioOn = false;
    this.neopixels = null;
  }

  // ── display ────────────────────────────────────────────────────────────────

  setPixel(x: number, y: number, brightness: number) {
    if (x < 0 || x > 4 || y < 0 || y > 4) return;
    this.display[y * 5 + x] = Math.max(0, Math.min(9, Math.round(brightness)));
  }

  getPixel(x: number, y: number) {
    if (x < 0 || x > 4 || y < 0 || y > 4) return 0;
    return this.display[y * 5 + x];
  }

  showFrame(pixels: number[]) {
    for (let i = 0; i < 25; i++) this.display[i] = Math.max(0, Math.min(9, pixels[i] ?? 0));
  }

  clearDisplay() {
    this.display.fill(0);
  }

  /** What the part renders: 0–1 per LED, dark when the display is off. */
  frame(): number[] {
    if (!this.displayOn) return new Array(25).fill(0);
    return Array.from(this.display, (b) => b / 9);
  }

  // ── pins ───────────────────────────────────────────────────────────────────

  private valid(pin: number) {
    return Number.isFinite(pin) && pin >= 0 && pin < MB_PIN_COUNT;
  }

  writeDigital(pin: number, high: boolean) {
    if (!this.valid(pin)) return;
    this.modes[pin] = 'digital-out';
    this.outputs[pin] = high ? 1023 : 0;
    this.driving[pin] = 1;
  }

  writeAnalog(pin: number, value: number) {
    if (!this.valid(pin)) return;
    this.modes[pin] = 'analog-out';
    this.outputs[pin] = Math.max(0, Math.min(1023, value));
    this.driving[pin] = 1;
  }

  readDigital(pin: number): number {
    if (!this.valid(pin)) return 0;
    if (this.modes[pin] === 'digital-out' || this.modes[pin] === 'analog-out') {
      return this.outputs[pin] > 511 ? 1 : 0;
    }
    this.modes[pin] = 'digital-in';
    this.driving[pin] = 0;
    return this.sensed[pin] > MB_VCC * 0.5 ? 1 : 0;
  }

  readAnalog(pin: number): number {
    if (!this.valid(pin)) return 0;
    this.modes[pin] = 'analog-in';
    this.driving[pin] = 0;
    return Math.round((Math.max(0, Math.min(MB_VCC, this.sensed[pin])) / MB_VCC) * 1023);
  }

  setPull(pin: number, pull: MbPull) {
    if (!this.valid(pin)) return;
    this.pulls[pin] = pull;
    if (this.modes[pin] === 'unused') this.modes[pin] = 'digital-in';
    this.driving[pin] = 0;
  }

  isTouched(pin: number): boolean {
    if (!this.valid(pin)) return false;
    this.modes[pin] = 'touch';
    // Touch pads read as touched when pulled toward ground.
    return this.sensed[pin] < MB_VCC * 0.35;
  }

  /** What the solver should stamp for this pin, or null for high-impedance. */
  drive(pin: number): { v: number; r: number } | null {
    if (!this.valid(pin)) return null;
    if (this.driving[pin] && (this.modes[pin] === 'digital-out' || this.modes[pin] === 'analog-out')) {
      return { v: (this.outputs[pin] / 1023) * MB_VCC, r: R_OUT };
    }
    if (this.pulls[pin] === 'up') return { v: MB_VCC, r: R_PULL };
    if (this.pulls[pin] === 'down') return { v: 0, r: R_PULL };
    return null;
  }

  runningTime() {
    return Math.floor(this.time * 1000);
  }

  // ── buttons ────────────────────────────────────────────────────────────────

  press(which: 'a' | 'b', down: boolean) {
    const b = which === 'a' ? this.buttonA : this.buttonB;
    if (down && !b.pressed) {
      b.latched = true;
      b.presses++;
    }
    b.pressed = down;
  }

  wasPressed(which: 'a' | 'b') {
    const b = which === 'a' ? this.buttonA : this.buttonB;
    const v = b.latched;
    b.latched = false;
    return v;
  }

  getPresses(which: 'a' | 'b') {
    const b = which === 'a' ? this.buttonA : this.buttonB;
    const n = b.presses;
    b.presses = 0;
    return n;
  }

  // ── motion ─────────────────────────────────────────────────────────────────

  /**
   * Set the board's tilt in degrees and derive the accelerometer reading and
   * the current gesture from it, so dragging the board on the canvas produces
   * the same values a program would see from real motion.
   */
  setTilt(degX: number, degY: number) {
    const rx = (degX * Math.PI) / 180;
    const ry = (degY * Math.PI) / 180;
    this.accel = {
      x: Math.round(Math.sin(rx) * 1000),
      y: Math.round(Math.sin(ry) * 1000),
      z: Math.round(-Math.cos(rx) * Math.cos(ry) * 1000),
    };
    this.compassHeading = (Math.round(degX * 2) + 360) % 360;

    const g =
      degX > 45 ? 'left'
      : degX < -45 ? 'right'
      : degY > 45 ? 'down'
      : degY < -45 ? 'up'
      : 'face up';
    if (g !== this.gesture) this.gestureLatched.add(g);
    this.gesture = g;
  }

  wasGesture(name: string) {
    const hit = this.gestureLatched.has(name);
    this.gestureLatched.delete(name);
    return hit;
  }

  shake() {
    this.gestureLatched.add('shake');
    this.gesture = 'shake';
  }

  // ── serial ─────────────────────────────────────────────────────────────────

  print(text: string) {
    this.txPartial += text;
    let nl = this.txPartial.indexOf('\n');
    while (nl >= 0) {
      this.serialTx.push(this.txPartial.slice(0, nl).replace(/\r$/, ''));
      this.txPartial = this.txPartial.slice(nl + 1);
      nl = this.txPartial.indexOf('\n');
    }
    if (this.serialTx.length > 2000) this.serialTx.splice(0, this.serialTx.length - 2000);
  }

  feedRx(text: string) {
    for (const ch of text) this.serialRx.push(ch.charCodeAt(0));
  }

  readLine(): string | null {
    const idx = this.serialRx.indexOf(10);
    if (idx < 0) return null;
    const line = this.serialRx.splice(0, idx + 1);
    return line.map((c) => String.fromCharCode(c)).join('').replace(/[\r\n]+$/, '');
  }
}

/** micro:bit pin number → the terminal name on the part. */
export function mbPinTerminal(pin: number): string | null {
  if (pin === 0 || pin === 1 || pin === 2) return String(pin);
  if (MB_EDGE_PINS.includes(pin)) return `P${pin}`;
  return null;
}
