import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { BoardShadow, DipBody, Leg, Silk } from '../primitives';

// ─── Packages ────────────────────────────────────────────────────────────────

/** TO-92: the little half-cylinder small-signal package. */
function To92({ label, sub }: { label: string; sub?: string }) {
  return (
    <g>
      {[-10, 0, 10].map((x) => (
        <Leg key={x} x1={x} y1={10} x2={x} y2={24} />
      ))}
      <path
        d="M-14,-14 A14,14 0 0,1 14,-14 L14,10 L-14,10 Z"
        fill="#1F2123"
        stroke="#0E1011"
        strokeWidth={0.8}
      />
      <path d="M-14,-14 L14,-14" stroke="#3A3E41" strokeWidth={1} />
      <Silk x={0} y={-4} size={6} fill="#C8CCD0" weight={600}>
        {label}
      </Silk>
      {sub && (
        <Silk x={0} y={4} size={5} fill="#8E949A" weight={500}>
          {sub}
        </Silk>
      )}
    </g>
  );
}

/** TO-220: the tabbed power package. */
function To220({ label, hot }: { label: string; hot?: boolean }) {
  return (
    <g>
      {[-10, 0, 10].map((x) => (
        <Leg key={x} x1={x} y1={22} x2={x} y2={36} />
      ))}
      <rect x={-18} y={-30} width={36} height={16} rx={2} fill="#B9BEC4" stroke="#8E949A" />
      <circle cx={0} cy={-22} r={4.5} fill={C.canvasBg} stroke="#8E949A" />
      <rect x={-18} y={-16} width={36} height={38} rx={2} fill="#1F2123" stroke="#0E1011" />
      <Silk x={0} y={-6} size={6.5} fill="#C8CCD0" weight={600}>
        {label}
      </Silk>
      {hot && (
        <g opacity={0.9}>
          <path d="M-6,10 q4,-5 0,-9 M0,10 q4,-5 0,-9 M6,10 q4,-5 0,-9" stroke="#E3853B" strokeWidth={1.4} fill="none" />
        </g>
      )}
    </g>
  );
}

const threeLegs = (names: [string, string, string], y = 24): TerminalDef[] =>
  names.map((name, i) => ({
    name,
    type: 'breadboard_male' as const,
    x: -10 + i * 10,
    y,
    dir: [0, 1] as [number, number],
  }));

// ─── Bipolar transistors ─────────────────────────────────────────────────────

interface BjtProps extends Record<string, string | number> {
  beta: number;
  is: number;
}

function makeBjt(
  id: string,
  name: string,
  model: 'npn' | 'pnp',
  label: string,
  keywords: string[],
  basic = false,
) {
  return definePart<BjtProps>({
    id,
    name,
    category: 'powercontrol',
    keywords,
    basic,
    size: { w: 42, h: 54 },
    origin: { x: 21, y: 18 },
    socketable: true,
    model,
    // Standard TO-92 order for a 2N3904/2N3906 seen from the flat: E B C.
    terminals: threeLegs(['emitter', 'base', 'collector']),
    props: [
      { key: 'beta', label: 'Current gain (hFE)', kind: 'number', min: 10, max: 1000, step: 10 },
    ],
    defaults: { beta: 100, is: 1e-14 },
    Art: () => <To92 label={label} sub={model.toUpperCase()} />,
  });
}

export const NpnTransistor = makeBjt(
  'npn-transistor',
  'NPN Transistor (BJT)',
  'npn',
  '2N3904',
  ['transistor', 'npn', 'bjt', 'switch', 'amplifier', '2n2222'],
  true,
);
export const PnpTransistor = makeBjt(
  'pnp-transistor',
  'PNP Transistor (BJT)',
  'pnp',
  '2N3906',
  ['transistor', 'pnp', 'bjt', 'switch', 'high side'],
);

export const DarlingtonNpn = definePart<BjtProps>({
  id: 'tip120',
  name: 'NPN Darlington [TIP120]',
  category: 'powercontrol',
  keywords: ['darlington', 'tip120', 'power transistor', 'npn', 'motor'],
  size: { w: 46, h: 78 },
  origin: { x: 23, y: 34 },
  socketable: true,
  model: 'npn',
  terminals: threeLegs(['base', 'collector', 'emitter'], 36),
  props: [{ key: 'beta', label: 'Current gain (hFE)', kind: 'number', min: 100, max: 10000, step: 100 }],
  defaults: { beta: 1000, is: 1e-14 },
  Art: ({ state }: ArtProps<BjtProps>) => (
    <To220 label="TIP120" hot={Math.abs(Number(state?.ic ?? 0)) > 0.5} />
  ),
});

