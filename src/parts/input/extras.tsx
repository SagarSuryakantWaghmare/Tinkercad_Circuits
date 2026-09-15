import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { C } from '@/lib/tokens';
import { BoardShadow, Leg, Silk } from '../primitives';
import { PartToggle } from '../simControls';

// ─── Infrared remote handset ─────────────────────────────────────────────────
//
// A 21-key handset of the kind that ships with receiver kits. Holding a key
// transmits its code; every IR receiver in the design sees it, which is what
// makes the pair usable without wiring the two together.

interface RemoteKey {
  label: string;
  code: number;
  col: number;
  row: number;
  wide?: boolean;
  accent?: string;
}

const REMOTE_KEYS: RemoteKey[] = [
  { label: '⏻', code: 0xffa25d, col: 0, row: 0, accent: '#C2413B' },
  { label: 'VOL+', code: 0xff629d, col: 1, row: 0 },
  { label: 'FUNC', code: 0xffe21d, col: 2, row: 0 },
  { label: '◀◀', code: 0xff22dd, col: 0, row: 1 },
  { label: '▶⏸', code: 0xff02fd, col: 1, row: 1 },
  { label: '▶▶', code: 0xffc23d, col: 2, row: 1 },
  { label: '▼', code: 0xffe01f, col: 0, row: 2 },
  { label: 'VOL−', code: 0xffa857, col: 1, row: 2 },
  { label: 'EQ', code: 0xff906f, col: 2, row: 2 },
  { label: '0', code: 0xff6897, col: 0, row: 3 },
  { label: '100+', code: 0xff9867, col: 1, row: 3 },
  { label: '200+', code: 0xffb04f, col: 2, row: 3 },
  { label: '1', code: 0xff30cf, col: 0, row: 4 },
  { label: '2', code: 0xff18e7, col: 1, row: 4 },
  { label: '3', code: 0xff7a85, col: 2, row: 4 },
  { label: '4', code: 0xff10ef, col: 0, row: 5 },
  { label: '5', code: 0xff38c7, col: 1, row: 5 },
  { label: '6', code: 0xff5aa5, col: 2, row: 5 },
  { label: '7', code: 0xff42bd, col: 0, row: 6 },
  { label: '8', code: 0xff4ab5, col: 1, row: 6 },
  { label: '9', code: 0xff52ad, col: 2, row: 6 },
];

const KEY_W = 26;
const KEY_H = 18;
const REMOTE_W = 108;
const REMOTE_H = 200;

export const IrRemote = definePart({
  id: 'ir-remote',
  name: 'IR Remote',
  // Tinkercad files the remote under Output. It sits in Input here for the
  // sensor-like feel (it feeds signal into a receiver), so keep the primary
  // spot and mirror it into Output so it shows up in both places.
  category: 'input',
  altCategories: ['output'],
  keywords: ['infrared', 'ir', 'remote', 'handset', 'transmitter', 'nec'],
  size: { w: REMOTE_W + 12, h: REMOTE_H + 12 },
  origin: { x: (REMOTE_W + 12) / 2, y: (REMOTE_H + 12) / 2 },
  // The handset runs on its own cells, so it has nothing to wire up.
  terminals: [],
  rotationStep: 30,
  model: 'ir-remote',
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const sending = Boolean(state?.sending);
    const code = Number(state?.code ?? -1);
    return (
      <g>
        <BoardShadow w={REMOTE_W} h={REMOTE_H} rx={8} />
        <rect
          x={-REMOTE_W / 2}
          y={-REMOTE_H / 2}
          width={REMOTE_W}
          height={REMOTE_H}
          rx={8}
          fill="#232629"
          stroke="#141618"
        />
        {/* Emitter window */}
        <rect x={-16} y={-REMOTE_H / 2 + 6} width={32} height={9} rx={3} fill="#3A2C4A" />
        {sending && (
          <g>
            <circle cx={0} cy={-REMOTE_H / 2 + 10} r={16} fill="#A98BFF" opacity={0.22} />
            <circle cx={0} cy={-REMOTE_H / 2 + 10} r={7} fill="#A98BFF" opacity={0.55} />
          </g>
        )}

        {REMOTE_KEYS.map((k) => {
          const x = -KEY_W - 4 + k.col * (KEY_W + 4);
          const y = -REMOTE_H / 2 + 24 + k.row * (KEY_H + 4);
          const active = sending && code === k.code;
          return (
            <g
              key={k.code}
              style={{ cursor: simulating ? 'pointer' : 'inherit' }}
              onPointerDown={(e) => {
                if (!simulating) return;
                e.stopPropagation();
                interact?.('press', k.code);
              }}
              onPointerUp={(e) => {
                if (!simulating) return;
                e.stopPropagation();
                interact?.('release');
              }}
              onPointerLeave={() => simulating && interact?.('release')}
            >
              <rect
                x={x}
                y={y}
                width={KEY_W}
                height={KEY_H}
                rx={4}
                fill={active ? '#6C7BFF' : (k.accent ?? '#3B4045')}
                stroke={active ? '#8A96FF' : '#191C1E'}
              />
              <Silk x={x + KEY_W / 2} y={y + KEY_H / 2 + 3} size={7} fill="#EEF1F4" weight={600}>
                {k.label}
              </Silk>
            </g>
          );
        })}

        {simulating && (
          <Silk x={0} y={REMOTE_H / 2 + 12} size={9} fill="#4A4F55" weight={700}>
            {sending ? `0x${code.toString(16).toUpperCase()}` : 'hold a key'}
          </Silk>
        )}
      </g>
    );
  },
});

