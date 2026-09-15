import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { beginValueDrag } from '../interact';
import { BoardShadow, Leg, Silk } from '../primitives';

// ─── DIP switch ──────────────────────────────────────────────────────────────

interface DipProps extends Record<string, string | number> {
  ways: number;
}

export const DipSwitch = definePart<DipProps>({
  id: 'dip-switch',
  name: 'DIP Switch',
  category: 'input',
  keywords: ['dip', 'switch', 'config', 'bank', 'multi switch'],
  size: { w: 120, h: 74 },
  origin: { x: 60, y: 37 },
  socketable: true,
  model: 'dip-switch',
  terminals: (props) => {
    const n = Math.max(2, Math.min(8, Number(props.ways) || 4));
    const t: TerminalDef[] = [];
    for (let i = 1; i <= n; i++) {
      const x = -((n - 1) * 10) / 2 + (i - 1) * 10;
      t.push({ name: `A${i}`, type: 'breadboard_male', x, y: -25, dir: [0, -1] });
      t.push({ name: `B${i}`, type: 'breadboard_male', x, y: 25, dir: [0, 1] });
    }
    return t;
  },
  props: [
    {
      key: 'ways',
      label: 'Switches',
      kind: 'select',
      options: [2, 4, 6, 8].map((v) => ({ value: String(v), label: `${v}-way` })),
    },
  ],
  defaults: { ways: 4 },
  Art: ({ props, state, simulating, interact }: ArtProps<DipProps>) => {
    const n = Math.max(2, Math.min(8, Number(props.ways) || 4));
    const states = (state?.states as number[] | undefined) ?? [];
    const w = n * 10 + 12;
    return (
      <g>
        <BoardShadow w={w} h={38} rx={2} />
        <rect x={-w / 2} y={-19} width={w} height={38} rx={2} fill="#C11F1F" stroke="#8E1616" />
        {Array.from({ length: n }, (_, i) => {
          const x = -((n - 1) * 10) / 2 + i * 10;
          const on = states[i] === 1;
          return (
            <g key={i}>
              <rect x={x - 3.5} y={-14} width={7} height={28} rx={1} fill="#F2F2F2" />
              <rect x={x - 3} y={on ? -13 : 1} width={6} height={12} rx={1} fill="#2B2E31" />
              <Silk x={x} y={on ? 22 : -22} size={5} fill="#8E1616" weight={700}>
                {i + 1}
              </Silk>
              {simulating && (
                <rect
                  x={x - 5}
                  y={-19}
                  width={10}
                  height={38}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    interact?.('toggle', i + 1);
                  }}
                />
              )}
            </g>
          );
        })}
      </g>
    );
  },
});

// ─── Toggle switch ───────────────────────────────────────────────────────────

export const ToggleSwitch = definePart({
  id: 'toggle-switch',
  name: 'Toggle Switch',
  category: 'input',
  keywords: ['toggle', 'switch', 'spst', 'lever', 'on off'],
  size: { w: 56, h: 84 },
  origin: { x: 28, y: 46 },
  socketable: true,
  model: 'toggle-switch',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 32, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 32, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const on = !!state?.closed;
    return (
      <g>
        <Leg x1={-10} y1={18} x2={-10} y2={32} />
        <Leg x1={10} y1={18} x2={10} y2={32} />
        <rect x={-16} y={-6} width={32} height={26} rx={3} fill="#B9BEC4" stroke="#8E949A" />
        <circle cx={0} cy={-4} r={9} fill="#8E949A" />
        <g transform={`rotate(${on ? -22 : 22} 0 -4)`}>
          <rect x={-3.5} y={-32} width={7} height={30} rx={3.5} fill="#D8DCE1" stroke="#9AA0A6" />
          <circle cx={0} cy={-32} r={4.5} fill="#E8EAEC" />
        </g>
        {simulating && (
          <rect
            x={-18}
            y={-38}
            width={36}
            height={58}
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
  },
});

// ─── Slide potentiometer ─────────────────────────────────────────────────────

interface PotProps extends Record<string, string | number> {
  resistance: number;
}

export const SlidePot = definePart<PotProps>({
  id: 'slide-pot',
  name: 'Slide Potentiometer',
  category: 'input',
  keywords: ['slider', 'fader', 'potentiometer', 'linear', 'slide'],
  size: { w: 180, h: 74 },
  origin: { x: 90, y: 32 },
  socketable: true,
  model: 'slide-pot',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -70, y: 30, dir: [0, 1] },
    { name: 'wiper', type: 'breadboard_male', x: 0, y: 30, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 70, y: 30, dir: [0, 1] },
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
    const f = Math.max(0, Math.min(1, Number(state?.wiper ?? 0.5)));
    const x = -60 + f * 120;
    return (
      <g>
        <BoardShadow w={166} h={38} rx={3} />
        <rect x={-83} y={-19} width={166} height={38} rx={3} fill="#2B2E31" stroke="#17191B" />
        <rect x={-64} y={-3} width={128} height={6} rx={3} fill="#15171A" />
        <rect x={x - 9} y={-16} width={18} height={32} rx={2.5} fill="#D8DCE1" stroke="#9AA0A6" />
        <rect x={x - 1} y={-14} width={2} height={28} fill="#8E949A" />
        {simulating && (
          <rect
            x={-83}
            y={-19}
            width={166}
            height={38}
            fill="transparent"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => beginValueDrag(e, (dx) => interact?.('delta', dx * 0.006))}
          />
        )}
      </g>
    );
  },
});

