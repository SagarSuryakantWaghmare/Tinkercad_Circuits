import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

interface Entry {
  label: string;
  detail?: string;
  info?: string;
  type: 'function' | 'constant' | 'class' | 'keyword';
  apply?: string;
}

/** The Arduino surface the interpreter actually implements. */
const ENTRIES: Entry[] = [
  // digital / analog
  { label: 'pinMode', type: 'function', detail: '(pin, mode)', apply: 'pinMode(${pin}, ${OUTPUT})', info: 'Configure a pin as INPUT, OUTPUT or INPUT_PULLUP.' },
  { label: 'digitalWrite', type: 'function', detail: '(pin, value)', apply: 'digitalWrite(${pin}, ${HIGH})' },
  { label: 'digitalRead', type: 'function', detail: '(pin) → int', apply: 'digitalRead(${pin})' },
  { label: 'analogWrite', type: 'function', detail: '(pin, 0–255)', apply: 'analogWrite(${pin}, ${value})', info: 'PWM output on a ~ pin.' },
  { label: 'analogRead', type: 'function', detail: '(pin) → 0–1023', apply: 'analogRead(${A0})' },
  { label: 'analogReference', type: 'function', detail: '(type)' },

  // time
  { label: 'delay', type: 'function', detail: '(ms)', apply: 'delay(${1000})' },
  { label: 'delayMicroseconds', type: 'function', detail: '(us)' },
  { label: 'millis', type: 'function', detail: '() → unsigned long' },
  { label: 'micros', type: 'function', detail: '() → unsigned long' },

  // maths
  { label: 'map', type: 'function', detail: '(x, inMin, inMax, outMin, outMax)' },
  { label: 'constrain', type: 'function', detail: '(x, lo, hi)' },
  { label: 'min', type: 'function', detail: '(a, b)' },
  { label: 'max', type: 'function', detail: '(a, b)' },
  { label: 'abs', type: 'function', detail: '(x)' },
  { label: 'pow', type: 'function', detail: '(base, exp)' },
  { label: 'sqrt', type: 'function', detail: '(x)' },
  { label: 'sq', type: 'function', detail: '(x)' },
  { label: 'random', type: 'function', detail: '(min?, max)' },
  { label: 'randomSeed', type: 'function', detail: '(seed)' },
  { label: 'sin', type: 'function', detail: '(rad)' },
  { label: 'cos', type: 'function', detail: '(rad)' },
  { label: 'tan', type: 'function', detail: '(rad)' },
  { label: 'round', type: 'function', detail: '(x)' },
  { label: 'floor', type: 'function', detail: '(x)' },
  { label: 'ceil', type: 'function', detail: '(x)' },

  // bits
  { label: 'bitRead', type: 'function', detail: '(value, bit)' },
  { label: 'bitWrite', type: 'function', detail: '(value, bit, bitValue)' },
  { label: 'bitSet', type: 'function', detail: '(value, bit)' },
  { label: 'bitClear', type: 'function', detail: '(value, bit)' },
  { label: 'lowByte', type: 'function', detail: '(w)' },
  { label: 'highByte', type: 'function', detail: '(w)' },
  { label: 'shiftOut', type: 'function', detail: '(dataPin, clockPin, bitOrder, value)' },

  // sound & pulse
  { label: 'tone', type: 'function', detail: '(pin, frequency, duration?)' },
  { label: 'noTone', type: 'function', detail: '(pin)' },
  { label: 'pulseIn', type: 'function', detail: '(pin, value) → unsigned long' },

  // serial
  { label: 'Serial.begin', type: 'function', detail: '(baud)', apply: 'Serial.begin(9600)' },
  { label: 'Serial.print', type: 'function', detail: '(value)' },
  { label: 'Serial.println', type: 'function', detail: '(value)' },
  { label: 'Serial.available', type: 'function', detail: '() → int' },
  { label: 'Serial.read', type: 'function', detail: '() → int' },
  { label: 'Serial.readString', type: 'function', detail: '() → String' },

  // constants
  { label: 'HIGH', type: 'constant' },
  { label: 'LOW', type: 'constant' },
  { label: 'INPUT', type: 'constant' },
  { label: 'OUTPUT', type: 'constant' },
  { label: 'INPUT_PULLUP', type: 'constant' },
  { label: 'LED_BUILTIN', type: 'constant', info: 'Digital pin 13.' },
  { label: 'A0', type: 'constant' }, { label: 'A1', type: 'constant' },
  { label: 'A2', type: 'constant' }, { label: 'A3', type: 'constant' },
  { label: 'A4', type: 'constant' }, { label: 'A5', type: 'constant' },
  { label: 'PI', type: 'constant' },
  { label: 'DEC', type: 'constant' }, { label: 'HEX', type: 'constant' },
  { label: 'BIN', type: 'constant' }, { label: 'OCT', type: 'constant' },

  // library classes
  { label: 'Servo', type: 'class', info: 'Servo s; s.attach(9); s.write(90);' },
  { label: 'LiquidCrystal', type: 'class', info: 'LiquidCrystal lcd(12, 11, 5, 4, 3, 2);' },
  { label: 'Adafruit_NeoPixel', type: 'class' },
  { label: 'SoftwareSerial', type: 'class' },
  { label: 'Stepper', type: 'class' },

  // keywords
  ...['void', 'int', 'long', 'float', 'double', 'char', 'bool', 'byte', 'word',
      'unsigned', 'const', 'static', 'String', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'break', 'continue', 'return', 'struct', 'enum',
      'true', 'false'].map((label) => ({ label, type: 'keyword' as const })),
];

