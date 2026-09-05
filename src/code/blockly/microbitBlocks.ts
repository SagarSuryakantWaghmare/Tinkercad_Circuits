import * as Blockly from 'blockly/core';
import { BUILTIN_IMAGES } from '@/sim/mcu/microbit/images';

/**
 * micro:bit blocks, in the MakeCode categories and colours a micro:bit user
 * expects: Basic, Input, Music, LED, Radio, Pins. The generic Control, Math,
 * Variables and Functions blocks are shared with the Arduino set — only the
 * generator differs — so the two languages stay in step.
 */

export const MB_HUE = {
  basic: '#1E90FF',
  input: '#B4009E',
  music: '#D83B01',
  led: '#5C2D91',
  radio: '#E3008C',
  pins: '#A80000',
} as const;

const ICONS = Object.keys(BUILTIN_IMAGES)
  .filter((n) => !n.startsWith('CLOCK'))
  .map((n) => [prettyIcon(n), n] as [string, string]);

function prettyIcon(name: string) {
  return name
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const PINS: [string, string][] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20]
  .map((p) => [`P${p}`, String(p)]);

const NOTES: [string, string][] = [
  ['C', 'c4'], ['D', 'd4'], ['E', 'e4'], ['F', 'f4'], ['G', 'g4'], ['A', 'a4'], ['B', 'b4'],
  ['C5', 'c5'], ['D5', 'd5'], ['E5', 'e5'], ['F5', 'f5'], ['G5', 'g5'], ['A5', 'a5'], ['B5', 'b5'],
];

const BEATS: [string, string][] = [
  ['1 beat', '4'], ['1/2 beat', '2'], ['1/4 beat', '1'],
  ['2 beats', '8'], ['4 beats', '16'],
];

const MELODIES: [string, string][] = [
  ['dadadum', 'DADADADUM'], ['entertainer', 'ENTERTAINER'], ['prelude', 'PRELUDE'],
  ['ode', 'ODE'], ['nyan', 'NYAN'], ['ringtone', 'RINGTONE'], ['funk', 'FUNK'],
  ['blues', 'BLUES'], ['birthday', 'BIRTHDAY'], ['wedding', 'WEDDING'],
  ['funeral', 'FUNERAL'], ['punchline', 'PUNCHLINE'], ['baddy', 'BADDY'],
  ['chase', 'CHASE'], ['ba ding', 'BA_DING'], ['power up', 'POWER_UP'],
  ['power down', 'POWER_DOWN'],
];

const GESTURES: [string, string][] = [
  ['shake', 'shake'], ['tilt left', 'left'], ['tilt right', 'right'],
  ['logo up', 'up'], ['logo down', 'down'], ['face up', 'face up'],
];

