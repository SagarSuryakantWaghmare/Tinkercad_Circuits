import type { ReactNode } from 'react';
import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import {
  ColdIcon,
  HotIcon,
  MoonIcon,
  PartSlider,
  PartToggle,
  SunIcon,
  TargetLine,
} from '../simControls';
import { BoardShadow, Leg, Silk } from '../primitives';

const PCB = '#1E5FA8';
const PCB_EDGE = '#154379';

/**
 * Three-pin breakout module: a small PCB with the sensing element on top and a
 * VCC/GND/OUT header along the bottom edge. Most of the sensor catalogue is
 * this shape, so it is one builder rather than a dozen near-identical files.
 */
function moduleBoard(opts: {
  id: string;
  name: string;
  label: string;
  model: string;
  keywords: string[];
  pins?: string[];
  basic?: boolean;
  w?: number;
  h?: number;
  /** Drawn above the header, centred on the origin. */
  element: (state: ArtProps['state']) => ReactNode;
  /**
   * The on-part control shown while the simulation runs. Sensors get a slider
   * you can see and grab; on/off detectors get a toggle.
   */
  control:
    | {
        kind: 'slider';
        min: number;
        max: number;
        log?: boolean;
        color?: string;
        lowIcon?: ReactNode;
        highIcon?: ReactNode;
        label: (v: number) => string;
      }
    | { kind: 'toggle'; onLabel: string; offLabel: string }
    | { kind: 'none'; readout?: (state: ArtProps['state']) => string };
}) {
  const pins = opts.pins ?? ['VCC', 'OUT', 'GND'];
  const w = opts.w ?? Math.max(70, pins.length * 10 + 40);
  const h = opts.h ?? 80;

  const terminals: TerminalDef[] = pins.map((name, i) => ({
    name,
    type: 'breadboard_male',
    x: -((pins.length - 1) * 10) / 2 + i * 10,
    y: h / 2 + 14,
    dir: [0, 1],
    role: name === 'VCC' ? 'power' : name === 'GND' ? 'gnd' : 'analog',
  }));

  return definePart({
    id: opts.id,
    name: opts.name,
    category: 'input',
    keywords: opts.keywords,
    basic: opts.basic,
    size: { w: w + 10, h: h + 40 },
    origin: { x: (w + 10) / 2, y: (h + 40) / 2 - 14 },
    socketable: true,
    rotationStep: 90,
    model: opts.model,
    terminals,
    props: [],
    defaults: {},
    Art: ({ state, simulating, interact }: ArtProps) => (
      <g>
        <BoardShadow w={w} h={h} rx={3} />
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={PCB} stroke={PCB_EDGE} />
        <circle cx={-w / 2 + 7} cy={-h / 2 + 7} r={3.4} fill="#0F2C4D" />
        <circle cx={w / 2 - 7} cy={-h / 2 + 7} r={3.4} fill="#0F2C4D" />
        {opts.element(state)}
        <rect
          x={-((pins.length - 1) * 10) / 2 - 5}
          y={h / 2 - 9}
          width={pins.length * 10}
          height={9}
          rx={1}
          fill="#1A1C1D"
        />
        {pins.map((p, i) => (
          <g key={p}>
            <rect
              x={-((pins.length - 1) * 10) / 2 + i * 10 - 1.4}
              y={h / 2 - 9}
              width={2.8}
              height={23}
              fill={C.solderPad}
            />
            <Silk
              x={-((pins.length - 1) * 10) / 2 + i * 10}
              y={h / 2 - 15}
              size={5}
              fill="#BBD0EC"
              weight={600}
            >
              {p}
            </Silk>
          </g>
        ))}
        <Silk x={0} y={h / 2 - 24} size={5.5} fill="#8FB3D8" weight={600}>
          {opts.label}
        </Silk>

        {simulating && opts.control.kind === 'slider' && (
          <PartSlider
            x={0}
            y={-h / 2 - 22}
            width={Math.max(78, w - 10)}
            value={Number(state?.value ?? opts.control.min)}
            min={opts.control.min}
            max={opts.control.max}
            log={opts.control.log}
            color={opts.control.color}
            lowIcon={opts.control.lowIcon}
            highIcon={opts.control.highIcon}
            label={opts.control.label(Number(state?.value ?? opts.control.min))}
            onChange={(v) => interact?.('set', v)}
          />
        )}
        {simulating && opts.control.kind === 'toggle' && (
          <PartToggle
            x={0}
            y={-h / 2 - 18}
            on={Number(state?.value ?? 0) > 0.5}
            onLabel={opts.control.onLabel}
            offLabel={opts.control.offLabel}
            onToggle={() => interact?.('toggle')}
          />
        )}
        {simulating && opts.control.kind === 'none' && opts.control.readout && (
          <Silk x={0} y={-h / 2 - 12} size={8} fill="#4A4F55" weight={700}>
            {opts.control.readout(state)}
          </Silk>
        )}
      </g>
    ),
  });
}

