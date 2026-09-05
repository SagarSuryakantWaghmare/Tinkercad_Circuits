import * as Blockly from 'blockly/core';

/**
 * Blocks → MicroPython.
 *
 * MakeCode's shape is event-driven; MicroPython's is a single loop. The
 * generator bridges the two the way a person would write it by hand: `on start`
 * becomes the module body, `forever` becomes `while True:`, and every event hat
 * becomes a poll inside that loop. The result is idiomatic Python a learner can
 * read, not a transliteration of the block tree.
 */

const ORDER = {
  ATOMIC: 0,
  UNARY: 2,
  POWER: 3,
  MUL: 5,
  ADD: 6,
  RELATIONAL: 8,
  NOT: 10,
  AND: 11,
  OR: 12,
  NONE: 99,
};

interface Collected {
  onStart: string[];
  forever: string[];
  events: { condition: string; body: string; setup?: string }[];
  functions: string[];
  imports: Set<string>;
  variables: Set<string>;
}

let ctx: Collected;

function reset() {
  ctx = {
    onStart: [],
    forever: [],
    events: [],
    functions: [],
    imports: new Set(),
    variables: new Set(),
  };
}
reset();

const gen = new Blockly.CodeGenerator('MicroPython');
gen.INDENT = '    ';

// Chain a block to whatever follows it.
(gen as unknown as {
  scrub_: (block: Blockly.Block, code: string, thisOnly?: boolean) => string;
}).scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection?.targetBlock();
  if (next && !thisOnly) return code + gen.blockToCode(next);
  return code;
};

const val = (b: Blockly.Block, name: string, order = ORDER.NONE, fallback = '0') =>
  gen.valueToCode(b, name, order) || fallback;

/** A statement body, or `pass` when the slot is empty. */
const body = (b: Blockly.Block, name: string, indent = '    ') => {
  const code = gen.statementToCode(b, name);
  if (!code.trim()) return `${indent}pass\n`;
  // statementToCode already applies one level; re-indent to the caller's depth.
  return code
    .split('\n')
    .map((l) => (l.trim() ? indent + l.replace(/^ {4}/, '') : ''))
    .join('\n')
    .replace(/\n+$/, '\n');
};

const ident = (raw: string) => {
  const s = raw.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^(\d)/, '_$1');
  return s || 'item';
};

// ── Basic ────────────────────────────────────────────────────────────────────

gen.forBlock['mb_on_start'] = (b) => {
  ctx.onStart.push(dedent(gen.statementToCode(b, 'BODY')));
  return '';
};

gen.forBlock['mb_forever'] = (b) => {
  ctx.forever.push(gen.statementToCode(b, 'BODY'));
  return '';
};