const OPTIONS = ENTRIES.map((e) => ({
  label: e.label,
  type: e.type,
  detail: e.detail,
  info: e.info,
  apply: e.apply ? e.apply.replace(/\$\{([^}]*)\}/g, '$1') : undefined,
}));

export function ARDUINO_COMPLETIONS(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[\w.]+/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  return { from: word.from, options: OPTIONS, validFor: /^[\w.]*$/ };
}

// ─── MicroPython for the micro:bit ───────────────────────────────────────────

const MB_ENTRIES: Entry[] = [
  { label: 'from microbit import *', type: 'keyword', apply: 'from microbit import *' },
  { label: 'display.show', type: 'function', detail: '(value)', info: 'An Image, a number or a string.' },
  { label: 'display.scroll', type: 'function', detail: '(text, delay=150)' },
  { label: 'display.clear', type: 'function', detail: '()' },
  { label: 'display.set_pixel', type: 'function', detail: '(x, y, brightness 0–9)' },
  { label: 'display.get_pixel', type: 'function', detail: '(x, y) → 0–9' },
  { label: 'display.read_light_level', type: 'function', detail: '() → 0–255' },
  { label: 'display.on', type: 'function', detail: '()' },
  { label: 'display.off', type: 'function', detail: '()' },

  { label: 'button_a.is_pressed', type: 'function', detail: '() → bool' },
  { label: 'button_a.was_pressed', type: 'function', detail: '() → bool' },
  { label: 'button_a.get_presses', type: 'function', detail: '() → int' },
  { label: 'button_b.is_pressed', type: 'function', detail: '() → bool' },
  { label: 'button_b.was_pressed', type: 'function', detail: '() → bool' },

  { label: 'accelerometer.get_x', type: 'function', detail: '() → milli-g' },
  { label: 'accelerometer.get_y', type: 'function', detail: '() → milli-g' },
  { label: 'accelerometer.get_z', type: 'function', detail: '() → milli-g' },
  { label: 'accelerometer.current_gesture', type: 'function', detail: '() → str' },
  { label: 'accelerometer.was_gesture', type: 'function', detail: "('shake')" },
  { label: 'compass.heading', type: 'function', detail: '() → 0–359' },

  { label: 'pin0.write_digital', type: 'function', detail: '(0 or 1)' },
  { label: 'pin0.read_digital', type: 'function', detail: '() → 0 or 1' },
  { label: 'pin0.write_analog', type: 'function', detail: '(0–1023)' },
  { label: 'pin0.read_analog', type: 'function', detail: '() → 0–1023' },
  { label: 'pin0.is_touched', type: 'function', detail: '() → bool' },
  { label: 'pin1', type: 'constant' },
  { label: 'pin2', type: 'constant' },

  { label: 'sleep', type: 'function', detail: '(ms)' },
  { label: 'running_time', type: 'function', detail: '() → ms' },
  { label: 'temperature', type: 'function', detail: '() → °C' },
  { label: 'panic', type: 'function', detail: '(code)' },
  { label: 'reset', type: 'function', detail: '()' },

  { label: 'music.play', type: 'function', detail: '(notes, wait=True, loop=False)' },
  { label: 'music.pitch', type: 'function', detail: '(frequency, duration)' },
  { label: 'music.stop', type: 'function', detail: '()' },
  { label: 'music.set_tempo', type: 'function', detail: '(bpm=120)' },
  { label: 'music.NYAN', type: 'constant' },
  { label: 'music.BIRTHDAY', type: 'constant' },
  { label: 'music.POWER_UP', type: 'constant' },

  { label: 'radio.on', type: 'function', detail: '()' },
  { label: 'radio.send', type: 'function', detail: '(message)' },
  { label: 'radio.receive', type: 'function', detail: '() → str or None' },
  { label: 'radio.config', type: 'function', detail: '(group=1)' },

  { label: 'random.randint', type: 'function', detail: '(a, b)' },
  { label: 'random.choice', type: 'function', detail: '(sequence)' },

  ...['HEART', 'HEART_SMALL', 'HAPPY', 'SAD', 'YES', 'NO', 'ARROW_N', 'ARROW_S',
      'ARROW_E', 'ARROW_W', 'DIAMOND', 'SQUARE', 'TARGET', 'DUCK', 'GHOST',
      'SKULL', 'MUSIC_QUAVER', 'ALL_ARROWS', 'ALL_CLOCKS']
    .map((n) => ({ label: `Image.${n}`, type: 'constant' as const })),

  ...['while', 'for', 'in', 'if', 'elif', 'else', 'def', 'return', 'break',
      'continue', 'import', 'from', 'True', 'False', 'None', 'and', 'or',
      'not', 'pass', 'class', 'try', 'except', 'print', 'range', 'len',
      'str', 'int', 'abs', 'min', 'max', 'round']
    .map((label) => ({ label, type: 'keyword' as const })),
];

const MB_OPTIONS = MB_ENTRIES.map((e) => ({
  label: e.label,
  type: e.type,
  detail: e.detail,
  info: e.info,
  apply: e.apply,
}));

export function MICROPYTHON_COMPLETIONS(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[\w.]+/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  return { from: word.from, options: MB_OPTIONS, validFor: /^[\w.]*$/ };
}