export const DarlingtonPnp = definePart<BjtProps>({
  id: 'tip125',
  name: 'PNP Darlington [TIP125]',
  category: 'powercontrol',
  keywords: ['darlington', 'tip125', 'power transistor', 'pnp'],
  size: { w: 46, h: 78 },
  origin: { x: 23, y: 34 },
  socketable: true,
  model: 'pnp',
  terminals: threeLegs(['base', 'collector', 'emitter'], 36),
  props: [{ key: 'beta', label: 'Current gain (hFE)', kind: 'number', min: 100, max: 10000, step: 100 }],
  defaults: { beta: 1000, is: 1e-14 },
  Art: () => <To220 label="TIP125" />,
});

// ─── MOSFETs ─────────────────────────────────────────────────────────────────

interface MosProps extends Record<string, string | number> {
  vth: number;
  beta: number;
}

function makeMos(
  id: string,
  name: string,
  model: 'nmos' | 'pmos',
  label: string,
  power: boolean,
  keywords: string[],
) {
  return definePart<MosProps>({
    id,
    name,
    category: 'powercontrol',
    keywords,
    size: power ? { w: 46, h: 78 } : { w: 42, h: 54 },
    origin: power ? { x: 23, y: 34 } : { x: 21, y: 18 },
    socketable: true,
    model,
    terminals: threeLegs(['gate', 'drain', 'source'], power ? 36 : 24),
    props: [
      { key: 'vth', label: 'Threshold voltage', kind: 'number', unit: 'V', min: 0.5, max: 6, step: 0.1 },
      { key: 'beta', label: 'Transconductance', kind: 'number', unit: 'A/V²', min: 0.01, max: 20, step: 0.01 },
    ],
    defaults: { vth: 2, beta: power ? 4 : 0.5 },
    Art: ({ state }: ArtProps<MosProps>) =>
      power ? (
        <To220 label={label} hot={Math.abs(Number(state?.id ?? 0)) > 1} />
      ) : (
        <To92 label={label} sub={model === 'nmos' ? 'N-CH' : 'P-CH'} />
      ),
  });
}

export const NMosfet = makeMos('nmos-transistor', 'N-Channel MOSFET', 'nmos', '2N7000', false, [
  'mosfet',
  'nmos',
  'n-channel',
  'fet',
  'switch',
]);
export const PMosfet = makeMos('pmos-transistor', 'P-Channel MOSFET', 'pmos', 'BS250', false, [
  'mosfet',
  'pmos',
  'p-channel',
  'fet',
  'high side',
]);
export const PowerMosfet = makeMos('irf520', 'Power MOSFET [IRF520]', 'nmos', 'IRF520', true, [
  'mosfet',
  'power',
  'irf520',
  'motor',
  'high current',
]);
export const PowerPMosfet = makeMos('irf9540', 'Power MOSFET [IRF9540]', 'pmos', 'IRF9540', true, [
  'mosfet',
  'power',
  'irf9540',
  'pmos',
  'p-channel',
  'high side',
  'motor',
  'high current',
]);

// ─── Relays ──────────────────────────────────────────────────────────────────

interface RelayProps extends Record<string, string | number> {
  coilResistance: number;
  pullInCurrent: number;
}

function RelayArt({ poles, state }: { poles: number; state: ArtProps['state'] }) {
  const on = !!state?.energised;
  const w = poles === 1 ? 110 : 140;
  return (
    <g>
      <BoardShadow w={w} h={92} rx={3} />
      <rect x={-w / 2} y={-46} width={w} height={92} rx={3} fill="#2B5FA8" stroke="#1D4478" />
      <rect x={-w / 2 + 6} y={-40} width={w - 12} height={30} rx={2} fill="#1D4478" opacity={0.6} />
      <Silk x={0} y={-25} size={9} fill="#DCE8F5" weight={700}>
        RELAY
      </Silk>
      <Silk x={0} y={-13} size={6} fill="#A9C4DA" weight={500}>
        {poles === 1 ? 'SPDT' : 'DPDT'}
      </Silk>
      {/* armature indicator */}
      <g transform={`translate(0,8)`}>
        <circle cx={-22} cy={0} r={5} fill={on ? '#7FBF34' : '#5C6166'} />
        <line
          x1={-17}
          y1={0}
          x2={12}
          y2={on ? -9 : 9}
          stroke="#E8EDF5"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={16} cy={-9} r={3.2} fill={on ? '#7FBF34' : '#8FA6BE'} />
        <circle cx={16} cy={9} r={3.2} fill={on ? '#8FA6BE' : '#7FBF34'} />
        <Silk x={30} y={-9} size={5.5} fill="#C6D6E8" weight={600}>NO</Silk>
        <Silk x={30} y={9} size={5.5} fill="#C6D6E8" weight={600}>NC</Silk>
      </g>
    </g>
  );
}

