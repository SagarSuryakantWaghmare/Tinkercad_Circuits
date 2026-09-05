/**
 * The board's I/O state — the boundary between the sketch and the circuit.
 *
 * The interpreter writes pin intents here; the MCU device model reads them each
 * solver step and stamps the corresponding sources, then writes the solved
 * voltages back for the next `digitalRead`/`analogRead`.
 */

export type PinMode = 'input' | 'output' | 'input_pullup';

export const VCC = 5;

/** Output driver impedance of an AVR pin, and the pull-up value. */
export const R_OUTPUT = 25;
export const R_PULLUP = 20_000;
export const R_INPUT = 1e8;

/** Analog pins continue the digital numbering: A0 is 14. */
export const A0_INDEX = 14;
export const PIN_COUNT = 20;

export interface ToneState {
  pin: number;
  frequency: number;
  /** Simulated seconds at which the tone stops; Infinity for an open-ended tone. */
  until: number;
}

export class Board {
  modes = new Array<PinMode>(PIN_COUNT).fill('input');
  /** Requested output level, 0…255. Digital HIGH is 255. */
  duty = new Float64Array(PIN_COUNT);
  /** Whether the pin is being driven at all this step. */
  driving = new Uint8Array(PIN_COUNT);
  /** Solved voltage on each pin, written back by the device model. */
  sensed = new Float64Array(PIN_COUNT);

  /** Simulated seconds since reset. */
  time = 0;

  serialTx: string[] = [];
  private txPartial = '';
  serialRx: number[] = [];
  serialBaud = 9600;
  serialOpen = false;

  /** pin → commanded angle in degrees (positional) or speed (continuous). */
  servos = new Map<number, { angle: number; attached: boolean; min: number; max: number }>();
  tone: ToneState | null = null;

  /** Names for the parts a shield-style library drives, keyed by object id. */
  peripherals = new Map<string, unknown>();

  reset() {
    this.modes.fill('input');
    this.duty.fill(0);
    this.driving.fill(0);
    this.sensed.fill(0);
    this.time = 0;
    this.serialTx = [];
    this.txPartial = '';
    this.serialRx = [];
    this.serialOpen = false;
    this.servos.clear();
    this.tone = null;
    this.peripherals.clear();
  }

  // ── digital / analog I/O ───────────────────────────────────────────────────

  pinMode(pin: number, mode: PinMode) {
    if (!this.valid(pin)) return;
    this.modes[pin] = mode;
    if (mode !== 'output') this.driving[pin] = 0;
  }

  digitalWrite(pin: number, high: boolean) {
    if (!this.valid(pin)) return;
    if (this.modes[pin] === 'output') {
      this.duty[pin] = high ? 255 : 0;
      this.driving[pin] = 1;
    } else {
      // Writing HIGH to an input pin enables the pull-up, as on real hardware.
      this.modes[pin] = high ? 'input_pullup' : 'input';
    }
  }

  analogWrite(pin: number, value: number) {
    if (!this.valid(pin)) return;
    this.modes[pin] = 'output';
    this.duty[pin] = Math.max(0, Math.min(255, Math.round(value)));
    this.driving[pin] = 1;
  }

  digitalRead(pin: number): number {
    if (!this.valid(pin)) return 0;
    if (this.modes[pin] === 'output') return this.duty[pin] > 127 ? 1 : 0;
    // TTL thresholds on a 5 V part.
    return this.sensed[pin] > VCC * 0.5 ? 1 : 0;
  }

  analogRead(pin: number): number {
    if (!this.valid(pin)) return 0;
    const v = Math.max(0, Math.min(VCC, this.sensed[pin]));
    return Math.round((v / VCC) * 1023);
  }

  /** What the solver should stamp for this pin, or null for high-impedance. */
  drive(pin: number): { v: number; r: number } | null {
    if (!this.valid(pin)) return null;
    if (this.modes[pin] === 'output' && this.driving[pin]) {
      return { v: (this.duty[pin] / 255) * VCC, r: R_OUTPUT };
    }
    if (this.modes[pin] === 'input_pullup') return { v: VCC, r: R_PULLUP };
    return null;
  }

  millis() {
    return Math.floor(this.time * 1000);
  }
  micros() {
    return Math.floor(this.time * 1e6);
  }

  // ── serial ─────────────────────────────────────────────────────────────────

  /**
   * Buffer transmitted text and split it into lines. Output is line-oriented so
   * the monitor and the plotter can both consume it, with any trailing partial
   * line exposed separately.
   */
  print(text: string) {
    if (!this.serialOpen) return;
    this.txPartial += text;
    let nl = this.txPartial.indexOf('\n');
    while (nl >= 0) {
      this.serialTx.push(this.txPartial.slice(0, nl).replace(/\r$/, ''));
      this.txPartial = this.txPartial.slice(nl + 1);
      nl = this.txPartial.indexOf('\n');
    }
    if (this.serialTx.length > 2000) this.serialTx.splice(0, this.serialTx.length - 2000);
  }

  get pendingLine() {
    return this.txPartial;
  }

  feedRx(text: string) {
    for (const ch of text) this.serialRx.push(ch.charCodeAt(0));
  }

  private valid(pin: number) {
    return Number.isFinite(pin) && pin >= 0 && pin < PIN_COUNT;
  }
}

/** Arduino pin number → the terminal name on the board part. */
export function pinTerminal(pin: number): string | null {
  if (pin < 0) return null;
  if (pin < A0_INDEX) return `D${pin}`;
  if (pin < PIN_COUNT) return `A${pin - A0_INDEX}`;
  return null;
}
