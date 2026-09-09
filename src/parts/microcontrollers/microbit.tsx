import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { beginValueDrag } from '../interact';
import { BoardShadow, HeaderStrip, Silk } from '../primitives';

/**
 * BBC micro:bit v2 form factor.
 *
 * The edge connector's five large pads (0, 1, 2, 3V, GND) are the ones anyone
 * clips to, so those are full-size terminals; the small pads between them are
 * present but quiet so they do not clutter the terminal overlay.
 */

const W = 500;
const H = 400;

const BIG_PADS = [
  { name: '0', x: -180, role: 'analog' as const },
  { name: '1', x: -90, role: 'analog' as const },
  { name: '2', x: 0, role: 'analog' as const },
  { name: '3V', x: 90, role: 'power' as const },
  { name: 'GND', x: 180, role: 'gnd' as const },
];

function buildTerminals(): TerminalDef[] {
  const t: TerminalDef[] = BIG_PADS.map((p) => ({
    name: p.name,
    type: 'wire',
    x: p.x,
    y: H / 2 + 8,
    dir: [0, 1],
    role: p.role,
  }));
  // The 20 small pads of the edge connector.
  const small = ['P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12',
                 'P13', 'P14', 'P15', 'P16', 'P19', 'P20'];
  small.forEach((name, i) => {
    t.push({
      name,
      type: 'wire',
      x: -230 + i * 30,
      y: H / 2 - 6,
      dir: [0, 1],
      quiet: true,
      role: 'digital',
    });
  });
  return t;
}