// ─── Environmental / proximity modules ───────────────────────────────────────

export const PirSensor = moduleBoard({
  id: 'pir-sensor',
  name: 'PIR Sensor',
  label: 'HC-SR501',
  model: 'pir-sensor',
  basic: true,
  keywords: ['pir', 'motion', 'passive infrared', 'presence', 'occupancy'],
  w: 90,
  h: 90,
  control: { kind: 'toggle', onLabel: 'MOTION', offLabel: 'no motion' },
  element: (s) => (
    <g>
      <circle cx={0} cy={-6} r={26} fill="#F0F2F4" stroke="#C6CBD1" />
      <circle cx={0} cy={-6} r={26} fill="none" stroke="#D8DCE1" strokeWidth={6} opacity={0.5} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          cx={Math.cos((a * Math.PI) / 180) * 13}
          cy={-6 + Math.sin((a * Math.PI) / 180) * 13}
          r={7}
          fill="none"
          stroke="#DDE1E5"
          strokeWidth={1.4}
        />
      ))}
      {s?.value ? <circle cx={0} cy={-6} r={9} fill="#E3853B" opacity={0.85} /> : null}
    </g>
  ),
});

export const GasSensor = moduleBoard({
  id: 'gas-sensor',
  name: 'Gas Sensor',
  label: 'MQ-2',
  model: 'gas-sensor',
  keywords: ['gas', 'smoke', 'mq2', 'co', 'air quality', 'lpg'],
  w: 90,
  h: 88,
  control: {
    kind: 'slider',
    min: 0,
    max: 1000,
    color: '#8A5A2B',
    label: (v) => `${Math.round(v)} ppm`,
  },
  element: () => (
    <g>
      <circle cx={0} cy={-6} r={22} fill="#B9BEC4" stroke="#8E949A" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={-20} y1={-18 + i * 4} x2={20} y2={-18 + i * 4} stroke="#8E949A" strokeWidth={1.6} />
      ))}
      <circle cx={0} cy={-6} r={22} fill="none" stroke="#6E7479" strokeWidth={2} />
    </g>
  ),
});

export const FlameSensor = moduleBoard({
  id: 'flame-sensor',
  name: 'Flame Sensor',
  label: 'IR FLAME',
  model: 'flame-sensor',
  keywords: ['flame', 'fire', 'infrared', 'ir', 'detector'],
  control: {
    kind: 'slider',
    min: 0,
    max: 100,
    color: '#E3853B',
    label: (v) => `flame ${Math.round(v)}%`,
  },
  element: (s) => (
    <g>
      <circle cx={0} cy={-4} r={11} fill="#1B1D1F" stroke="#0D0E0F" />
      <circle cx={0} cy={-4} r={6} fill={s && Number(s.value) > 5 ? '#E3853B' : '#2C3034'} />
      {s && Number(s.value) > 5 && (
        <path d="M14,-4 q6,-8 0,-14 M20,-4 q7,-9 0,-16" stroke="#E3853B" strokeWidth={1.6} fill="none" />
      )}
    </g>
  ),
});

export const SoilMoisture = moduleBoard({
  id: 'soil-moisture',
  name: 'Soil Moisture Sensor',
  label: 'MOISTURE',
  model: 'soil-moisture',
  keywords: ['soil', 'moisture', 'hygrometer', 'plant', 'water', 'garden'],
  w: 74,
  h: 104,
  control: {
    kind: 'slider',
    min: 0,
    max: 100,
    color: '#2E8BD6',
    label: (v) => `${Math.round(v)}% wet`,
  },
  element: (s) => {
    const wet = Number(s?.value ?? 0) / 100;
    return (
      <g>
        <rect x={-20} y={-40} width={16} height={64} rx={2} fill="#C8A24B" />
        <rect x={4} y={-40} width={16} height={64} rx={2} fill="#C8A24B" />
        <rect x={-20} y={24 - 44 * wet} width={40} height={44 * wet} fill="#2E8BD6" opacity={0.35} />
      </g>
    );
  },
});