// ─── Rotary encoder ──────────────────────────────────────────────────────────

export const RotaryEncoder = definePart({
  id: 'rotary-encoder',
  name: 'Rotary Encoder',
  category: 'input',
  keywords: ['encoder', 'rotary', 'quadrature', 'knob', 'dial', 'ky-040'],
  size: { w: 96, h: 106 },
  origin: { x: 48, y: 48 },
  socketable: true,
  model: 'rotary-encoder',
  terminals: [
    { name: 'A', type: 'breadboard_male', x: -20, y: 44, dir: [0, 1] },
    { name: 'C', type: 'breadboard_male', x: -10, y: 44, dir: [0, 1], role: 'gnd' },
    { name: 'B', type: 'breadboard_male', x: 0, y: 44, dir: [0, 1] },
    { name: 'SW1', type: 'breadboard_male', x: 10, y: 44, dir: [0, 1] },
    { name: 'SW2', type: 'breadboard_male', x: 20, y: 44, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const pos = Number(state?.position ?? 0);
    const pressed = !!state?.pressed;
    return (
      <g>
        <rect x={-30} y={-14} width={60} height={44} rx={2} fill="#B9BEC4" stroke="#8E949A" />
        <circle cx={0} cy={-6} r={22} fill="#31363B" stroke="#1F2325" />
        <circle cx={0} cy={-6} r={18} fill={pressed ? '#43494F' : '#3A4046'} />
        {Array.from({ length: 20 }, (_, i) => (
          <line
            key={i}
            x1={Math.cos((i / 20) * Math.PI * 2 + pos * 0.3) * 15}
            y1={-6 + Math.sin((i / 20) * Math.PI * 2 + pos * 0.3) * 15}
            x2={Math.cos((i / 20) * Math.PI * 2 + pos * 0.3) * 19}
            y2={-6 + Math.sin((i / 20) * Math.PI * 2 + pos * 0.3) * 19}
            stroke="#5A6066"
            strokeWidth={1.6}
          />
        ))}
        <g transform={`rotate(${pos * 18} 0 -6)`}>
          <rect x={-1.6} y={-24} width={3.2} height={10} rx={1.4} fill="#D8DCE1" />
        </g>
        {simulating && (
          <>
            <Silk x={0} y={-36} size={7.5} fill="#4A4F55" weight={600}>
              {`pos ${pos}`}
            </Silk>
            <circle
              cx={0}
              cy={-6}
              r={22}
              fill="transparent"
              style={{ cursor: 'ew-resize' }}
              onPointerDown={(e) => {
                let acc = 0;
                beginValueDrag(e, (dx) => {
                  acc += dx;
                  while (Math.abs(acc) >= 8) {
                    interact?.('delta', Math.sign(acc));
                    acc -= Math.sign(acc) * 8;
                  }
                });
              }}
              onDoubleClick={() => interact?.('press', true)}
            />
          </>
        )}
      </g>
    );
  },
});

// ─── Keypad ──────────────────────────────────────────────────────────────────

const KEYS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];