function makeRelay(id: string, name: string, poles: number, keywords: string[]) {
  const pinNames: string[] = ['coil1', 'coil2'];
  for (let p = 1; p <= poles; p++) pinNames.push(`COM${p}`, `NO${p}`, `NC${p}`);
  const w = poles === 1 ? 110 : 140;
  return definePart<RelayProps>({
    id,
    name,
    category: 'powercontrol',
    keywords,
    size: { w: w + 10, h: 116 },
    origin: { x: (w + 10) / 2, y: 58 },
    socketable: true,
    rotationStep: 90,
    model: poles === 1 ? 'relay-spdt' : 'relay-dpdt',
    terminals: pinNames.map((name, i) => ({
      name,
      type: 'breadboard_male' as const,
      x: -((pinNames.length - 1) * 10) / 2 + i * 10,
      y: 52,
      dir: [0, 1] as [number, number],
    })),
    props: [
      { key: 'coilResistance', label: 'Coil resistance', kind: 'number', unit: 'Ω', min: 20, max: 2000 },
      { key: 'pullInCurrent', label: 'Pull-in current', kind: 'number', unit: 'A', min: 0.005, max: 0.2, step: 0.005 },
    ],
    defaults: { coilResistance: 120, pullInCurrent: 0.03 },
    Art: ({ state }: ArtProps<RelayProps>) => <RelayArt poles={poles} state={state} />,
  });
}

export const RelaySpdt = makeRelay('relay-spdt', 'Relay SPDT', 1, [
  'relay',
  'spdt',
  'switch',
  'contactor',
  'mains',
]);
export const RelayDpdt = makeRelay('relay-dpdt', 'Relay DPDT', 2, ['relay', 'dpdt', 'double pole']);

// ─── Voltage regulator ───────────────────────────────────────────────────────

interface RegProps extends Record<string, string | number> {
  output: number;
}

// Tinkercad ships a dedicated 3.3V Regulator part in addition to the generic
// LM7805-family regulator. Users looking for 3.3V by name find this one
// directly instead of picking the generic and switching the output prop.
export const Regulator33 = definePart<RegProps>({
  id: 'regulator-33v',
  name: '3.3V Voltage Regulator',
  category: 'powercontrol',
  keywords: ['regulator', 'ld1117', 'ldo', '3.3v', '3v3', 'ams1117'],
  size: { w: 46, h: 78 },
  origin: { x: 23, y: 34 },
  socketable: true,
  model: 'regulator',
  terminals: [
    { name: 'input', type: 'breadboard_male', x: -10, y: 36, dir: [0, 1] },
    { name: 'gnd', type: 'breadboard_male', x: 0, y: 36, dir: [0, 1], role: 'gnd' },
    { name: 'output', type: 'breadboard_male', x: 10, y: 36, dir: [0, 1] },
  ],
  props: [],
  defaults: { output: 3.3 },
  Art: ({ state }: ArtProps<RegProps>) => (
    <g>
      <To220 label="LD1117" />
      {state?.dropout ? (
        <Silk x={0} y={-40} size={6} fill="#C11F1F" weight={700}>
          LOW Vin
        </Silk>
      ) : null}
    </g>
  ),
});

export const Regulator = definePart<RegProps>({
  id: 'regulator',
  name: 'Voltage Regulator',
  category: 'powercontrol',
  keywords: ['regulator', '7805', 'lm7805', 'ldo', '5v', '3.3v', 'lm317'],
  size: { w: 46, h: 78 },
  origin: { x: 23, y: 34 },
  socketable: true,
  model: 'regulator',
  terminals: threeLegs(['input', 'gnd', 'output'], 36),
  props: [
    {
      key: 'output',
      label: 'Output voltage',
      kind: 'select',
      options: [3.3, 5, 9, 12].map((v) => ({ value: String(v), label: `${v} V` })),
    },
  ],
  defaults: { output: 5 },
  Art: ({ props, state }: ArtProps<RegProps>) => (
    <g>
      <To220 label={Number(props.output) === 3.3 ? 'LD1117' : `78${String(Number(props.output) * 10).padStart(2, '0')}`} />
      {state?.dropout ? (
        <Silk x={0} y={-40} size={6} fill="#C11F1F" weight={700}>
          LOW Vin
        </Silk>
      ) : null}
    </g>
  ),
});

