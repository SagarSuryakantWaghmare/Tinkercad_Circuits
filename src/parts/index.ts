/**
 * Part library entry point.
 *
 * Importing a part module runs its `definePart` calls, which register it. This
 * file re-exports the collections so bundlers keep the side effects and so the
 * component panel has a stable ordering to work from.
 */

import { BREADBOARDS } from './breadboards/breadboards';
import { PASSIVES } from './general/passives';
import { INPUT_BASIC } from './input/basic';
import { SENSORS } from './input/sensors';
import { INPUT_EXTRAS } from './input/extras';
import { CONTROLS } from './input/controls';
import { MICROCONTROLLERS } from './microcontrollers/uno';
import { MICROBIT_PARTS } from './microcontrollers/microbit';
import { INSTRUMENTS } from './instruments';
import { CONNECTORS, NETWORKING, POWER_EXTRAS } from './misc';
import { LEDS } from './output/led';
import { DISPLAYS } from './output/displays';
import { OUTPUT_EXTRAS } from './output/extras';
import { MOTORS } from './output/motors';
import { SOUND } from './output/sound';
import { BATTERIES } from './power/batteries';
import { POWER_CONTROL } from './powercontrol';
import { ICS } from './ics';
import { DIP74 } from './ics/dip74';
import { LOGIC } from './logic';

export const REGISTERED = [
  ...BREADBOARDS,
  ...PASSIVES,
  ...INPUT_BASIC,
  ...SENSORS,
  ...INPUT_EXTRAS,
  ...CONTROLS,
  ...LEDS,
  ...DISPLAYS,
  ...OUTPUT_EXTRAS,
  ...MOTORS,
  ...SOUND,
  ...MICROCONTROLLERS,
  ...MICROBIT_PARTS,
  ...INSTRUMENTS,
  ...CONNECTORS,
  ...POWER_EXTRAS,
  ...NETWORKING,
  ...BATTERIES,
  ...POWER_CONTROL,
  ...ICS,
  ...DIP74,
  ...LOGIC,
];

export * from './registry';
export * from './types';