export const Keypad = definePart({
  id: 'keypad-4x4',
  name: 'Keypad 4 × 4',
  category: 'input',
  keywords: ['keypad', 'matrix', '4x4', 'keys', 'buttons', 'entry'],
  size: { w: 200, h: 230 },
  origin: { x: 100, y: 100 },
  socketable: true,
  rotationStep: 90,
  model: 'keypad-4x4',
  terminals: [
    ...Array.from({ length: 4 }, (_, i) => ({
      name: `ROW${i + 1}`,
      type: 'breadboard_male' as const,
      x: -35 + i * 10,
      y: 100,
      dir: [0, 1] as [number, number],
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      name: `COL${i + 1}`,
      type: 'breadboard_male' as const,
      x: 5 + i * 10,
      y: 100,
      dir: [0, 1] as [number, number],
    })),
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const active = Number(state?.key ?? -1);
    return (
      <g>
        <BoardShadow w={186} h={186} rx={4} />
        <rect x={-93} y={-93} width={186} height={186} rx={4} fill="#2B2E31" stroke="#17191B" />
        {KEYS.map((k, i) => {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const x = -69 + c * 46;
          const y = -69 + r * 46;
          const on = active === i;
          return (
            <g key={k}>
              <rect
                x={x - 19}
                y={y - 19}
                width={38}
                height={38}
                rx={4}
                fill={on ? '#8E949A' : '#4A4F55'}
                stroke="#1F2325"
              />
              <Silk x={x} y={y} size={16} fill="#E8EAEC" weight={700}>
                {k}
              </Silk>
              {simulating && (
                <rect
                  x={x - 19}
                  y={y - 19}
                  width={38}
                  height={38}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    interact?.('press', i);
                  }}
                  onPointerUp={() => interact?.('release')}
                  onPointerLeave={() => interact?.('release')}
                />
              )}
            </g>
          );
        })}
      </g>
    );
  },
});

// ─── Joystick ────────────────────────────────────────────────────────────────

export const Joystick = definePart({
  id: 'joystick',
  name: 'Joystick',
  category: 'input',
  keywords: ['joystick', 'thumbstick', 'analog stick', 'xy', 'controller'],
  size: { w: 170, h: 200 },
  origin: { x: 85, y: 86 },
  socketable: true,
  rotationStep: 90,
  model: 'joystick',
  terminals: ['GND', 'VCC', 'VRx', 'VRy', 'SW'].map((name, i) => ({
    name,
    type: 'breadboard_male' as const,
    x: -20 + i * 10,
    y: 90,
    dir: [0, 1] as [number, number],
    role: name === 'VCC' ? ('power' as const) : name === 'GND' ? ('gnd' as const) : ('analog' as const),
  })),
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const x = Number(state?.x ?? 0.5);
    const y = Number(state?.y ?? 0.5);
    const pressed = !!state?.pressed;
    const cx = (x - 0.5) * 46;
    const cy = (y - 0.5) * 46;
    return (
      <g>
        <BoardShadow w={150} h={150} rx={4} />
        <rect x={-75} y={-75} width={150} height={150} rx={4} fill="#1E5FA8" stroke="#154379" />
        <rect x={-56} y={-56} width={112} height={112} rx={4} fill="#2B2E31" stroke="#17191B" />
        <circle cx={0} cy={0} r={44} fill="#3A3D41" />
        <circle cx={cx} cy={cy} r={30} fill={pressed ? '#1F2123' : '#31363B'} stroke="#15171A" />
        <circle cx={cx} cy={cy} r={22} fill="#43494F" />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1={cx + Math.cos((i / 12) * Math.PI * 2) * 22}
            y1={cy + Math.sin((i / 12) * Math.PI * 2) * 22}
            x2={cx + Math.cos((i / 12) * Math.PI * 2) * 29}
            y2={cy + Math.sin((i / 12) * Math.PI * 2) * 29}
            stroke="#2B3036"
            strokeWidth={2}
          />
        ))}
        {simulating && (
          <>
            <Silk x={0} y={-64} size={7.5} fill="#DCE8F5" weight={600}>
              {`X ${Math.round(x * 1023)} · Y ${Math.round(y * 1023)}`}
            </Silk>
            <rect
              x={-56}
              y={-56}
              width={112}
              height={112}
              fill="transparent"
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => {
                let px = x;
                let py = y;
                beginValueDrag(
                  e,
                  (dx, dy) => {
                    px = Math.max(0, Math.min(1, px + dx * 0.006));
                    py = Math.max(0, Math.min(1, py + dy * 0.006));
                    interact?.('x', px);
                    interact?.('y', py);
                  },
                  () => interact?.('release'),
                );
              }}
              onDoubleClick={() => interact?.('press', true)}
            />
          </>
        )}
      </g>
    );
  },
});

