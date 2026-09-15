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
      <rect x={-16} y={-14} width={32} height={28} rx={2} fill="#2E3133" stroke="#1A1C1D" />
      <rect x={-16} y={-14} width={32} height={4} rx={1} fill="#3B3F42" />
      <circle cx={0} cy={0} r={9.5} fill="#D9DCE0" stroke="#A9AEB4" strokeWidth={0.8} />
      <circle
        cx={0}
        cy={0}
        r={pressed ? 7 : 8}
        fill={pressed ? '#B7BCC2' : '#EDEFF2'}
        stroke="#9BA1A8"
        strokeWidth={0.6}
      />
      {/* full-size invisible target so the whole cap is clickable while running */}
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
      <rect x={-18} y={-13} width={36} height={22} rx={2} fill="#B9BEC4" stroke="#8E949A" />
      <rect x={-11} y={-9} width={22} height={12} rx={1.5} fill="#2B2E30" />
      <rect
        x={knobX}
        y={-15}
        width={8}
        height={16}
        rx={1.5}
        fill={pos === 1 ? '#F5D033' : '#E8EAEC'}
        stroke="#A6ACB2"
        strokeWidth={0.7}
      />
      <text
        x={0}
        y={-16}
        fontSize={4.5}
        fontWeight={700}
        textAnchor="middle"
        fill="#5A6068"
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
      <rect x={-20} y={-18} width={40} height={34} rx={3} fill="#3C6EA5" stroke="#2A5279" />
      <circle cx={0} cy={-2} r={15} fill="#D8DCE1" stroke="#A8AEB5" strokeWidth={1} />
      <circle cx={0} cy={-2} r={12.5} fill="#EDF0F3" />
      <g transform={`rotate(${angle} 0 -2)`}>
        <rect x={-1.6} y={-14} width={3.2} height={11} rx={1.4} fill="#31363B" />
      </g>
      <path
        d="M-13,8 A15,15 0 0,1 13,8"
        fill="none"
        stroke="#8E959C"
        strokeWidth={0.9}
        strokeDasharray="1.5 3"
      />
      {simulating && (
        <>
          <circle
            cx={0}
            cy={-2}
            r={16}
            fill="transparent"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) =>
              beginValueDrag(e, (dx, dy) => interact?.('delta', (dx - dy) * 0.012))
            }
          />
          {/* Voltage-divider regulator slider: precise wiper control (0–100 %). */}
          <PartSlider
            x={0}
            y={-38}
            width={78}
            value={frac}
            min={0}
            max={1}
            color="#3C6EA5"
            label={`${Math.round(frac * 100)} %`}
            onChange={(v) => interact?.('set', v)}
          />
          {/* Step buttons for one-percent nudges — the reference product's
              behaviour is that a click on the knob edge fine-tunes the value. */}
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
      <Leg x1={-5} y1={9} x2={-5} y2={20} />
      <Leg x1={5} y1={9} x2={5} y2={20} />
      <circle cx={0} cy={-2} r={12} fill="#E9E2CC" stroke="#B9AE8E" strokeWidth={1} />
      <circle cx={0} cy={-2} r={9.5} fill={mix('#8A7B4E', '#F2E9C6', lit)} />
      {/* the serpentine CdS track */}
      <path
        d="M-7,-8 L-7,-4 L-3.5,-4 L-3.5,0 L-7,0 L-7,4 M7,-8 L7,-4 L3.5,-4 L3.5,0 L7,0 L7,4"
        fill="none"
        stroke="#5E5233"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path d="M-7,4 L7,4" stroke="#5E5233" strokeWidth={1.5} strokeLinecap="round" />
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
          fill="#1F2123"
          stroke="#0E1011"
          strokeWidth={0.8}
        />
        <path d="M-11,-12 L11,-12" stroke="#3A3E41" strokeWidth={1} />
        <Silk x={0} y={-2} size={5.5} fill="#C8CCD0" weight={600}>
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