// ─── Photo-interrupter ───────────────────────────────────────────────────────

const PI_W = 56;
const PI_H = 62;

export const PhotoInterrupter = definePart({
  id: 'photo-interrupter',
  name: 'Photo Interrupter',
  category: 'input',
  keywords: ['optical', 'slotted', 'interrupter', 'beam break', 'encoder', 'opto', 'end stop'],
  size: { w: PI_W + 20, h: PI_H + 44 },
  origin: { x: (PI_W + 20) / 2, y: (PI_H + 44) / 2 - 10 },
  socketable: true,
  rotationStep: 90,
  model: 'photo-interrupter',
  terminals: [
    { name: 'anode', type: 'breadboard_male', x: -15, y: PI_H / 2 + 18, dir: [0, 1], role: 'passive' },
    { name: 'cathode', type: 'breadboard_male', x: -5, y: PI_H / 2 + 18, dir: [0, 1], role: 'passive' },
    { name: 'collector', type: 'breadboard_male', x: 5, y: PI_H / 2 + 18, dir: [0, 1], role: 'passive' },
    { name: 'emitter', type: 'breadboard_male', x: 15, y: PI_H / 2 + 18, dir: [0, 1], role: 'passive' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const blocked = Boolean(state?.blocked);
    const conducting = Boolean(state?.conducting);
    return (
      <g>
        <BoardShadow w={PI_W} h={PI_H} rx={2} />
        {/* U-shaped body: emitter arm, slot, detector arm. */}
        <path
          d={`M${-PI_W / 2},${PI_H / 2} L${-PI_W / 2},${-PI_H / 2} L${-PI_W / 2 + 17},${-PI_H / 2}
             L${-PI_W / 2 + 17},${-6} L${PI_W / 2 - 17},${-6} L${PI_W / 2 - 17},${-PI_H / 2}
             L${PI_W / 2},${-PI_H / 2} L${PI_W / 2},${PI_H / 2} Z`}
          fill="#1F2225"
          stroke="#111315"
        />
        {/* Optical path across the slot */}
        <line
          x1={-PI_W / 2 + 17}
          y1={-24}
          x2={PI_W / 2 - 17}
          y2={-24}
          stroke={blocked ? '#5A4A2E' : conducting ? '#A98BFF' : '#3A3F44'}
          strokeWidth={3}
          strokeDasharray="4 3"
          opacity={blocked ? 0.4 : 0.9}
        />
        {blocked && <rect x={-6} y={-40} width={12} height={34} rx={2} fill="#8A8F95" />}
        <Silk x={0} y={PI_H / 2 - 6} size={5.5} fill="#9BA1A7" weight={600}>
          OPB
        </Silk>
        {['A', 'K', 'C', 'E'].map((n, i) => (
          <g key={n}>
            <rect x={-15 + i * 10 - 1.4} y={PI_H / 2 - 2} width={2.8} height={20} fill={C.solderPad} />
            <Silk x={-15 + i * 10} y={PI_H / 2 - 10} size={5} fill="#9BA1A7" weight={600}>
              {n}
            </Silk>
          </g>
        ))}
        {simulating && (
          <PartToggle
            x={0}
            y={-PI_H / 2 - 16}
            on={blocked}
            onLabel="BLOCKED"
            offLabel="clear"
            onToggle={() => interact?.('toggle')}
          />
        )}
      </g>
    );
  },
});

// ─── Crystal ─────────────────────────────────────────────────────────────────

interface CrystalProps extends Record<string, string | number> {
  frequency: number;
}

export const Crystal = definePart<CrystalProps>({
  id: 'crystal',
  name: 'Crystal Oscillator',
  category: 'general',
  keywords: ['crystal', 'quartz', 'xtal', 'resonator', 'clock', '16mhz'],
  size: { w: 52, h: 62 },
  origin: { x: 26, y: 31 },
  socketable: true,
  model: 'crystal',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 24, dir: [0, 1], role: 'passive' },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 24, dir: [0, 1], role: 'passive' },
  ],
  props: [
    {
      key: 'frequency',
      label: 'Frequency',
      kind: 'unit',
      unit: 'Hz',
      prefixes: ['k', 'M'],
      min: 1000,
      max: 5e7,
    },
  ],
  defaults: { frequency: 16e6 },
  Art: ({ props }: ArtProps<CrystalProps>) => {
    const f = Number(props.frequency);
    const text = f >= 1e6 ? `${+(f / 1e6).toFixed(3)}MHz` : `${+(f / 1e3).toFixed(2)}kHz`;
    return (
      <g>
        <Leg x1={-10} y1={6} x2={-10} y2={24} />
        <Leg x1={10} y1={6} x2={10} y2={24} />
        {/* Low-profile HC-49 can */}
        <rect x={-19} y={-22} width={38} height={30} rx={12} fill="#B7BDC3" stroke="#8E949A" />
        <rect x={-16} y={-19} width={32} height={24} rx={10} fill="#CDD3D8" />
        <Silk x={0} y={-4} size={7} fill="#4A4F55" weight={600}>
          {text}
        </Silk>
      </g>
    );
  },
});

