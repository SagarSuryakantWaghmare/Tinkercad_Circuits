import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { C } from '@/lib/tokens';
import { Leg, Silk } from '../primitives';
import { beginValueDrag } from '../interact';
import { ColdIcon, HotIcon, MoonIcon, PartButton, PartSlider, SunIcon } from '../simControls';

// ─── Pushbutton ──────────────────────────────────────────────────────────────
// Four legs; the two on each side are permanently tied, and pressing bridges
// left to right. Terminal names match the product's 1a/1b/2a/2b convention.

function PushbuttonArt({ state, simulating, interact }: ArtProps<Record<string, never>>) {
  const pressed = !!state?.pressed;
  return (
    <g>
      {[
        [-15, -25],
        [15, -25],
        [-15, 25],
        [15, 25],
      ].map(([x, y]) => (
        <path
          key={`${x},${y}`}
          d={`M${x},${y > 0 ? 12 : -12} L${x},${y}`}
          stroke={C.lead}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
      <rect x={-15} y={-13} width={30} height={26} rx={2.5} fill="#DCE0E5" stroke="#ACB2B8" strokeWidth={0.8} />
      <circle cx={-11} cy={-9} r={1.5} fill="#9BA1A8" />
      <circle cx={11} cy={-9} r={1.5} fill="#9BA1A8" />
      <circle cx={-11} cy={9} r={1.5} fill="#9BA1A8" />
      <circle cx={11} cy={9} r={1.5} fill="#9BA1A8" />
      <circle cx={0} cy={0} r={9} fill="#242628" stroke="#141517" strokeWidth={0.8} />
      <circle
        cx={0}
        cy={0}
        r={pressed ? 6.5 : 7.5}
        fill={pressed ? '#161718' : '#313538'}
      />
      {simulating && (
        <circle
          cx={0}
          cy={0}
          r={11}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            interact?.('press', true);
          }}
          onPointerUp={() => interact?.('press', false)}
          onPointerLeave={() => interact?.('press', false)}
        />
      )}
    </g>
  );
}

export const Pushbutton = definePart({
  id: 'pushbutton',
  name: 'Pushbutton',
  category: 'input',
  keywords: ['button', 'switch', 'tactile', 'momentary', 'press'],
  basic: true,
  size: { w: 40, h: 62 },
  origin: { x: 20, y: 31 },
  socketable: true,
  model: 'pushbutton',
  terminals: [
    { name: '1a', type: 'breadboard_male', x: -15, y: -25, dir: [0, -1], group: 'L' },
    { name: '2a', type: 'breadboard_male', x: 15, y: -25, dir: [0, -1], group: 'R' },
    { name: '1b', type: 'breadboard_male', x: -15, y: 25, dir: [0, 1], group: 'L' },
    { name: '2b', type: 'breadboard_male', x: 15, y: 25, dir: [0, 1], group: 'R' },
  ],
  props: [],
  defaults: {},
  Art: PushbuttonArt,
});

// ─── Slideswitch (SPDT) ──────────────────────────────────────────────────────

function SlideswitchArt({ state, simulating, interact }: ArtProps<Record<string, never>>) {
  // 0 = left closed, 1 = centre OFF, 2 = right closed.
  const pos = Math.max(0, Math.min(2, Number(state?.position ?? 0)));
  const knobX = pos === 0 ? -9 : pos === 2 ? 1 : -4;
  const label = pos === 0 ? '1' : pos === 2 ? '2' : 'OFF';
  return (
    <g>
      {[-10, 0, 10].map((x) => (
        <Leg key={x} x1={x} y1={8} x2={x} y2={18} />
      ))}
      <rect x={-18} y={-13} width={36} height={22} rx={2} fill="#2B2E31" stroke="#17191B" strokeWidth={0.8} />
      <rect x={-12} y={-9} width={24} height={13} rx={1} fill="#141618" />
      <rect
        x={knobX}
        y={-14}
        width={8}
        height={15}
        rx={1.5}
        fill="#E2E5E8"
        stroke="#8E949A"
        strokeWidth={0.7}
      />
      <line x1={knobX + 2.5} y1={-10} x2={knobX + 2.5} y2={-3} stroke="#ACB2B8" strokeWidth={0.8} />
      <line x1={knobX + 5.5} y1={-10} x2={knobX + 5.5} y2={-3} stroke="#ACB2B8" strokeWidth={0.8} />
      <text
        x={0}
        y={-16}
        fontSize={4.5}
        fontWeight={700}
        textAnchor="middle"
        fill="#8E949A"
      >
        {label}
      </text>
      {simulating && (
        <rect
          x={-18}
          y={-16}
          width={36}
          height={26}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            interact?.('toggle');
          }}
        />
      )}
    </g>
  );
}

