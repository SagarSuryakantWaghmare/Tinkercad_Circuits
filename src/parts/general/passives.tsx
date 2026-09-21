import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { C } from '@/lib/tokens';
import { Leg, resistorBands, Silk } from '../primitives';

// ─── Resistor ────────────────────────────────────────────────────────────────

interface ResistorProps extends Record<string, string | number> {
  resistance: number;
  tolerance: string;
}

function ResistorArt({ props, state }: ArtProps<ResistorProps>) {
  const bands = resistorBands(Number(props.resistance));
  const burnt = !!state?.burnt;
  const body = burnt ? '#3A3230' : '#DCBA88';
  return (
    <g>
      <Leg x1={-30} y1={0} x2={-15} y2={0} />
      <Leg x1={15} y1={0} x2={30} y2={0} />
      <path
        d="M-15,0 C-15,-5 -12,-7 -9,-7 L9,-7 C12,-7 15,-5 15,0 C15,5 12,7 9,7 L-9,7 C-12,7 -15,5 -15,0 Z"
        fill={body}
        stroke={burnt ? '#241D1B' : '#B89868'}
        strokeWidth={0.8}
      />
      {!burnt &&
        bands.map((hex, i) => (
          <rect key={i} x={-9 + i * 5} y={-6.6} width={2.5} height={13.2} fill={hex} />
        ))}
      {burnt && <Silk x={0} y={0} size={9} fill="#FF6B4A">✕</Silk>}
    </g>
  );
}

export const Resistor = definePart<ResistorProps>({
  id: 'resistor',
  name: 'Resistor',
  category: 'general',
  keywords: ['ohm', 'passive', 'r', 'pull-up', 'pulldown'],
  basic: true,
  size: { w: 68, h: 20 },
  origin: { x: 34, y: 10 },
  socketable: true,
  model: 'resistor',
  terminals: [
    { name: 'a', type: 'breadboard_male', x: -30, y: 0, dir: [-1, 0], role: 'passive' },
    { name: 'b', type: 'breadboard_male', x: 30, y: 0, dir: [1, 0], role: 'passive' },
  ],
  props: [
    {
      key: 'resistance',
      label: 'Resistance',
      kind: 'unit',
      unit: 'Ω',
      prefixes: ['', 'k', 'M'],
      min: 0.1,
      max: 1e9,
    },
    {
      key: 'tolerance',
      label: 'Tolerance',
      kind: 'select',
      options: [
        { value: '1', label: '±1% (gold)' },
        { value: '5', label: '±5% (gold)' },
        { value: '10', label: '±10% (silver)' },
      ],
    },
  ],
  defaults: { resistance: 220, tolerance: '5' },
  Art: ResistorArt,
});

// ─── Ceramic capacitor ───────────────────────────────────────────────────────

interface CapProps extends Record<string, string | number> {
  capacitance: number;
  voltage: number;
}

export const Capacitor = definePart<CapProps>({
  id: 'capacitor',
  name: 'Capacitor',
  category: 'general',
  keywords: ['farad', 'ceramic', 'decoupling', 'non-polarized', 'c'],
  basic: true,
  size: { w: 40, h: 34 },
  origin: { x: 20, y: 22 },
  socketable: true,
  model: 'capacitor',
  terminals: [
    { name: 'a', type: 'breadboard_male', x: -5, y: 12, dir: [0, 1], role: 'passive' },
    { name: 'b', type: 'breadboard_male', x: 5, y: 12, dir: [0, 1], role: 'passive' },
  ],
  props: [
    {
      key: 'capacitance',
      label: 'Capacitance',
      kind: 'unit',
      unit: 'F',
      prefixes: ['p', 'n', 'µ', 'm'],
      min: 1e-12,
      max: 1,
    },
    { key: 'voltage', label: 'Max voltage', kind: 'number', unit: 'V', min: 1, max: 500 },
  ],
  defaults: { capacitance: 1e-7, voltage: 50 },
  Art: ({ props }: ArtProps<CapProps>) => (
    <g>
      <Leg x1={-5} y1={-2} x2={-5} y2={12} />
      <Leg x1={5} y1={-2} x2={5} y2={12} />
      <path
        d="M-12,-3 C-13,-18 13,-18 12,-3 C10,0 -10,0 -12,-3 Z"
        fill="#1F5FA8"
        stroke="#154379"
        strokeWidth={0.8}
      />
      <path
        d="M-9,-8 C-7,-14 0,-16 6,-15"
        fill="none"
        stroke="#5590D6"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.6}
      />
      <Silk x={0} y={-7} size={5.5} fill="#DCE8F5" weight={600}>
        {capLabel(Number(props.capacitance))}
      </Silk>
    </g>
  ),
});

function capLabel(f: number): string {
  if (f >= 1e-3) return `${round(f * 1e3)}m`;
  if (f >= 1e-6) return `${round(f * 1e6)}µ`;
  if (f >= 1e-9) return `${round(f * 1e9)}n`;
  return `${round(f * 1e12)}p`;
}
const round = (n: number) => Math.round(n * 100) / 100;

