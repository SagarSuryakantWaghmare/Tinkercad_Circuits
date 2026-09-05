import { audio } from '../../audio';
import { installBuiltins } from '../python/builtins';
import { PY_CPU_HZ, PyInterpreter } from '../python/Interpreter';
import {
  asSequence,
  PyDict,
  PyInstance,
  PyList,
  PyModule,
  PyNative,
  PyTuple,
  pyNum,
  pyStr,
  truthy,
  type PyValue,
  type PyWait,
} from '../python/values';
import { MicrobitBoard } from './board';
import { glyph } from './font';
import { ALL_ARROWS, ALL_CLOCKS, BUILTIN_IMAGES, imageToSpec, parseImage } from './images';

/**
 * The MicroPython API a micro:bit program sees.
 *
 * Everything that consumes time on real hardware — `sleep`, `display.show`,
 * `display.scroll`, `music.play` — is a generator, so it suspends the VM
 * rather than blocking the frame, and the display animates at the same rate it
 * would on the board.
 */
export function installMicrobitRuntime(interp: PyInterpreter, board: MicrobitBoard) {
  installBuiltins(interp, (text) => board.print(text));

  const ms = (n: number) => (Math.max(0, n) * PY_CPU_HZ) / 1000;

  // ── Image ────────────────────────────────────────────────────────────────

  const makeImage = (width: number, height: number, pixels: number[]): PyInstance => {
    const img = new PyInstance(null, new Map(), 'Image');
    img.attrs.set('__width__', width);
    img.attrs.set('__height__', height);
    img.attrs.set('__pixels__', new PyList(pixels.map((p) => p)));
    img.attrs.set('__str__', `Image('${imageToSpec(width, height, pixels)}')`);

    const px = () => (img.attrs.get('__pixels__') as PyList).items.map((v) => pyNum(v));
    const w = () => pyNum(img.attrs.get('__width__') ?? 0);
    const h = () => pyNum(img.attrs.get('__height__') ?? 0);

    img.attrs.set('width', new PyNative('width', () => w()));
    img.attrs.set('height', new PyNative('height', () => h()));
    img.attrs.set(
      'get_pixel',
      new PyNative('get_pixel', (a) => {
        const x = Math.trunc(pyNum(a[0]));
        const y = Math.trunc(pyNum(a[1]));
        if (x < 0 || y < 0 || x >= w() || y >= h()) return 0;
        return px()[y * w() + x] ?? 0;
      }),
    );
    img.attrs.set(
      'set_pixel',
      new PyNative('set_pixel', (a) => {
        const x = Math.trunc(pyNum(a[0]));
        const y = Math.trunc(pyNum(a[1]));
        if (x < 0 || y < 0 || x >= w() || y >= h()) return null;
        const list = img.attrs.get('__pixels__') as PyList;
        list.items[y * w() + x] = Math.max(0, Math.min(9, Math.trunc(pyNum(a[2]))));
        return null;
      }),
    );
    img.attrs.set('copy', new PyNative('copy', () => makeImage(w(), h(), px())));
    img.attrs.set('invert', new PyNative('invert', () => makeImage(w(), h(), px().map((p) => 9 - p))));
    img.attrs.set(
      'fill',
      new PyNative('fill', (a) => {
        const v = Math.max(0, Math.min(9, Math.trunc(pyNum(a[0]))));
        const list = img.attrs.get('__pixels__') as PyList;
        for (let i = 0; i < list.items.length; i++) list.items[i] = v;
        return null;
      }),
    );

    const shift = (dx: number, dy: number) =>
      new PyNative('shift', (a) => {
        const n = a[0] === undefined ? 1 : Math.trunc(pyNum(a[0]));
        const src = px();
        const out = new Array(w() * h()).fill(0);
        for (let y = 0; y < h(); y++) {
          for (let x = 0; x < w(); x++) {
            const sx = x + dx * n;
            const sy = y + dy * n;
            if (sx < 0 || sy < 0 || sx >= w() || sy >= h()) continue;
            out[y * w() + x] = src[sy * w() + sx];
          }
        }
        return makeImage(w(), h(), out);
      });
    img.attrs.set('shift_left', shift(1, 0));
    img.attrs.set('shift_right', shift(-1, 0));
    img.attrs.set('shift_up', shift(0, 1));
    img.attrs.set('shift_down', shift(0, -1));

    return img;
  };

  const imageFrom = (v: PyValue): { width: number; height: number; pixels: number[] } | null => {
    if (v instanceof PyInstance && v.typeName === 'Image') {
      return {
        width: pyNum(v.attrs.get('__width__') ?? 0),
        height: pyNum(v.attrs.get('__height__') ?? 0),
        pixels: (v.attrs.get('__pixels__') as PyList).items.map((x) => pyNum(x)),
      };
    }
    return null;
  };

  const ImageCtor = new PyNative('Image', (args) => {
    if (args.length === 0) return makeImage(5, 5, new Array(25).fill(0));
    if (typeof args[0] === 'string') {
      const { width, height, pixels } = parseImage(args[0]);
      return makeImage(width, height, pixels);
    }
    const width = Math.max(1, Math.trunc(pyNum(args[0])));
    const height = Math.max(1, Math.trunc(pyNum(args[1] ?? 5)));
    const buf = asSequence(args[2] ?? null);
    const pixels = new Array(width * height).fill(0);
    if (buf) buf.forEach((v, i) => (pixels[i] = Math.max(0, Math.min(9, Math.trunc(pyNum(v))))));
    return makeImage(width, height, pixels);
  });

  // The constants hang off the constructor, as `Image.HEART` does.
  const imageAttrs = new Map<string, PyValue>();
  for (const [name, spec] of Object.entries(BUILTIN_IMAGES)) {
    const { width, height, pixels } = parseImage(spec);
    imageAttrs.set(name, makeImage(width, height, pixels));
  }
  imageAttrs.set('ALL_CLOCKS', new PyList(ALL_CLOCKS.map((n) => imageAttrs.get(n)!)));
  imageAttrs.set('ALL_ARROWS', new PyList(ALL_ARROWS.map((n) => imageAttrs.get(n)!)));
  // A native callable that also carries attributes: wrap it in an instance
  // whose call target is the constructor.
  const ImageObj = new PyInstance(null, new Map(imageAttrs), 'Image');
  ImageObj.attrs.set('__call__', ImageCtor);

  // ── display ──────────────────────────────────────────────────────────────

  /** Centre a glyph or image into the 5 × 5 frame. */
  const frameFrom = (src: { width: number; height: number; pixels: number[] }, offsetX = 0) => {
    const out = new Array(25).fill(0);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const sx = x + offsetX;
        if (sx < 0 || sx >= src.width || y >= src.height) continue;
        out[y * 5 + x] = src.pixels[y * src.width + sx] ?? 0;
      }
    }
    return out;
  };

  /** Build one wide bitmap from a string, one glyph per character. */
  const textBitmap = (text: string, gap = 1) => {
    const chars = [...text];
    const width = chars.length * (5 + gap);
    const pixels = new Array(width * 5).fill(0);
    chars.forEach((ch, ci) => {
      const g = glyph(ch);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          pixels[y * width + ci * (5 + gap) + x] = g[y * 5 + x];
        }
      }
    });
    return { width, height: 5, pixels };
  };

  const display = new PyModule('display');
  display.attrs.set(
    'show',
    new PyNative('show', function* (args, kwargs): Generator<PyWait, PyValue, void> {
      const value = args[0];
      const delay = kwargs.delay !== undefined ? pyNum(kwargs.delay) : pyNum(args[1] ?? 400);
      const wait = kwargs.wait === undefined ? true : truthy(kwargs.wait);
      const clear = truthy(kwargs.clear ?? false);

      const single = imageFrom(value);
      if (single) {
        board.showFrame(frameFrom(single));
        return null;
      }

      // A sequence of images animates; anything else is rendered as text.
      const seq = value instanceof PyList || value instanceof PyTuple ? value.items : null;
      if (seq && seq.every((v) => imageFrom(v))) {
        for (const item of seq) {
          board.showFrame(frameFrom(imageFrom(item)!));
          if (wait) yield* interp.sleepCycles(ms(delay));
        }
        if (clear) board.clearDisplay();
        return null;
      }

      for (const ch of pyStr(value)) {
        board.showFrame(frameFrom({ width: 5, height: 5, pixels: glyph(ch) }));
        if (wait) yield* interp.sleepCycles(ms(delay));
      }
      if (clear) board.clearDisplay();
      return null;
    }),
  );

  display.attrs.set(
    'scroll',
    new PyNative('scroll', function* (args, kwargs): Generator<PyWait, PyValue, void> {
      const text = pyStr(args[0]);
      const delay = kwargs.delay !== undefined ? pyNum(kwargs.delay) : pyNum(args[1] ?? 150);
      const bmp = textBitmap(text);
      // Scroll in from the right and all the way off the left.
      for (let off = -5; off <= bmp.width; off++) {
        board.showFrame(frameFrom(bmp, off));
        yield* interp.sleepCycles(ms(delay));
      }
      board.clearDisplay();
      return null;
    }),
  );

  display.attrs.set(
    'set_pixel',
    new PyNative('set_pixel', (a) => {
      board.setPixel(Math.trunc(pyNum(a[0])), Math.trunc(pyNum(a[1])), pyNum(a[2]));
      return null;
    }),
  );
  display.attrs.set(
    'get_pixel',
    new PyNative('get_pixel', (a) => board.getPixel(Math.trunc(pyNum(a[0])), Math.trunc(pyNum(a[1])))),
  );
  display.attrs.set('clear', new PyNative('clear', () => (board.clearDisplay(), null)));
  display.attrs.set('on', new PyNative('on', () => ((board.displayOn = true), null)));
  display.attrs.set('off', new PyNative('off', () => ((board.displayOn = false), null)));
  display.attrs.set('is_on', new PyNative('is_on', () => board.displayOn));
  display.attrs.set('read_light_level', new PyNative('read_light_level', () => board.lightLevel));

  // ── buttons ──────────────────────────────────────────────────────────────

  const button = (which: 'a' | 'b') => {
    const b = new PyModule(`button_${which}`);
    b.attrs.set('is_pressed', new PyNative('is_pressed', () =>
      which === 'a' ? board.buttonA.pressed : board.buttonB.pressed));
    b.attrs.set('was_pressed', new PyNative('was_pressed', () => board.wasPressed(which)));
    b.attrs.set('get_presses', new PyNative('get_presses', () => board.getPresses(which)));
    return b;
  };

  // ── pins ─────────────────────────────────────────────────────────────────

  const makePin = (n: number) => {
    const p = new PyModule(`pin${n}`);
    p.attrs.set('read_digital', new PyNative('read_digital', () => board.readDigital(n)));
    p.attrs.set('write_digital', new PyNative('write_digital', (a) => {
      board.writeDigital(n, pyNum(a[0]) !== 0);
      return null;
    }));
    p.attrs.set('read_analog', new PyNative('read_analog', () => board.readAnalog(n)));
    p.attrs.set('write_analog', new PyNative('write_analog', (a) => {
      board.writeAnalog(n, pyNum(a[0]));
      return null;
    }));
    p.attrs.set('set_pull', new PyNative('set_pull', (a) => {
      const v = pyStr(a[0]);
      board.setPull(n, v.includes('up') ? 'up' : v.includes('down') ? 'down' : 'none');
      return null;
    }));
    p.attrs.set('get_pull', new PyNative('get_pull', () => board.pulls[n]));
    p.attrs.set('is_touched', new PyNative('is_touched', () => board.isTouched(n)));
    p.attrs.set('set_analog_period', new PyNative('set_analog_period', () => null));
    p.attrs.set('set_touch_mode', new PyNative('set_touch_mode', () => null));
    return p;
  };

  // ── motion ───────────────────────────────────────────────────────────────

  const accelerometer = new PyModule('accelerometer');
  accelerometer.attrs.set('get_x', new PyNative('get_x', () => board.accel.x));
  accelerometer.attrs.set('get_y', new PyNative('get_y', () => board.accel.y));
  accelerometer.attrs.set('get_z', new PyNative('get_z', () => board.accel.z));
  accelerometer.attrs.set('get_values', new PyNative('get_values', () =>
    new PyTuple([board.accel.x, board.accel.y, board.accel.z])));
  accelerometer.attrs.set('current_gesture', new PyNative('current_gesture', () => board.gesture));
  accelerometer.attrs.set('is_gesture', new PyNative('is_gesture', (a) => pyStr(a[0]) === board.gesture));
  accelerometer.attrs.set('was_gesture', new PyNative('was_gesture', (a) => board.wasGesture(pyStr(a[0]))));
  accelerometer.attrs.set('get_gestures', new PyNative('get_gestures', () => new PyTuple([])));
  accelerometer.attrs.set('set_range', new PyNative('set_range', () => null));

  const compass = new PyModule('compass');
  compass.attrs.set('heading', new PyNative('heading', () => board.compassHeading));
  compass.attrs.set('is_calibrated', new PyNative('is_calibrated', () => board.compassCalibrated));
  compass.attrs.set('calibrate', new PyNative('calibrate', () => ((board.compassCalibrated = true), null)));
  compass.attrs.set('clear_calibration', new PyNative('clear_calibration', () => null));
  compass.attrs.set('get_field_strength', new PyNative('get_field_strength', () => 40_000));
  compass.attrs.set('get_x', new PyNative('get_x', () => Math.round(Math.cos((board.compassHeading * Math.PI) / 180) * 40_000)));
  compass.attrs.set('get_y', new PyNative('get_y', () => Math.round(Math.sin((board.compassHeading * Math.PI) / 180) * 40_000)));
  compass.attrs.set('get_z', new PyNative('get_z', () => 0));

  // ── microbit module ──────────────────────────────────────────────────────

  const microbit = new PyModule('microbit');
  microbit.attrs.set('display', display);
  microbit.attrs.set('Image', ImageObj);
  microbit.attrs.set('button_a', button('a'));
  microbit.attrs.set('button_b', button('b'));
  microbit.attrs.set('accelerometer', accelerometer);
  microbit.attrs.set('compass', compass);
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20]) {
    microbit.attrs.set(`pin${n}`, makePin(n));
  }
  microbit.attrs.set('pin_logo', (() => {
    const p = new PyModule('pin_logo');
    p.attrs.set('is_touched', new PyNative('is_touched', () => board.logoTouched));
    return p;
  })());

  const sleepFn = new PyNative('sleep', function* (a): Generator<PyWait, PyValue, void> {
    yield* interp.sleepCycles(ms(pyNum(a[0])));
    return null;
  });
  microbit.attrs.set('sleep', sleepFn);
  microbit.attrs.set('running_time', new PyNative('running_time', () => board.runningTime()));
  microbit.attrs.set('temperature', new PyNative('temperature', () => Math.round(board.temperature)));
  microbit.attrs.set('reset', new PyNative('reset', () => (board.reset(), null)));
  microbit.attrs.set('panic', new PyNative('panic', (a) => {
    board.print(`PANIC ${pyNum(a[0] ?? 0)}\n`);
    return null;
  }));
  microbit.attrs.set('set_volume', new PyNative('set_volume', (a) => {
    board.volume = Math.max(0, Math.min(255, pyNum(a[0])));
    return null;
  }));

  const uart = new PyModule('uart');
  uart.attrs.set('init', new PyNative('init', () => null));
  uart.attrs.set('write', new PyNative('write', (a) => (board.print(pyStr(a[0])), null)));
  uart.attrs.set('any', new PyNative('any', () => board.serialRx.length > 0));
  uart.attrs.set('read', new PyNative('read', () => {
    const s = board.serialRx.map((c) => String.fromCharCode(c)).join('');
    board.serialRx = [];
    return s;
  }));
  uart.attrs.set('readline', new PyNative('readline', () => board.readLine() ?? null));
  microbit.attrs.set('uart', uart);

  for (const busName of ['i2c', 'spi']) {
    const bus = new PyModule(busName);
    bus.attrs.set('init', new PyNative('init', () => null));
    bus.attrs.set('read', new PyNative('read', () => ''));
    bus.attrs.set('write', new PyNative('write', () => null));
    bus.attrs.set('scan', new PyNative('scan', () => new PyList([])));
    microbit.attrs.set(busName, bus);
  }

  // ── music ────────────────────────────────────────────────────────────────

  const music = buildMusic(interp, board, ms);
  const radio = buildRadio(board);
  const speech = buildSpeech(board);
  const neopixelMod = buildNeopixel(board);
  const randomMod = buildRandom();
  const mathMod = buildMath();
  const timeMod = buildTime(interp, board, ms);

  const modules: Record<string, PyModule> = {
    microbit,
    music,
    radio,
    speech,
    neopixel: neopixelMod,
    random: randomMod,
    math: mathMod,
    time: timeMod,
    utime: timeMod,
    os: new PyModule('os'),
    gc: (() => {
      const m = new PyModule('gc');
      m.attrs.set('collect', new PyNative('collect', () => null));
      m.attrs.set('mem_free', new PyNative('mem_free', () => 8192));
      return m;
    })(),
  };

  interp.moduleLoader = (name) => modules[name.split('.')[0]];

  // `sleep` and friends are also global once `from microbit import *` runs,
  // but many programs assume them without the import, as MakeCode-exported
  // code does.
  interp.builtins.set('sleep', sleepFn);
  interp.builtins.set('running_time', microbit.attrs.get('running_time')!);
  interp.builtins.set('display', display);
  interp.builtins.set('Image', ImageObj);
  interp.builtins.set('button_a', microbit.attrs.get('button_a')!);
  interp.builtins.set('button_b', microbit.attrs.get('button_b')!);
  interp.builtins.set('accelerometer', accelerometer);
  interp.builtins.set('compass', compass);
  for (const n of [0, 1, 2]) {
    interp.builtins.set(`pin${n}`, microbit.attrs.get(`pin${n}`)!);
  }
}