export const WaterLevel = moduleBoard({
  id: 'water-level',
  name: 'Water Level Sensor',
  label: 'WATER',
  model: 'water-level',
  keywords: ['water', 'level', 'liquid', 'rain', 'depth'],
  w: 66,
  h: 104,
  control: {
    kind: 'slider',
    min: 0,
    max: 100,
    color: '#2E8BD6',
    label: (v) => `${Math.round(v)}% level`,
  },
  element: (s) => {
    const lvl = Number(s?.value ?? 0) / 100;
    return (
      <g>
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={-18} y={-42 + i * 7} width={36} height={4} rx={1} fill="#C8A24B" />
        ))}
        <rect x={-22} y={28 - 72 * lvl} width={44} height={72 * lvl} fill="#2E8BD6" opacity={0.4} />
      </g>
    );
  },
});

export const SoundSensor = moduleBoard({
  id: 'sound-sensor',
  name: 'Sound Sensor',
  label: 'MIC',
  model: 'sound-sensor',
  keywords: ['sound', 'microphone', 'mic', 'noise', 'clap', 'audio'],
  control: {
    kind: 'slider',
    min: 30,
    max: 110,
    color: '#7B3FB5',
    label: (v) => `${Math.round(v)} dB`,
  },
  element: (s) => (
    <g>
      <circle cx={0} cy={-4} r={13} fill="#2B2E31" stroke="#17191B" />
      <circle cx={0} cy={-4} r={9} fill="#3A3D41" />
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={-6 + (i % 3) * 6} cy={-9 + Math.floor(i / 3) * 6} r={1.4} fill="#1A1C1D" />
      ))}
      {s && Number(s.value) > 55 && (
        <path d="M16,-4 q6,-7 0,-13" stroke={C.select} strokeWidth={1.8} fill="none" />
      )}
    </g>
  ),
});

export const HallSensor = moduleBoard({
  id: 'hall-sensor',
  name: 'Hall Effect Sensor',
  label: 'A3144',
  model: 'hall-sensor',
  keywords: ['hall', 'magnet', 'magnetic', 'a3144', 'proximity'],
  control: { kind: 'toggle', onLabel: 'MAGNET', offLabel: 'no magnet' },
  element: (s) => (
    <g>
      <path d="M-9,-14 A9,9 0 0,1 9,-14 L9,6 L-9,6 Z" fill="#1F2123" />
      {s?.value ? (
        <g>
          <rect x={-24} y={-16} width={12} height={9} rx={1} fill="#C11F1F" />
          <rect x={12} y={-16} width={12} height={9} rx={1} fill="#2E63B8" />
        </g>
      ) : null}
    </g>
  ),
});

