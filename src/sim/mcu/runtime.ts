import { A0_INDEX, Board, VCC } from './board';
import { CPU_HZ, RuntimeError, type Interpreter, type Wait } from './Interpreter';
import {
  ArduinoArray,
  formatFloat,
  formatNumber,
  formatWithBase,
  ObjectValue,
  toNum,
  toStr,
  type Value,
} from './values';

/**
 * The Arduino core API and the bundled libraries.
 *
 * These are implemented natively rather than interpreted: they are exact, they
 * are fast, and they are where the sketch meets the circuit. Anything that
 * consumes simulated time (delay, tone with a duration, pulseIn) is written as
 * a generator so it suspends the VM instead of blocking.
 */
export function installRuntime(interp: Interpreter, board: Board) {
  const K = interp.constants;

  // ── constants ──────────────────────────────────────────────────────────────
  K.set('HIGH', 1);
  K.set('LOW', 0);
  K.set('INPUT', 0);
  K.set('OUTPUT', 1);
  K.set('INPUT_PULLUP', 2);
  K.set('LED_BUILTIN', 13);
  K.set('true', 1);
  K.set('false', 0);
  K.set('PI', Math.PI);
  K.set('HALF_PI', Math.PI / 2);
  K.set('TWO_PI', Math.PI * 2);
  K.set('EULER', Math.E);
  K.set('DEG_TO_RAD', Math.PI / 180);
  K.set('RAD_TO_DEG', 180 / Math.PI);
  K.set('BIN', 2);
  K.set('OCT', 8);
  K.set('DEC', 10);
  K.set('HEX', 16);
  K.set('MSBFIRST', 1);
  K.set('LSBFIRST', 0);
  K.set('CHANGE', 1);
  K.set('FALLING', 2);
  K.set('RISING', 3);
  for (let i = 0; i < 6; i++) K.set(`A${i}`, A0_INDEX + i);

  const N = interp.natives;
  const n = (v: Value) => toNum(v);

  // ── digital & analog I/O ───────────────────────────────────────────────────
  N.set('pinMode', (a) => {
    const mode = n(a[1]);
    board.pinMode(n(a[0]), mode === 1 ? 'output' : mode === 2 ? 'input_pullup' : 'input');
    return 0;
  });
  N.set('digitalWrite', (a) => {
    board.digitalWrite(n(a[0]), n(a[1]) !== 0);
    return 0;
  });
  N.set('digitalRead', (a) => board.digitalRead(n(a[0])));
  N.set('analogWrite', (a) => {
    board.analogWrite(n(a[0]), n(a[1]));
    return 0;
  });
  N.set('analogRead', (a) => board.analogRead(n(a[0])));
  N.set('analogReference', () => 0);

  // ── time ───────────────────────────────────────────────────────────────────
  N.set('millis', () => board.millis());
  N.set('micros', () => board.micros());
  N.set('delay', function* (a): Generator<Wait, Value, void> {
    yield* interp.sleepCycles(Math.max(0, n(a[0])) * (CPU_HZ / 1000));
    return 0;
  });
  N.set('delayMicroseconds', function* (a): Generator<Wait, Value, void> {
    yield* interp.sleepCycles(Math.max(0, n(a[0])) * (CPU_HZ / 1e6));
    return 0;
  });

  // ── maths ──────────────────────────────────────────────────────────────────
  N.set('min', (a) => Math.min(n(a[0]), n(a[1])));
  N.set('max', (a) => Math.max(n(a[0]), n(a[1])));
  N.set('abs', (a) => Math.abs(n(a[0])));
  N.set('constrain', (a) => Math.min(Math.max(n(a[0]), n(a[1])), n(a[2])));
  N.set('map', (a) => {
    const [x, inMin, inMax, outMin, outMax] = a.map(n);
    if (inMax === inMin) return outMin;
    // Arduino's map is integer arithmetic and truncates.
    return Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin);
  });
  N.set('pow', (a) => Math.pow(n(a[0]), n(a[1])));
  N.set('sqrt', (a) => Math.sqrt(n(a[0])));
  N.set('sq', (a) => n(a[0]) * n(a[0]));
  N.set('sin', (a) => Math.sin(n(a[0])));
  N.set('cos', (a) => Math.cos(n(a[0])));
  N.set('tan', (a) => Math.tan(n(a[0])));
  N.set('atan', (a) => Math.atan(n(a[0])));
  N.set('atan2', (a) => Math.atan2(n(a[0]), n(a[1])));
  N.set('asin', (a) => Math.asin(n(a[0])));
  N.set('acos', (a) => Math.acos(n(a[0])));
  N.set('log', (a) => Math.log(n(a[0])));
  N.set('log10', (a) => Math.log10(n(a[0])));
  N.set('exp', (a) => Math.exp(n(a[0])));
  N.set('floor', (a) => Math.floor(n(a[0])));
  N.set('ceil', (a) => Math.ceil(n(a[0])));
  N.set('round', (a) => Math.round(n(a[0])));
  N.set('radians', (a) => (n(a[0]) * Math.PI) / 180);
  N.set('degrees', (a) => (n(a[0]) * 180) / Math.PI);

  // Arduino's PRNG is deterministic per seed; ours is too so runs repeat.
  let seed = 1;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    // Divide by (max + 1) so the result is always < 1. Using 0x7fffffff as
    // the divisor lets seed = 0x7fffffff evaluate to 1.0 exactly, and
    // Math.floor(1.0 * hi) returns hi — one past Arduino's contract of
    // 0..hi-1.
    return seed / 0x80000000;
  };
  N.set('randomSeed', (a) => {
    seed = Math.trunc(n(a[0])) || 1;
    return 0;
  });
  N.set('random', (a) => {
    if (a.length >= 2) {
      const lo = Math.trunc(n(a[0]));
      const hi = Math.trunc(n(a[1]));
      return hi <= lo ? lo : lo + Math.floor(rnd() * (hi - lo));
    }
    const hi = Math.trunc(n(a[0]));
    return hi <= 0 ? 0 : Math.floor(rnd() * hi);
  });

  // ── bits & bytes ───────────────────────────────────────────────────────────
  N.set('lowByte', (a) => Math.trunc(n(a[0])) & 0xff);
  N.set('highByte', (a) => (Math.trunc(n(a[0])) >> 8) & 0xff);
  N.set('bitRead', (a) => (Math.trunc(n(a[0])) >> Math.trunc(n(a[1]))) & 1);
  N.set('bitSet', (a) => Math.trunc(n(a[0])) | (1 << Math.trunc(n(a[1]))));
  N.set('bitClear', (a) => Math.trunc(n(a[0])) & ~(1 << Math.trunc(n(a[1]))));
  N.set('bitWrite', (a) => {
    const v = Math.trunc(n(a[0]));
    const b = Math.trunc(n(a[1]));
    return n(a[2]) ? v | (1 << b) : v & ~(1 << b);
  });
  N.set('bit', (a) => 1 << Math.trunc(n(a[0])));

  // ── characters ─────────────────────────────────────────────────────────────
  const ch = (v: Value) => String.fromCharCode(toNum(v));
  N.set('isAlpha', (a) => (/[A-Za-z]/.test(ch(a[0])) ? 1 : 0));
  N.set('isDigit', (a) => (/[0-9]/.test(ch(a[0])) ? 1 : 0));
  N.set('isAlphaNumeric', (a) => (/[A-Za-z0-9]/.test(ch(a[0])) ? 1 : 0));
  N.set('isSpace', (a) => (/\s/.test(ch(a[0])) ? 1 : 0));
  N.set('isUpperCase', (a) => (/[A-Z]/.test(ch(a[0])) ? 1 : 0));
  N.set('isLowerCase', (a) => (/[a-z]/.test(ch(a[0])) ? 1 : 0));
  N.set('isPunct', (a) => (/[!-/:-@[-`{-~]/.test(ch(a[0])) ? 1 : 0));
  N.set('toupper', (a) => ch(a[0]).toUpperCase().charCodeAt(0));
  N.set('tolower', (a) => ch(a[0]).toLowerCase().charCodeAt(0));

  // ── conversions ────────────────────────────────────────────────────────────
  N.set('String', (a) =>
    a.length > 1 ? formatWithBase(n(a[0]), n(a[1])) : toStr(a[0] ?? ''),
  );
  N.set('int', (a) => Math.trunc(n(a[0])));
  N.set('float', (a) => n(a[0]));
  N.set('char', (a) => Math.trunc(n(a[0])) & 0xff);
  N.set('byte', (a) => Math.trunc(n(a[0])) & 0xff);
  N.set('atoi', (a) => parseInt(toStr(a[0]), 10) || 0);
  N.set('atof', (a) => parseFloat(toStr(a[0])) || 0);
  N.set('strlen', (a) => toStr(a[0]).length);
  N.set('dtostrf', (a) => formatFloat(n(a[0]), n(a[2])));

  // ── tone ───────────────────────────────────────────────────────────────────
  N.set('tone', function* (a): Generator<Wait, Value, void> {
    const pin = n(a[0]);
    const freq = n(a[1]);
    const dur = a.length > 2 ? n(a[2]) : 0;
    board.tone = {
      pin,
      frequency: freq,
      until: dur > 0 ? board.time + dur / 1000 : Infinity,
    };
    // A tone with a duration does not block on real hardware, so neither here.
    return 0;
  });
  N.set('noTone', () => {
    board.tone = null;
    return 0;
  });

  // ── pulse / shift ──────────────────────────────────────────────────────────
  N.set('pulseIn', function* (a): Generator<Wait, Value, void> {
    // Peripherals that answer a pulse (the ultrasonic sensor) park their reply
    // here; without one, report the Arduino timeout of 0.
    const pin = n(a[0]);
    const reply = board.peripherals.get(`pulse:${pin}`);
    yield* interp.sleepCycles(CPU_HZ / 1000);
    return typeof reply === 'number' ? reply : 0;
  });
  N.set('shiftOut', function* (a): Generator<Wait, Value, void> {
    const dataPin = n(a[0]);
    const clockPin = n(a[1]);
    const order = n(a[2]);
    const value = Math.trunc(n(a[3])) & 0xff;
    // Yield between each clock edge so the solver commits a step and the
    // shift register sees eight distinct rising edges — otherwise every bit
    // collapses onto the last one in the same JS tick.
    const perEdge = Math.max(1, Math.round(CPU_HZ * 1e-6));
    for (let i = 0; i < 8; i++) {
      const bit = order === 1 ? (value >> (7 - i)) & 1 : (value >> i) & 1;
      board.digitalWrite(dataPin, bit === 1);
      yield* interp.sleepCycles(perEdge);
      board.digitalWrite(clockPin, true);
      yield* interp.sleepCycles(perEdge);
      board.digitalWrite(clockPin, false);
      yield* interp.sleepCycles(perEdge);
    }
    return 0;
  });
  N.set('shiftIn', () => 0);
  N.set('attachInterrupt', () => 0);
  N.set('detachInterrupt', () => 0);
  N.set('digitalPinToInterrupt', (a) => n(a[0]));
  N.set('interrupts', () => 0);
  N.set('noInterrupts', () => 0);
  N.set('yield', () => 0);

  // ── Serial ─────────────────────────────────────────────────────────────────
  const serial = makeSerial(board);
  interp.constants.set('Serial', serial as unknown as Value);
  // `Serial` resolves through the constant table; give the VM the object too.
  interp.classFactories.set('SoftwareSerial', () => makeSerial(board, true));

  // ── libraries ──────────────────────────────────────────────────────────────
  installServo(interp, board);
  installLcd(interp, board);
  installNeoPixel(interp, board);
  installWireSpiEeprom(interp, board);
  installStepper(interp, board);
}

// ── Serial ───────────────────────────────────────────────────────────────────

function makeSerial(board: Board, soft = false): ObjectValue {
  const write = (v: Value, arg?: Value) => {
    if (arg !== undefined && typeof v === 'number') {
      const base = toNum(arg);
      board.print(base >= 2 && base <= 16 ? formatWithBase(v, base) : formatFloat(v, base));
      return;
    }
    board.print(toStr(v));
  };

  return new ObjectValue(soft ? 'SoftwareSerial' : 'HardwareSerial', {
    begin: (a) => {
      board.serialOpen = true;
      if (!soft) board.serialBaud = toNum(a[0]) || 9600;
      return 0;
    },
    end: () => {
      board.serialOpen = false;
      return 0;
    },
    print: (a) => {
      write(a[0] ?? '', a[1]);
      return 0;
    },
    println: (a) => {
      if (a.length) write(a[0], a[1]);
      board.print('\n');
      return 0;
    },
    write: (a) => {
      const v = a[0];
      if (v instanceof ArduinoArray) board.print(toStr(v));
      else if (typeof v === 'number') board.print(String.fromCharCode(v));
      else board.print(toStr(v));
      return 0;
    },
    printf: (a) => {
      board.print(cFormat(toStr(a[0]), a.slice(1)));
      return 0;
    },
    available: () => board.serialRx.length,
    read: () => (board.serialRx.length ? board.serialRx.shift()! : -1),
    peek: () => (board.serialRx.length ? board.serialRx[0] : -1),
    readString: () => {
      const s = board.serialRx.map((c) => String.fromCharCode(c)).join('');
      board.serialRx = [];
      return s;
    },
    readStringUntil: (a) => {
      const term = toNum(a[0]);
      const idx = board.serialRx.indexOf(term);
      const take = idx < 0 ? board.serialRx.length : idx + 1;
      const s = board.serialRx.splice(0, take).map((c) => String.fromCharCode(c)).join('');
      return s.replace(/[\n\r]$/, '');
    },
    parseInt: () => {
      const s = board.serialRx.map((c) => String.fromCharCode(c)).join('');
      board.serialRx = [];
      return parseInt(s, 10) || 0;
    },
    parseFloat: () => {
      const s = board.serialRx.map((c) => String.fromCharCode(c)).join('');
      board.serialRx = [];
      return parseFloat(s) || 0;
    },
    flush: () => 0,
    setTimeout: () => 0,
  });
}

/** Minimal printf for `Serial.printf` and `sprintf`. */
function cFormat(fmt: string, args: Value[]): string {
  let i = 0;
  return fmt.replace(/%(-?\d+)?(?:\.(\d+))?([difsuxXcl%])/g, (_m, w, prec, conv) => {
    if (conv === '%') return '%';
    const v = args[i++];
    let out: string;
    switch (conv) {
      case 'd': case 'i': case 'u': case 'l': out = String(Math.trunc(toNum(v))); break;
      case 'f': out = formatFloat(toNum(v), prec ? Number(prec) : 2); break;
      case 'x': out = (Math.trunc(toNum(v)) >>> 0).toString(16); break;
      case 'X': out = (Math.trunc(toNum(v)) >>> 0).toString(16).toUpperCase(); break;
      case 'c': out = String.fromCharCode(toNum(v)); break;
      default: out = toStr(v);
    }
    if (w) {
      const width = Number(w);
      out = width < 0 ? out.padEnd(-width) : out.padStart(width);
    }
    return out;
  });
}

// ── Servo ────────────────────────────────────────────────────────────────────

function installServo(interp: Interpreter, board: Board) {
  interp.classFactories.set('Servo', () => {
    const st = { pin: -1 };
    return new ObjectValue('Servo', {
      attach: (a) => {
        st.pin = toNum(a[0]);
        board.servos.set(st.pin, {
          angle: 90,
          attached: true,
          min: a.length > 1 ? toNum(a[1]) : 544,
          max: a.length > 2 ? toNum(a[2]) : 2400,
        });
        return 0;
      },
      detach: () => {
        const s = board.servos.get(st.pin);
        if (s) s.attached = false;
        return 0;
      },
      write: (a) => {
        const s = board.servos.get(st.pin);
        if (s) s.angle = Math.max(0, Math.min(180, toNum(a[0])));
        return 0;
      },
      writeMicroseconds: (a) => {
        const s = board.servos.get(st.pin);
        if (s) {
          const us = toNum(a[0]);
          s.angle = Math.max(0, Math.min(180, ((us - s.min) / (s.max - s.min)) * 180));
        }
        return 0;
      },
      read: () => board.servos.get(st.pin)?.angle ?? 0,
      attached: () => (board.servos.get(st.pin)?.attached ? 1 : 0),
    });
  });
}

// ── LiquidCrystal ────────────────────────────────────────────────────────────

export interface LcdState {
  cols: number;
  rows: number;
  buffer: string[];
  cursor: { col: number; row: number };
  backlight: boolean;
  display: boolean;
  pins: number[];
}

function installLcd(interp: Interpreter, board: Board) {
  const factory = (args: Value[]) => {
    const pins = args.map(toNum).filter((v) => Number.isFinite(v));
    const st: LcdState = {
      cols: 16,
      rows: 2,
      buffer: ['', ''],
      cursor: { col: 0, row: 0 },
      backlight: true,
      display: true,
      pins,
    };
    const id = `lcd:${pins.join(',')}`;
    board.peripherals.set(id, st);

    const put = (text: string) => {
      const row = Math.min(st.cursor.row, st.rows - 1);
      const line = (st.buffer[row] ?? '').padEnd(st.cols, ' ');
      const before = line.slice(0, st.cursor.col);
      const after = line.slice(st.cursor.col + text.length);
      st.buffer[row] = (before + text + after).slice(0, st.cols);
      st.cursor.col = Math.min(st.cursor.col + text.length, st.cols);
    };

    return new ObjectValue('LiquidCrystal', {
      begin: (a) => {
        st.cols = toNum(a[0]) || 16;
        st.rows = toNum(a[1]) || 2;
        st.buffer = Array.from({ length: st.rows }, () => '');
        return 0;
      },
      clear: () => {
        st.buffer = Array.from({ length: st.rows }, () => '');
        st.cursor = { col: 0, row: 0 };
        return 0;
      },
      home: () => {
        st.cursor = { col: 0, row: 0 };
        return 0;
      },
      setCursor: (a) => {
        st.cursor = { col: toNum(a[0]), row: toNum(a[1]) };
        return 0;
      },
      print: (a) => {
        put(a.length > 1 ? formatWithBase(toNum(a[0]), toNum(a[1])) : toStr(a[0]));
        return 0;
      },
      write: (a) => {
        put(typeof a[0] === 'number' ? String.fromCharCode(a[0]) : toStr(a[0]));
        return 0;
      },
      println: (a) => {
        put(toStr(a[0] ?? ''));
        st.cursor = { col: 0, row: Math.min(st.cursor.row + 1, st.rows - 1) };
        return 0;
      },
      noDisplay: () => ((st.display = false), 0),
      display: () => ((st.display = true), 0),
      backlight: () => ((st.backlight = true), 0),
      noBacklight: () => ((st.backlight = false), 0),
      cursor: () => 0,
      noCursor: () => 0,
      blink: () => 0,
      noBlink: () => 0,
      scrollDisplayLeft: () => 0,
      scrollDisplayRight: () => 0,
      autoscroll: () => 0,
      noAutoscroll: () => 0,
      leftToRight: () => 0,
      rightToLeft: () => 0,
      createChar: () => 0,
      init: () => 0,
    }, st as unknown as Record<string, unknown>);
  };

  for (const name of ['LiquidCrystal', 'LiquidCrystal_I2C', 'Adafruit_LiquidCrystal']) {
    interp.classFactories.set(name, factory);
  }
}

// ── NeoPixel ─────────────────────────────────────────────────────────────────

export interface NeoState {
  count: number;
  pin: number;
  /** Same shape as the other peripherals so one matcher handles them all. */
  pins: number[];
  pixels: number[];
  brightness: number;
}

function installNeoPixel(interp: Interpreter, board: Board) {
  interp.classFactories.set('Adafruit_NeoPixel', (args) => {
    const pin = toNum(args[1]) || 6;
    const st: NeoState = {
      count: toNum(args[0]) || 1,
      pin,
      pins: [pin],
      pixels: new Array(toNum(args[0]) || 1).fill(0),
      brightness: 255,
    };
    board.peripherals.set(`neopixel:${st.pin}`, st);

    return new ObjectValue('Adafruit_NeoPixel', {
      begin: () => 0,
      show: () => 0,
      numPixels: () => st.count,
      setBrightness: (a) => ((st.brightness = toNum(a[0])), 0),
      getBrightness: () => st.brightness,
      setPixelColor: (a) => {
        const i = toNum(a[0]);
        // Either a packed colour or separate r, g, b arguments.
        const colour =
          a.length >= 4
            ? (toNum(a[1]) << 16) | (toNum(a[2]) << 8) | toNum(a[3])
            : toNum(a[1]);
        if (i >= 0 && i < st.count) st.pixels[i] = colour;
        return 0;
      },
      getPixelColor: (a) => st.pixels[toNum(a[0])] ?? 0,
      fill: (a) => {
        st.pixels.fill(toNum(a[0]));
        return 0;
      },
      clear: () => {
        st.pixels.fill(0);
        return 0;
      },
      Color: (a) => (toNum(a[0]) << 16) | (toNum(a[1]) << 8) | toNum(a[2]),
    }, st as unknown as Record<string, unknown>);
  });

  // Adafruit_NeoPixel::Color is also used statically.
  interp.natives.set('Color', (a) =>
    (toNum(a[0]) << 16) | (toNum(a[1]) << 8) | toNum(a[2]),
  );
}

// ── Wire / SPI / EEPROM ──────────────────────────────────────────────────────

function installWireSpiEeprom(interp: Interpreter, board: Board) {
  const eeprom = new Uint8Array(1024);

  interp.constants.set(
    'Wire',
    new ObjectValue('TwoWire', {
      begin: () => 0,
      beginTransmission: () => 0,
      write: () => 1,
      endTransmission: () => 0,
      requestFrom: () => 0,
      available: () => 0,
      read: () => 0,
      setClock: () => 0,
    }) as unknown as Value,
  );

  interp.constants.set(
    'SPI',
    new ObjectValue('SPIClass', {
      begin: () => 0,
      end: () => 0,
      transfer: (a) => toNum(a[0]),
      setBitOrder: () => 0,
      setDataMode: () => 0,
      setClockDivider: () => 0,
      beginTransaction: () => 0,
      endTransaction: () => 0,
    }) as unknown as Value,
  );

  interp.constants.set(
    'EEPROM',
    new ObjectValue('EEPROMClass', {
      read: (a) => eeprom[toNum(a[0]) & 1023],
      write: (a) => {
        eeprom[toNum(a[0]) & 1023] = toNum(a[1]) & 0xff;
        return 0;
      },
      update: (a) => {
        eeprom[toNum(a[0]) & 1023] = toNum(a[1]) & 0xff;
        return 0;
      },
      get: (a) => eeprom[toNum(a[0]) & 1023],
      put: (a) => {
        eeprom[toNum(a[0]) & 1023] = toNum(a[1]) & 0xff;
        return 0;
      },
      length: () => eeprom.length,
    }) as unknown as Value,
  );

  void board;
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function installStepper(interp: Interpreter, board: Board) {
  interp.classFactories.set('Stepper', (args) => {
    const steps = toNum(args[0]) || 200;
    const pins = args.slice(1).map(toNum);
    const st = { steps, pins, position: 0, rpm: 30 };
    board.peripherals.set(`stepper:${pins[0]}`, st);
    return new ObjectValue('Stepper', {
      setSpeed: (a) => ((st.rpm = toNum(a[0])), 0),
      step: (a) => ((st.position += toNum(a[0])), 0),
      version: () => 5,
    }, st as unknown as Record<string, unknown>);
  });
}

export { VCC, formatNumber, RuntimeError };
