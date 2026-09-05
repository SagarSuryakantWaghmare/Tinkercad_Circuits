import * as Blockly from 'blockly/core';

/**
 * Block definitions.
 *
 * The set and the category colours mirror the reference product: Output,
 * Input, Notification, Control, Math, Variables and Functions. Blocks are
 * defined from JSON so the generator file can stay purely about code shape.
 */

export const HUE = {
  output: '#2E7D32',
  input: '#1565C0',
  notification: '#6A1B9A',
  control: '#EF6C00',
  math: '#00838F',
  variables: '#C62828',
  functions: '#4527A0',
} as const;

const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => [String(i), String(i)] as [string, string]);
const PWM_PINS = ['3', '5', '6', '9', '10', '11'].map((p) => [p, p] as [string, string]);
const ANALOG_PINS = Array.from({ length: 6 }, (_, i) => [`A${i}`, String(14 + i)] as [string, string]);

const NOTES: [string, string][] = [
  ['C3', '131'], ['D3', '147'], ['E3', '165'], ['F3', '175'], ['G3', '196'], ['A3', '220'], ['B3', '247'],
  ['C4', '262'], ['D4', '294'], ['E4', '330'], ['F4', '349'], ['G4', '392'], ['A4', '440'], ['B4', '494'],
  ['C5', '523'], ['D5', '587'], ['E5', '659'], ['F5', '698'], ['G5', '784'], ['A5', '880'], ['B5', '988'],
];

