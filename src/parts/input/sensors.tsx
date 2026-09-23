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
  PirTargetField,
  SunIcon,
  TargetLine,
} from '../simControls';
import { BoardShadow, Leg, Silk } from '../primitives';

const PCB = '#1E5FA8';
const PCB_EDGE = '#154379';

/**
 * Three-pin breakout module: a small PCB with the sensing element on top and a
 * VCC/GND/OUT header along the bottom edge.
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
  pcbColor?: string;
  pcbEdge?: string;
  silkColor?: string;
  /** Drawn above the header, centred on the origin. */
  element: (state: ArtProps['state']) => ReactNode;
  /**
   * The on-part control shown while the simulation runs.
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
  const pcbFill = opts.pcbColor ?? PCB;
  const pcbBorder = opts.pcbEdge ?? PCB_EDGE;
  const silkFill = opts.silkColor ?? '#BBD0EC';

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
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={pcbFill} stroke={pcbBorder} />
        <circle cx={-w / 2 + 7} cy={-h / 2 + 7} r={3.4} fill="#000000" opacity={0.35} />
        <circle cx={w / 2 - 7} cy={-h / 2 + 7} r={3.4} fill="#000000" opacity={0.35} />
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
              fill={silkFill}
              weight={600}
            >
              {p}
            </Silk>
          </g>
        ))}
        <Silk x={0} y={h / 2 - 24} size={5.5} fill={silkFill} weight={600}>
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

export const PirSensor = definePart({
  id: 'pir-sensor',
  name: 'PIR Sensor',
  category: 'input',
  keywords: ['pir', 'motion', 'passive infrared', 'presence', 'occupancy'],
  basic: true,
  size: { w: 94, h: 120 },
  origin: { x: 47, y: 47 },
  socketable: true,
  rotationStep: 90,
  model: 'pir-sensor',
  terminals: [
    { name: 'VCC', type: 'breadboard_male', x: -10, y: 56, dir: [0, 1], role: 'power' },
    { name: 'OUT', type: 'breadboard_male', x: 0, y: 56, dir: [0, 1], role: 'digital' },
    { name: 'GND', type: 'breadboard_male', x: 10, y: 56, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => (
    <g>
      <BoardShadow w={84} h={84} rx={3} />
      {/* Green square PCB */}
      <rect x={-42} y={-42} width={84} height={84} rx={3} fill="#237A3B" stroke="#155226" strokeWidth={1} />
      {/* Mounting corner holes */}
      <circle cx={-34} cy={-34} r={3} fill="#10381A" />
      <circle cx={34} cy={-34} r={3} fill="#10381A" />
      {/* White Fresnel lens dome */}
      <circle cx={0} cy={-8} r={26} fill="#14171A" opacity={0.15} />
      <circle cx={0} cy={-8} r={24} fill="#F4F6F8" stroke="#CFD5DC" strokeWidth={1.2} />
      <circle cx={0} cy={-8} r={19} fill="none" stroke="#E2E7ED" strokeWidth={1.2} />
      <circle cx={0} cy={-8} r={13} fill="none" stroke="#D5DCE3" strokeWidth={1.2} />
      <circle cx={0} cy={-8} r={6.5} fill="#EAEEF2" stroke="#CAD2DA" strokeWidth={1} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={Math.cos(rad) * 6.5}
            y1={-8 + Math.sin(rad) * 6.5}
            x2={Math.cos(rad) * 23.5}
            y2={-8 + Math.sin(rad) * 23.5}
            stroke="#DCE2E8"
            strokeWidth={1}
          />
        );
      })}
      <ellipse cx={-7} cy={-15} rx={9} ry={5.5} fill="#FFFFFF" opacity={0.65} />
      {state?.value ? <circle cx={0} cy={-8} r={7.5} fill="#E24B3F" opacity={0.85} /> : null}

      {/* Silkscreen text cleanly spaced below dome without overlap */}
      <Silk x={0} y={19} size={5.5} fill="#FFFFFF" weight={700}>
        HC-SR501
      </Silk>
      <Silk x={0} y={27} size={4.8} fill="#FFFFFF" weight={700}>
        VCC OUT GND
      </Silk>

      {/* Bottom 3-pin connector header */}
      <rect x={-15} y={34} width={30} height={10} rx={1} fill="#181A1C" />
      {[-10, 0, 10].map((px) => (
        <rect key={px} x={px - 1.2} y={34} width={2.4} height={22} fill="#D4AF37" />
      ))}

      {simulating && (
        <PirTargetField
          x={0}
          y={-8}
          targetX={Number(state?.targetX ?? 0)}
          targetY={Number(state?.targetY ?? -70)}
          detected={Number(state?.value ?? 0) > 0.5}
          onChange={(pos) => {
            interact?.('target', pos);
            interact?.('set', pos.detected ? 1 : 0);
          }}
        />
      )}
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
  pcbColor: '#C42B2B',
  pcbEdge: '#8E1717',
  silkColor: '#FFCDD2',
  control: {
    kind: 'slider',
    min: 0,
    max: 1000,
    color: '#8A5A2B',
    label: (v) => `${Math.round(v)} ppm`,
  },
  element: () => (
    <g>
      {/* Sensor base rim */}
      <circle cx={0} cy={-6} r={24} fill="#8A9096" stroke="#666C72" strokeWidth={1.2} />
      <circle cx={0} cy={-6} r={22} fill="#C4C9CE" />
      <circle cx={0} cy={-6} r={20} fill="#9FA5AB" />
      {/* Wire mesh pattern */}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={`h-${i}`}
          x1={-Math.sqrt(Math.max(0, 400 - Math.pow(-16 + i * 4, 2)))}
          y1={-6 - 16 + i * 4}
          x2={Math.sqrt(Math.max(0, 400 - Math.pow(-16 + i * 4, 2)))}
          y2={-6 - 16 + i * 4}
          stroke="#5C6268"
          strokeWidth={1.2}
          opacity={0.75}
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={`v-${i}`}
          x1={-16 + i * 4}
          y1={-6 - Math.sqrt(Math.max(0, 400 - Math.pow(-16 + i * 4, 2)))}
          x2={-16 + i * 4}
          y2={-6 + Math.sqrt(Math.max(0, 400 - Math.pow(-16 + i * 4, 2)))}
          stroke="#5C6268"
          strokeWidth={1.2}
          opacity={0.75}
        />
      ))}
      {/* Central cap and outer metal bevel */}
      <circle cx={0} cy={-6} r={20} fill="none" stroke="#D8DCE1" strokeWidth={1.5} opacity={0.6} />
      <circle cx={0} cy={-6} r={7} fill="#8E949A" stroke="#5C6268" strokeWidth={1} />
      <circle cx={0} cy={-6} r={4} fill="#ADB3B8" />
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