export function defineMicrobitBlocks() {
  Blockly.defineBlocksWithJsonArray([
    // ── Basic ────────────────────────────────────────────────────────────────
    {
      type: 'mb_on_start',
      message0: 'on start',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      colour: MB_HUE.basic,
      tooltip: 'Runs once when the program starts.',
    },
    {
      type: 'mb_forever',
      message0: 'forever',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      colour: MB_HUE.basic,
      tooltip: 'Runs over and over for as long as the board is powered.',
    },
    {
      type: 'mb_show_number',
      message0: 'show number %1',
      args0: [{ type: 'input_value', name: 'VALUE', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
    },
    {
      type: 'mb_show_string',
      message0: 'show string %1',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
    },
    {
      type: 'mb_show_icon',
      message0: 'show icon %1',
      args0: [{ type: 'field_dropdown', name: 'ICON', options: ICONS }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
    },
    {
      type: 'mb_show_leds',
      message0: 'show leds %1',
      args0: [
        {
          type: 'field_input',
          name: 'PATTERN',
          text: '09090:99999:99999:09990:00900',
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
      tooltip: 'Five rows of five brightness digits (0–9), separated by colons.',
    },
    {
      type: 'mb_clear_screen',
      message0: 'clear screen',
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
    },
    {
      type: 'mb_pause',
      message0: 'pause %1 ms',
      args0: [{ type: 'input_value', name: 'MS', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
    },

    // ── Input ────────────────────────────────────────────────────────────────
    {
      type: 'mb_on_button',
      message0: 'on button %1 pressed',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BUTTON',
          options: [['A', 'a'], ['B', 'b'], ['A + B', 'ab']],
        },
      ],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      colour: MB_HUE.input,
      tooltip: 'Checked once each time round the main loop.',
    },
    {
      type: 'mb_on_gesture',
      message0: 'on %1',
      args0: [{ type: 'field_dropdown', name: 'GESTURE', options: GESTURES }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      colour: MB_HUE.input,
    },
    {
      type: 'mb_button_is_pressed',
      message0: 'button %1 is pressed',
      args0: [
        { type: 'field_dropdown', name: 'BUTTON', options: [['A', 'a'], ['B', 'b']] },
      ],
      output: 'Boolean',
      colour: MB_HUE.input,
    },
    {
      type: 'mb_acceleration',
      message0: 'acceleration %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'AXIS',
          options: [['x', 'x'], ['y', 'y'], ['z', 'z']],
        },
      ],
      output: 'Number',
      colour: MB_HUE.input,
    },
    {
      type: 'mb_light_level',
      message0: 'light level',
      output: 'Number',
      colour: MB_HUE.input,
    },
    {
      type: 'mb_compass_heading',
      message0: 'compass heading',
      output: 'Number',
      colour: MB_HUE.input,
    },
    {
      type: 'mb_temperature',
      message0: 'temperature (°C)',
      output: 'Number',
      colour: MB_HUE.input,
    },
    {
      type: 'mb_running_time',
      message0: 'running time (ms)',
      output: 'Number',
      colour: MB_HUE.input,
    },

    // ── LED ──────────────────────────────────────────────────────────────────
    {
      type: 'mb_plot',
      message0: 'plot x %1 y %2',
      args0: [
        { type: 'input_value', name: 'X', check: 'Number' },
        { type: 'input_value', name: 'Y', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.led,
    },
    {
      type: 'mb_unplot',
      message0: 'unplot x %1 y %2',
      args0: [
        { type: 'input_value', name: 'X', check: 'Number' },
        { type: 'input_value', name: 'Y', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.led,
    },
    {
      type: 'mb_plot_brightness',
      message0: 'plot x %1 y %2 brightness %3',
      args0: [
        { type: 'input_value', name: 'X', check: 'Number' },
        { type: 'input_value', name: 'Y', check: 'Number' },
        { type: 'input_value', name: 'B', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.led,
    },
    {
      type: 'mb_point',
      message0: 'brightness at x %1 y %2',
      args0: [
        { type: 'input_value', name: 'X', check: 'Number' },
        { type: 'input_value', name: 'Y', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: MB_HUE.led,
    },

    // ── Music ────────────────────────────────────────────────────────────────
    {
      type: 'mb_play_tone',
      message0: 'play tone %1 for %2',
      args0: [
        { type: 'field_dropdown', name: 'NOTE', options: NOTES },
        { type: 'field_dropdown', name: 'BEAT', options: BEATS },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.music,
    },
    {
      type: 'mb_rest',
      message0: 'rest for %1',
      args0: [{ type: 'field_dropdown', name: 'BEAT', options: BEATS }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.music,
    },
    {
      type: 'mb_play_melody',
      message0: 'play melody %1',
      args0: [{ type: 'field_dropdown', name: 'MELODY', options: MELODIES }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.music,
    },
    {
      type: 'mb_set_tempo',
      message0: 'set tempo to %1 bpm',
      args0: [{ type: 'input_value', name: 'BPM', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.music,
    },
    {
      type: 'mb_stop_music',
      message0: 'stop all sounds',
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.music,
    },

    // ── Pins ─────────────────────────────────────────────────────────────────
    {
      type: 'mb_digital_write',
      message0: 'digital write pin %1 to %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: PINS },
        { type: 'field_dropdown', name: 'VALUE', options: [['1', '1'], ['0', '0']] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.pins,
    },
    {
      type: 'mb_digital_read',
      message0: 'digital read pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: PINS }],
      output: 'Number',
      colour: MB_HUE.pins,
    },
    {
      type: 'mb_analog_write',
      message0: 'analog write pin %1 to %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: PINS },
        { type: 'input_value', name: 'VALUE', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.pins,
      tooltip: '0 to 1023.',
    },
    {
      type: 'mb_analog_read',
      message0: 'analog read pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: PINS }],
      output: 'Number',
      colour: MB_HUE.pins,
    },
    {
      type: 'mb_pin_is_touched',
      message0: 'pin %1 is touched',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: [['P0', '0'], ['P1', '1'], ['P2', '2']],
        },
      ],
      output: 'Boolean',
      colour: MB_HUE.pins,
    },

    // ── Radio ────────────────────────────────────────────────────────────────
    {
      type: 'mb_radio_set_group',
      message0: 'radio set group %1',
      args0: [{ type: 'input_value', name: 'GROUP', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.radio,
    },
    {
      type: 'mb_radio_send',
      message0: 'radio send %1',
      args0: [{ type: 'input_value', name: 'MESSAGE' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.radio,
    },
    {
      type: 'mb_radio_receive',
      message0: 'radio received message',
      output: 'String',
      colour: MB_HUE.radio,
    },

    // ── Serial ───────────────────────────────────────────────────────────────
    {
      type: 'mb_print',
      message0: 'print %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      nextStatement: null,
      colour: MB_HUE.basic,
      tooltip: 'Sends a line to the serial monitor.',
    },
  ]);
}