// ─── H-bridge motor driver ───────────────────────────────────────────────────

const L293_PINS = [
  'EN1', 'IN1A', 'OUT1A', 'GND', 'GND2', 'OUT1B', 'IN1B', 'VSS',
  'VS', 'IN2A', 'OUT2A', 'GND3', 'GND4', 'OUT2B', 'IN2B', 'EN2',
];

export const MotorDriver = definePart({
  id: 'motor-driver-l293d',
  name: 'Motor Driver [L293D]',
  category: 'powercontrol',
  keywords: ['h-bridge', 'l293d', 'motor driver', 'bidirectional', 'dual'],
  size: { w: 110, h: 100 },
  origin: { x: 55, y: 50 },
  socketable: true,
  rotationStep: 90,
  model: 'motor-driver',
  terminals: L293_PINS.map((name, i) => {
    const half = i < 8;
    const idx = half ? i : 15 - i;
    return {
      name,
      type: 'breadboard_male' as const,
      x: -35 + idx * 10,
      y: half ? 35 : -35,
      dir: [0, half ? 1 : -1] as [number, number],
      group: name.startsWith('GND') ? 'gnd' : undefined,
      role: name.startsWith('GND') ? ('gnd' as const) : undefined,
    };
  }),
  props: [],
  defaults: {},
  Art: () => (
    <g>
      <DipBody w={90} h={54} />
      <Silk x={0} y={-6} size={8} fill="#C9CED3" weight={600}>
        L293D
      </Silk>
      <Silk x={0} y={6} size={5.5} fill="#9BA1A7" weight={500}>
        H-BRIDGE
      </Silk>
    </g>
  ),
});

// ─── Optocoupler ─────────────────────────────────────────────────────────────

interface OptoProps extends Record<string, string | number> {
  ctr: number;
}

export const Optocoupler = definePart<OptoProps>({
  id: 'optocoupler',
  name: 'Optocoupler [4N35]',
  category: 'powercontrol',
  // Tinkercad files the 4N35 under Integrated Circuits; mirror it there so
  // students who look in either section find it.
  altCategories: ['ics'],
  keywords: ['optocoupler', 'opto', 'isolator', '4n35', 'isolation'],
  size: { w: 70, h: 70 },
  origin: { x: 35, y: 35 },
  socketable: true,
  model: 'optocoupler',
  terminals: [
    { name: 'anode', type: 'breadboard_male', x: -15, y: 25, dir: [0, 1] },
    { name: 'cathode', type: 'breadboard_male', x: -5, y: 25, dir: [0, 1] },
    { name: 'nc', type: 'breadboard_male', x: 5, y: 25, dir: [0, 1] },
    { name: 'emitter', type: 'breadboard_male', x: 15, y: 25, dir: [0, 1] },
    { name: 'collector', type: 'breadboard_male', x: 15, y: -25, dir: [0, -1] },
    { name: 'base', type: 'breadboard_male', x: 5, y: -25, dir: [0, -1] },
    { name: 'nc2', type: 'breadboard_male', x: -5, y: -25, dir: [0, -1] },
    { name: 'nc3', type: 'breadboard_male', x: -15, y: -25, dir: [0, -1] },
  ],
  props: [
    { key: 'ctr', label: 'Current transfer ratio', kind: 'number', min: 0.1, max: 5, step: 0.1 },
  ],
  defaults: { ctr: 0.5 },
  Art: ({ state }: ArtProps<OptoProps>) => (
    <g>
      <DipBody w={50} h={40} />
      <Silk x={0} y={-4} size={7} fill="#C9CED3" weight={600}>
        4N35
      </Silk>
      {state?.on ? <circle cx={0} cy={8} r={4} fill="#E3853B" opacity={0.9} /> : null}
    </g>
  ),
});

export const POWER_CONTROL: PartDef<never>[] = [
  NpnTransistor,
  PnpTransistor,
  DarlingtonNpn,
  DarlingtonPnp,
  NMosfet,
  PMosfet,
  PowerMosfet,
  PowerPMosfet,
  RelaySpdt,
  RelayDpdt,
  Regulator,
  Regulator33,
  MotorDriver,
  Optocoupler,
] as unknown as PartDef<never>[];