export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray([
    // ── Output ───────────────────────────────────────────────────────────────
    {
      type: 'cl_digital_write',
      message0: 'set pin %1 to %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
        {
          type: 'field_dropdown',
          name: 'STATE',
          options: [
            ['HIGH', 'HIGH'],
            ['LOW', 'LOW'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.output,
      tooltip: 'Drive a digital pin high or low.',
    },
    {
      type: 'cl_analog_write',
      message0: 'set PWM pin %1 to %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
        { type: 'input_value', name: 'VALUE', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.output,
      tooltip: 'Write 0–255 to a PWM-capable pin.',
    },
    {
      type: 'cl_servo_write',
      message0: 'rotate servo on pin %1 to %2 degrees',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
        { type: 'input_value', name: 'ANGLE', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.output,
    },
    {
      type: 'cl_tone',
      message0: 'play note %1 on pin %2 for %3 secs',
      args0: [
        { type: 'field_dropdown', name: 'NOTE', options: NOTES },
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
        { type: 'input_value', name: 'DURATION', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.output,
    },
    {
      type: 'cl_no_tone',
      message0: 'turn off tone on pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.output,
    },

    // ── Input ────────────────────────────────────────────────────────────────
    {
      type: 'cl_digital_read',
      message0: 'read digital pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
      output: 'Number',
      colour: HUE.input,
    },
    {
      type: 'cl_analog_read',
      message0: 'read analog pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
      output: 'Number',
      colour: HUE.input,
    },
    {
      type: 'cl_pin_mode',
      message0: 'set pin %1 as %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            ['input', 'INPUT'],
            ['output', 'OUTPUT'],
            ['input with pull-up', 'INPUT_PULLUP'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.input,
    },
    {
      type: 'cl_pulse_in',
      message0: 'read pulse on pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
      output: 'Number',
      colour: HUE.input,
      tooltip: 'Microseconds the pin stays high — used with an ultrasonic sensor.',
    },
    {
      type: 'cl_millis',
      message0: 'current time (milliseconds)',
      output: 'Number',
      colour: HUE.input,
    },

    // ── Notification ─────────────────────────────────────────────────────────
    {
      type: 'cl_serial_print',
      message0: 'print to serial monitor %1 %2',
      args0: [
        { type: 'input_value', name: 'TEXT' },
        {
          type: 'field_dropdown',
          name: 'NEWLINE',
          options: [
            ['with new line', 'TRUE'],
            ['without new line', 'FALSE'],
          ],
        },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.notification,
    },
    {
      type: 'cl_serial_begin',
      message0: 'start serial monitor at %1 baud',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BAUD',
          options: [9600, 19200, 38400, 57600, 115200].map((b) => [String(b), String(b)]),
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.notification,
    },
    {
      type: 'cl_comment',
      message0: 'comment %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'note to self' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.notification,
    },

    // ── Control ──────────────────────────────────────────────────────────────
    {
      type: 'cl_wait',
      message0: 'wait %1 %2',
      args0: [
        { type: 'input_value', name: 'TIME', check: 'Number' },
        {
          type: 'field_dropdown',
          name: 'UNIT',
          options: [
            ['seconds', 'SECS'],
            ['milliseconds', 'MILLIS'],
            ['microseconds', 'MICROS'],
          ],
        },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_repeat',
      message0: 'repeat %1 times',
      args0: [{ type: 'input_value', name: 'TIMES', check: 'Number' }],
      message1: 'do %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_forever',
      message0: 'forever',
      message1: 'do %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_while',
      message0: 'while %1',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: 'do %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_if',
      message0: 'if %1 then',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'THEN' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_if_else',
      message0: 'if %1 then',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'THEN' }],
      message2: 'else %1',
      args2: [{ type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_for',
      message0: 'count with %1 from %2 to %3 by %4',
      args0: [
        { type: 'field_input', name: 'VAR', text: 'i' },
        { type: 'input_value', name: 'FROM', check: 'Number' },
        { type: 'input_value', name: 'TO', check: 'Number' },
        { type: 'input_value', name: 'STEP', check: 'Number' },
      ],
      inputsInline: true,
      message1: 'do %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },
    {
      type: 'cl_break',
      message0: 'break out of loop',
      previousStatement: null,
      nextStatement: null,
      colour: HUE.control,
    },

    // ── Math ─────────────────────────────────────────────────────────────────
    {
      type: 'cl_number',
      message0: '%1',
      args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
      output: 'Number',
      colour: HUE.math,
    },
    {
      type: 'cl_text',
      message0: '" %1 "',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'hello' }],
      output: 'String',
      colour: HUE.math,
    },
    {
      type: 'cl_arithmetic',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A', check: 'Number' },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['+', 'ADD'],
            ['−', 'MINUS'],
            ['×', 'MULTIPLY'],
            ['÷', 'DIVIDE'],
            ['remainder of', 'MODULO'],
            ['^', 'POWER'],
          ],
        },
        { type: 'input_value', name: 'B', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: HUE.math,
    },
    {
      type: 'cl_compare',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A' },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['=', 'EQ'],
            ['≠', 'NEQ'],
            ['<', 'LT'],
            ['≤', 'LTE'],
            ['>', 'GT'],
            ['≥', 'GTE'],
          ],
        },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: 'Boolean',
      colour: HUE.math,
    },
    {
      type: 'cl_logic',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A', check: 'Boolean' },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['and', 'AND'],
            ['or', 'OR'],
          ],
        },
        { type: 'input_value', name: 'B', check: 'Boolean' },
      ],
      inputsInline: true,
      output: 'Boolean',
      colour: HUE.math,
    },
    {
      type: 'cl_not',
      message0: 'not %1',
      args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }],
      output: 'Boolean',
      colour: HUE.math,
    },
    {
      type: 'cl_boolean',
      message0: '%1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BOOL',
          options: [
            ['true', 'TRUE'],
            ['false', 'FALSE'],
          ],
        },
      ],
      output: 'Boolean',
      colour: HUE.math,
    },
    {
      type: 'cl_map',
      message0: 'map %1 from ( %2 , %3 ) to ( %4 , %5 )',
      args0: [
        { type: 'input_value', name: 'VALUE', check: 'Number' },
        { type: 'input_value', name: 'FROM_LOW', check: 'Number' },
        { type: 'input_value', name: 'FROM_HIGH', check: 'Number' },
        { type: 'input_value', name: 'TO_LOW', check: 'Number' },
        { type: 'input_value', name: 'TO_HIGH', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: HUE.math,
    },
    {
      type: 'cl_constrain',
      message0: 'constrain %1 between %2 and %3',
      args0: [
        { type: 'input_value', name: 'VALUE', check: 'Number' },
        { type: 'input_value', name: 'LOW', check: 'Number' },
        { type: 'input_value', name: 'HIGH', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: HUE.math,
    },
    {
      type: 'cl_random',
      message0: 'random number from %1 to %2',
      args0: [
        { type: 'input_value', name: 'LOW', check: 'Number' },
        { type: 'input_value', name: 'HIGH', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: HUE.math,
    },
    {
      type: 'cl_unary_math',
      message0: '%1 of %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['absolute value', 'ABS'],
            ['square root', 'SQRT'],
            ['round', 'ROUND'],
            ['sine', 'SIN'],
            ['cosine', 'COS'],
            ['tangent', 'TAN'],
          ],
        },
        { type: 'input_value', name: 'A', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: HUE.math,
    },

    // ── Variables ────────────────────────────────────────────────────────────
    {
      type: 'cl_var_set',
      message0: 'set %1 to %2',
      args0: [
        { type: 'field_input', name: 'VAR', text: 'item' },
        { type: 'input_value', name: 'VALUE' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.variables,
    },
    {
      type: 'cl_var_change',
      message0: 'change %1 by %2',
      args0: [
        { type: 'field_input', name: 'VAR', text: 'item' },
        { type: 'input_value', name: 'VALUE', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: HUE.variables,
    },
    {
      type: 'cl_var_get',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'VAR', text: 'item' }],
      output: null,
      colour: HUE.variables,
    },

    // ── Functions ────────────────────────────────────────────────────────────
    {
      type: 'cl_function_def',
      message0: 'to %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'do something' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      colour: HUE.functions,
      tooltip: 'Define a reusable function.',
    },
    {
      type: 'cl_function_call',
      message0: 'call %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'do something' }],
      previousStatement: null,
      nextStatement: null,
      colour: HUE.functions,
    },
  ]);
}