export const SoilMoisture = definePart({
  id: 'soil-moisture',
  name: 'Soil Moisture Sensor',
  category: 'input',
  keywords: ['soil', 'moisture', 'hygrometer', 'plant', 'water', 'garden'],
  size: { w: 84, h: 144 },
  origin: { x: 42, y: 72 },
  socketable: true,
  rotationStep: 90,
  model: 'soil-moisture',
  terminals: [
    { name: 'VCC', type: 'breadboard_male', x: -10, y: -54, dir: [0, -1], role: 'power' },
    { name: 'GND', type: 'breadboard_male', x: 0, y: -54, dir: [0, -1], role: 'gnd' },
    { name: 'SIG', type: 'breadboard_male', x: 10, y: -54, dir: [0, -1], role: 'analog' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const wet = Number(state?.value ?? 0) / 100;
    return (
      <g>
        <BoardShadow w={64} h={134} rx={10} />
        {/* Top Red PCB Housing */}
        <path
          d="M-32,-60 L32,-60 A10,10 0 0,1 32,-15 L7,-15 L7,50 L-7,50 L-7,-15 L-32,-15 A10,10 0 0,1 -32,-60 Z"
          fill="#C42020"
          stroke="#8A1414"
          strokeWidth={1}
        />
        {/* Top Mounting Corner Holes */}
        <circle cx={-24} cy={-50} r={5} fill="#FFFFFF" />
        <circle cx={-24} cy={-50} r={3.4} fill="#1E2022" />
        <circle cx={24} cy={-50} r={5} fill="#FFFFFF" />
        <circle cx={24} cy={-50} r={3.4} fill="#1E2022" />

        {/* Top Header Silkscreen Box */}
        <rect x={-18} y={-58} width={36} height={20} rx={1} fill="none" stroke="#FFFFFF" strokeWidth={0.8} />
        <Silk x={-10} y={-54} size={4.2} fill="#FFFFFF" weight={700}>
          VCC
        </Silk>
        <Silk x={0} y={-54} size={4.2} fill="#FFFFFF" weight={700}>
          GND
        </Silk>
        <Silk x={10} y={-54} size={4.2} fill="#FFFFFF" weight={700}>
          SIG
        </Silk>

        {/* Solder eyelet pads */}
        {[-10, 0, 10].map((px) => (
          <circle key={px} cx={px} cy={-46} r={2.8} fill="#DCE0E5" stroke="#9FA5AB" strokeWidth={0.6} />
        ))}
        {[-5, 5].map((px) => (
          <circle key={px} cx={px} cy={-41} r={2.8} fill="#DCE0E5" stroke="#9FA5AB" strokeWidth={0.6} />
        ))}

        {/* SMD Transistor and Components */}
        <rect x={-5} y={-30} width={10} height={6} rx={0.6} fill="#1E2022" />
        <rect x={-11} y={-30} width={3.5} height={6} rx={0.5} fill="#3A3D40" />
        <rect x={7.5} y={-30} width={3.5} height={6} rx={0.5} fill="#3A3D40" />

        {/* Silkscreen Part Title */}
        <Silk x={0} y={-19} size={5.4} fill="#FFFFFF" weight={700}>
          Soil Moisture Sensor
        </Silk>
        {/* Flame Logo Graphic */}
        <path
          d="M22,-34 C20,-30 25,-26 23,-22 C21,-25 19,-26 19,-28 C17,-25 18,-22 22,-20 C25,-22 26,-26 24,-29 Z"
          fill="#FFFFFF"
        />

        {/* Left Probe Prong */}
        <path d="M-30,-15 L-8,-15 L-8,50 L-19,66 L-30,50 Z" fill="#D4AF37" stroke="#B8860B" strokeWidth={0.8} />
        <path d="M-28,-14 L-10,-14 L-10,48 L-19,62 L-28,48 Z" fill="#D0D4D8" />
        {/* Right Probe Prong */}
        <path d="M8,-15 L30,-15 L30,50 L19,66 L8,50 Z" fill="#D4AF37" stroke="#B8860B" strokeWidth={0.8} />
        <path d="M10,-14 L28,-14 L28,48 L19,62 L10,48 Z" fill="#D0D4D8" />

        {/* Grid of via dots along prongs */}
        {[-3, 10, 23, 36, 47, 56].map((y) => (
          <g key={y}>
            <circle cx={-22} cy={y} r={1.1} fill="#A0A6AD" />
            <circle cx={-15} cy={y} r={1.1} fill="#A0A6AD" />
            <circle cx={15} cy={y} r={1.1} fill="#A0A6AD" />
            <circle cx={22} cy={y} r={1.1} fill="#A0A6AD" />
          </g>
        ))}

        {/* Water immersion level overlay */}
        {wet > 0 && (
          <path
            d={`M-30,${66 - 80 * wet} L30,${66 - 80 * wet} L30,50 L19,66 L8,50 L-8,50 L-19,66 L-30,50 Z`}
            fill="#2E8BD6"
            opacity={0.45}
          />
        )}

        {simulating && (
          <PartSlider
            x={0}
            y={-72}
            width={78}
            value={Number(state?.value ?? 0)}
            min={0}
            max={100}
            color="#2E8BD6"
            label={`${Math.round(Number(state?.value ?? 0))}% wet`}
            onChange={(v) => interact?.('set', v)}
          />
        )}
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
        {/* Optical dome housing */}
        <circle cx={0} cy={-4} r={14} fill="#243348" stroke="#121D2C" strokeWidth={1} />
        {/* Clear glass dome with lux brightness glow */}
        <circle cx={0} cy={-4} r={11} fill="#EBF2FA" opacity={0.3 + lit * 0.5} />
        {/* Silicon photodiode IC die */}
        <rect x={-5} y={-9} width={10} height={10} rx={1} fill="#141E2D" stroke="#3A4D68" strokeWidth={0.6} />
        <rect x={-3} y={-7} width={6} height={6} fill="#0F1722" />
        {/* Bond wires and silicon reflection */}
        <line x1={-3} y1={-7} x2={-8} y2={-2} stroke="#D4AF37" strokeWidth={0.7} />
        <line x1={3} y1={-7} x2={8} y2={-2} stroke="#D4AF37" strokeWidth={0.7} />
        <ellipse cx={-4} cy={-8} rx={5} ry={3} fill="#FFFFFF" opacity={0.5} />
      </g>
    );
  },
});

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
  name: 'IR sensor',
  label: 'TSOP',
  model: 'ir-receiver',
  keywords: ['infrared', 'ir', 'remote', 'receiver', 'tsop', '38khz'],
  pins: ['OUT', 'GND', 'VCC'],
  control: { kind: 'toggle', onLabel: 'SIGNAL', offLabel: 'idle' },
  element: (s) => (
    <g>
      {/* Molded epoxy casing */}
      <path
        d="M-13,-16 Q-13,-20 -9,-20 L9,-20 Q13,-20 13,-16 L13,8 L-13,8 Z"
        fill="#1C1E20"
        stroke="#101213"
        strokeWidth={1}
      />
      {/* Convex optical lens dome */}
      <ellipse cx={0} cy={-6} rx={8} ry={9} fill="#2A2D31" stroke="#16181A" strokeWidth={0.8} />
      <ellipse cx={-2.5} cy={-9} rx={4} ry={3.5} fill="#FFFFFF" opacity={0.25} />
      {/* Metallic mesh window / signal glow */}
      {s?.value ? (
        <circle cx={0} cy={-6} r={5} fill="#9A5CFF" opacity={0.85} />
      ) : (
        <circle cx={0} cy={-6} r={3} fill="#181A1C" />
      )}
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
          {/* Blue PCB Base */}
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill="#145A9D" stroke="#0E3F6E" strokeWidth={1} />
          {/* Mounting corner holes */}
          <circle cx={-w / 2 + 8} cy={-h / 2 + 8} r={3.2} fill="#0A2C4D" />
          <circle cx={w / 2 - 8} cy={-h / 2 + 8} r={3.2} fill="#0A2C4D" />

          {/* Dual Silver Transducer Cans (T & R) */}
          {[-32, 32].map((x, idx) => (
            <g key={x}>
              {/* Outer shadow */}
              <circle cx={x} cy={-4} r={25} fill="#0A2C4D" opacity={0.35} />
              {/* Outer aluminum housing */}
              <circle cx={x} cy={-4} r={24.5} fill="#CBD1D6" stroke="#90969C" strokeWidth={1.2} />
              {/* Outer rim bevel */}
              <circle cx={x} cy={-4} r={21} fill="#8A9096" />
              {/* Recessed transducer mesh */}
              <circle cx={x} cy={-4} r={19.5} fill="#5C6268" stroke="#484E54" strokeWidth={0.8} />
              {/* Inner transducer cone */}
              <circle cx={x} cy={-4} r={15} fill="#CBD1D6" stroke="#90969C" strokeWidth={0.8} />
              {/* Center piezoelectric element */}
              <circle cx={x} cy={-4} r={5} fill="#E2E7EC" stroke="#7A8086" strokeWidth={0.8} />
              {/* Dome gloss highlight */}
              <ellipse cx={x - 7} cy={-11} rx={8} ry={5} fill="#FFFFFF" opacity={0.35} />
              {/* Silk label T (Transmitter) and R (Receiver) */}
              <Silk x={x} y={-22} size={6} fill="#EBF2FA" weight={700}>
                {idx === 0 ? 'T' : 'R'}
              </Silk>
            </g>
          ))}

          {/* Crystal Oscillator in center */}
          <rect x={-8} y={-16} width={16} height={6} rx={2} fill="#D4D9DE" stroke="#9AA0A6" strokeWidth={0.8} />
          {/* Center controller IC */}
          <rect x={-11} y={-8} width={22} height={14} rx={1.2} fill="#181A1C" stroke="#0D0F10" />
          <rect x={-9} y={-6} width={18} height={10} rx={0.5} fill="#24272A" />
          <Silk x={0} y={-1} size={4.2} fill="#9BC4E2" weight={700}>
            HC-SR04
          </Silk>

          {/* 4-pin bottom header block */}
          <rect
            x={-((pins.length - 1) * 10) / 2 - 5}
            y={h / 2 - 11}
            width={pins.length * 10}
            height={11}
            rx={1.2}
            fill="#181A1C"
          />
          {/* Individual pin leads and crisp non-overlapping silkscreen text */}
          {pins.map((p, i) => {
            const px = -((pins.length - 1) * 10) / 2 + i * 10;
            return (
              <g key={p}>
                <rect x={px - 1.4} y={h / 2 - 11} width={2.8} height={25} fill={C.solderPad} />
                <Silk x={px} y={h / 2 - 17} size={3.8} fill="#CFE3F8" weight={700}>
                  {p}
                </Silk>
              </g>
            );
          })}

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

export const Ultrasonic3 = definePart({
  id: 'ultrasonic-3pin',
  name: 'Ultrasonic Distance Sensor (3-pin)',
  category: 'input',
  keywords: ['ultrasonic', 'distance', 'ping', 'sonar', '3 pin'],
  size: { w: 140, h: 116 },
  origin: { x: 70, y: 44 },
  socketable: true,
  rotationStep: 90,
  model: 'ultrasonic-3pin',
  terminals: [
    { name: 'SIG', type: 'breadboard_male', x: -10, y: 52, dir: [0, 1], role: 'digital' },
    { name: 'VCC', type: 'breadboard_male', x: 0, y: 52, dir: [0, 1], role: 'power' },
    { name: 'GND', type: 'breadboard_male', x: 10, y: 52, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const cm = Number(state?.distance ?? 100);
    const w = 130;
    const h = 76;
    const pins = [
      { name: 'SIG', x: -10 },
      { name: '5V', x: 0 },
      { name: 'GND', x: 10 },
    ];
    return (
      <g>
        <BoardShadow w={w} h={h} rx={3} />
        {/* PING-style Dark Teal PCB Base */}
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill="#145A68" stroke="#0E3F49" strokeWidth={1} />
        {/* Mounting corner holes */}
        <circle cx={-w / 2 + 8} cy={-h / 2 + 8} r={3.2} fill="#0A2B31" />
        <circle cx={w / 2 - 8} cy={-h / 2 + 8} r={3.2} fill="#0A2B31" />
        {/* Dual Silver Transducer Cans */}
        {[-32, 32].map((x) => (
          <g key={x}>
            {/* Outer shadow */}
            <circle cx={x} cy={-4} r={25} fill="#0A2B31" opacity={0.35} />
            {/* Outer aluminum housing */}
            <circle cx={x} cy={-4} r={24.5} fill="#CBD1D6" stroke="#90969C" strokeWidth={1.2} />
            {/* Outer rim bevel */}
            <circle cx={x} cy={-4} r={21} fill="#8A9096" />
            {/* Recessed transducer mesh */}
            <circle cx={x} cy={-4} r={19.5} fill="#5C6268" stroke="#484E54" strokeWidth={0.8} />
            {/* Inner transducer cone */}
            <circle cx={x} cy={-4} r={15} fill="#CBD1D6" stroke="#90969C" strokeWidth={0.8} />
            {/* Center piezoelectric element */}
            <circle cx={x} cy={-4} r={5} fill="#E2E7EC" stroke="#7A8086" strokeWidth={0.8} />
            {/* Dome gloss highlight */}
            <ellipse cx={x - 7} cy={-11} rx={8} ry={5} fill="#FFFFFF" opacity={0.35} />
          </g>
        ))}
        {/* Center controller IC */}
        <rect x={-9} y={-8} width={18} height={13} rx={1.2} fill="#181A1C" stroke="#0D0F10" />
        <rect x={-7} y={-6} width={14} height={9} rx={0.5} fill="#24272A" />
        {/* 3-pin bottom header */}
        <rect x={-17} y={h / 2 - 11} width={34} height={11} rx={1.2} fill="#181A1C" />
        {pins.map((p) => (
          <g key={p.name}>
            <rect x={p.x - 1.4} y={h / 2 - 11} width={2.8} height={25} fill={C.solderPad} />
            <Silk x={p.x} y={h / 2 - 17} size={4.8} fill="#A7DCD4" weight={700}>
              {p.name}
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

// ─── Discrete two-lead sensors ───────────────────────────────────────────────

function twoLead(opts: {
  id: string;
  name: string;
  model: string;
  keywords: string[];
  w: number;
  h: number;
  legY1?: number;
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
  const legTop = opts.legY1 !== undefined ? opts.legY1 : opts.h / 2 - 6;
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
        <Leg x1={-5} y1={legTop} x2={-5} y2={opts.h / 2 + 10} />
        <Leg x1={5} y1={legTop} x2={5} y2={opts.h / 2 + 10} />
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
      <g>
        {/* Amber polyimide flexible substrate with rounded top */}
        <path
          d={`M-9,-54 Q${18 * bend},0 -9,46 L9,46 Q${18 * bend + 18},0 9,-54 C9,-60 -9,-60 -9,-54 Z`}
          fill="#D47822"
          stroke="#9E5410"
          strokeWidth={1}
        />
        {/* Top return bridge */}
        <path
          d={`M-6,-48 L4,-48 L4,-44 L-6,-44 Z`}
          fill="#1C1E20"
        />
        {/* Right solid conductive return trace */}
        <path
          d={`M4,-48 Q${18 * bend + 13},0 4,38`}
          stroke="#1C1E20"
          strokeWidth={2.4}
          fill="none"
        />
        {/* Left ladder rungs */}
        {Array.from({ length: 26 }, (_, i) => {
          const t = i / 25;
          const y = -46 + t * 82;
          const curX = 18 * bend * (1 - Math.pow(2 * t - 1, 2));
          return (
            <line
              key={i}
              x1={curX - 6.5}
              y1={y}
              x2={curX - 0.5}
              y2={y}
              stroke="#1C1E20"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}
        {/* Left vertical bus rail */}
        <path
          d={`M-6.5,-46 Q${18 * bend + 2.5},0 -6.5,38`}
          stroke="#1C1E20"
          strokeWidth={1.4}
          fill="none"
        />
        {/* Solder crimp tab base */}
        <rect x={-8} y={38} width={16} height={12} rx={1.5} fill="#C4C9CE" stroke="#8E949A" strokeWidth={0.8} />
        <circle cx={-4} cy={44} r={1.5} fill="#5A6066" />
        <circle cx={4} cy={44} r={1.5} fill="#5A6066" />
        {/* Degree angle indicator pill */}
        <rect x={-10} y={30} width={20} height={10} rx={5} fill="#FFFFFF" opacity={0.9} />
        <Silk x={0} y={34} size={5} fill="#242628" weight={700}>
          {`${Math.round(bend * 90)}\u00b0`}
        </Silk>
      </g>
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
        {/* Mint / pale teal flexible tail */}
        <rect x={-7} y={6} width={14} height={28} rx={1} fill="#9ED5CD" stroke="#70A89F" strokeWidth={0.8} />
        <line x1={-3.5} y1={6} x2={-3.5} y2={34} stroke="#687680" strokeWidth={1.2} />
        <line x1={3.5} y1={6} x2={3.5} y2={34} stroke="#687680" strokeWidth={1.2} />
        {/* Solder crimp collar at tail end */}
        <rect x={-7.5} y={30} width={15} height={7} rx={1} fill="#C4C9CE" stroke="#8E949A" strokeWidth={0.6} />
        <circle cx={-3.5} cy={33.5} r={1.2} fill="#5A6066" />
        <circle cx={3.5} cy={33.5} r={1.2} fill="#5A6066" />
        {/* Outer round pad bezel */}
        <circle cx={0} cy={-12} r={24} fill="#2B3035" stroke="#16181B" strokeWidth={1.2} />
        {/* Active sensing area */}
        <circle cx={0} cy={-12} r={20} fill="#828B94" stroke="#5A6168" strokeWidth={0.8} />
        {/* Concentric line texture */}
        {[17, 14, 11, 8, 5, 2].map((r) => (
          <circle key={r} cx={0} cy={-12} r={r} fill="none" stroke="#5A626A" strokeWidth={0.8} />
        ))}
        {/* Pressure deformation indicator */}
        <circle cx={0} cy={-12} r={20 * (1 - f * 0.4)} fill="#454B52" opacity={0.3 + f * 0.7} />
      </g>
    );
  },
});

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
        <rect x={-9} y={14} width={18} height={8} rx={1} fill="#2B2E31" />
        <rect x={-20} y={-24} width={40} height={40} rx={2} fill="#1F2325" stroke="#0F1112" />
        <rect x={-17} y={-21} width={34} height={34} rx={1.5} fill="#2E3336" />
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
  legY1: -4,
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
      {/* Black capsule body */}
      <rect x={-9} y={-24} width={18} height={42} rx={9} fill="#232629" stroke="#121416" strokeWidth={1} />
      <rect x={-7} y={-22} width={5} height={38} rx={2.5} fill="#3E4348" opacity={0.5} />
      {/* Internal rolling ball switch indicator */}
      <circle cx={0} cy={s?.closed ? 10 : -10} r={5} fill="#D8DCE1" stroke="#9AA0A6" strokeWidth={0.8} />
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

export const Photodiode = definePart({
  id: 'photodiode',
  name: 'Photodiode',
  category: 'input',
  keywords: ['photodiode', 'light', 'optical', 'detector'],
  size: { w: 34, h: 56 },
  origin: { x: 17, y: 18 },
  socketable: true,
  model: 'photodiode',
  terminals: [
    { name: 'cathode', type: 'breadboard_male', x: -5, y: 28, dir: [0, 1], role: 'passive' },
    { name: 'anode', type: 'breadboard_male', x: 5, y: 28, dir: [0, 1], role: 'passive' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const lux = Number(state?.value ?? state?.lux ?? 100);
    return (
      <g>
        <Leg x1={-5} y1={8} x2={-5} y2={28} />
        <Leg x1={5} y1={8} x2={5} y2={28} />
        {/* Metal TO-can base and rim */}
        <circle cx={0} cy={-2} r={13.5} fill="#A6ACB2" stroke="#7A8086" strokeWidth={1} />
        <circle cx={0} cy={-2} r={11.5} fill="#C4C9CE" />
        {/* Optical window */}
        <circle cx={0} cy={-2} r={9.5} fill="#141E2E" stroke="#0D1522" strokeWidth={0.8} />
        {/* Active photodiode silicon die */}
        <rect x={-4} y={-6} width={8} height={8} rx={0.8} fill="#243754" stroke="#3D5A85" strokeWidth={0.6} />
        <line x1={-2} y1={-4} x2={-7} y2={-1} stroke="#D4AF37" strokeWidth={0.6} />
        {/* Cathode tab indicator */}
        <rect x={-14} y={-4} width={2.5} height={4} rx={0.5} fill="#7A8086" />
        {/* Glass gloss highlight */}
        <ellipse cx={-3} cy={-5} rx={4} ry={2.5} fill="#FFFFFF" opacity={0.35} />
        {simulating && (
          <PartSlider
            x={0}
            y={-40}
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
  },
});

export const SENSORS: PartDef<never>[] = [
  PirSensor, GasSensor, FlameSensor, SoilMoisture, WaterLevel, SoundSensor,
  HallSensor, IrReceiver, IrProximity, AmbientLight, RtcModule,
  Ultrasonic4, Ultrasonic3,
  FlexSensor, ForceSensor, ForceSensorSquare, Thermistor, TiltSensor, VibrationSensor, ReedSwitch,
  Phototransistor, Photodiode,
] as unknown as PartDef<never>[];
