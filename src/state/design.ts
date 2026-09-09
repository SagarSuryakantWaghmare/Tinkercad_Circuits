import type { Vec2 } from '@/lib/geometry';
import type { PropValue } from '@/parts/types';

export type PartInstanceId = string;
export type WireId = string;
export type NoteId = string;

export interface PartInstance {
  id: PartInstanceId;
  /** PartDef.id */
  type: string;
  /** World position of the part's origin, snapped to the 5-unit grid. */
  x: number;
  y: number;
  /** Degrees clockwise. 30° steps for free parts, 90° when socketed. */
  rotation: number;
  mirrored: boolean;
  /** User label shown in the inspector and on the canvas. */
  name?: string;
  props: Record<string, PropValue>;
  /** Paint order within the parts layer. */
  z: number;
  locked?: boolean;
}

/** One end of a wire: a part terminal, or a bare point in space. */
export type WireEnd =
  | { kind: 'terminal'; partId: PartInstanceId; terminal: string }
  | { kind: 'free'; x: number; y: number };

export interface Wire {
  id: WireId;
  a: WireEnd;
  b: WireEnd;
  /** User-placed bend points, world units. */
  waypoints: Vec2[];
  /** Key into WIRE_COLORS ('0'–'9'). */
  color: string;
  type: 'wire' | 'jumper';
}

export interface Note {
  id: NoteId;
  x: number;
  y: number;
  text: string;
  /** When set, the note tethers to a part and moves with it. */
  anchorPartId?: PartInstanceId;
}

export type CodeMode = 'blocks' | 'blocks+text' | 'text';

/**
 * Which language the code panel is editing. It follows the programmable board
 * on the canvas — an Uno gets Arduino C++, a micro:bit gets MicroPython — so a
 * design can hold both and switching boards does not lose either program.
 */
export type CodeLanguage = 'arduino' | 'micropython';

export interface CodeState {
  mode: CodeMode;
  language: CodeLanguage;
  /** Arduino blocks workspace, serialised. */
  blocksXml: string;
  /** Arduino C++ sketch. */
  text: string;
  /** micro:bit blocks workspace, serialised. */
  microbitBlocksXml: string;
  /** micro:bit MicroPython program. */
  python: string;
  libraries: string[];
  breakpoints: number[];
  /** Once blocks have been abandoned for text the conversion is one-way. */
  blocksAbandoned: boolean;
}

export interface Design {
  id: string;
  name: string;
  version: 1;
  parts: Record<PartInstanceId, PartInstance>;
  wires: Record<WireId, Wire>;
  notes: Record<NoteId, Note>;
  code: CodeState;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PYTHON = `from microbit import *

while True:
    display.show(Image.HEART)
    sleep(500)
    display.clear()
    sleep(500)
`;

export const DEFAULT_SKETCH = `void setup()
{

}

void loop()
{

}
`;

/**
 * Bring a design loaded from storage or a file up to the current shape.
 * Designs saved before the micro:bit engine existed have no Python program or
 * language field, and must not lose their Arduino sketch when opened.
 */
/**
 * Parts that used to be separate entries and are now one part with a setting.
 *
 * Dropping the old ids outright would make those components vanish from any
 * design already saved with them — silently, since an unresolved type is
 * simply skipped. Mapping them forward costs a few lines and keeps every
 * existing design openable.
 */
const RENAMED_PARTS: Record<string, { type: string; props: Record<string, PropValue> }> = {
  'breadboard-mini': { type: 'breadboard', props: { size: 'mini' } },
  'breadboard-small': { type: 'breadboard', props: { size: 'small' } },
};

function migrateParts(parts: Record<string, PartInstance>): Record<string, PartInstance> {
  let changed = false;
  const out: Record<string, PartInstance> = {};
  for (const id in parts) {
    const inst = parts[id];
    // `breadboard` used to mean the full-size board specifically. An instance
    // saved without a size predates the setting, so it must stay full-size
    // rather than picking up today's default and quietly shrinking.
    if (inst.type === 'breadboard' && inst.props?.size === undefined) {
      changed = true;
      out[id] = { ...inst, props: { ...inst.props, size: 'full' } };
      continue;
    }

    const to = RENAMED_PARTS[inst.type];
    if (!to) {
      out[id] = inst;
      continue;
    }
    changed = true;
    out[id] = { ...inst, type: to.type, props: { ...to.props, ...inst.props } };
  }
  return changed ? out : parts;
}

export function migrateDesign(raw: Design): Design {
  const code = (raw.code ?? {}) as Partial<CodeState>;
  return {
    ...raw,
    parts: migrateParts(raw.parts ?? {}),
    wires: raw.wires ?? {},
    notes: raw.notes ?? {},
    code: {
      mode: code.mode ?? 'blocks',
      language: code.language ?? 'arduino',
      blocksXml: code.blocksXml ?? '',
      text: code.text ?? DEFAULT_SKETCH,
      microbitBlocksXml: code.microbitBlocksXml ?? '',
      python: code.python ?? DEFAULT_PYTHON,
      libraries: code.libraries ?? [],
      breakpoints: code.breakpoints ?? [],
      blocksAbandoned: code.blocksAbandoned ?? false,
    },
  };
}

export function emptyDesign(id: string, name = 'Untitled Circuit'): Design {
  return {
    id,
    name,
    version: 1,
    parts: {},
    wires: {},
    notes: {},
    code: {
      mode: 'blocks',
      language: 'arduino',
      blocksXml: '',
      text: DEFAULT_SKETCH,
      microbitBlocksXml: '',
      python: DEFAULT_PYTHON,
      libraries: [],
      breakpoints: [],
      blocksAbandoned: false,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