// ── music ────────────────────────────────────────────────────────────────────

const NOTE_SEMITONE: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

/** MicroPython note syntax: `NOTE[octave][:duration]`, e.g. `c4:4`, `g#`, `r`. */
function noteToFrequency(note: string, lastOctave: { value: number }): number {
  const m = /^([a-gA-GrR])([#b]?)(\d*)/.exec(note.trim());
  if (!m) return 0;
  const [, letter, accidental, octaveStr] = m;
  if (letter.toLowerCase() === 'r') return 0;
  let semitone = NOTE_SEMITONE[letter.toLowerCase()] ?? 0;
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  const octave = octaveStr ? Number(octaveStr) : lastOctave.value;
  lastOctave.value = octave;
  // A4 = 440 Hz sits at semitone 9 of octave 4.
  return 440 * Math.pow(2, (semitone - 9) / 12 + (octave - 4));
}

const MELODIES: Record<string, string[]> = {
  DADADADUM: ['r4:2', 'g', 'g', 'g', 'eb:8', 'r:2', 'f', 'f', 'f', 'd:8'],
  ENTERTAINER: ['d4:1', 'd#', 'e', 'c5:2', 'e4:1', 'c5:2', 'e4:1', 'c5:3', 'c:1', 'd', 'd#', 'e', 'c', 'd', 'e:2', 'b4:1', 'd5:2', 'c:4'],
  PRELUDE: ['c4:1', 'e', 'g', 'c5', 'e', 'g4', 'c5', 'e', 'c4', 'e', 'g', 'c5', 'e', 'g4', 'c5', 'e'],
  ODE: ['e4', 'e', 'f', 'g', 'g', 'f', 'e', 'd', 'c', 'c', 'd', 'e', 'e:6', 'd:2', 'd:8'],
  NYAN: ['f#5:2', 'g#', 'c#:1', 'd#:2', 'b4:1', 'd5:1', 'c#', 'b4:2', 'b', 'c#5', 'd', 'd:1', 'c#', 'b4:1', 'c#5:1', 'd#', 'f#', 'g#', 'd#', 'f#', 'c#', 'd', 'b4', 'c#5', 'b4', 'd#5:2', 'f#', 'g#:1', 'd#', 'f#', 'c#', 'd#', 'b4', 'd5', 'd#', 'd', 'c#', 'b4', 'c#5', 'd:2'],
  RINGTONE: ['c4:1', 'd', 'e:2', 'g', 'd:1', 'e', 'f:2', 'a', 'e:1', 'f', 'g:2', 'b', 'c5:4'],
  FUNK: ['c2:2', 'c', 'd#', 'c:1', 'f:2', 'c:1', 'f:2', 'f#', 'g', 'c', 'c', 'g'],
  BLUES: ['c2:2', 'e', 'g', 'a', 'a#', 'a', 'g', 'e', 'c2:2', 'e', 'g', 'a', 'a#', 'a', 'g', 'e'],
  BIRTHDAY: ['c4:3', 'c:1', 'd:4', 'c:4', 'f', 'e:8', 'c:3', 'c:1', 'd:4', 'c:4', 'g', 'f:8'],
  WEDDING: ['c4:4', 'f:3', 'f:1', 'f:8', 'c:4', 'g:3', 'e:1', 'f:8'],
  FUNERAL: ['c3:4', 'c:3', 'c:1', 'c:4', 'd#:3', 'd:1', 'd:3', 'c:1', 'c:3', 'b2:1', 'c3:4'],
  PUNCHLINE: ['c4:3', 'g3:1', 'f#', 'g', 'g#:3', 'g', 'r', 'b', 'c4'],
  PYTHON: ['d5:1', 'b4', 'r', 'b', 'b', 'a#', 'b', 'g5', 'r', 'd', 'd', 'r', 'b4', 'r', 'c5', 'r', 'c', 'c', 'r', 'c'],
  BADDY: ['c3:3', 'r', 'd:2', 'd#', 'r', 'c', 'r', 'f#:8'],
  CHASE: ['a4:1', 'b', 'c5', 'b4', 'a:2', 'r', 'a:1', 'b', 'c5', 'b4', 'a:2', 'r'],
  BA_DING: ['b5:1', 'e6:3'],
  WAWAWAWAA: ['e3:3', 'r:1', 'd#:3', 'r:1', 'd:4', 'r:1', 'c#:8'],
  JUMP_UP: ['c5:1', 'd', 'e', 'f', 'g'],
  JUMP_DOWN: ['g5:1', 'f', 'e', 'd', 'c'],
  POWER_UP: ['g4:1', 'c5', 'e', 'g:2', 'e:1', 'g:3'],
  POWER_DOWN: ['g5:1', 'd#', 'c', 'g4:2', 'b:1', 'c5:3'],
};

function buildMusic(
  interp: PyInterpreter,
  board: MicrobitBoard,
  ms: (n: number) => number,
): PyModule {
  const music = new PyModule('music');
  const state = { bpm: 120, ticks: 4 };
  const voiceId = 'microbit-music';

  /** A tick is one beat divided by `ticks`, in milliseconds. */
  const tickMs = () => (60_000 / state.bpm) / state.ticks;

  const playSequence = function* (
    notes: string[],
    pin: number,
    wait: boolean,
    loop: boolean,
  ): Generator<PyWait, PyValue, void> {
    const lastOctave = { value: 4 };
    let passes = 0;
    do {
      for (const raw of notes) {
        const [notePart, durPart] = String(raw).split(':');
        const duration = durPart ? Number(durPart) || 4 : 4;
        const freq = noteToFrequency(notePart, lastOctave);
        board.tone = freq > 0
          ? { pin, frequency: freq, until: board.time + (duration * tickMs()) / 1000 }
          : null;
        if (freq > 0) audio.play(voiceId, freq, (board.volume / 255) * 0.7, 'square');
        else audio.stop(voiceId);
        if (wait) yield* interp.sleepCycles(ms(duration * tickMs()));
      }
      passes++;
      // A looping call with wait=True would never return; cap it so the
      // program stays responsive.
    } while (loop && wait && passes < 64);
    board.tone = null;
    audio.stop(voiceId);
    return null;
  };

  music.attrs.set(
    'play',
    new PyNative('play', function* (args, kwargs): Generator<PyWait, PyValue, void> {
      const value = args[0];
      const pin = kwargs.pin !== undefined ? pyNum(kwargs.pin) : 0;
      const wait = kwargs.wait === undefined ? true : truthy(kwargs.wait);
      const loop = truthy(kwargs.loop ?? false);
      const seq = asSequence(value);
      const notes = seq ? seq.map(pyStr) : [pyStr(value)];
      return yield* playSequence(notes, pin, wait, loop);
    }),
  );

  music.attrs.set(
    'pitch',
    new PyNative('pitch', function* (args, kwargs): Generator<PyWait, PyValue, void> {
      const freq = pyNum(args[0]);
      const duration = args[1] !== undefined ? pyNum(args[1]) : pyNum(kwargs.duration ?? -1);
      const pin = kwargs.pin !== undefined ? pyNum(kwargs.pin) : 0;
      const wait = kwargs.wait === undefined ? true : truthy(kwargs.wait);

      if (freq <= 0) {
        board.tone = null;
        audio.stop(voiceId);
        return null;
      }
      board.tone = {
        pin,
        frequency: freq,
        until: duration >= 0 ? board.time + duration / 1000 : Infinity,
      };
      audio.play(voiceId, freq, (board.volume / 255) * 0.7, 'square');
      if (duration >= 0 && wait) {
        yield* interp.sleepCycles(ms(duration));
        board.tone = null;
        audio.stop(voiceId);
      }
      return null;
    }),
  );

  music.attrs.set('stop', new PyNative('stop', () => {
    board.tone = null;
    audio.stop(voiceId);
    return null;
  }));
  music.attrs.set('reset', new PyNative('reset', () => {
    state.bpm = 120;
    state.ticks = 4;
    return null;
  }));
  music.attrs.set('set_tempo', new PyNative('set_tempo', (a, kw) => {
    if (kw.bpm !== undefined) state.bpm = Math.max(1, pyNum(kw.bpm));
    if (kw.ticks !== undefined) state.ticks = Math.max(1, pyNum(kw.ticks));
    if (a[0] !== undefined) state.ticks = Math.max(1, pyNum(a[0]));
    if (a[1] !== undefined) state.bpm = Math.max(1, pyNum(a[1]));
    return null;
  }));
  music.attrs.set('get_tempo', new PyNative('get_tempo', () => new PyTuple([state.ticks, state.bpm])));

  for (const [name, notes] of Object.entries(MELODIES)) {
    music.attrs.set(name, new PyList(notes));
  }
  return music;
}

// ── radio, speech, neopixel, random, math, time ──────────────────────────────

function buildRadio(board: MicrobitBoard): PyModule {
  const radio = new PyModule('radio');
  radio.attrs.set('on', new PyNative('on', () => ((board.radioOn = true), null)));
  radio.attrs.set('off', new PyNative('off', () => ((board.radioOn = false), null)));
  radio.attrs.set('config', new PyNative('config', (_a, kw) => {
    if (kw.group !== undefined) board.radioGroup = pyNum(kw.group);
    return null;
  }));
  radio.attrs.set('reset', new PyNative('reset', () => ((board.radioQueue = []), null)));
  radio.attrs.set('send', new PyNative('send', (a) => {
    // With one board in the design a message loops back to the sender, which
    // is the only behaviour that can be observed here.
    board.radioQueue.push(pyStr(a[0]));
    return null;
  }));
  radio.attrs.set('send_bytes', new PyNative('send_bytes', (a) => {
    board.radioQueue.push(pyStr(a[0]));
    return null;
  }));
  radio.attrs.set('receive', new PyNative('receive', () => board.radioQueue.shift() ?? null));
  radio.attrs.set('receive_bytes', new PyNative('receive_bytes', () => board.radioQueue.shift() ?? null));
  radio.attrs.set('receive_full', new PyNative('receive_full', () => {
    const m = board.radioQueue.shift();
    return m === undefined ? null : new PyTuple([m, -40, board.runningTime()]);
  }));
  return radio;
}

function buildSpeech(board: MicrobitBoard): PyModule {
  const speech = new PyModule('speech');
  const say = new PyNative('say', (a) => {
    // There is no speech synthesiser here; surfacing the words in the serial
    // monitor is more useful than silence.
    board.print(`[speech] ${pyStr(a[0])}\n`);
    return null;
  });
  speech.attrs.set('say', say);
  speech.attrs.set('pronounce', say);
  speech.attrs.set('sing', say);
  speech.attrs.set('translate', new PyNative('translate', (a) => pyStr(a[0])));
  return speech;
}

function buildNeopixel(board: MicrobitBoard): PyModule {
  const mod = new PyModule('neopixel');
  mod.attrs.set(
    'NeoPixel',
    new PyNative('NeoPixel', (args) => {
      const pin = args[0] instanceof PyModule ? Number(args[0].name.replace('pin', '')) || 0 : pyNum(args[0]);
      const count = Math.max(1, Math.trunc(pyNum(args[1] ?? 1)));
      const strip = new PyInstance(null, new Map(), 'NeoPixel');
      const pixels: number[][] = Array.from({ length: count }, () => [0, 0, 0]);
      // Published where the strip part looks for it.
      board.neopixels = { pin, count, pixels };

      strip.attrs.set('__items__', new PyList(pixels.map((p) => new PyTuple(p))));
      strip.attrs.set('__len__', count);
      strip.attrs.set('show', new PyNative('show', () => null));
      strip.attrs.set('clear', new PyNative('clear', () => {
        pixels.forEach((p) => p.fill(0));
        return null;
      }));
      strip.attrs.set('fill', new PyNative('fill', (a) => {
        const rgb = asSequence(a[0]) ?? [];
        pixels.forEach((p) => {
          p[0] = pyNum(rgb[0] ?? 0);
          p[1] = pyNum(rgb[1] ?? 0);
          p[2] = pyNum(rgb[2] ?? 0);
        });
        return null;
      }));
      strip.attrs.set('__setitem__', new PyNative('__setitem__', (a) => {
        const i = Math.trunc(pyNum(a[0]));
        const rgb = asSequence(a[1]) ?? [];
        if (i >= 0 && i < count) {
          pixels[i][0] = pyNum(rgb[0] ?? 0);
          pixels[i][1] = pyNum(rgb[1] ?? 0);
          pixels[i][2] = pyNum(rgb[2] ?? 0);
        }
        return null;
      }));
      return strip;
    }),
  );
  return mod;
}

function buildRandom(): PyModule {
  const mod = new PyModule('random');
  let seed = 12345;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  mod.attrs.set('seed', new PyNative('seed', (a) => ((seed = Math.trunc(pyNum(a[0])) || 1), null)));
  mod.attrs.set('random', new PyNative('random', () => next()));
  mod.attrs.set('randint', new PyNative('randint', (a) => {
    const lo = Math.trunc(pyNum(a[0]));
    const hi = Math.trunc(pyNum(a[1]));
    return hi <= lo ? lo : lo + Math.floor(next() * (hi - lo + 1));
  }));
  mod.attrs.set('randrange', new PyNative('randrange', (a) => {
    const lo = a.length > 1 ? Math.trunc(pyNum(a[0])) : 0;
    const hi = a.length > 1 ? Math.trunc(pyNum(a[1])) : Math.trunc(pyNum(a[0]));
    return hi <= lo ? lo : lo + Math.floor(next() * (hi - lo));
  }));
  mod.attrs.set('choice', new PyNative('choice', (a) => {
    const seq = asSequence(a[0]) ?? [];
    return seq.length ? seq[Math.floor(next() * seq.length)] : null;
  }));
  mod.attrs.set('shuffle', new PyNative('shuffle', (a) => {
    if (a[0] instanceof PyList) {
      const items = a[0].items;
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    }
    return null;
  }));
  mod.attrs.set('uniform', new PyNative('uniform', (a) => {
    const lo = pyNum(a[0]);
    return lo + next() * (pyNum(a[1]) - lo);
  }));
  return mod;
}

function buildMath(): PyModule {
  const mod = new PyModule('math');
  mod.attrs.set('pi', Math.PI);
  mod.attrs.set('e', Math.E);
  const one = (name: string, fn: (x: number) => number) =>
    mod.attrs.set(name, new PyNative(name, (a) => fn(pyNum(a[0]))));
  one('sin', Math.sin);
  one('cos', Math.cos);
  one('tan', Math.tan);
  one('asin', Math.asin);
  one('acos', Math.acos);
  one('atan', Math.atan);
  one('sqrt', Math.sqrt);
  one('floor', Math.floor);
  one('ceil', Math.ceil);
  one('exp', Math.exp);
  one('log', Math.log);
  one('log10', Math.log10);
  one('fabs', Math.abs);
  one('radians', (x) => (x * Math.PI) / 180);
  one('degrees', (x) => (x * 180) / Math.PI);
  mod.attrs.set('atan2', new PyNative('atan2', (a) => Math.atan2(pyNum(a[0]), pyNum(a[1]))));
  mod.attrs.set('pow', new PyNative('pow', (a) => Math.pow(pyNum(a[0]), pyNum(a[1]))));
  return mod;
}

function buildTime(
  interp: PyInterpreter,
  board: MicrobitBoard,
  ms: (n: number) => number,
): PyModule {
  const mod = new PyModule('time');
  mod.attrs.set('sleep', new PyNative('sleep', function* (a): Generator<PyWait, PyValue, void> {
    yield* interp.sleepCycles(ms(pyNum(a[0]) * 1000));
    return null;
  }));
  mod.attrs.set('sleep_ms', new PyNative('sleep_ms', function* (a): Generator<PyWait, PyValue, void> {
    yield* interp.sleepCycles(ms(pyNum(a[0])));
    return null;
  }));
  mod.attrs.set('sleep_us', new PyNative('sleep_us', function* (a): Generator<PyWait, PyValue, void> {
    yield* interp.sleepCycles(ms(pyNum(a[0]) / 1000));
    return null;
  }));
  mod.attrs.set('ticks_ms', new PyNative('ticks_ms', () => board.runningTime()));
  mod.attrs.set('ticks_us', new PyNative('ticks_us', () => Math.floor(board.time * 1e6)));
  mod.attrs.set('ticks_diff', new PyNative('ticks_diff', (a) => pyNum(a[0]) - pyNum(a[1])));
  mod.attrs.set('time', new PyNative('time', () => Math.floor(board.time)));
  return mod;
}

export { PyDict };