// ─── Polarized / Electrolytic capacitor ───────────────────────────────────────

export const ElectrolyticCapacitor = definePart<CapProps>({
  id: 'capacitor-electrolytic',
  name: 'Polarized Capacitor',
  category: 'general',
  keywords: ['farad', 'polarized', 'electrolytic', 'bulk'],
  size: { w: 44, h: 52 },
  origin: { x: 22, y: 38 },
  socketable: true,
  model: 'capacitor-polarized',
  terminals: [
    { name: '+', type: 'breadboard_male', x: -5, y: 14, dir: [0, 1], role: 'passive' },
    { name: '-', type: 'breadboard_male', x: 5, y: 14, dir: [0, 1], role: 'passive' },
  ],
  props: [
    {
      key: 'capacitance',
      label: 'Capacitance',
      kind: 'unit',
      unit: 'F',
      prefixes: ['n', 'µ', 'm'],
      min: 1e-9,
      max: 1,
    },
    { key: 'voltage', label: 'Max voltage', kind: 'number', unit: 'V', min: 1, max: 500 },
  ],
  defaults: { capacitance: 1e-5, voltage: 25 },
  Art: ({ props, state }: ArtProps<CapProps>) => (
    <g>
      <Leg x1={-5} y1={4} x2={-5} y2={14} />
      <Leg x1={5} y1={4} x2={5} y2={14} />
      <rect x={-14} y={-22} width={28} height={28} rx={3} fill="#1C1C1C" stroke="#111111" strokeWidth={0.8} />
      <ellipse cx={0} cy={-22} rx={13.5} ry={4} fill="#888E94" stroke="#686E74" strokeWidth={0.7} />
      <ellipse cx={0} cy={-22} rx={11} ry={2.8} fill="#9FA5AB" />
      <rect x={-14} y={-19} width={8} height={25} fill="#C9CDD3" opacity={0.9} />
      <Silk x={-10} y={-7} size={7} fill="#1C1C1C" weight={700}>−</Silk>
      <Silk x={5} y={-13} size={5} fill="#E8ECEF" weight={500}>
        {capLabel(Number(props.capacitance))}
      </Silk>
      <Silk x={5} y={-5} size={5} fill="#E8ECEF" weight={500}>
        {props.voltage}V
      </Silk>
      {state?.burnt ? <circle cx={0} cy={-7} r={12} fill="#000" opacity={0.6} /> : null}
    </g>
  ),
});

// ─── Inductor ────────────────────────────────────────────────────────────────

interface IndProps extends Record<string, string | number> {
  inductance: number;
}