// ─── Limit switch ────────────────────────────────────────────────────────────

export const LimitSwitch = definePart({
  id: 'limit-switch',
  name: 'Limit Switch',
  category: 'input',
  keywords: ['limit', 'microswitch', 'endstop', 'lever', 'mechanical'],
  size: { w: 120, h: 84 },
  origin: { x: 60, y: 42 },
  socketable: true,
  model: 'limit-switch',
  terminals: [
    { name: 'COM', type: 'breadboard_male', x: -20, y: 34, dir: [0, 1] },
    { name: 'NO', type: 'breadboard_male', x: 0, y: 34, dir: [0, 1] },
    { name: 'NC', type: 'breadboard_male', x: 20, y: 34, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const on = !!state?.closed;
    return (
      <g>
        <rect x={-38} y={-12} width={76} height={44} rx={2} fill="#2B2E31" stroke="#17191B" />
        <g transform={`rotate(${on ? 8 : -14} -34 -8)`}>
          <rect x={-36} y={-11} width={72} height={5} rx={2.5} fill="#B9BEC4" />
          <circle cx={36} cy={-8.5} r={5} fill="#D8DCE1" />
        </g>
        <circle cx={-34} cy={-8} r={3} fill="#8E949A" />
        <Silk x={0} y={12} size={6} fill="#8E949A" weight={600}>
          {on ? 'PRESSED' : 'OPEN'}
        </Silk>
        {simulating && (
          <rect
            x={-40}
            y={-26}
            width={82}
            height={58}
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
  },
});

// ─── Pushbutton, 12 mm ───────────────────────────────────────────────────────

export const Pushbutton12 = definePart({
  id: 'pushbutton-12mm',
  name: 'Pushbutton (12mm)',
  category: 'input',
  keywords: ['button', 'large', '12mm', 'momentary', 'arcade'],
  size: { w: 70, h: 82 },
  origin: { x: 35, y: 41 },
  socketable: true,
  model: 'pushbutton',
  terminals: [
    { name: '1a', type: 'breadboard_male', x: -25, y: -25, dir: [0, -1], group: 'L' },
    { name: '2a', type: 'breadboard_male', x: 25, y: -25, dir: [0, -1], group: 'R' },
    { name: '1b', type: 'breadboard_male', x: -25, y: 25, dir: [0, 1], group: 'L' },
    { name: '2b', type: 'breadboard_male', x: 25, y: 25, dir: [0, 1], group: 'R' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const pressed = !!state?.pressed;
    return (
      <g>
        {[[-25, -25], [25, -25], [-25, 25], [25, 25]].map(([x, y]) => (
          <path
            key={`${x},${y}`}
            d={`M${x},${y > 0 ? 16 : -16} L${x},${y}`}
            stroke={C.lead}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
        <rect x={-24} y={-20} width={48} height={40} rx={3} fill="#2E3133" stroke="#1A1C1D" />
        <circle cx={0} cy={0} r={15} fill="#D9DCE0" stroke="#A9AEB4" />
        <circle cx={0} cy={0} r={pressed ? 11.5 : 13} fill={pressed ? '#B7BCC2' : '#EDEFF2'} />
        {simulating && (
          <circle
            cx={0}
            cy={0}
            r={16}
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
  },
});

// Tinkercad ships fixed-width DIP switch variants alongside the generic bank.
// The generic DipSwitch already handles 2/4/6/8 ways via a prop; these
// presets show up in the palette directly so a student searching for "DIP
// switch SPST 4" finds it without having to place the generic and change a
// setting.
function DipSwitchPreset(id: string, name: string, ways: number) {
  return definePart<DipProps>({
    ...DipSwitch,
    id,
    name,
    defaults: { ways },
  });
}

export const DipSwitchSpst4 = DipSwitchPreset(
  'dip-switch-spst-4',
  'DIP Switch SPST × 4',
  4,
);
export const DipSwitchSpst6 = DipSwitchPreset(
  'dip-switch-spst-6',
  'DIP Switch SPST × 6',
  6,
);

// Double-pole DIP switch: each actuator bridges two independent pole pairs
// so it can drive two circuits from one flip. Tinkercad ships this as a
// distinct part alongside the SPST bank. Behaviour reuses the dip-switch
// device with paired terminal groups A1/A1b + B1/B1b per position.
export const DipSwitchDpst = definePart<DipProps>({
  id: 'dip-switch-dpst',
  name: 'DIP Switch DPST',
  category: 'input',
  keywords: ['dip', 'switch', 'dpst', 'double pole', 'bank'],
  size: { w: 160, h: 92 },
  origin: { x: 80, y: 46 },
  socketable: true,
  model: 'dip-switch-dpst',
  terminals: (props) => {
    const n = Math.max(2, Math.min(8, Number(props.ways) || 4));
    const t: TerminalDef[] = [];
    for (let i = 1; i <= n; i++) {
      const x = -((n - 1) * 10) / 2 + (i - 1) * 10;
      // Pole A along the top, pole B along the bottom. Same actuator name
      // groups both pairs so the sim toggles them together.
      t.push({ name: `A${i}`, type: 'breadboard_male', x, y: -35, dir: [0, -1] });
      t.push({ name: `A${i}b`, type: 'breadboard_male', x, y: -15, dir: [0, -1] });
      t.push({ name: `B${i}`, type: 'breadboard_male', x, y: 15, dir: [0, 1] });
      t.push({ name: `B${i}b`, type: 'breadboard_male', x, y: 35, dir: [0, 1] });
    }
    return t;
  },
  props: [
    {
      key: 'ways',
      label: 'Switches',
      kind: 'select',
      options: [2, 4, 6].map((v) => ({ value: String(v), label: `${v}-way` })),
    },
  ],
  defaults: { ways: 4 },
  Art: ({ props, state, simulating, interact }: ArtProps<DipProps>) => {
    const n = Math.max(2, Math.min(8, Number(props.ways) || 4));
    const states = (state?.states as number[] | undefined) ?? [];
    const w = n * 10 + 12;
    return (
      <g>
        <BoardShadow w={w} h={64} rx={2} />
        <rect x={-w / 2} y={-32} width={w} height={64} rx={2} fill="#C11F1F" stroke="#8E1616" />
        {Array.from({ length: n }, (_, i) => {
          const x = -((n - 1) * 10) / 2 + i * 10;
          const on = states[i] === 1;
          return (
            <g key={i}>
              <rect x={x - 3.5} y={-27} width={7} height={54} rx={1} fill="#F2F2F2" />
              <rect x={x - 3} y={on ? -26 : 2} width={6} height={24} rx={1} fill="#2B2E31" />
              <Silk x={x} y={on ? 40 : -40} size={5} fill="#8E1616" weight={700}>
                {i + 1}
              </Silk>
              {simulating && (
                <rect
                  x={x - 5}
                  y={-32}
                  width={10}
                  height={64}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    interact?.('toggle', i + 1);
                  }}
                />
              )}
            </g>
          );
        })}
      </g>
    );
  },
});

export const CONTROLS: PartDef<never>[] = [
  DipSwitch,
  DipSwitchSpst4,
  DipSwitchSpst6,
  DipSwitchDpst,
  ToggleSwitch,
  SlidePot,
  RotaryEncoder,
  Keypad,
  Joystick,
  LimitSwitch,
  Pushbutton12,
] as unknown as PartDef<never>[];