// Tinkercad ships an Ambient Light Sensor breakout distinct from the CdS
// photoresistor. It reads lux over a wider dynamic range with clean digital
// output, so users can build brightness-triggered code without a divider.
export const AmbientLight = moduleBoard({
  id: 'ambient-light',
  name: 'Ambient Light Sensor',
  label: 'BH1750',
  model: 'photoresistor',
  keywords: ['light', 'ambient', 'lux', 'bh1750', 'sensor', 'illuminance'],
  control: {
    kind: 'slider',
    min: 0.05,
    max: 100000,
    log: true,
    color: '#E3B341',
    lowIcon: MoonIcon,
    highIcon: SunIcon,
    label: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} lux`,
  },
  element: (s) => {
    const lux = Number(s?.value ?? 100);
    const lit = Math.min(1, Math.log10(Math.max(lux, 0.1) + 1) / 5);
    return (
      <g>
        <rect x={-16} y={-12} width={32} height={22} rx={2} fill="#12305F" />
        <circle cx={0} cy={-1} r={7} fill="#E9E2CC" opacity={0.7 + lit * 0.3} />
        <circle cx={0} cy={-1} r={4} fill="#F5D033" opacity={lit} />
      </g>
    );
  },
});

// Tinkercad's generic IR proximity sensor is distinct from the IR receiver
// (which decodes a modulated NEC/RC5 signal). This one just returns near/far.
export const IrProximity = moduleBoard({
  id: 'ir-proximity',
  name: 'IR Proximity Sensor',
  label: 'IR PROX',
  model: 'ir-proximity',
  keywords: ['ir', 'infrared', 'proximity', 'obstacle', 'reflective', 'sensor'],
  control: { kind: 'toggle', onLabel: 'OBJECT', offLabel: 'clear' },
  element: (s) => (
    <g>
      <rect x={-20} y={-14} width={40} height={22} rx={2} fill="#12305F" />
      <circle cx={-8} cy={-3} r={4.5} fill="#1F2123" />
      <circle cx={8} cy={-3} r={4.5} fill="#1F2123" />
      {s?.value ? (
        <g>
          <circle cx={-8} cy={-3} r={2.5} fill="#A56BFF" opacity={0.9} />
          <circle cx={8} cy={-3} r={2.5} fill="#A56BFF" opacity={0.9} />
        </g>
      ) : null}
    </g>
  ),
});

export const IrReceiver = moduleBoard({
  id: 'ir-receiver',
  name: 'IR Receiver',
  label: 'TSOP',
  model: 'ir-receiver',
  keywords: ['infrared', 'ir', 'remote', 'receiver', 'tsop', '38khz'],
  pins: ['OUT', 'GND', 'VCC'],
  control: { kind: 'toggle', onLabel: 'SIGNAL', offLabel: 'idle' },
  element: (s) => (
    <g>
      <path d="M-11,-14 A11,11 0 0,1 11,-14 L11,8 L-11,8 Z" fill="#1F2123" />
      <circle cx={0} cy={-4} r={6} fill="#2C3034" />
      {s?.value ? <circle cx={0} cy={-4} r={4} fill="#A56BFF" opacity={0.9} /> : null}
    </g>
  ),
});

export const RtcModule = moduleBoard({
  id: 'rtc',
  name: 'Real-Time Clock [DS1307]',
  label: 'DS1307',
  model: 'rtc',
  keywords: ['rtc', 'clock', 'ds1307', 'time', 'date', 'i2c'],
  pins: ['GND', 'VCC', 'SDA', 'SCL'],
  w: 96,
  h: 76,
  element: () => (
    <g>
      <rect x={-24} y={-18} width={48} height={20} rx={2} fill="#1F2123" />
      <circle cx={0} cy={12} r={12} fill="#C4C9CE" stroke="#9AA0A6" />
      <Silk x={0} y={-8} size={6} fill="#C8CCD0" weight={600}>
        DS1307
      </Silk>
    </g>
  ),
  control: { kind: 'none', readout: (s) => String(s?.time ?? '') },
});

// ─── Ultrasonic ──────────────────────────────────────────────────────────────

function ultrasonicPart(id: string, name: string, pins: string[], keywords: string[], basic = false) {
  const w = 130;
  const h = 76;
  return definePart({
    id,
    name,
    category: 'input',
    keywords,
    basic,
    size: { w: w + 10, h: h + 40 },
    origin: { x: (w + 10) / 2, y: (h + 40) / 2 - 14 },
    socketable: true,
    rotationStep: 90,
    model: pins.length === 4 ? 'ultrasonic-4pin' : 'ultrasonic-3pin',
    terminals: pins.map((p, i) => ({
      name: p,
      type: 'breadboard_male' as const,
      x: -((pins.length - 1) * 10) / 2 + i * 10,
      y: h / 2 + 14,
      dir: [0, 1] as [number, number],
      role: p === 'VCC' ? ('power' as const) : p === 'GND' ? ('gnd' as const) : ('digital' as const),
    })),
    props: [],
    defaults: {},
    Art: ({ state, simulating, interact }: ArtProps) => {
      const cm = Number(state?.distance ?? 100);
      return (
        <g>
          <BoardShadow w={w} h={h} rx={3} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={PCB} stroke={PCB_EDGE} />
          {[-32, 32].map((x) => (
            <g key={x}>
              <circle cx={x} cy={-6} r={24} fill="#B9BEC4" stroke="#8E949A" strokeWidth={1.5} />
              <circle cx={x} cy={-6} r={19} fill="#9AA0A6" />
              <circle cx={x} cy={-6} r={19} fill="none" stroke="#7E848A" strokeWidth={4} opacity={0.5} />
              <circle cx={x} cy={-6} r={5} fill="#6E7479" />
            </g>
          ))}
          <rect x={-14} y={-16} width={26} height={20} rx={2} fill="#1A2E45" />
          {pins.map((p, i) => (
            <g key={p}>
              <rect
                x={-((pins.length - 1) * 10) / 2 + i * 10 - 1.4}
                y={h / 2 - 9}
                width={2.8}
                height={23}
                fill={C.solderPad}
              />
              <Silk x={-((pins.length - 1) * 10) / 2 + i * 10} y={h / 2 - 15} size={5} fill="#BBD0EC" weight={600}>
                {p}
              </Silk>
            </g>
          ))}
          {simulating && (
            <TargetLine
              x={0}
              y={-h / 2 - 6}
              span={w}
              distance={cm}
              maxDistance={400}
              onChange={(v) => interact?.('set', v)}
            />
          )}
        </g>
      );
    },
  });
}

export const Ultrasonic4 = ultrasonicPart(
  'ultrasonic-4pin',
  'Ultrasonic Distance Sensor (4-pin)',
  ['VCC', 'TRIG', 'ECHO', 'GND'],
  ['ultrasonic', 'distance', 'hc-sr04', 'sonar', 'range', 'proximity'],
  true,
);
export const Ultrasonic3 = ultrasonicPart(
  'ultrasonic-3pin',
  'Ultrasonic Distance Sensor (3-pin)',
  ['SIG', 'VCC', 'GND'],
  ['ultrasonic', 'distance', 'ping', 'sonar', '3 pin'],
);

// ─── Discrete two-lead sensors ───────────────────────────────────────────────

function twoLead(opts: {
  id: string;
  name: string;
  model: string;
  keywords: string[];
  w: number;
  h: number;
  body: (state: ArtProps['state']) => ReactNode;
  terminals?: [string, string];
  control:
    | {
        kind: 'slider';
        min: number;
        max: number;
        log?: boolean;
        color?: string;
        lowIcon?: ReactNode;
        highIcon?: ReactNode;
        label: (v: number) => string;
      }
    | { kind: 'toggle'; onLabel: string; offLabel: string };
}) {
  const names = opts.terminals ?? ['terminal1', 'terminal2'];
  return definePart({
    id: opts.id,
    name: opts.name,
    category: 'input',
    keywords: opts.keywords,
    size: { w: opts.w, h: opts.h + 24 },
    origin: { x: opts.w / 2, y: opts.h / 2 },
    socketable: true,
    model: opts.model,
    terminals: [
      { name: names[0], type: 'breadboard_male', x: -5, y: opts.h / 2 + 10, dir: [0, 1] },
      { name: names[1], type: 'breadboard_male', x: 5, y: opts.h / 2 + 10, dir: [0, 1] },
    ],
    props: [],
    defaults: {},
    Art: ({ state, simulating, interact }: ArtProps) => (
      <g>
        <Leg x1={-5} y1={opts.h / 2 - 6} x2={-5} y2={opts.h / 2 + 10} />
        <Leg x1={5} y1={opts.h / 2 - 6} x2={5} y2={opts.h / 2 + 10} />
        {opts.body(state)}
        {simulating && opts.control.kind === 'slider' && (
          <PartSlider
            x={0}
            y={-opts.h / 2 - 22}
            width={78}
            value={Number(state?.value ?? opts.control.min)}
            min={opts.control.min}
            max={opts.control.max}
            log={opts.control.log}
            color={opts.control.color}
            lowIcon={opts.control.lowIcon}
            highIcon={opts.control.highIcon}
            label={opts.control.label(Number(state?.value ?? opts.control.min))}
            onChange={(v) => interact?.('set', v)}
          />
        )}
        {simulating && opts.control.kind === 'toggle' && (
          <PartToggle
            x={0}
            y={-opts.h / 2 - 18}
            on={!!state?.closed}
            onLabel={opts.control.onLabel}
            offLabel={opts.control.offLabel}
            onToggle={() => interact?.('toggle')}
          />
        )}
      </g>
    ),
  });
}

export const FlexSensor = twoLead({
  id: 'flex-sensor',
  name: 'Flex Sensor',
  model: 'flex-sensor',
  keywords: ['flex', 'bend', 'glove', 'strain', 'sensor'],
  w: 44,
  h: 120,
  control: { kind: 'slider', min: 0, max: 90, label: (v) => `${Math.round(v)}\u00b0 bend` },
  body: (s) => {
    const bend = Number(s?.value ?? 0) / 90;
    return (
      <path
        d={`M-8,-56 Q${18 * bend},0 -8,54 L8,54 Q${18 * bend + 16},0 8,-56 Z`}
        fill="#2B2E31"
        stroke="#17191B"
      />
    );
  },
});

export const ForceSensor = twoLead({
  id: 'force-sensor',
  name: 'Force Sensor',
  model: 'force-sensor',
  keywords: ['force', 'fsr', 'pressure', 'touch', 'load'],
  w: 62,
  h: 74,
  control: { kind: 'slider', min: 0, max: 100, label: (v) => `${Math.round(v)}% force` },
  body: (s) => {
    const f = Number(s?.value ?? 0) / 100;
    return (
      <g>
        <circle cx={0} cy={-6} r={26} fill="#2B2E31" stroke="#17191B" />
        <circle cx={0} cy={-6} r={20} fill="#3A3D41" />
        <circle cx={0} cy={-6} r={20 * (1 - f * 0.45)} fill="#5A5F64" opacity={0.5 + f * 0.5} />
        <rect x={-9} y={12} width={18} height={16} fill="#2B2E31" />
      </g>
    );
  },
});

// Square 1.5" FSR: flat carbon pad with solder tabs off one edge. Shares the
// force-sensor device so the sim behaves identically to the round version.
export const ForceSensorSquare = definePart({
  id: 'force-sensor-square',
  name: 'Force Sensor (Square 1.5")',
  category: 'input',
  keywords: ['force', 'fsr', 'pressure', 'square', 'flat', 'pad', 'touch'],
  size: { w: 56, h: 74 },
  origin: { x: 28, y: 37 },
  socketable: true,
  model: 'force-sensor',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -5, y: 32, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 5, y: 32, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const f = Number(state?.value ?? 0) / 100;
    return (
      <g>
        <Leg x1={-5} y1={20} x2={-5} y2={32} />
        <Leg x1={5} y1={20} x2={5} y2={32} />
        {/* Solder tail block above the tabs. */}
        <rect x={-9} y={14} width={18} height={8} rx={1} fill="#2B2E31" />
        {/* Flat square pad, ~40 x 40. */}
        <rect x={-20} y={-24} width={40} height={40} rx={2} fill="#1F2325" stroke="#0F1112" />
        <rect x={-17} y={-21} width={34} height={34} rx={1.5} fill="#2E3336" />
        {/* Compression indicator — inner dark region grows with force. */}
        <rect
          x={-17 + 17 * (1 - f)}
          y={-21 + 17 * (1 - f)}
          width={34 * f}
          height={34 * f}
          rx={1}
          fill="#5A5F64"
          opacity={0.5 + f * 0.5}
        />
        <Silk x={0} y={-4} size={5} fill="#8E949A" weight={600}>
          FSR
        </Silk>
        {simulating && (
          <PartSlider
            x={0}
            y={-38}
            width={78}
            value={Number(state?.value ?? 0)}
            min={0}
            max={100}
            label={`${Math.round(Number(state?.value ?? 0))}% force`}
            onChange={(v) => interact?.('set', v)}
          />
        )}
      </g>
    );
  },
});

export const Thermistor = twoLead({
  id: 'thermistor',
  name: 'Thermistor (NTC)',
  model: 'thermistor',
  keywords: ['thermistor', 'ntc', 'temperature', '10k', 'thermal'],
  w: 40,
  h: 46,
  control: {
    kind: 'slider',
    min: -40,
    max: 125,
    color: '#C11F1F',
    lowIcon: ColdIcon,
    highIcon: HotIcon,
    label: (v) => `${Math.round(v)} \u00b0C`,
  },
  body: () => (
    <g>
      <circle cx={0} cy={-4} r={13} fill="#1E5FA8" stroke="#154379" />
      <Silk x={0} y={-4} size={7} fill="#DCE8F5" weight={700}>
        10k
      </Silk>
    </g>
  ),
});

export const TiltSensor = twoLead({
  id: 'tilt-sensor',
  name: 'Tilt Sensor',
  model: 'tilt-sensor',
  keywords: ['tilt', 'ball switch', 'orientation', 'shake'],
  w: 40,
  h: 56,
  control: { kind: 'toggle', onLabel: 'TILTED', offLabel: 'upright' },
  body: (s) => (
    <g>
      <rect x={-11} y={-24} width={22} height={44} rx={10} fill="#B9BEC4" stroke="#8E949A" />
      <circle cx={0} cy={s?.closed ? 12 : -12} r={7} fill="#5C6166" />
    </g>
  ),
});

export const VibrationSensor = twoLead({
  id: 'vibration-sensor',
  name: 'Vibration Sensor',
  model: 'vibration-sensor',
  keywords: ['vibration', 'shake', 'knock', 'spring switch', 'sw-420'],
  w: 40,
  h: 60,
  control: { kind: 'toggle', onLabel: 'SHAKING', offLabel: 'still' },
  body: (s) => (
    <g>
      <rect x={-9} y={-26} width={18} height={48} rx={4} fill="#2B2E31" stroke="#17191B" />
      <path
        d={s?.closed ? 'M0,-20 q7,6 -7,12 q7,6 -7,12 q7,6 0,10' : 'M0,-20 L0,22'}
        stroke="#B9BEC4"
        strokeWidth={2}
        fill="none"
      />
    </g>
  ),
});

export const ReedSwitch = twoLead({
  id: 'reed-switch',
  name: 'Magnetic Reed Switch',
  model: 'reed-switch',
  keywords: ['reed', 'magnetic', 'door', 'window', 'magnet switch'],
  w: 70,
  h: 40,
  control: { kind: 'toggle', onLabel: 'MAGNET', offLabel: 'open' },
  body: (s) => (
    <g>
      <rect x={-26} y={-10} width={52} height={20} rx={10} fill="#DDE6EF" opacity={0.7} stroke="#A9B6C2" />
      <line x1={-24} y1={-3} x2={s?.closed ? 4 : 0} y2={s?.closed ? 0 : -3} stroke="#8E949A" strokeWidth={2.4} />
      <line x1={24} y1={3} x2={s?.closed ? -4 : 0} y2={s?.closed ? 0 : 3} stroke="#8E949A" strokeWidth={2.4} />
    </g>
  ),
});

export const Phototransistor = twoLead({
  id: 'phototransistor',
  name: 'Phototransistor',
  model: 'phototransistor',
  keywords: ['phototransistor', 'light', 'optical', 'ir detector'],
  w: 34,
  h: 46,
  terminals: ['collector', 'emitter'],
  control: {
    kind: 'slider',
    min: 0.05,
    max: 100000,
    log: true,
    color: '#E3B341',
    lowIcon: MoonIcon,
    highIcon: SunIcon,
    label: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} lux`,
  },
  body: () => (
    <g>
      <path d="M-11,-8 A11,11 0 0,1 11,-8 L11,16 L-11,16 Z" fill="#2B2E31" opacity={0.85} />
      <circle cx={0} cy={-8} r={11} fill="#3A3D41" opacity={0.6} />
      <ellipse cx={-3} cy={-11} rx={3.5} ry={2.4} fill="#FFFFFF" opacity={0.35} />
    </g>
  ),
});

