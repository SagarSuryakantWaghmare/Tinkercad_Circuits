import { HUE } from './blocks';

const num = (v: number) => ({
  shadow: { type: 'cl_number', fields: { NUM: v } },
});

const text = (v: string) => ({
  shadow: { type: 'cl_text', fields: { TEXT: v } },
});

/** Toolbox in the reference product's category order. */
export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Output',
      colour: HUE.output,
      contents: [
        { kind: 'block', type: 'cl_digital_write' },
        { kind: 'block', type: 'cl_analog_write', inputs: { VALUE: num(128) } },
        { kind: 'block', type: 'cl_servo_write', inputs: { ANGLE: num(90) } },
        { kind: 'block', type: 'cl_tone', inputs: { DURATION: num(1) } },
        { kind: 'block', type: 'cl_no_tone' },
      ],
    },
    {
      kind: 'category',
      name: 'Input',
      colour: HUE.input,
      contents: [
        { kind: 'block', type: 'cl_digital_read' },
        { kind: 'block', type: 'cl_analog_read' },
        { kind: 'block', type: 'cl_pin_mode' },
        { kind: 'block', type: 'cl_pulse_in' },
        { kind: 'block', type: 'cl_millis' },
      ],
    },
    {
      kind: 'category',
      name: 'Notification',
      colour: HUE.notification,
      contents: [
        { kind: 'block', type: 'cl_serial_begin' },
        { kind: 'block', type: 'cl_serial_print', inputs: { TEXT: text('hello') } },
        { kind: 'block', type: 'cl_comment' },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      colour: HUE.control,
      contents: [
        { kind: 'block', type: 'cl_wait', inputs: { TIME: num(1) } },
        { kind: 'block', type: 'cl_repeat', inputs: { TIMES: num(10) } },
        { kind: 'block', type: 'cl_forever' },
        { kind: 'block', type: 'cl_while' },
        { kind: 'block', type: 'cl_if' },
        { kind: 'block', type: 'cl_if_else' },
        {
          kind: 'block',
          type: 'cl_for',
          inputs: { FROM: num(1), TO: num(10), STEP: num(1) },
        },
        { kind: 'block', type: 'cl_break' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: HUE.math,
      contents: [
        { kind: 'block', type: 'cl_number' },
        { kind: 'block', type: 'cl_text' },
        { kind: 'block', type: 'cl_arithmetic', inputs: { A: num(1), B: num(1) } },
        { kind: 'block', type: 'cl_compare', inputs: { A: num(0), B: num(0) } },
        { kind: 'block', type: 'cl_logic' },
        { kind: 'block', type: 'cl_not' },
        { kind: 'block', type: 'cl_boolean' },
        {
          kind: 'block',
          type: 'cl_map',
          inputs: {
            VALUE: num(0),
            FROM_LOW: num(0),
            FROM_HIGH: num(1023),
            TO_LOW: num(0),
            TO_HIGH: num(255),
          },
        },
        {
          kind: 'block',
          type: 'cl_constrain',
          inputs: { VALUE: num(0), LOW: num(0), HIGH: num(255) },
        },
        { kind: 'block', type: 'cl_random', inputs: { LOW: num(1), HIGH: num(100) } },
        { kind: 'block', type: 'cl_unary_math', inputs: { A: num(1) } },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: HUE.variables,
      contents: [
        { kind: 'block', type: 'cl_var_set', inputs: { VALUE: num(0) } },
        { kind: 'block', type: 'cl_var_change', inputs: { VALUE: num(1) } },
        { kind: 'block', type: 'cl_var_get' },
      ],
    },
    {
      kind: 'category',
      name: 'Functions',
      colour: HUE.functions,
      contents: [
        { kind: 'block', type: 'cl_function_def' },
        { kind: 'block', type: 'cl_function_call' },
      ],
    },
  ],
};

/** The starter workspace — an LED blink, as the reference product ships. */
export const DEFAULT_WORKSPACE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'cl_forever',
        x: 40,
        y: 40,
        inputs: {
          DO: {
            block: {
              type: 'cl_digital_write',
              fields: { PIN: '13', STATE: 'HIGH' },
              next: {
                block: {
                  type: 'cl_wait',
                  fields: { UNIT: 'SECS' },
                  inputs: { TIME: { shadow: { type: 'cl_number', fields: { NUM: 1 } } } },
                  next: {
                    block: {
                      type: 'cl_digital_write',
                      fields: { PIN: '13', STATE: 'LOW' },
                      next: {
                        block: {
                          type: 'cl_wait',
                          fields: { UNIT: 'SECS' },
                          inputs: { TIME: { shadow: { type: 'cl_number', fields: { NUM: 1 } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};