export const Slideswitch = definePart({
  id: 'slideswitch',
  name: 'Slideswitch',
  category: 'input',
  keywords: ['switch', 'spdt', 'toggle', 'slide', 'selector'],
  basic: true,
  size: { w: 42, h: 40 },
  origin: { x: 21, y: 18 },
  socketable: true,
  model: 'slideswitch',
  terminals: [
    { name: '1', type: 'breadboard_male', x: -10, y: 18, dir: [0, 1] },
    { name: 'common', type: 'breadboard_male', x: 0, y: 18, dir: [0, 1] },
    { name: '2', type: 'breadboard_male', x: 10, y: 18, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: SlideswitchArt,
});

// ─── Potentiometer ───────────────────────────────────────────────────────────

interface PotProps extends Record<string, string | number> {
  resistance: number;
}

function PotArt({ state, simulating, interact }: ArtProps<PotProps>) {
  const frac = clamp01(Number(state?.wiper ?? 0.5));
  const angle = -135 + frac * 270;
  return (
    <g>
      {[-10, 0, 10].map((x) => (
        <Leg key={x} x1={x} y1={14} x2={x} y2={24} />
      ))}
      <rect x={-18} y={-18} width={36} height={34} rx={4} fill="#1A3B66" stroke="#122A4A" strokeWidth={0.8} />
      <circle cx={0} cy={-1} r={14} fill="#24518C" stroke="#183A66" strokeWidth={1} />
      <circle cx={0} cy={-1} r={11.5} fill="#2E66B0" />
      <g transform={`rotate(${angle} 0 -1)`}>
        <rect x={-1.5} y={-11} width={3} height={7} rx={1} fill="#FFFFFF" />
      </g>
      {simulating && (
        <>
          <circle
            cx={0}
            cy={-1}
            r={16}
            fill="transparent"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) =>
              beginValueDrag(e, (dx, dy) => interact?.('delta', (dx - dy) * 0.012))
            }
          />
          <PartSlider
            x={0}
            y={-38}
            width={78}
            value={frac}
            min={0}
            max={1}
            color="#2E66B0"
            label={`${Math.round(frac * 100)} %`}
            onChange={(v) => interact?.('set', v)}
          />
          <PartButton
            x={-30}
            y={-16}
            width={14}
            height={12}
            label="−"
            active={false}
            onPress={() => interact?.('delta', -0.01)}
          />
          <PartButton
            x={30}
            y={-16}
            width={14}
            height={12}
            label="+"
            active={false}
            onPress={() => interact?.('delta', 0.01)}
          />
        </>
      )}
    </g>
  );
}

const clamp01 = (n: number) => (isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export const Potentiometer = definePart<PotProps>({
  id: 'potentiometer',
  name: 'Rotary Potentiometer',
  category: 'input',
  keywords: ['pot', 'knob', 'variable resistor', 'dial', 'analog'],
  basic: true,
  size: { w: 44, h: 46 },
  origin: { x: 22, y: 20 },
  socketable: true,
  model: 'potentiometer',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 24, dir: [0, 1] },
    { name: 'wiper', type: 'breadboard_male', x: 0, y: 24, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 24, dir: [0, 1] },
  ],
  props: [
    {
      key: 'resistance',
      label: 'Resistance',
      kind: 'unit',
      unit: 'Ω',
      prefixes: ['', 'k', 'M'],
      min: 100,
      max: 1e6,
    },
  ],
  defaults: { resistance: 10000 },
  Art: PotArt,
});

export const TrimPot = definePart<PotProps>({
  id: 'trimpot',
  name: 'Trimmer Potentiometer',
  category: 'input',
  keywords: ['trimpot', 'preset', 'trim', 'calibration'],
  size: { w: 36, h: 40 },
  origin: { x: 18, y: 16 },
  socketable: true,
  model: 'potentiometer',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 20, dir: [0, 1] },
    { name: 'wiper', type: 'breadboard_male', x: 0, y: 20, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 20, dir: [0, 1] },
  ],
  props: [
    {
      key: 'resistance',
      label: 'Resistance',
      kind: 'unit',
      unit: 'Ω',
      prefixes: ['', 'k', 'M'],
      min: 100,
      max: 1e6,
    },
  ],
  defaults: { resistance: 10000 },
  Art: ({ state, simulating, interact }: ArtProps<PotProps>) => {
    const frac = clamp01(Number(state?.wiper ?? 0.5));
    return (
      <g>
        {[-10, 0, 10].map((x) => (
          <Leg key={x} x1={x} y1={10} x2={x} y2={20} />
        ))}
        <rect x={-15} y={-14} width={30} height={26} rx={2} fill="#2E5FA8" stroke="#204476" />
        <circle cx={0} cy={-1} r={9} fill="#D9DCE0" />
        <g transform={`rotate(${-135 + frac * 270} 0 -1)`}>
          <rect x={-1.2} y={-8} width={2.4} height={14} rx={0.6} fill="#31363B" />
        </g>
        {simulating && (
          <>
            <circle
              cx={0}
              cy={-1}
              r={10}
              fill="transparent"
              style={{ cursor: 'ew-resize' }}
              onPointerDown={(e) =>
                beginValueDrag(e, (dx, dy) => interact?.('delta', (dx - dy) * 0.012))
              }
            />
            <PartSlider
              x={0}
              y={-30}
              width={62}
              value={frac}
              min={0}
              max={1}
              color="#2E5FA8"
              label={`${Math.round(frac * 100)} %`}
              onChange={(v) => interact?.('set', v)}
            />
          </>
        )}
      </g>
    );
  },
});

