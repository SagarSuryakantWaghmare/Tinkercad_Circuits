import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { Silk } from '../primitives';

// ─── 9 V battery ─────────────────────────────────────────────────────────────

export const Battery9V = definePart({
  id: 'battery-9v',
  name: '9V Battery',
  category: 'power',
  keywords: ['battery', 'power', 'pp3', 'supply', '9 volt'],
  basic: true,
  size: { w: 96, h: 128 },
  origin: { x: 48, y: 64 },
  model: 'battery',
  terminals: [
    { name: '+', type: 'wire', x: -20, y: -62, dir: [0, -1], role: 'power' },
    { name: '-', type: 'wire', x: 20, y: -62, dir: [0, -1], role: 'gnd' },
  ],
  props: [],
  defaults: { voltage: 9 },
  Art: () => (
    <g>
      <rect x={-42} y={-52} width={84} height={108} rx={6} fill="#2A2C2F" stroke="#151719" />
      <rect x={-38} y={-48} width={76} height={44} rx={3} fill="#C9992E" />
      <rect x={-38} y={0} width={76} height={52} rx={3} fill="#3A3D41" />
      <Silk x={0} y={-26} size={17} fill="#2A2C2F" weight={800}>
        9V
      </Silk>
      <Silk x={0} y={22} size={9} fill="#CFD3D7" weight={600}>
        ALKALINE
      </Silk>
      {/* terminals on the crown */}
      <circle cx={-20} cy={-58} r={9} fill="#B9BDC2" stroke="#8A9096" strokeWidth={1} />
      <circle cx={-20} cy={-58} r={5} fill="#8A9096" />
      <circle cx={20} cy={-58} r={9} fill="#B9BDC2" stroke="#8A9096" strokeWidth={1} />
      <circle cx={20} cy={-58} r={5.5} fill="#6E7479" />
      <Silk x={-20} y={-72} size={9} fill="#5A5F65">
        +
      </Silk>
      <Silk x={20} y={-72} size={11} fill="#5A5F65">
        −
      </Silk>
    </g>
  ),
});

// ─── Cylindrical cells ───────────────────────────────────────────────────────

interface CellProps extends Record<string, string | number> {
  cells: number;
}

/** Cells sit end to end in a holder, so the pack grows with the count. */
const MAX_CELLS = 8;
const cellCount = (p: Record<string, unknown>) =>
  Math.max(1, Math.min(MAX_CELLS, Number(p.cells) || 1));

function cylindricalCell(
  id: string,
  name: string,
  label: string,
  bodyW: number,
  bodyH: number,
  keywords: string[],
) {
  return definePart<CellProps>({
    id,
    name,
    category: 'power',
    keywords,
    basic: id === 'battery-aa',
    // Sized for the largest pack so the hit area never lags the art; the
    // terminals themselves follow the actual count.
    size: { w: bodyW * MAX_CELLS + 30, h: bodyH + 20 },
    origin: { x: (bodyW * MAX_CELLS + 30) / 2, y: (bodyH + 20) / 2 },
    model: 'battery',
    terminals: (props) => {
      const n = cellCount(props);
      const half = (n * bodyW) / 2;
      return [
        { name: '+', type: 'wire', x: half + 12, y: 0, dir: [1, 0], role: 'power' },
        { name: '-', type: 'wire', x: -half - 12, y: 0, dir: [-1, 0], role: 'gnd' },
      ];
    },
    props: [
      {
        key: 'cells',
        label: 'Cells in series',
        kind: 'number',
        min: 1,
        max: MAX_CELLS,
        step: 1,
        help: 'Each cell adds 1.5 V, exactly as stacking them in a holder does.',
      },
    ],
    defaults: { cells: 1, voltage: 1.5 },
    Art: ({ props }: ArtProps<CellProps>) => {
      const n = cellCount(props);
      const half = (n * bodyW) / 2;
      return (
        <g>
          {/* negative end cap */}
          <rect x={-half - 12} y={-5} width={12} height={10} rx={1.5} fill="#B9BDC2" />
          {Array.from({ length: n }, (_, i) => {
            const x0 = -half + i * bodyW;
            return (
              <g key={i}>
                <rect
                  x={x0}
                  y={-bodyH / 2}
                  width={bodyW}
                  height={bodyH}
                  rx={4}
                  fill="#1F3F6B"
                  stroke="#132A48"
                />
                <rect
                  x={x0 + 3}
                  y={-bodyH / 2 + 3}
                  width={bodyW - 6}
                  height={bodyH / 3}
                  rx={2}
                  fill="#2E5FA8"
                  opacity={0.7}
                />
                {/* The nub of one cell presses on the cap of the next. */}
                {i < n - 1 && (
                  <rect x={x0 + bodyW - 3} y={-5} width={6} height={10} rx={1.5} fill="#C9CDD2" />
                )}
                <Silk
                  x={x0 + bodyW / 2}
                  y={-3}
                  size={Math.min(13, bodyH * 0.4)}
                  fill="#E8EDF5"
                  weight={800}
                >
                  {label}
                </Silk>
              </g>
            );
          })}
          {/* positive nub */}
          <rect x={half} y={-6} width={8} height={12} rx={2} fill="#C9CDD2" />
          <rect x={half + 8} y={-4} width={5} height={8} rx={1.5} fill="#B9BDC2" />
          <Silk x={0} y={bodyH / 2 + 12} size={8} fill="#4A4F55" weight={700}>
            {n > 1 ? `${n} \u00d7 1.5V = ${(n * 1.5).toFixed(1)}V` : '1.5V'}
          </Silk>
        </g>
      );
    },
  });
}