function MicrobitArt({ state, simulating, interact }: ArtProps) {
  const grid = (state?.grid as number[] | undefined) ?? [];
  const aDown = !!state?.buttonA;
  const bDown = !!state?.buttonB;
  const tiltX = Number(state?.tiltX ?? 0);
  const tiltY = Number(state?.tiltY ?? 0);
  const gesture = String(state?.gesture ?? '');
  const toneHz = Number(state?.toneHz ?? 0);

  return (
    <g>
      <BoardShadow w={W} h={H} rx={16} />
      {/* board outline with the flared edge connector */}
      <path
        d={`M${-W / 2 + 16},${-H / 2}
            L${W / 2 - 16},${-H / 2}
            Q${W / 2},${-H / 2} ${W / 2},${-H / 2 + 16}
            L${W / 2},${H / 2 - 90}
            L${W / 2 - 30},${H / 2 - 60}
            L${W / 2 - 30},${H / 2}
            L${-W / 2 + 30},${H / 2}
            L${-W / 2 + 30},${H / 2 - 60}
            L${-W / 2},${H / 2 - 90}
            L${-W / 2},${-H / 2 + 16}
            Q${-W / 2},${-H / 2} ${-W / 2 + 16},${-H / 2} Z`}
        fill="#1C1C1C"
        stroke="#0C0C0C"
        strokeWidth={2}
      />

      {/* LED matrix */}
      <g transform={`translate(0,${-40})`}>
        {Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 5 }, (_, c) => {
            const v = Math.max(0, Math.min(1, grid[r * 5 + c] ?? 0));
            return (
              <g key={`${r}-${c}`}>
                {v > 0.05 && (
                  <circle cx={-80 + c * 40} cy={-60 + r * 34} r={18} fill="#FF3B3B" opacity={0.28 * v} />
                )}
                <rect
                  x={-86 + c * 40}
                  y={-66 + r * 34}
                  width={12}
                  height={16}
                  rx={2}
                  fill={v > 0.05 ? '#FF3B3B' : '#3A1A1A'}
                  opacity={v > 0.05 ? 0.5 + 0.5 * v : 1}
                />
              </g>
            );
          }),
        )}
      </g>

      {/* buttons A and B */}
      {[
        { x: -190, label: 'A', down: aDown, event: 'buttonA' },
        { x: 190, label: 'B', down: bDown, event: 'buttonB' },
      ].map((b) => (
        <g key={b.label}>
          <rect x={b.x - 26} y={-64} width={52} height={52} rx={4} fill="#2E3133" stroke="#161819" />
          <circle cx={b.x} cy={-38} r={b.down ? 15 : 17} fill={b.down ? '#B7BCC2' : '#EDEFF2'} stroke="#9BA1A8" strokeWidth={1.5} />
          <Silk x={b.x} y={4} size={16} fill="#E8EAEC" weight={800}>
            {b.label}
          </Silk>
          {simulating && (
            <circle
              cx={b.x}
              cy={-38}
              r={22}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                interact?.(b.event, true);
              }}
              onPointerUp={() => interact?.(b.event, false)}
              onPointerLeave={() => interact?.(b.event, false)}
            />
          )}
        </g>
      ))}

      {/* USB and battery connector along the top */}
      <rect x={-42} y={-H / 2 - 6} width={84} height={26} rx={3} fill="#C6CBD1" stroke="#9AA1A8" />
      <rect x={-30} y={-H / 2 + 2} width={60} height={14} rx={2} fill="#5A6169" />
      <rect x={-W / 2 + 40} y={-H / 2 + 6} width={54} height={30} rx={3} fill="#F2F2F2" stroke="#C6CBD1" />
      <Silk x={-W / 2 + 67} y={-H / 2 + 21} size={7} fill="#7B8288" weight={600}>
        BATT
      </Silk>

      {/* reset button */}
      <circle cx={W / 2 - 46} cy={-H / 2 + 22} r={11} fill="#2E3133" />
      <circle cx={W / 2 - 46} cy={-H / 2 + 22} r={7} fill="#C43B3B" />

      {/* edge connector pads */}
      <g>
        {BIG_PADS.map((p) => (
          <g key={p.name}>
            <rect x={p.x - 26} y={H / 2 - 58} width={52} height={58} rx={2} fill={C.solderPad} />
            <circle cx={p.x} cy={H / 2 - 32} r={13} fill="#1C1C1C" />
            <Silk x={p.x} y={H / 2 - 32} size={13} fill={C.solderPad} weight={800}>
              {p.name}
            </Silk>
          </g>
        ))}
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={-234 + i * 30} y={H / 2 - 20} width={8} height={20} fill={C.solderPad} opacity={0.85} />
        ))}
      </g>

      <Silk x={0} y={H / 2 - 74} size={13} fill="#E8EAEC" weight={800}>
        micro:bit
      </Silk>

      {simulating && (
        <>
          <Silk x={0} y={-H / 2 - 20} size={10} fill="#4A4F55" weight={700}>
            {`tilt ${tiltX.toFixed(0)}° / ${tiltY.toFixed(0)}°  ·  ${gesture}${
              toneHz > 0 ? `  ·  ${Math.round(toneHz)} Hz` : ''
            }`}
          </Silk>

          {/* Drag anywhere on the board face to tilt it in both axes. */}
          <rect
            x={-110}
            y={-140}
            width={220}
            height={220}
            fill="transparent"
            style={{ cursor: 'move' }}
            onPointerDown={(e) =>
              beginValueDrag(e, (dx, dy) => {
                interact?.('tilt', dx * 0.6);
                interact?.('tiltY', dy * 0.6);
              })
            }
          />

          {/* Shake, and the v2 logo touch pad. */}
          <g
            transform={`translate(0,${-H / 2 + 62})`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              interact?.('shake');
            }}
          >
            <rect x={-44} y={-13} width={88} height={26} rx={13} fill="#2E3133" stroke="#161819" />
            <Silk x={0} y={0} size={11} fill="#E8EAEC" weight={700}>
              SHAKE
            </Silk>
          </g>
          <g
            transform={`translate(${W / 2 - 120},${-H / 2 + 62})`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              interact?.('logo', true);
            }}
            onPointerUp={() => interact?.('logo', false)}
            onPointerLeave={() => interact?.('logo', false)}
          >
            <circle cx={0} cy={0} r={14} fill="#C43B3B" opacity={0.9} />
            <Silk x={0} y={0} size={9} fill="#FFFFFF" weight={700}>
              LOGO
            </Silk>
          </g>
        </>
      )}
    </g>
  );
}

