import * as Blockly from 'blockly/core';

/**
 * Blocks → Arduino C++.
 *
 * The generator collects three things while it walks the workspace: the loop
 * body, whatever `setup()` needs (pin modes, Serial.begin, servo attach), and
 * global declarations (variables, Servo objects). That mirrors how the
 * reference product hides `setup()` from the blocks view — you place blocks and
 * the pin configuration appears in the generated code by itself.
 */

const ORDER = {
  ATOMIC: 0,
  UNARY: 2,
  MUL: 5,
  ADD: 6,
  SHIFT: 7,
  RELATIONAL: 8,
  EQUALITY: 9,
  AND: 13,
  OR: 14,
  CONDITIONAL: 15,
  ASSIGNMENT: 16,
  NONE: 99,
};

interface Collected {
  setup: string[];
  globals: string[];
  functions: string[];
  variables: Set<string>;
  servos: Map<string, string>;
  pinModes: Map<string, string>;
  serial: boolean;
}

let ctx: Collected;

function resetCollected() {
  ctx = {
    setup: [],
    globals: [],
    functions: [],
    variables: new Set(),
    servos: new Map(),
    pinModes: new Map(),
    serial: false,
  };
}
resetCollected();

const gen = new Blockly.CodeGenerator('Arduino');

// Chain a block to whatever follows it. `scrub_` is marked protected in the
// type definitions but is the documented extension point for generators.
(gen as unknown as {
  scrub_: (block: Blockly.Block, code: string, thisOnly?: boolean) => string;
}).scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection?.targetBlock();
  if (next && !thisOnly) return code + gen.blockToCode(next);
  return code;
};

const val = (b: Blockly.Block, name: string, order = ORDER.NONE, fallback = '0') =>
  gen.valueToCode(b, name, order) || fallback;

const stmts = (b: Blockly.Block, name: string) => gen.statementToCode(b, name) || '';

const ident = (raw: string) => {
  const s = raw.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^(\d)/, '_$1');
  return s || 'item';
};

// ── Output ───────────────────────────────────────────────────────────────────

gen.forBlock['cl_digital_write'] = (b) => {
  const pin = b.getFieldValue('PIN');
  ctx.pinModes.set(pin, 'OUTPUT');
  return `digitalWrite(${pin}, ${b.getFieldValue('STATE')});\n`;
};

gen.forBlock['cl_analog_write'] = (b) => {
  const pin = b.getFieldValue('PIN');
  ctx.pinModes.set(pin, 'OUTPUT');
  return `analogWrite(${pin}, ${val(b, 'VALUE', ORDER.NONE, '128')});\n`;
};

gen.forBlock['cl_servo_write'] = (b) => {
  const pin = b.getFieldValue('PIN');
  const name = `servo_${pin}`;
  if (!ctx.servos.has(pin)) {
    ctx.servos.set(pin, name);
    ctx.globals.push(`Servo ${name};`);
    ctx.setup.push(`${name}.attach(${pin});`);
  }
  return `${name}.write(${val(b, 'ANGLE', ORDER.NONE, '90')});\n`;
};

gen.forBlock['cl_tone'] = (b) => {
  const pin = b.getFieldValue('PIN');
  ctx.pinModes.set(pin, 'OUTPUT');
  const secs = val(b, 'DURATION', ORDER.NONE, '1');
  return `tone(${pin}, ${b.getFieldValue('NOTE')}, ${secs} * 1000);\ndelay(${secs} * 1000);\n`;
};

gen.forBlock['cl_no_tone'] = (b) => `noTone(${b.getFieldValue('PIN')});\n`;

// ── Input ────────────────────────────────────────────────────────────────────

gen.forBlock['cl_digital_read'] = (b) => {
  const pin = b.getFieldValue('PIN');
  if (!ctx.pinModes.has(pin)) ctx.pinModes.set(pin, 'INPUT');
  return [`digitalRead(${pin})`, ORDER.ATOMIC];
};

gen.forBlock['cl_analog_read'] = (b) => [
  `analogRead(${b.getFieldValue('PIN')})`,
  ORDER.ATOMIC,
];

gen.forBlock['cl_pin_mode'] = (b) => {
  ctx.pinModes.set(b.getFieldValue('PIN'), b.getFieldValue('MODE'));
  return '';
};