// ─── Trimmer capacitor ───────────────────────────────────────────────────────

interface TrimCapProps extends Record<string, string | number> {
  capacitance: number;
}

export const TrimmerCapacitor = definePart<TrimCapProps>({
  id: 'capacitor-trimmer',
  name: 'Trimmer Capacitor',
  category: 'general',
  keywords: ['trimmer', 'variable capacitor', 'tuning', 'trim cap', 'adjustable'],
  size: { w: 48, h: 58 },
  origin: { x: 24, y: 29 },
  socketable: true,
  model: 'capacitor',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 22, dir: [0, 1], role: 'passive' },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 22, dir: [0, 1], role: 'passive' },
  ],
  props: [
    {
      key: 'capacitance',
      label: 'Capacitance',
      kind: 'unit',
      unit: 'F',
      prefixes: ['p', 'n'],
      min: 1e-12,
      max: 1e-9,
    },
  ],
  defaults: { capacitance: 3e-11 },
  Art: ({ props }: ArtProps<TrimCapProps>) => {
    const pf = Number(props.capacitance) * 1e12;
    // The screw slot turns with the setting, which is the only visible cue a
    // real trimmer gives you.
    const angle = -60 + 240 * Math.min(1, Math.max(0, (pf - 1) / 99));
    return (
      <g>
        <Leg x1={-10} y1={6} x2={-10} y2={22} />
        <Leg x1={10} y1={6} x2={10} y2={22} />
        <circle cx={0} cy={-6} r={17} fill="#C9772E" stroke="#9A5A22" strokeWidth={1.4} />
        <circle cx={0} cy={-6} r={11} fill="#E0E4E8" stroke="#A8AEB4" />
        <g transform={`rotate(${angle} 0 -6)`}>
          <rect x={-8} y={-8} width={16} height={4} rx={1.5} fill="#5A6066" />
        </g>
        <Silk x={0} y={16} size={5.5} fill="#6B7378" weight={600}>
          {`${Math.round(pf)}pF`}
        </Silk>
      </g>
    );
  },
});

// ─── Relay module ────────────────────────────────────────────────────────────

const RM_W = 132;
const RM_H = 88;