export const Microbit = definePart({
  id: 'microbit',
  name: 'micro:bit',
  category: 'microcontrollers',
  keywords: ['microbit', 'micro:bit', 'bbc', 'education', 'board', 'nrf52'],
  size: { w: W + 20, h: H + 40 },
  origin: { x: (W + 20) / 2, y: (H + 40) / 2 - 10 },
  substrate: true,
  rotationStep: 90,
  model: 'microbit',
  terminals: buildTerminals(),
  props: [],
  defaults: {},
  Art: MicrobitArt,
});

// ─── Nano-form-factor board ──────────────────────────────────────────────────

const NANO_LEFT = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RESET2', 'GND2', 'VIN'];
const NANO_RIGHT = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RESET', 'D0', 'D1'];

export const NanoBoard = definePart({
  id: 'nano',
  name: 'Nano (ATmega328P)',
  category: 'microcontrollers',
  keywords: ['nano', 'atmega328', 'small board', 'breadboard mcu'],
  size: { w: 190, h: 460 },
  origin: { x: 95, y: 230 },
  substrate: true,
  rotationStep: 90,
  model: 'mcu-atmega328p',
  terminals: [
    ...NANO_LEFT.map((name, i) => ({
      name,
      type: 'breadboard_male' as const,
      x: -70,
      y: -140 + i * 20,
      dir: [-1, 0] as [number, number],
      group: name.startsWith('GND') ? 'gnd' : undefined,
      role: name.startsWith('GND') ? ('gnd' as const) : undefined,
    })),
    ...NANO_RIGHT.map((name, i) => ({
      name,
      type: 'breadboard_male' as const,
      x: 70,
      y: -140 + i * 20,
      dir: [1, 0] as [number, number],
      group: name.startsWith('GND') ? 'gnd' : undefined,
      role: name.startsWith('GND') ? ('gnd' as const) : undefined,
    })),
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps) => (
    <g>
      <BoardShadow w={140} h={430} rx={4} />
      <rect x={-70} y={-215} width={140} height={430} rx={4} fill={C.pcbBlue} stroke={C.pcbBlueDark} />
      <HeaderStrip x={-70} y={-140} count={15} pitch={20} vertical male />
      <HeaderStrip x={70} y={-140} count={15} pitch={20} vertical male />
      <rect x={-42} y={-212} width={84} height={54} rx={3} fill="#C6CBD1" stroke="#9AA1A8" />
      <rect x={-28} y={-200} width={56} height={34} rx={2} fill="#5A6169" />
      <g transform="translate(0,20)">
        <rect x={-46} y={-40} width={92} height={80} rx={2} fill="#1F2123" stroke="#0D0F10" />
        <Silk x={0} y={-4} size={9} fill="#C9CED3" weight={600} rotate={-90}>
          ATMEGA328P
        </Silk>
      </g>
      <circle cx={-40} cy={-120} r={5} fill={Number(state?.led13 ?? 0) > 0.02 ? '#E6C619' : '#6E7C86'} />
      <Silk x={0} y={170} size={11} weight={800} fill="#DCE8F2">
        NANO
      </Silk>
      {NANO_LEFT.map((n, i) => (
        <Silk key={n} x={-52} y={-140 + i * 20} size={6} anchor="start" weight={600}>
          {n === 'RESET2' ? 'RST' : n === 'GND2' ? 'GND' : n}
        </Silk>
      ))}
      {NANO_RIGHT.map((n, i) => (
        <Silk key={n} x={52} y={-140 + i * 20} size={6} anchor="end" weight={600}>
          {n}
        </Silk>
      ))}
    </g>
  ),
});

export const MICROBIT_PARTS: PartDef<never>[] = [Microbit, NanoBoard] as unknown as PartDef<never>[];
