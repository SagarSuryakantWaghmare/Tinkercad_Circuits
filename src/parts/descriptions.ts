/**
 * One-line descriptions of what a component is and what it is for.
 *
 * A part may carry its own `description`; this file supplies the rest. Keeping
 * them together makes them reviewable as a set — they should read in a
 * consistent voice, and that is much easier to check in one file than across
 * fifteen. Every entry is written for someone who does not already know what
 * the part is, which is the whole point: the catalogue previously shipped no
 * help text at all, so a learner meeting a 74HC595 had nowhere to turn.
 */
export const PART_DESCRIPTIONS: Record<string, string> = {
  // ── the starting set ───────────────────────────────────────────────────────
  resistor:
    'Limits current. The single most useful part here — almost every LED needs one in series.',
  led: 'Lights up when current flows one way through it. Always needs a series resistor.',
  pushbutton:
    'Connects its two sides only while held down. Four legs, joined in pairs across the gap.',
  potentiometer:
    'A resistor with a movable tap. Turn the knob to vary the voltage on the middle pin.',
  capacitor: 'Stores a little charge. Smooths a supply, or sets the timing of a circuit.',
  slideswitch: 'Latching switch — it stays where you put it, unlike a pushbutton.',
  'battery-9v': 'A 9 V block. Plenty of voltage, but not much current.',
  'battery-coin': 'A 3 V coin cell. Enough for an LED or a small board, and nothing more.',
  'battery-aa': '1.5 V cells in a holder. Set how many are stacked in series.',
  breadboard:
    'Solderless prototyping board. Each row of five holes is joined; the long rails run the length of the board.',
  microbit:
    'A programmable board with a 5×5 LED display, buttons and a motion sensor. Programmed in Python or blocks.',
  'uno-r3':
    'The classic 8-bit microcontroller board: 14 digital pins, 6 analog inputs. Programmed in C++ or blocks.',
  'vibration-motor': 'A tiny off-balance motor that buzzes rather than drives anything.',
  'dc-motor': 'Spins when powered, and faster with more voltage. Reverse the leads to reverse it.',
  'micro-servo':
    'Moves to a commanded angle and holds it. Takes a position pulse on its signal wire.',
  gearmotor: 'A DC motor with a gearbox: much slower, much more torque.',
  'npn-transistor':
    'A switch a small current can control. Use it to let a microcontroller pin drive something bigger than it can.',
  'led-rgb': 'Red, green and blue dice in one package. Mix them to make any colour.',
  diode: 'Lets current pass one way only. Useful for protecting a circuit from reversed power.',
  photoresistor: 'Its resistance falls as light rises. The simplest way to sense brightness.',
  'soil-moisture': 'Reports how wet the soil between its prongs is, as an analog voltage.',
  'ultrasonic-4pin':
    'Measures distance by timing an ultrasonic echo. Trigger it, then time the pulse on the echo pin.',
  'pir-sensor': 'Detects a warm body moving nearby, and pulses its output pin when it does.',
  piezo: 'A ceramic disc that clicks or tones when driven. Loud for its size, and no moving parts.',
  'temperature-sensor':
    'Outputs a voltage proportional to temperature — 10 mV per °C, offset by 500 mV.',
  multimeter:
    'Measures voltage, current or resistance between its two probes. Pick the mode in the inspector.',

  // ── frequently reached for next ────────────────────────────────────────────
  'light-bulb': 'An incandescent lamp. Draws a large inrush while its filament is still cold.',
  'capacitor-electrolytic':
    'A larger capacitor, and a polarised one — putting it in backwards destroys it.',
  'timer-555': 'The classic timer chip. Makes pulses or delays without a microcontroller.',
  '74hc595': 'A shift register: turns three microcontroller pins into eight outputs.',
  'seven-segment': 'One digit, seven bars and a dot. Each segment is its own LED.',
  'seven-segment-4': 'Four digits sharing one set of segment pins, lit one at a time.',
  'lcd-16x2': 'Two lines of sixteen characters, driven over four or eight data pins.',
  neopixel: 'An addressable RGB LED. Chain them and set every colour down one data wire.',
  'relay-spdt': 'An electrically operated switch, isolating the thing you switch from the circuit.',
  fuse: 'Opens permanently when too much current flows, protecting everything downstream.',
  'opamp': 'Amplifies the difference between its two inputs. The building block of analog circuits.',
  stepper: 'Moves in fixed steps rather than spinning freely, so its position is known.',
  solenoid: 'Pulls a plunger in when energised. Meant for short pulses, not for holding on.',
  speaker: 'Moves air properly, unlike a piezo — but its low impedance draws real current.',
  'ir-remote': 'A handset. Hold a key and any IR receiver in the design picks up its code.',
  'ir-receiver': 'Demodulates a 38 kHz infrared signal and pulls its output low while one arrives.',
};