export const BatteryAA = cylindricalCell('battery-aa', '1.5V Battery', 'AA', 96, 34, [
  'battery',
  'aa',
  'cell',
  'power',
  '1.5v',
]);

export const BatteryAAA = cylindricalCell('battery-aaa', '1.5V Battery (AAA)', 'AAA', 78, 26, [
  'battery',
  'aaa',
  'cell',
  'power',
]);

export const BatteryD = cylindricalCell('battery-d', '1.5V Battery (D)', 'D', 128, 52, [
  'battery',
  'd cell',
  'cell',
  'power',
  'torch',
]);

// ─── Coin cell ───────────────────────────────────────────────────────────────

export const CoinCell = definePart({
  id: 'battery-coin',
  name: '3V Coin Cell Battery',
  category: 'power',
  keywords: ['coin', 'cr2032', 'button cell', '3v', 'battery'],
  basic: true,
  size: { w: 84, h: 72 },
  origin: { x: 42, y: 36 },
  model: 'battery',
  terminals: [
    { name: '+', type: 'wire', x: 0, y: -32, dir: [0, -1], role: 'power' },
    { name: '-', type: 'wire', x: 0, y: 32, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: { voltage: 3 },
  Art: () => (
    <g>
      <circle cx={0} cy={0} r={30} fill="#C4C9CE" stroke="#9AA0A6" strokeWidth={1.2} />
      <circle cx={0} cy={0} r={24} fill="#D7DBE0" />
      <circle cx={0} cy={0} r={24} fill="none" stroke="#AEB4BA" strokeWidth={0.8} />
      <Silk x={0} y={-8} size={11} fill="#4C5257" weight={800}>
        CR2032
      </Silk>
      <Silk x={0} y={6} size={9} fill="#5F656B" weight={700}>
        3V
      </Silk>
      <Silk x={0} y={17} size={11} fill="#5F656B" weight={800}>
        +
      </Silk>
      <line x1={0} y1={-30} x2={0} y2={-38} stroke="#B0B4B8" strokeWidth={3} strokeLinecap="round" />
      <line x1={0} y1={30} x2={0} y2={38} stroke="#B0B4B8" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
});

// ─── 4×AA holder ─────────────────────────────────────────────────────────────

export const BatteryPack = definePart({
  id: 'battery-pack-4aa',
  name: 'Battery Pack (4×AA)',
  category: 'power',
  keywords: ['pack', 'holder', 'aa', '6v', 'battery'],
  size: { w: 150, h: 130 },
  origin: { x: 75, y: 65 },
  model: 'battery',
  terminals: [
    { name: '+', type: 'wire', x: -20, y: -60, dir: [0, -1], role: 'power' },
    { name: '-', type: 'wire', x: 20, y: -60, dir: [0, -1], role: 'gnd' },
  ],
  props: [],
  defaults: { voltage: 6 },
  Art: () => (
    <g>
      <rect x={-62} y={-52} width={124} height={104} rx={5} fill="#2B2E31" stroke="#17191B" />
      {[-33, -11, 11, 33].map((y) => (
        <g key={y}>
          <rect x={-54} y={y - 9} width={108} height={18} rx={4} fill="#1F3F6B" />
          <rect x={-54} y={y - 9} width={10} height={18} rx={2} fill="#B9BDC2" />
          <rect x={44} y={y - 5} width={10} height={10} rx={2} fill="#C9CDD2" />
          <Silk x={0} y={y} size={8} fill="#D6E1F2" weight={700}>
            AA
          </Silk>
        </g>
      ))}
      {/* terminals on the crown */}
      <circle cx={-20} cy={-58} r={9} fill="#B9BDC2" stroke="#8A9096" strokeWidth={1} />
      <circle cx={-20} cy={-58} r={5} fill="#8A9096" />
      <circle cx={20} cy={-58} r={9} fill="#B9BDC2" stroke="#8A9096" strokeWidth={1} />
      <circle cx={20} cy={-58} r={5.5} fill="#6E7479" />
      <Silk x={-20} y={-72} size={9} fill="#5A5F65">
        +
      </Silk>
      <Silk x={20} y={-72} size={11} fill="#5A5F65">
        −
      </Silk>
      <Silk x={0} y={48} size={8} fill="#7A8088" weight={700}>
        6V
      </Silk>
    </g>
  ),
});

// ─── Potato battery ──────────────────────────────────────────────────────────

export const PotatoBattery = definePart({
  id: 'battery-potato',
  name: 'Potato Battery',
  category: 'power',
  keywords: ['potato', 'battery', 'fruit', 'vegetable', 'power', 'cell', 'copper', 'zinc'],
  size: { w: 90, h: 90 },
  origin: { x: 45, y: 45 },
  model: 'battery-potato',
  terminals: [
    { name: '+', type: 'wire', x: -20, y: -42, dir: [0, -1], role: 'power' },
    { name: '-', type: 'wire', x: 20, y: -42, dir: [0, -1], role: 'gnd' },
  ],
  props: [],
  defaults: { voltage: 0.9, resistance: 20 },
  Art: () => (
    <g>
      {/* Potato body */}
      <path
        d="M -36,-12 C -38,-30 -15,-36 10,-34 C 34,-32 40,-12 37,14 C 34,34 10,36 -14,35 C -34,33 -34,6 -36,-12 Z"
        fill="#B58A4C"
        stroke="#7A5623"
        strokeWidth={1.5}
      />
      {/* Texture spots / eyes */}
      <ellipse cx={-18} cy={-12} rx={3} ry={1.5} fill="#8A6329" opacity={0.6} />
      <ellipse cx={16} cy={-10} rx={3.5} ry={2} fill="#8A6329" opacity={0.6} />
      <ellipse cx={-4} cy={14} rx={4} ry={2} fill="#8A6329" opacity={0.6} />
      <ellipse cx={20} cy={16} rx={2.5} ry={1.5} fill="#8A6329" opacity={0.6} />
      {/* Copper electrode (+) */}
      <rect x={-24} y={-42} width={8} height={18} rx={1.5} fill="#C87533" stroke="#8C4B18" strokeWidth={0.8} />
      {/* Zinc electrode (-) */}
      <rect x={16} y={-42} width={8} height={18} rx={1.5} fill="#A0AAB2" stroke="#68737B" strokeWidth={0.8} />
      <Silk x={-20} y={-48} size={9} fill="#5A5F65" weight={800}>
        +
      </Silk>
      <Silk x={20} y={-48} size={11} fill="#5A5F65" weight={800}>
        −
      </Silk>
      <Silk x={0} y={2} size={8} fill="#4E330F" weight={800}>
        POTATO
      </Silk>
      <Silk x={0} y={13} size={6.5} fill="#694617" weight={600}>
        0.9V CELL
      </Silk>
    </g>
  ),
});

// ─── Lemon battery ───────────────────────────────────────────────────────────

export const LemonBattery = definePart({
  id: 'battery-lemon',
  name: 'Lemon Battery',
  category: 'power',
  keywords: ['lemon', 'battery', 'fruit', 'citrus', 'power', 'cell', 'copper', 'zinc'],
  size: { w: 90, h: 90 },
  origin: { x: 45, y: 45 },
  model: 'battery-lemon',
  terminals: [
    { name: '+', type: 'wire', x: -20, y: -42, dir: [0, -1], role: 'power' },
    { name: '-', type: 'wire', x: 20, y: -42, dir: [0, -1], role: 'gnd' },
  ],
  props: [],
  defaults: { voltage: 0.95, resistance: 15 },
  Art: () => (
    <g>
      {/* Lemon body */}
      <path
        d="M -40,-2 C -38,-24 -18,-33 0,-33 C 18,-33 38,-24 40,-2 C 38,22 18,33 0,33 C -18,33 -38,22 -40,-2 Z"
        fill="#F4CE28"
        stroke="#BFA016"
        strokeWidth={1.5}
      />
      {/* Nipple ends */}
      <ellipse cx={-40} cy={-2} rx={2.5} ry={4} fill="#E2BC16" />
      <ellipse cx={40} cy={-2} rx={2.5} ry={4} fill="#E2BC16" />
      {/* Copper electrode (+) */}
      <rect x={-24} y={-42} width={8} height={18} rx={1.5} fill="#C87533" stroke="#8C4B18" strokeWidth={0.8} />
      {/* Zinc electrode (-) */}
      <rect x={16} y={-42} width={8} height={18} rx={1.5} fill="#A0AAB2" stroke="#68737B" strokeWidth={0.8} />
      <Silk x={-20} y={-48} size={9} fill="#5A5F65" weight={800}>
        +
      </Silk>
      <Silk x={20} y={-48} size={11} fill="#5A5F65" weight={800}>
        −
      </Silk>
      <Silk x={0} y={2} size={8} fill="#635105" weight={800}>
        LEMON
      </Silk>
      <Silk x={0} y={13} size={6.5} fill="#7A6508" weight={600}>
        0.95V CELL
      </Silk>
    </g>
  ),
});

export const BATTERIES: PartDef<never>[] = [
  Battery9V,
  BatteryAA,
  BatteryAAA,
  BatteryD,
  CoinCell,
  BatteryPack,
  PotatoBattery,
  LemonBattery,
] as unknown as PartDef<never>[];