// ─── Photoresistor ───────────────────────────────────────────────────────────

function LdrArt({ state, simulating, interact }: ArtProps<Record<string, never>>) {
  const lux = Number(state?.lux ?? 100);
  const lit = clamp01(Math.log10(Math.max(lux, 0.1) + 1) / 3);
  return (
    <g>
      <Leg x1={-5} y1={8} x2={-5} y2={20} />
      <Leg x1={5} y1={8} x2={5} y2={20} />
      <circle cx={0} cy={-2} r={12} fill="#E8D8C0" stroke="#C4B090" strokeWidth={1} />
      <circle cx={0} cy={-2} r={9.5} fill={mix('#D4782A', '#F0A860', lit)} />
      {/* serpentine CdS track */}
      <path
        d="M-7,-8 L-7,-4 L-3.5,-4 L-3.5,0 L-7,0 L-7,4 M7,-8 L7,-4 L3.5,-4 L3.5,0 L7,0 L7,4"
        fill="none"
        stroke="#7A240E"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path d="M-7,4 L7,4" stroke="#7A240E" strokeWidth={1.5} strokeLinecap="round" />
      {simulating && (
        <PartSlider
          x={0}
          y={-34}
          width={78}
          value={lux}
          min={0.05}
          max={100000}
          log
          color="#E3B341"
          lowIcon={MoonIcon}
          highIcon={SunIcon}
          label={`${lux < 10 ? lux.toFixed(1) : Math.round(lux)} lux`}
          onChange={(v) => interact?.('set', v)}
        />
      )}
    </g>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const Photoresistor = definePart({
  id: 'photoresistor',
  name: 'Photoresistor',
  category: 'input',
  keywords: ['ldr', 'light', 'sensor', 'cds', 'light dependent resistor'],
  basic: true,
  size: { w: 30, h: 44 },
  origin: { x: 15, y: 16 },
  socketable: true,
  model: 'photoresistor',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -5, y: 20, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 5, y: 20, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: LdrArt,
});

// ─── TMP36 temperature sensor ────────────────────────────────────────────────

export const TemperatureSensor = definePart({
  id: 'temperature-sensor',
  name: 'Temperature Sensor [TMP36]',
  category: 'input',
  keywords: ['tmp36', 'temp', 'thermometer', 'celsius', 'analog sensor'],
  basic: true,
  size: { w: 34, h: 44 },
  origin: { x: 17, y: 16 },
  socketable: true,
  model: 'tmp36',
  terminals: [
    { name: 'power', type: 'breadboard_male', x: -10, y: 20, dir: [0, 1], role: 'power' },
    { name: 'vout', type: 'breadboard_male', x: 0, y: 20, dir: [0, 1], role: 'analog' },
    { name: 'gnd', type: 'breadboard_male', x: 10, y: 20, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps<Record<string, never>>) => {
    const t = Number(state?.tempC ?? 25);
    return (
      <g>
        {[-10, 0, 10].map((x) => (
          <Leg key={x} x1={x} y1={8} x2={x} y2={20} />
        ))}
        <path
          d="M-11,-12 A11,11 0 0,1 11,-12 L11,7 L-11,7 Z"
          fill="#222426"
          stroke="#111213"
          strokeWidth={0.8}
        />
        <rect x={-10} y={4} width={20} height={3} fill="#2E3033" />
        <Silk x={0} y={-3} size={6} fill="#E8ECEF" weight={700}>
          TMP
        </Silk>
        {simulating && (
          <PartSlider
            x={0}
            y={-32}
            width={78}
            value={t}
            min={-40}
            max={125}
            color="#C11F1F"
            lowIcon={ColdIcon}
            highIcon={HotIcon}
            label={`${t.toFixed(0)} \u00b0C`}
            onChange={(v) => interact?.('set', v)}
          />
        )}
      </g>
    );
  },
});

export const INPUT_BASIC: PartDef<never>[] = [
  Pushbutton,
  Slideswitch,
  Potentiometer,
  TrimPot,
  Photoresistor,
  TemperatureSensor,
] as unknown as PartDef<never>[];
