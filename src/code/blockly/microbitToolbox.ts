import { HUE } from './blocks';
import { MB_HUE } from './microbitBlocks';

const num = (v: number) => ({ shadow: { type: 'cl_number', fields: { NUM: v } } });
const text = (v: string) => ({ shadow: { type: 'cl_text', fields: { TEXT: v } } });

/** MakeCode's category order, adapted to the block set we implement. */
export const MICROBIT_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Basic',
      colour: MB_HUE.basic,
      contents: [
        { kind: 'block', type: 'mb_show_number', inputs: { VALUE: num(0) } },
        { kind: 'block', type: 'mb_show_string', inputs: { TEXT: text('Hello!') } },
        { kind: 'block', type: 'mb_show_icon' },
        { kind: 'block', type: 'mb_show_leds' },
        { kind: 'block', type: 'mb_clear_screen' },
        { kind: 'block', type: 'mb_pause', inputs: { MS: num(500) } },
        { kind: 'block', type: 'mb_forever' },
        { kind: 'block', type: 'mb_on_start' },
        { kind: 'block', type: 'mb_print', inputs: { VALUE: text('hello') } },
      ],
    },
    {
      kind: 'category',
      name: 'Input',
      colour: MB_HUE.input,
      contents: [
        { kind: 'block', type: 'mb_on_button' },
        { kind: 'block', type: 'mb_on_gesture' },
        { kind: 'block', type: 'mb_button_is_pressed' },
        { kind: 'block', type: 'mb_acceleration' },
        { kind: 'block', type: 'mb_compass_heading' },
        { kind: 'block', type: 'mb_light_level' },
        { kind: 'block', type: 'mb_temperature' },
        { kind: 'block', type: 'mb_running_time' },
      ],
    },
    {
      kind: 'category',
      name: 'Music',
      colour: MB_HUE.music,
      contents: [
        { kind: 'block', type: 'mb_play_tone' },
        { kind: 'block', type: 'mb_rest' },
        { kind: 'block', type: 'mb_play_melody' },
        { kind: 'block', type: 'mb_set_tempo', inputs: { BPM: num(120) } },
        { kind: 'block', type: 'mb_stop_music' },
      ],
    },
    {
      kind: 'category',
      name: 'LED',
      colour: MB_HUE.led,
      contents: [
        { kind: 'block', type: 'mb_plot', inputs: { X: num(2), Y: num(2) } },
        { kind: 'block', type: 'mb_unplot', inputs: { X: num(2), Y: num(2) } },
        {
          kind: 'block',
          type: 'mb_plot_brightness',
          inputs: { X: num(2), Y: num(2), B: num(9) },
        },
        { kind: 'block', type: 'mb_point', inputs: { X: num(2), Y: num(2) } },
      ],
    },
    {
      kind: 'category',
      name: 'Pins',
      colour: MB_HUE.pins,
      contents: [
        { kind: 'block', type: 'mb_digital_write' },
        { kind: 'block', type: 'mb_digital_read' },
        { kind: 'block', type: 'mb_analog_write', inputs: { VALUE: num(512) } },
        { kind: 'block', type: 'mb_analog_read' },
        { kind: 'block', type: 'mb_pin_is_touched' },
      ],
    },
    {
      kind: 'category',
      name: 'Radio',
      colour: MB_HUE.radio,
      contents: [
        { kind: 'block', type: 'mb_radio_set_group', inputs: { GROUP: num(1) } },
        { kind: 'block', type: 'mb_radio_send', inputs: { MESSAGE: text('hello') } },
        { kind: 'block', type: 'mb_radio_receive' },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      colour: HUE.control,
      contents: [
        { kind: 'block', type: 'cl_repeat', inputs: { TIMES: num(4) } },
        { kind: 'block', type: 'cl_while' },
        { kind: 'block', type: 'cl_if' },
        { kind: 'block', type: 'cl_if_else' },
        {
          kind: 'block',
          type: 'cl_for',
          inputs: { FROM: num(0), TO: num(4), STEP: num(1) },
        },
        { kind: 'block', type: 'cl_break' },
        { kind: 'block', type: 'cl_comment' },
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
        { kind: 'block', type: 'cl_random', inputs: { LOW: num(1), HIGH: num(6) } },
        {
          kind: 'block',
          type: 'cl_constrain',
          inputs: { VALUE: num(0), LOW: num(0), HIGH: num(9) },
        },
        {
          kind: 'block',
          type: 'cl_map',
          inputs: {
            VALUE: num(0), FROM_LOW: num(0), FROM_HIGH: num(1023),
            TO_LOW: num(0), TO_HIGH: num(9),
          },
        },
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

/** The starter workspace: a beating heart, as MakeCode opens with. */
export const MICROBIT_DEFAULT_WORKSPACE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'mb_forever',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'mb_show_icon',
              fields: { ICON: 'HEART' },
              next: {
                block: {
                  type: 'mb_pause',
                  inputs: { MS: { shadow: { type: 'cl_number', fields: { NUM: 500 } } } },
                  next: {
                    block: {
                      type: 'mb_show_icon',
                      fields: { ICON: 'HEART_SMALL' },
                      next: {
                        block: {
                          type: 'mb_pause',
                          inputs: { MS: { shadow: { type: 'cl_number', fields: { NUM: 500 } } } },
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
