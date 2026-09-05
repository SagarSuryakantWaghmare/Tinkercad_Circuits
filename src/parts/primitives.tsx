import { C } from '@/lib/tokens';
import type { ReactNode } from 'react';

/** A tinned component lead running from the body out to a terminal point. */
export function Leg({
  x1,
  y1,
  x2,
  y2,
  w = 3,
  color = C.lead,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w?: number;
  color?: string;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
    />
  );
}

/** A bent lead: down from the body, then across, then down to the board. */
export function BentLeg({
  from,
  to,
  w = 3,
  color = C.lead,
}: {
  from: [number, number];
  to: [number, number];
  w?: number;
  color?: string;
}) {
  const midY = (from[1] + to[1]) / 2;
  return (
    <path
      d={`M${from[0]},${from[1]} L${from[0]},${midY} L${to[0]},${midY} L${to[0]},${to[1]}`}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * One breadboard hole: a slightly recessed square bezel with a small dark
 * bore in the middle, which is how the sockets read at working zoom levels.
 */
export function Hole({ x, y, r = 2.4 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <rect x={x - 3.6} y={y - 3.6} width={7.2} height={7.2} rx={1} fill={C.bbRing} />
      <rect
        x={x - 3.6}
        y={y - 3.6}
        width={7.2}
        height={7.2}
        rx={1}
        fill="none"
        stroke={C.bbRing2}
        strokeWidth={0.6}
      />
      <rect x={x - r / 2} y={y - r / 2} width={r} height={r} rx={0.5} fill={C.bbBore} />
    </g>
  );
}

/** A female header socket, as found on a microcontroller board. */
export function SocketPin({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x - 4.6} y={y - 4.6} width={9.2} height={9.2} rx={0.8} fill={C.headerMid} />
      <rect x={x - 2.6} y={y - 2.6} width={5.2} height={5.2} rx={0.6} fill={C.headerHole} />
    </>
  );
}

/** A male header pin. */
export function MalePin({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x - 4.4} y={y - 4.4} width={8.8} height={8.8} rx={0.8} fill={C.headerDark} />
      <rect x={x - 1.4} y={y - 4} width={2.8} height={8} rx={0.6} fill={C.solderPad} />
    </>
  );
}

/** A run of header sockets with a shared black shroud. */
export function HeaderStrip({
  x,
  y,
  count,
  pitch = 10,
  vertical = false,
  male = false,
}: {
  x: number;
  y: number;
  count: number;
  pitch?: number;
  vertical?: boolean;
  male?: boolean;
}) {
  const len = (count - 1) * pitch + 10;
  const Pin = male ? MalePin : SocketPin;
  return (
    <g>
      <rect
        x={vertical ? x - 5 : x - 5}
        y={vertical ? y - 5 : y - 5}
        width={vertical ? 10 : len}
        height={vertical ? len : 10}
        rx={1}
        fill={C.headerDark}
      />
      {Array.from({ length: count }, (_, i) => (
        <Pin
          key={i}
          x={vertical ? x : x + i * pitch}
          y={vertical ? y + i * pitch : y}
        />
      ))}
    </g>
  );
}

/** Silkscreen text in the board's white legend layer. */
export function Silk({
  x,
  y,
  children,
  size = 7,
  anchor = 'middle',
  fill = C.silk,
  rotate,
  weight = 700,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  rotate?: number;
  weight?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      dominantBaseline="central"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {children}
    </text>
  );
}

/** A standard black DIP package with the notch and pin-1 dot. */
export function DipBody({
  w,
  h,
  notch = true,
  pins,
  pinReach = 30,
}: {
  w: number;
  h: number;
  notch?: boolean;
  /** Total pin count; half are drawn along each long edge. */
  pins?: number;
  /** How far the legs run from the centre line, matching the terminals. */
  pinReach?: number;
}) {
  const perSide = pins ? pins / 2 : 0;
  return (
    <g>
      {perSide > 0 &&
        Array.from({ length: perSide }, (_, i) => {
          const x = -((perSide - 1) * 10) / 2 + i * 10;
          return (
            <g key={i}>
              <rect x={x - 1.7} y={h / 2 - 2} width={3.4} height={pinReach - h / 2 + 2} fill={C.metal} />
              <rect
                x={x - 1.7}
                y={-pinReach}
                width={3.4}
                height={pinReach - h / 2 + 2}
                fill={C.metal}
              />
            </g>
          );
        })}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={2}
        fill={C.bodyBlack}
        stroke="#0D0F10"
        strokeWidth={1}
      />
      <rect
        x={-w / 2 + 1.5}
        y={-h / 2 + 1.5}
        width={w - 3}
        height={h - 3}
        rx={1.5}
        fill="none"
        stroke="#34383B"
        strokeWidth={0.8}
      />
      {notch && (
        <path
          d={`M${-w / 2 + 1},-5 A5,5 0 0,0 ${-w / 2 + 1},5 Z`}
          fill="#0A0B0C"
        />
      )}
      <circle cx={-w / 2 + 9} cy={h / 2 - 7} r={2} fill="#0A0B0C" />
    </g>
  );
}

/** Resistor colour-band helper — returns the four band colours for a value. */
const BAND_HEX = [
  '#1A1A1A', // 0 black
  '#8A5A2B', // 1 brown
  '#C11F1F', // 2 red
  '#CC7A00', // 3 orange
  '#E6C619', // 4 yellow
  '#3D9E36', // 5 green
  '#2E63B8', // 6 blue
  '#7B3FB5', // 7 violet
  '#9B9B9B', // 8 grey
  '#F2F2F2', // 9 white
];

export function resistorBands(ohms: number): string[] {
  if (!isFinite(ohms) || ohms <= 0) return ['#1A1A1A', '#1A1A1A', '#1A1A1A', '#C8A24B'];
  let exp = 0;
  let v = ohms;
  while (v >= 100) {
    v /= 10;
    exp++;
  }
  while (v < 10 && v > 0) {
    v *= 10;
    exp--;
  }
  const d1 = Math.floor(v / 10) % 10;
  const d2 = Math.round(v) % 10;
  const mult = Math.max(0, Math.min(9, exp));
  return [BAND_HEX[d1], BAND_HEX[d2], BAND_HEX[mult], '#C8A24B'];
}

/** Soft drop shadow used under boards and breadboards. */
export function BoardShadow({
  w,
  h,
  rx = 4,
}: {
  w: number;
  h: number;
  rx?: number;
}) {
  return (
    <rect
      x={-w / 2 + 1.5}
      y={-h / 2 + 2.5}
      width={w}
      height={h}
      rx={rx}
      fill="rgba(0,0,0,0.13)"
    />
  );
}