gen.forBlock['cl_pulse_in'] = (b) => {
  const pin = b.getFieldValue('PIN');
  ctx.pinModes.set(pin, 'INPUT');
  return [`pulseIn(${pin}, HIGH)`, ORDER.ATOMIC];
};

gen.forBlock['cl_millis'] = () => ['millis()', ORDER.ATOMIC];

// ── Notification ─────────────────────────────────────────────────────────────

gen.forBlock['cl_serial_print'] = (b) => {
  ctx.serial = true;
  const nl = b.getFieldValue('NEWLINE') === 'TRUE';
  return `Serial.print${nl ? 'ln' : ''}(${val(b, 'TEXT', ORDER.NONE, '""')});\n`;
};

gen.forBlock['cl_serial_begin'] = (b) => {
  ctx.serial = true;
  ctx.setup.push(`Serial.begin(${b.getFieldValue('BAUD')});`);
  return '';
};

gen.forBlock['cl_comment'] = (b) => `// ${b.getFieldValue('TEXT')}\n`;

// ── Control ──────────────────────────────────────────────────────────────────

gen.forBlock['cl_wait'] = (b) => {
  const t = val(b, 'TIME', ORDER.NONE, '1');
  switch (b.getFieldValue('UNIT')) {
    case 'MILLIS':
      return `delay(${t});\n`;
    case 'MICROS':
      return `delayMicroseconds(${t});\n`;
    default:
      return `delay(${t} * 1000);\n`;
  }
};

let loopCounter = 0;
gen.forBlock['cl_repeat'] = (b) => {
  const i = `i_${loopCounter++}`;
  return `for (int ${i} = 0; ${i} < ${val(b, 'TIMES', ORDER.NONE, '10')}; ${i}++) {\n${stmts(b, 'DO')}}\n`;
};

gen.forBlock['cl_forever'] = (b) => `while (true) {\n${stmts(b, 'DO')}}\n`;

gen.forBlock['cl_while'] = (b) =>
  `while (${val(b, 'COND', ORDER.NONE, 'true')}) {\n${stmts(b, 'DO')}}\n`;

gen.forBlock['cl_if'] = (b) =>
  `if (${val(b, 'COND', ORDER.NONE, 'true')}) {\n${stmts(b, 'THEN')}}\n`;

gen.forBlock['cl_if_else'] = (b) =>
  `if (${val(b, 'COND', ORDER.NONE, 'true')}) {\n${stmts(b, 'THEN')}} else {\n${stmts(b, 'ELSE')}}\n`;

gen.forBlock['cl_for'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  const from = val(b, 'FROM', ORDER.NONE, '1');
  const to = val(b, 'TO', ORDER.NONE, '10');
  const step = val(b, 'STEP', ORDER.NONE, '1');
  return `for (int ${v} = ${from}; ${v} <= ${to}; ${v} += ${step}) {\n${stmts(b, 'DO')}}\n`;
};

gen.forBlock['cl_break'] = () => 'break;\n';

// ── Math ─────────────────────────────────────────────────────────────────────

gen.forBlock['cl_number'] = (b) => [String(b.getFieldValue('NUM')), ORDER.ATOMIC];

gen.forBlock['cl_text'] = (b) => [
  `"${String(b.getFieldValue('TEXT')).replace(/"/g, '\\"')}"`,
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
  const a = val(b, 'A', ORDER.NONE);
  const c = val(b, 'B', ORDER.NONE);
  if (op === 'POWER') return [`pow(${a}, ${c})`, ORDER.ATOMIC];
  const [sym, order] = ARITH[op] ?? ARITH.ADD;
  return [`${a} ${sym} ${c}`, order];
};

const COMPARE: Record<string, string> = {
  EQ: '==',
  NEQ: '!=',
  LT: '<',
  LTE: '<=',
  GT: '>',
  GTE: '>=',
};

gen.forBlock['cl_compare'] = (b) => {
  const op = COMPARE[b.getFieldValue('OP')] ?? '==';
  const order = op === '==' || op === '!=' ? ORDER.EQUALITY : ORDER.RELATIONAL;
  return [`${val(b, 'A', order)} ${op} ${val(b, 'B', order)}`, order];
};

