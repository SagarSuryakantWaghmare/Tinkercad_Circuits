import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { beginValueDrag } from '../interact';
import { BoardShadow, HeaderStrip, Leg, Silk } from '../primitives';

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
    const w = n * 10 + 16;
    const bodyColor = '#C11F1F';
    const borderColor = '#8E1616';
    return (
      <g>
        <BoardShadow w={w} h={40} rx={2.5} />
        {/* Main DIP housing */}
        <rect x={-w / 2} y={-20} width={w} height={40} rx={2.5} fill={bodyColor} stroke={borderColor} strokeWidth={1} />
        {/* Top ON indicator */}
        <Silk x={-w / 2 + 6} y={-14} size={4.5} fill="#FFFFFF" weight={800}>
          ON
        </Silk>
        <path d={`M${-w / 2 + 10},-12 L${-w / 2 + 10},-16 L${-w / 2 + 8},-14 Z`} fill="#FFFFFF" />
        {Array.from({ length: n }, (_, i) => {
          const x = -((n - 1) * 10) / 2 + i * 10;
          const on = states[i] === 1;
          return (
            <g key={i}>
              {/* Recessed slider well */}
              <rect x={x - 3.5} y={-15} width={7} height={30} rx={1} fill="#181A1C" />
              {/* White slider actuator */}
              <rect
                x={x - 3}
                y={on ? -14 : 1}
                width={6}
                height={13}
                rx={1}
                fill="#FFFFFF"
                stroke="#D0D5DA"
                strokeWidth={0.5}
              />
              {/* Actuator grip ridges */}
              <line x1={x - 2} y1={on ? -8 : 7} x2={x + 2} y2={on ? -8 : 7} stroke="#9AA0A6" strokeWidth={0.8} />
              {/* Switch channel number */}
              <Silk x={x} y={17} size={4.8} fill="#FFFFFF" weight={700}>
                {i + 1}
              </Silk>
              {simulating && (
                <rect
                  x={x - 5}
                  y={-20}
                  width={10}
                  height={40}
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
  basic: true,
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
  name: 'Keypad 4x4',
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
        <BoardShadow w={186} h={186} rx={6} />
        {/* Main keypad membrane base */}
        <rect x={-93} y={-93} width={186} height={186} rx={6} fill="#1E2124" stroke="#101214" strokeWidth={1.5} />
        {/* Yellow graphic border outline */}
        <rect x={-88} y={-88} width={176} height={176} rx={4} fill="none" stroke="#D4AF37" strokeWidth={1} opacity={0.65} />
        {KEYS.map((k, i) => {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const x = -69 + c * 46;
          const y = -69 + r * 46;
          const on = active === i;
          const isAlphaOrSymbol = ['A', 'B', 'C', 'D', '*', '#'].includes(k);
          const textColor = isAlphaOrSymbol ? '#EF4444' : '#FFFFFF';
          return (
            <g key={k}>
              {/* Blue key cap */}
              <rect
                x={x - 18}
                y={y - 18}
                width={36}
                height={36}
                rx={5}
                fill={on ? '#3B82F6' : '#1D5A9E'}
                stroke={on ? '#60A5FA' : '#123A68'}
                strokeWidth={1.2}
              />
              {/* Key bevel highlight */}
              <rect
                x={x - 16}
                y={y - 16}
                width={32}
                height={16}
                rx={3}
                fill="#FFFFFF"
                opacity={on ? 0.2 : 0.1}
              />
              <Silk x={x} y={y + 1} size={15} fill={textColor} weight={800}>
                {k}
              </Silk>
              {simulating && (
                <rect
                  x={x - 18}
                  y={y - 18}
                  width={36}
                  height={36}
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
        {/* Ribbon cable leading to header pins */}
        <path d="M-42,93 L-42,98 L-38,100 L38,100 L42,98 L42,93 Z" fill="#2E3338" />
        {Array.from({ length: 8 }, (_, i) => {
          const px = -35 + i * 10;
          return <line key={i} x1={px} y1={93} x2={px} y2={100} stroke="#D4AF37" strokeWidth={1} />;
        })}
        <rect x={-42} y={97} width={84} height={3} fill="#181A1C" />
        <HeaderStrip x={-35} y={100} count={8} male />
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
        <rect x={-27} y={75} width={54} height={10} fill="#1E5FA8" stroke="#154379" strokeWidth={0.5} />
        <HeaderStrip x={-20} y={90} count={5} male />
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
        <Leg x1={-20} y1={28} x2={-20} y2={34} />
        <Leg x1={0} y1={28} x2={0} y2={34} />
        <Leg x1={20} y1={28} x2={20} y2={34} />
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

// Miniature SPDT slide switch: taller and thinner than the standard slide
// switch, matching the small PCB-mount part Tinkercad ships. Same three-way
// electrical model (position 0 / OFF / 2) as the full-size slideswitch.
export const SlideSwitchMini = definePart({
  id: 'slide-switch-mini',
  name: 'Slide Switch (Mini SPDT)',
  category: 'input',
  keywords: ['slide', 'switch', 'spdt', 'mini', 'small', 'selector'],
  size: { w: 26, h: 60 },
  origin: { x: 13, y: 26 },
  socketable: true,
  model: 'slideswitch',
  terminals: [
    { name: '1', type: 'breadboard_male', x: -8, y: 26, dir: [0, 1] },
    { name: 'common', type: 'breadboard_male', x: 0, y: 26, dir: [0, 1] },
    { name: '2', type: 'breadboard_male', x: 8, y: 26, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const pos = Math.max(0, Math.min(2, Number(state?.position ?? 0)));
    const knobY = pos === 0 ? -9 : pos === 2 ? 7 : -1;
    const label = pos === 0 ? '1' : pos === 2 ? '2' : 'OFF';
    return (
      <g>
        {[-8, 0, 8].map((x) => (
          <Leg key={x} x1={x} y1={16} x2={x} y2={26} />
        ))}
        <rect x={-10} y={-22} width={20} height={40} rx={2} fill="#B9BEC4" stroke="#8E949A" />
        <rect x={-6} y={-18} width={12} height={32} rx={1.5} fill="#2B2E30" />
        <rect
          x={-5}
          y={knobY}
          width={10}
          height={8}
          rx={1.2}
          fill={pos === 1 ? '#F5D033' : '#E8EAEC'}
          stroke="#A6ACB2"
          strokeWidth={0.6}
        />
        <Silk x={0} y={-26} size={4.2} fill="#5A6068" weight={700}>
          {label}
        </Silk>
        {simulating && (
          <rect
            x={-11}
            y={-24}
            width={22}
            height={46}
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
  'DIP Switch SPST x 4',
  4,
);
export const DipSwitchSpst6 = DipSwitchPreset(
  'dip-switch-spst-6',
  'DIP Switch SPST x 6',
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
    const w = n * 10 + 16;
    return (
      <g>
        <BoardShadow w={w} h={64} rx={2.5} />
        {/* Main Red DPST DIP housing */}
        <rect x={-w / 2} y={-32} width={w} height={64} rx={2.5} fill="#C11F1F" stroke="#8E1616" strokeWidth={1} />
        {/* Top ON indicator */}
        <Silk x={-w / 2 + 6} y={-25} size={4.5} fill="#FFFFFF" weight={800}>
          ON
        </Silk>
        <path d={`M${-w / 2 + 10},-23 L${-w / 2 + 10},-27 L${-w / 2 + 8},-25 Z`} fill="#FFFFFF" />
        {Array.from({ length: n }, (_, i) => {
          const x = -((n - 1) * 10) / 2 + i * 10;
          const on = states[i] === 1;
          return (
            <g key={i}>
              {/* Recessed dual-pole slider track */}
              <rect x={x - 3.5} y={-26} width={7} height={52} rx={1} fill="#181A1C" />
              {/* White dual-pole slider actuator */}
              <rect
                x={x - 3}
                y={on ? -25 : 1}
                width={6}
                height={24}
                rx={1}
                fill="#FFFFFF"
                stroke="#D0D5DA"
                strokeWidth={0.5}
              />
              {/* Actuator grip ridges */}
              <line x1={x - 2} y1={on ? -13 : 13} x2={x + 2} y2={on ? -13 : 13} stroke="#9AA0A6" strokeWidth={0.8} />
              {/* Switch channel number */}
              <Silk x={x} y={28} size={4.8} fill="#FFFFFF" weight={700}>
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

// ─── Pushbutton, 30 mm dome ──────────────────────────────────────────────────

export const Pushbutton30 = definePart({
  id: 'pushbutton-30mm',
  name: 'Pushbutton (30mm)',
  category: 'input',
  keywords: ['button', 'arcade', 'dome', '30mm', 'large', 'momentary'],
  size: { w: 96, h: 108 },
  origin: { x: 48, y: 54 },
  socketable: true,
  model: 'pushbutton',
  terminals: [
    { name: '1a', type: 'breadboard_male', x: -34, y: -36, dir: [0, -1], group: 'L' },
    { name: '2a', type: 'breadboard_male', x: 34, y: -36, dir: [0, -1], group: 'R' },
    { name: '1b', type: 'breadboard_male', x: -34, y: 36, dir: [0, 1], group: 'L' },
    { name: '2b', type: 'breadboard_male', x: 34, y: 36, dir: [0, 1], group: 'R' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const pressed = !!state?.pressed;
    return (
      <g>
        {[[-34, -36], [34, -36], [-34, 36], [34, 36]].map(([x, y]) => (
          <path
            key={`${x},${y}`}
            d={`M${x},${y > 0 ? 22 : -22} L${x},${y}`}
            stroke={C.lead}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        ))}
        <rect x={-32} y={-24} width={64} height={48} rx={4} fill="#2E3133" stroke="#1A1C1D" />
        {/* skirt around the dome */}
        <circle cx={0} cy={0} r={26} fill="#3B3F42" stroke="#1A1C1D" strokeWidth={0.8} />
        <circle cx={0} cy={0} r={22} fill="#C11F1F" stroke="#8E1616" strokeWidth={1} />
        {/* dome with a soft highlight */}
        <circle cx={0} cy={0} r={pressed ? 18 : 20} fill={pressed ? '#8E1616' : '#E24B3F'} stroke="#5A0F0F" strokeWidth={0.8} />
        <ellipse cx={-6} cy={-6} rx={9} ry={5} fill="#F2938C" opacity={0.55} />
        {simulating && (
          <circle
            cx={0}
            cy={0}
            r={24}
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

// ─── Rocker switch (SPST) ────────────────────────────────────────────────────

export const RockerSwitch = definePart({
  id: 'rocker-switch',
  name: 'Rocker Switch',
  category: 'input',
  keywords: ['rocker', 'switch', 'spst', 'mains', 'appliance', 'on off'],
  size: { w: 80, h: 74 },
  origin: { x: 40, y: 36 },
  socketable: true,
  model: 'toggle-switch',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -14, y: 30, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 14, y: 30, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const on = !!state?.closed;
    return (
      <g>
        {/* mounting bezel */}
        <rect x={-30} y={-22} width={60} height={44} rx={3} fill="#2E3133" stroke="#0E1011" strokeWidth={1.2} />
        <rect x={-27} y={-19} width={54} height={38} rx={2} fill="#1A1C1D" />
        {/* two-tone rocker: red half glows when on, black half sits raised when off */}
        <path
          d="M-24,-16 L2,-16 L4,0 L2,16 L-24,16 Z"
          fill={on ? '#E24B3F' : '#8E1616'}
          stroke="#0E1011"
          strokeWidth={0.8}
        />
        <path
          d="M24,-16 L-2,-16 L-4,0 L-2,16 L24,16 Z"
          fill={on ? '#1F2123' : '#3B3F42'}
          stroke="#0E1011"
          strokeWidth={0.8}
        />
        <Silk x={-14} y={0} size={9} fill="#F2E9C6" weight={800}>
          I
        </Silk>
        <Silk x={14} y={0} size={9} fill="#C9CED3" weight={800}>
          O
        </Silk>
        <Leg x1={-14} y1={20} x2={-14} y2={30} />
        <Leg x1={14} y1={20} x2={14} y2={30} />
        {simulating && (
          <rect
            x={-30}
            y={-22}
            width={60}
            height={44}
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
  Pushbutton30,
  RockerSwitch,
  SlideSwitchMini,
] as unknown as PartDef<never>[];