export const RelayModule = definePart({
  id: 'relay-module',
  name: 'Relay Module (5V)',
  category: 'powercontrol',
  keywords: ['relay', 'module', 'mains', 'switch', 'spdt', 'load', 'opto'],
  size: { w: RM_W + 10, h: RM_H + 40 },
  origin: { x: (RM_W + 10) / 2, y: (RM_H + 40) / 2 - 14 },
  socketable: true,
  rotationStep: 90,
  model: 'relay-module',
  terminals: [
    // Control header along the bottom.
    { name: 'GND', type: 'breadboard_male', x: -10, y: RM_H / 2 + 14, dir: [0, 1], role: 'gnd' },
    { name: 'VCC', type: 'breadboard_male', x: 0, y: RM_H / 2 + 14, dir: [0, 1], role: 'power' },
    { name: 'IN', type: 'breadboard_male', x: 10, y: RM_H / 2 + 14, dir: [0, 1], role: 'digital' },
    // Screw block along the top switches the load.
    { name: 'NO', type: 'wire', x: -34, y: -RM_H / 2 - 6, dir: [0, -1], role: 'passive' },
    { name: 'COM', type: 'wire', x: -12, y: -RM_H / 2 - 6, dir: [0, -1], role: 'passive' },
    { name: 'NC', type: 'wire', x: 10, y: -RM_H / 2 - 6, dir: [0, -1], role: 'passive' },
  ],
  props: [
    {
      key: 'trigger',
      label: 'Trigger level',
      kind: 'select',
      options: [
        { value: 'high', label: 'Active high' },
        { value: 'low', label: 'Active low' },
      ],
      help: 'Most opto-isolated boards pull the coil in when IN goes low.',
    },
  ],
  defaults: { trigger: 'high' },
  Art: ({ state }: ArtProps) => {
    const on = Boolean(state?.energised);
    return (
      <g>
        <BoardShadow w={RM_W} h={RM_H} rx={3} />
        <rect
          x={-RM_W / 2}
          y={-RM_H / 2}
          width={RM_W}
          height={RM_H}
          rx={3}
          fill="#1E5FA8"
          stroke="#154379"
        />
        {/* Relay can */}
        <rect x={4} y={-RM_H / 2 + 12} width={54} height={52} rx={2} fill="#2E3236" stroke="#17191B" />
        <Silk x={31} y={-8} size={7} fill="#C9CED3" weight={700}>
          SRD-05
        </Silk>
        <Silk x={31} y={4} size={5.5} fill="#9BA1A7" weight={500}>
          10A 250V
        </Silk>
        {/* Green screw terminal block */}
        <rect x={-RM_W / 2 + 4} y={-RM_H / 2 - 2} width={68} height={26} rx={2} fill="#2E7D4F" stroke="#1E5836" />
        {[-34, -12, 10].map((x) => (
          <g key={x}>
            <circle cx={x} cy={-RM_H / 2 + 10} r={5.5} fill="#B7BDC3" stroke="#8E949A" />
            <rect x={x - 4} y={-RM_H / 2 + 8.5} width={8} height={3} rx={1} fill="#5A6066" />
          </g>
        ))}
        <Silk x={-34} y={-RM_H / 2 + 22} size={5} fill="#D6EBDE" weight={600}>
          NO
        </Silk>
        <Silk x={-12} y={-RM_H / 2 + 22} size={5} fill="#D6EBDE" weight={600}>
          COM
        </Silk>
        <Silk x={10} y={-RM_H / 2 + 22} size={5} fill="#D6EBDE" weight={600}>
          NC
        </Silk>
        {/* Coil-state indicator */}
        <circle cx={-46} cy={6} r={5} fill={on ? '#E24B3F' : '#5A2622'} />
        {on && <circle cx={-46} cy={6} r={11} fill="#E24B3F" opacity={0.3} />}
        <Silk x={-46} y={22} size={5} fill="#BBD0EC" weight={600}>
          ON
        </Silk>
        {/* Control header */}
        <rect x={-16} y={RM_H / 2 - 9} width={32} height={9} rx={1} fill="#1A1C1D" />
        {['GND', 'VCC', 'IN'].map((p, i) => (
          <g key={p}>
            <rect x={-10 + i * 10 - 1.4} y={RM_H / 2 - 9} width={2.8} height={23} fill={C.solderPad} />
            <Silk x={-10 + i * 10} y={RM_H / 2 - 14} size={4.6} fill="#BBD0EC" weight={600}>
              {p}
            </Silk>
          </g>
        ))}
      </g>
    );
  },
});

export const INPUT_EXTRAS: PartDef<never>[] = [
  IrRemote,
  PhotoInterrupter,
  Crystal,
  TrimmerCapacitor,
  RelayModule,
] as unknown as PartDef<never>[];