gen.forBlock['cl_logic'] = (b) => {
  const and = b.getFieldValue('OP') === 'AND';
  const order = and ? ORDER.AND : ORDER.OR;
  return [`${val(b, 'A', order, 'true')} ${and ? '&&' : '||'} ${val(b, 'B', order, 'true')}`, order];
};

gen.forBlock['cl_not'] = (b) => [`!(${val(b, 'A', ORDER.UNARY, 'true')})`, ORDER.UNARY];

gen.forBlock['cl_boolean'] = (b) => [
  b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false',
  ORDER.ATOMIC,
];

gen.forBlock['cl_map'] = (b) => [
  `map(${val(b, 'VALUE')}, ${val(b, 'FROM_LOW')}, ${val(b, 'FROM_HIGH', ORDER.NONE, '1023')}, ${val(b, 'TO_LOW')}, ${val(b, 'TO_HIGH', ORDER.NONE, '255')})`,
  ORDER.ATOMIC,
];

gen.forBlock['cl_constrain'] = (b) => [
  `constrain(${val(b, 'VALUE')}, ${val(b, 'LOW')}, ${val(b, 'HIGH', ORDER.NONE, '255')})`,
  ORDER.ATOMIC,
];

gen.forBlock['cl_random'] = (b) => [
  `random(${val(b, 'LOW', ORDER.NONE, '1')}, ${val(b, 'HIGH', ORDER.NONE, '100')})`,
  ORDER.ATOMIC,
];

const UNARY: Record<string, string> = {
  ABS: 'abs',
  SQRT: 'sqrt',
  ROUND: 'round',
  SIN: 'sin',
  COS: 'cos',
  TAN: 'tan',
};

gen.forBlock['cl_unary_math'] = (b) => [
  `${UNARY[b.getFieldValue('OP')] ?? 'abs'}(${val(b, 'A')})`,
  ORDER.ATOMIC,
];

// ── Variables ────────────────────────────────────────────────────────────────

gen.forBlock['cl_var_set'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  ctx.variables.add(v);
  return `${v} = ${val(b, 'VALUE')};\n`;
};

gen.forBlock['cl_var_change'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  ctx.variables.add(v);
  return `${v} += ${val(b, 'VALUE', ORDER.NONE, '1')};\n`;
};

gen.forBlock['cl_var_get'] = (b) => {
  const v = ident(b.getFieldValue('VAR'));
  ctx.variables.add(v);
  return [v, ORDER.ATOMIC];
};

// ── Functions ────────────────────────────────────────────────────────────────

gen.forBlock['cl_function_def'] = (b) => {
  const name = ident(b.getFieldValue('NAME'));
  ctx.functions.push(`void ${name}() {\n${stmts(b, 'BODY')}}`);
  return '';
};

gen.forBlock['cl_function_call'] = (b) => `${ident(b.getFieldValue('NAME'))}();\n`;

// ── Whole-sketch assembly ────────────────────────────────────────────────────

export function generateSketch(workspace: Blockly.Workspace): string {
  resetCollected();
  loopCounter = 0;

  // Function definitions first, so their bodies register any pins they use.
  const tops = workspace.getTopBlocks(true);
  for (const b of tops) {
    if (b.type === 'cl_function_def') gen.blockToCode(b);
  }

  let body = '';
  for (const b of tops) {
    if (b.type === 'cl_function_def') continue;
    body += gen.blockToCode(b);
  }

  const lines: string[] = [];
  if (ctx.servos.size) lines.push('#include <Servo.h>', '');

  const declared = [...ctx.variables].map((v) => `int ${v} = 0;`);
  if (declared.length) lines.push(...declared, '');
  if (ctx.globals.length) lines.push(...ctx.globals, '');

  const setup = [
    ...[...ctx.pinModes].map(([pin, mode]) => `  pinMode(${pin}, ${mode});`),
    ...ctx.setup.map((s) => `  ${s}`),
  ];
  lines.push('void setup()', '{', ...(setup.length ? setup : ['']), '}', '');

  lines.push('void loop()', '{', indent(body || ''), '}', '');

  if (ctx.functions.length) lines.push(...ctx.functions, '');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function indent(code: string): string {
  return code
    .split('\n')
    .filter((l, i, a) => l.trim() !== '' || i < a.length - 1)
    .map((l) => (l.trim() ? `  ${l}` : ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export const arduinoGenerator = gen;