export const Photodiode = twoLead({
  id: 'photodiode',
  name: 'Photodiode',
  model: 'photodiode',
  keywords: ['photodiode', 'light', 'optical', 'detector'],
  w: 34,
  h: 46,
  terminals: ['cathode', 'anode'],
  control: {
    kind: 'slider',
    min: 0.05,
    max: 100000,
    log: true,
    color: '#E3B341',
    lowIcon: MoonIcon,
    highIcon: SunIcon,
    label: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} lux`,
  },
  body: () => (
    <g>
      <path d="M-10,-8 A10,10 0 0,1 10,-8 L10,16 L-10,16 Z" fill="#2E3B52" opacity={0.9} />
      <circle cx={0} cy={-8} r={10} fill="#41527A" opacity={0.7} />
      <rect x={5} y={8} width={5} height={8} fill="#D8DCE1" />
    </g>
  ),
});

export const SENSORS: PartDef<never>[] = [
  PirSensor, GasSensor, FlameSensor, SoilMoisture, WaterLevel, SoundSensor,
  HallSensor, IrReceiver, IrProximity, AmbientLight, RtcModule,
  Ultrasonic4, Ultrasonic3,
  FlexSensor, ForceSensor, ForceSensorSquare, Thermistor, TiltSensor, VibrationSensor, ReedSwitch,
  Phototransistor, Photodiode,
] as unknown as PartDef<never>[];