export const Inductor = definePart<IndProps>({
  id: 'inductor',
  name: 'Inductor',
  category: 'general',
  keywords: ['henry', 'coil', 'choke', 'l'],
  size: { w: 68, h: 22 },
  origin: { x: 34, y: 11 },
  socketable: true,
  model: 'inductor',
  terminals: [
    { name: 'a', type: 'breadboard_male', x: -30, y: 0, dir: [-1, 0], role: 'passive' },
    { name: 'b', type: 'breadboard_male', x: 30, y: 0, dir: [1, 0], role: 'passive' },
  ],
  props: [
    {
      key: 'inductance',
      label: 'Inductance',
      kind: 'unit',
      unit: 'H',
      prefixes: ['µ', 'm', ''],
      min: 1e-9,
      max: 100,
    },
  ],
  defaults: { inductance: 1e-3 },
  Art: () => (
    <g>
      <Leg x1={-30} y1={0} x2={-19} y2={0} />
      <Leg x1={19} y1={0} x2={30} y2={0} />
      <rect x={-19} y={-6.5} width={38} height={13} rx={6} fill="#8A4A0E" stroke="#683408" strokeWidth={0.7} />
      {[-14, -7, 0, 7, 14].map((x) => (
        <g key={x}>
          <path
            d={`M${x - 2},-6.5 C${x + 2},-6.5 ${x + 2},6.5 ${x - 2},6.5`}
            fill="none"
            stroke="#C8741A"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <path
            d={`M${x - 1},-4.5 C${x + 1},-4.5 ${x + 1},4.5 ${x - 1},4.5`}
            fill="none"
            stroke="#E09238"
            strokeWidth={1}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  ),
});

// ─── Diodes ──────────────────────────────────────────────────────────────────

function standardDiodeArt<P extends Record<string, string | number> = Record<string, never>>(
  bandColor: string,
  bodyColor: string,
) {
  return function DiodeArt({ state }: ArtProps<P>) {
    return (
      <g>
        <Leg x1={-30} y1={0} x2={-13} y2={0} />
        <Leg x1={13} y1={0} x2={30} y2={0} />
        <rect
          x={-14}
          y={-6.5}
          width={28}
          height={13}
          rx={2}
          fill={state?.burnt ? '#2A2422' : bodyColor}
          stroke="#0F0F0F"
          strokeWidth={0.7}
        />
        <rect x={6.5} y={-6.5} width={3.5} height={13} fill={bandColor} />
      </g>
    );
  };
}

function diodeArt<P extends Record<string, string | number>>(
  bandColor: string,
  body: string,
) {
  return function DiodeArt({ state }: ArtProps<P>) {
    return (
      <g>
        <Leg x1={-30} y1={0} x2={-13} y2={0} />
        <Leg x1={13} y1={0} x2={30} y2={0} />
        <rect
          x={-14}
          y={-7}
          width={28}
          height={14}
          rx={2.5}
          fill={state?.burnt ? '#2A2422' : body}
          stroke="#2A2A2A"
          strokeWidth={0.7}
        />
        <rect x={7} y={-7} width={3.5} height={14} fill={bandColor} />
      </g>
    );
  };
}

export const Diode = definePart({
  id: 'diode',
  name: 'Diode',
  category: 'general',
  keywords: ['1n4148', 'rectifier', 'signal', 'pn junction'],
  size: { w: 68, h: 18 },
  origin: { x: 34, y: 9 },
  socketable: true,
  model: 'diode',
  terminals: [
    { name: 'anode', type: 'breadboard_male', x: -30, y: 0, dir: [-1, 0] },
    { name: 'cathode', type: 'breadboard_male', x: 30, y: 0, dir: [1, 0] },
  ],
  props: [],
  defaults: {},
  Art: standardDiodeArt('#1F5FA8', '#1C1C1C'),
});

interface ZenerProps extends Record<string, string | number> {
  breakdown: number;
}

export const ZenerDiode = definePart<ZenerProps>({
  id: 'diode-zener',
  name: 'Zener Diode',
  category: 'general',
  keywords: ['zener', 'clamp', 'reference', 'breakdown'],
  size: { w: 68, h: 18 },
  origin: { x: 34, y: 9 },
  socketable: true,
  model: 'zener',
  terminals: [
    { name: 'anode', type: 'breadboard_male', x: -30, y: 0, dir: [-1, 0] },
    { name: 'cathode', type: 'breadboard_male', x: 30, y: 0, dir: [1, 0] },
  ],
  props: [
    {
      key: 'breakdown',
      label: 'Breakdown voltage',
      kind: 'select',
      options: [3.3, 4.7, 5.1, 6.2, 9.1, 12].map((v) => ({
        value: String(v),
        label: `${v} V`,
      })),
    },
  ],
  defaults: { breakdown: 5.1 },
  Art: standardDiodeArt('#1F5FA8', '#1C1C1C'),
});

export const SchottkyDiode = definePart({
  id: 'diode-schottky',
  name: 'Schottky Diode',
  category: 'general',
  keywords: ['schottky', '1n5819', 'low drop'],
  size: { w: 68, h: 18 },
  origin: { x: 34, y: 9 },
  socketable: true,
  model: 'schottky',
  terminals: [
    { name: 'anode', type: 'breadboard_male', x: -30, y: 0, dir: [-1, 0] },
    { name: 'cathode', type: 'breadboard_male', x: 30, y: 0, dir: [1, 0] },
  ],
  props: [],
  defaults: {},
  Art: diodeArt('#C8C8C8', '#3A3A3A'),
});

// ─── Fuse ────────────────────────────────────────────────────────────────────

interface FuseProps extends Record<string, string | number> {
  rating: number;
}

export const Fuse = definePart<FuseProps>({
  id: 'fuse',
  name: 'Fuse',
  category: 'general',
  keywords: ['protection', 'amp', 'blow'],
  size: { w: 68, h: 22 },
  origin: { x: 34, y: 11 },
  socketable: true,
  model: 'fuse',
  terminals: [
    { name: 'a', type: 'breadboard_male', x: -30, y: 0, dir: [-1, 0] },
    { name: 'b', type: 'breadboard_male', x: 30, y: 0, dir: [1, 0] },
  ],
  props: [
    { key: 'rating', label: 'Current rating', kind: 'number', unit: 'A', min: 0.05, max: 20, step: 0.05 },
  ],
  defaults: { rating: 1 },
  Art: ({ state }: ArtProps<FuseProps>) => (
    <g>
      <Leg x1={-30} y1={0} x2={-16} y2={0} />
      <Leg x1={16} y1={0} x2={30} y2={0} />
      <rect x={-17} y={-9} width={34} height={18} rx={9} fill="#DCE6EF" opacity={0.85} stroke="#A9B6C2" />
      <rect x={-17} y={-9} width={6} height={18} rx={2} fill={C.metal} />
      <rect x={11} y={-9} width={6} height={18} rx={2} fill={C.metal} />
      {state?.blown ? (
        <path d="M-9,0 L-3,-5 L0,3 L3,-5 L9,0" fill="none" stroke="#8A8A8A" strokeWidth={1.4} strokeDasharray="3 3" />
      ) : (
        <line x1={-10} y1={0} x2={10} y2={0} stroke="#7A7A7A" strokeWidth={1.6} />
      )}
    </g>
  ),
});

export const PASSIVES: PartDef<never>[] = [
  Resistor,
  Capacitor,
  ElectrolyticCapacitor,
  Inductor,
  Diode,
  ZenerDiode,
  SchottkyDiode,
  Fuse,
] as unknown as PartDef<never>[];