gen.forBlock['mb_show_number'] = (b) => `display.show(${val(b, 'VALUE', ORDER.NONE, '0')})\n`;
gen.forBlock['mb_show_string'] = (b) => `display.scroll(${val(b, 'TEXT', ORDER.NONE, "''")})\n`;
gen.forBlock['mb_show_icon'] = (b) => `display.show(Image.${b.getFieldValue('ICON')})\n`;
gen.forBlock['mb_show_leds'] = (b) => {
  const pattern = String(b.getFieldValue('PATTERN')).replace(/'/g, '');
  return `display.show(Image('${pattern}'))\n`;
};
gen.forBlock['mb_clear_screen'] = () => 'display.clear()\n';
gen.forBlock['mb_pause'] = (b) => `sleep(${val(b, 'MS', ORDER.NONE, '100')})\n`;
gen.forBlock['mb_print'] = (b) => `print(${val(b, 'VALUE', ORDER.NONE, "''")})\n`;

// ── Input ────────────────────────────────────────────────────────────────────

gen.forBlock['mb_on_button'] = (b) => {
  const which = b.getFieldValue('BUTTON');
  const condition =
    which === 'ab'
      ? 'button_a.was_pressed() and button_b.was_pressed()'
      : `button_${which}.was_pressed()`;
  ctx.events.push({ condition, body: gen.statementToCode(b, 'BODY') });
  return '';
};

gen.forBlock['mb_on_gesture'] = (b) => {
  const g = b.getFieldValue('GESTURE');
  ctx.events.push({
    condition: `accelerometer.was_gesture('${g}')`,
    body: gen.statementToCode(b, 'BODY'),
  });
  return '';
};

gen.forBlock['mb_button_is_pressed'] = (b) => [
  `button_${b.getFieldValue('BUTTON')}.is_pressed()`,
  ORDER.ATOMIC,
];
gen.forBlock['mb_acceleration'] = (b) => [
  `accelerometer.get_${b.getFieldValue('AXIS')}()`,
  ORDER.ATOMIC,
];
gen.forBlock['mb_light_level'] = () => ['display.read_light_level()', ORDER.ATOMIC];
gen.forBlock['mb_compass_heading'] = () => ['compass.heading()', ORDER.ATOMIC];
gen.forBlock['mb_temperature'] = () => ['temperature()', ORDER.ATOMIC];
gen.forBlock['mb_running_time'] = () => ['running_time()', ORDER.ATOMIC];

// ── LED ──────────────────────────────────────────────────────────────────────

gen.forBlock['mb_plot'] = (b) =>
  `display.set_pixel(${val(b, 'X')}, ${val(b, 'Y')}, 9)\n`;
gen.forBlock['mb_unplot'] = (b) =>
  `display.set_pixel(${val(b, 'X')}, ${val(b, 'Y')}, 0)\n`;
gen.forBlock['mb_plot_brightness'] = (b) =>
  `display.set_pixel(${val(b, 'X')}, ${val(b, 'Y')}, ${val(b, 'B', ORDER.NONE, '9')})\n`;
gen.forBlock['mb_point'] = (b) => [
  `display.get_pixel(${val(b, 'X')}, ${val(b, 'Y')})`,
  ORDER.ATOMIC,
];

// ── Music ────────────────────────────────────────────────────────────────────

gen.forBlock['mb_play_tone'] = (b) => {
  ctx.imports.add('music');
  return `music.play('${b.getFieldValue('NOTE')}:${b.getFieldValue('BEAT')}')\n`;
};
gen.forBlock['mb_rest'] = (b) => {
  ctx.imports.add('music');
  return `music.play('r:${b.getFieldValue('BEAT')}')\n`;
};
gen.forBlock['mb_play_melody'] = (b) => {
  ctx.imports.add('music');
  return `music.play(music.${b.getFieldValue('MELODY')})\n`;
};
gen.forBlock['mb_set_tempo'] = (b) => {
  ctx.imports.add('music');
  return `music.set_tempo(bpm=${val(b, 'BPM', ORDER.NONE, '120')})\n`;
};
gen.forBlock['mb_stop_music'] = () => {
  ctx.imports.add('music');
  return 'music.stop()\n';
};

// ── Pins ─────────────────────────────────────────────────────────────────────

gen.forBlock['mb_digital_write'] = (b) =>
  `pin${b.getFieldValue('PIN')}.write_digital(${b.getFieldValue('VALUE')})\n`;
gen.forBlock['mb_digital_read'] = (b) => [
  `pin${b.getFieldValue('PIN')}.read_digital()`,
  ORDER.ATOMIC,
];
gen.forBlock['mb_analog_write'] = (b) =>
  `pin${b.getFieldValue('PIN')}.write_analog(${val(b, 'VALUE', ORDER.NONE, '512')})\n`;
gen.forBlock['mb_analog_read'] = (b) => [
  `pin${b.getFieldValue('PIN')}.read_analog()`,
  ORDER.ATOMIC,
];
gen.forBlock['mb_pin_is_touched'] = (b) => [
  `pin${b.getFieldValue('PIN')}.is_touched()`,
  ORDER.ATOMIC,
];

// ── Radio ────────────────────────────────────────────────────────────────────

gen.forBlock['mb_radio_set_group'] = (b) => {
  ctx.imports.add('radio');
  return `radio.config(group=${val(b, 'GROUP', ORDER.NONE, '1')})\nradio.on()\n`;
};
gen.forBlock['mb_radio_send'] = (b) => {
  ctx.imports.add('radio');
  return `radio.send(str(${val(b, 'MESSAGE', ORDER.NONE, "''")}))\n`;
};
gen.forBlock['mb_radio_receive'] = () => {
  ctx.imports.add('radio');
  return ['radio.receive()', ORDER.ATOMIC];
};

// ── Shared control / maths / variables (the cl_* blocks) ─────────────────────

gen.forBlock['cl_wait'] = (b) => {
  const t = val(b, 'TIME', ORDER.NONE, '1');
  switch (b.getFieldValue('UNIT')) {
    case 'MILLIS':
      return `sleep(${t})\n`;
    case 'MICROS':
      return `sleep(${t} / 1000)\n`;
    default:
      return `sleep(${t} * 1000)\n`;
  }
};

let loopCounter = 0;
gen.forBlock['cl_repeat'] = (b) => {
  const i = `i_${loopCounter++}`;
  return `for ${i} in range(${val(b, 'TIMES', ORDER.NONE, '10')}):\n${body(b, 'DO')}`;
};
gen.forBlock['cl_forever'] = (b) => `while True:\n${body(b, 'DO')}`;
gen.forBlock['cl_while'] = (b) =>
  `while ${val(b, 'COND', ORDER.NONE, 'True')}:\n${body(b, 'DO')}`;
gen.forBlock['cl_if'] = (b) =>
  `if ${val(b, 'COND', ORDER.NONE, 'True')}:\n${body(b, 'THEN')}`;
gen.forBlock['cl_if_else'] = (b) =>
  `if ${val(b, 'COND', ORDER.NONE, 'True')}:\n${body(b, 'THEN')}else:\n${body(b, 'ELSE')}`;
gen.forBlock['cl_for'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  const from = val(b, 'FROM', ORDER.NONE, '1');
  const to = val(b, 'TO', ORDER.NONE, '10');
  const step = val(b, 'STEP', ORDER.NONE, '1');
  return `for ${v} in range(${from}, ${to} + 1, ${step}):\n${body(b, 'DO')}`;
};
gen.forBlock['cl_break'] = () => 'break\n';

gen.forBlock['cl_number'] = (b) => [String(b.getFieldValue('NUM')), ORDER.ATOMIC];
gen.forBlock['cl_text'] = (b) => [
  `'${String(b.getFieldValue('TEXT')).replace(/'/g, "\\'")}'`,
  ORDER.ATOMIC,
];
gen.forBlock['cl_boolean'] = (b) => [
  b.getFieldValue('BOOL') === 'TRUE' ? 'True' : 'False',
  ORDER.ATOMIC,
];

const ARITH: Record<string, [string, number]> = {
  ADD: ['+', ORDER.ADD],
  MINUS: ['-', ORDER.ADD],
  MULTIPLY: ['*', ORDER.MUL],
  DIVIDE: ['/', ORDER.MUL],
  MODULO: ['%', ORDER.MUL],
};

gen.forBlock['cl_arithmetic'] = (b) => {
  const op = b.getFieldValue('OP');
  const a = val(b, 'A');
  const c = val(b, 'B');
  if (op === 'POWER') return [`${a} ** ${c}`, ORDER.POWER];
  const [sym, order] = ARITH[op] ?? ARITH.ADD;
  return [`${a} ${sym} ${c}`, order];
};

const COMPARE: Record<string, string> = {
  EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=',
};
gen.forBlock['cl_compare'] = (b) => [
  `${val(b, 'A', ORDER.RELATIONAL)} ${COMPARE[b.getFieldValue('OP')] ?? '=='} ${val(b, 'B', ORDER.RELATIONAL)}`,
  ORDER.RELATIONAL,
];
gen.forBlock['cl_logic'] = (b) => {
  const and = b.getFieldValue('OP') === 'AND';
  const order = and ? ORDER.AND : ORDER.OR;
  return [
    `${val(b, 'A', order, 'True')} ${and ? 'and' : 'or'} ${val(b, 'B', order, 'True')}`,
    order,
  ];
};
gen.forBlock['cl_not'] = (b) => [`not ${val(b, 'A', ORDER.NOT, 'True')}`, ORDER.NOT];

gen.forBlock['cl_map'] = (b) => {
  // MicroPython has no `map()`, so emit the arithmetic directly.
  const v = val(b, 'VALUE');
  const inLo = val(b, 'FROM_LOW');
  const inHi = val(b, 'FROM_HIGH', ORDER.NONE, '1023');
  const outLo = val(b, 'TO_LOW');
  const outHi = val(b, 'TO_HIGH', ORDER.NONE, '255');
  return [
    `int((${v} - ${inLo}) * (${outHi} - ${outLo}) / (${inHi} - ${inLo}) + ${outLo})`,
    ORDER.ATOMIC,
  ];
};
gen.forBlock['cl_constrain'] = (b) => [
  `min(max(${val(b, 'VALUE')}, ${val(b, 'LOW')}), ${val(b, 'HIGH', ORDER.NONE, '255')})`,
  ORDER.ATOMIC,
];
gen.forBlock['cl_random'] = (b) => {
  ctx.imports.add('random');
  return [
    `random.randint(${val(b, 'LOW', ORDER.NONE, '1')}, ${val(b, 'HIGH', ORDER.NONE, '100')})`,
    ORDER.ATOMIC,
  ];
};

const UNARY: Record<string, string> = {
  ABS: 'abs', SQRT: 'math.sqrt', ROUND: 'round',
  SIN: 'math.sin', COS: 'math.cos', TAN: 'math.tan',
};
gen.forBlock['cl_unary_math'] = (b) => {
  const fn = UNARY[b.getFieldValue('OP')] ?? 'abs';
  if (fn.startsWith('math.')) ctx.imports.add('math');
  return [`${fn}(${val(b, 'A')})`, ORDER.ATOMIC];
};

gen.forBlock['cl_var_set'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  ctx.variables.add(v);
  return `${v} = ${val(b, 'VALUE')}\n`;
};
gen.forBlock['cl_var_change'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  ctx.variables.add(v);
  return `${v} += ${val(b, 'VALUE', ORDER.NONE, '1')}\n`;
};
gen.forBlock['cl_var_get'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  ctx.variables.add(v);
  return [v, ORDER.ATOMIC];
};

gen.forBlock['cl_function_def'] = (b) => {
  const name = ident(b.getFieldValue('NAME'));
  ctx.functions.push(`def ${name}():\n${body(b, 'BODY')}`);
  return '';
};
gen.forBlock['cl_function_call'] = (b) => `${ident(b.getFieldValue('NAME'))}()\n`;

gen.forBlock['cl_comment'] = (b) => `# ${b.getFieldValue('TEXT')}\n`;
gen.forBlock['cl_serial_print'] = (b) => `print(${val(b, 'TEXT', ORDER.NONE, "''")})\n`;
gen.forBlock['cl_serial_begin'] = () => '';

// ── whole-program assembly ───────────────────────────────────────────────────

export function generateMicropython(workspace: Blockly.Workspace): string {
  reset();
  loopCounter = 0;

  const tops = workspace.getTopBlocks(true);
  // Functions first so their bodies register any imports they need.
  for (const b of tops) if (b.type === 'cl_function_def') gen.blockToCode(b);
  // Hats next; they push into `ctx` rather than returning code.
  for (const b of tops) {
    if (b.type === 'cl_function_def') continue;
    gen.blockToCode(b);
  }

  const lines: string[] = ['from microbit import *'];
  for (const mod of [...ctx.imports].sort()) lines.push(`import ${mod}`);
  lines.push('');

  if (ctx.variables.size) {
    for (const v of ctx.variables) lines.push(`${v} = 0`);
    lines.push('');
  }

  if (ctx.functions.length) {
    lines.push(...ctx.functions, '');
  }

  for (const start of ctx.onStart) {
    if (start.trim()) lines.push(start.replace(/\n+$/, ''), '');
  }

  const loopParts: string[] = [];
  for (const f of ctx.forever) if (f.trim()) loopParts.push(f.replace(/\n+$/, ''));
  for (const e of ctx.events) {
    const inner = e.body.trim()
      ? e.body.split('\n').map((l) => (l.trim() ? `    ${l}` : '')).join('\n').replace(/\n+$/, '')
      : '        pass';
    loopParts.push(`    if ${e.condition}:\n${inner}`);
  }

  if (loopParts.length) {
    const loopBody = loopParts.join('\n');
    lines.push('while True:');
    lines.push(loopBody);
    // A loop that never sleeps would spend its whole cycle budget polling, so
    // add a yield — but only when the blocks did not already pause somewhere.
    if (!loopBody.includes('sleep(')) lines.push('    sleep(20)');
  }

  // Variables assigned inside the loop must be declared global to the module
  // only when a function writes them; at module level plain assignment is fine.
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function dedent(code: string): string {
  return code
    .split('\n')
    .map((l) => l.replace(/^ {4}/, ''))
    .join('\n');
}

export const micropythonGenerator = gen;
