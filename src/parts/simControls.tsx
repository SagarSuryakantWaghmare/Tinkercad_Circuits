'use client';

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { C } from '@/lib/tokens';
import { beginValueDrag } from './interact';

/**
 * On-part interactive controls.
 *
 * The reference product does not use invisible drag areas for sensors: each one
 * carries a visible slider you grab, and the meter carries its own mode
 * buttons. A control you can see is the difference between a simulation you can
 * explore and one you have to be told about.
 *
 * Everything here is drawn in world units, so it sits in a part's own
 * coordinate space and scales with the canvas.
 */

const TRACK = '#C9CED3';
const TRACK_FILL = C.select;
const THUMB = '#FFFFFF';
const THUMB_EDGE = '#7B8288';

export interface SliderProps {
  /** Centre of the track. */
  x: number;
  y: number;
  width?: number;
  value: number;
  min: number;
  max: number;
  /** Logarithmic travel — right for light level, which spans six decades. */
  log?: boolean;
  /** Text above the track. */
  label?: string;
  /** Accent colour for the filled portion. */
  color?: string;
  /** A small glyph drawn at each end of the track. */
  lowIcon?: ReactNode;
  highIcon?: ReactNode;
  onChange: (value: number) => void;
}

/** Map a value to 0–1 along the track, honouring a log scale. */
function toFraction(v: number, min: number, max: number, log: boolean) {
  if (log) {
    const lo = Math.log10(Math.max(min, 1e-6));
    const hi = Math.log10(Math.max(max, 1e-6));
    const cur = Math.log10(Math.max(v, 1e-6));
    return clamp01((cur - lo) / (hi - lo || 1));
  }
  return clamp01((v - min) / (max - min || 1));
}

function fromFraction(f: number, min: number, max: number, log: boolean) {
  if (log) {
    const lo = Math.log10(Math.max(min, 1e-6));
    const hi = Math.log10(Math.max(max, 1e-6));
    return Math.pow(10, lo + clamp01(f) * (hi - lo));
  }
  return min + clamp01(f) * (max - min);
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function PartSlider({
  x,
  y,
  width = 90,
  value,
  min,
  max,
  log = false,
  label,
  color = TRACK_FILL,
  lowIcon,
  highIcon,
  onChange,
}: SliderProps) {
  const f = toFraction(value, min, max, log);
  const half = width / 2;
  const thumbX = x - half + f * width;

  // Dragging works in track fractions so a log scale feels linear to the hand.
  const drag = (e: ReactPointerEvent) => {
    let current = f;
    beginValueDrag(e, (dx) => {
      current = clamp01(current + dx / width);
      onChange(fromFraction(current, min, max, log));
    });
  };

  return (
    <g>
      {label && (
        <text
          x={x}
          y={y - 13}
          fontSize={8}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={600}
          fill="#4A4F55"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}

      {lowIcon && <g transform={`translate(${x - half - 11},${y})`}>{lowIcon}</g>}
      {highIcon && <g transform={`translate(${x + half + 11},${y})`}>{highIcon}</g>}

      {/* track */}
      <rect x={x - half} y={y - 2.5} width={width} height={5} rx={2.5} fill={TRACK} />
      <rect x={x - half} y={y - 2.5} width={f * width} height={5} rx={2.5} fill={color} />

      {/* thumb */}
      <circle cx={thumbX} cy={y} r={6.5} fill={THUMB} stroke={THUMB_EDGE} strokeWidth={1.4} />
      <circle cx={thumbX} cy={y} r={2.4} fill={color} />

      {/* a generous invisible target so the thumb is easy to grab */}
      <rect
        x={x - half - 8}
        y={y - 11}
        width={width + 16}
        height={22}
        fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={drag}
      />
    </g>
  );
}

/** A push-button on a part's face, as the multimeter's range buttons are. */
export function PartButton({
  x,
  y,
  width = 26,
  height = 16,
  label,
  active,
  onPress,
  activeColor = C.select,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor?: string;
}) {
  return (
    <g style={{ cursor: 'pointer' }} onPointerDown={(e) => (e.stopPropagation(), onPress())}>
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={3}
        fill={active ? activeColor : '#E9ECEF'}
        stroke={active ? activeColor : '#B4BAC0'}
        strokeWidth={1.2}
      />
      <text
        x={x}
        y={y}
        fontSize={Math.min(10, height * 0.62)}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight={700}
        fill={active ? '#FFFFFF' : '#4A4F55'}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/** A toggle you tap, for a sensor that is simply on or off (PIR, hall, reed). */
export function PartToggle({
  x,
  y,
  on,
  onLabel,
  offLabel,
  onToggle,
  width = 74,
}: {
  x: number;
  y: number;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onToggle: () => void;
  width?: number;
}) {
  return (
    <g style={{ cursor: 'pointer' }} onPointerDown={(e) => (e.stopPropagation(), onToggle())}>
      <rect
        x={x - width / 2}
        y={y - 9}
        width={width}
        height={18}
        rx={9}
        fill={on ? '#D6F0C4' : '#E9ECEF'}
        stroke={on ? C.ok : '#B4BAC0'}
        strokeWidth={1.3}
      />
      <circle cx={on ? x + width / 2 - 8 : x - width / 2 + 8} cy={y} r={6.5} fill={on ? C.ok : '#9BA1A8'} />
      <text
        x={on ? x - 6 : x + 6}
        y={y}
        fontSize={8}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight={700}
        fill="#4A4F55"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {on ? onLabel : offLabel}
      </text>
    </g>
  );
}

/**
 * The ultrasonic sensor's target: a band showing the sensor's range with a
 * draggable line at the current distance, which is how the reference product
 * lets you set what the sensor is pointed at.
 */
export function TargetLine({
  x,
  y,
  span,
  distance,
  maxDistance,
  onChange,
}: {
  /** Centre of the sensor face. */
  x: number;
  /** Top of the range band, above the sensor. */
  y: number;
  /** Width of the band. */
  span: number;
  distance: number;
  maxDistance: number;
  onChange: (cm: number) => void;
}) {
  const depth = 150;
  const f = Math.max(0, Math.min(1, distance / maxDistance));
  const lineY = y - f * depth;

  const drag = (e: ReactPointerEvent) => {
    let current = f;
    beginValueDrag(e, (_, dy) => {
      current = Math.max(0, Math.min(1, current - dy / depth));
      onChange(Math.max(2, current * maxDistance));
    });
  };

  return (
    <g>
      {/* range band */}
      <path
        d={`M${x - span * 0.22},${y} L${x - span / 2},${y - depth} L${x + span / 2},${y - depth} L${x + span * 0.22},${y} Z`}
        fill={C.select}
        opacity={0.07}
      />
      {/* the target itself */}
      <line
        x1={x - span * 0.42}
        y1={lineY}
        x2={x + span * 0.42}
        y2={lineY}
        stroke={C.select}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <text
        x={x}
        y={lineY - 10}
        fontSize={10}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight={700}
        fill="#4A4F55"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {`${distance.toFixed(0)} cm`}
      </text>
      <rect
        x={x - span * 0.5}
        y={lineY - 12}
        width={span}
        height={24}
        fill="transparent"
        style={{ cursor: 'ns-resize' }}
        onPointerDown={drag}
      />
    </g>
  );
}

/**
 * PIR sensor's field of view: a detection cone projecting from the sensor lens
 * with a draggable target dot to test motion detection.
 */
export function PirTargetField({
  x = 0,
  y = -8,
  targetX = 0,
  targetY = -80,
  detected = false,
  onChange,
}: {
  x?: number;
  y?: number;
  targetX?: number;
  targetY?: number;
  detected?: boolean;
  onChange: (pos: { x: number; y: number; detected: boolean }) => void;
}) {
  const r = 110;
  const angle = (35 * Math.PI) / 180;
  const x1 = Math.sin(-angle) * r;
  const y1 = -Math.cos(-angle) * r;
  const x2 = Math.sin(angle) * r;
  const y2 = -Math.cos(angle) * r;

  const drag = (e: ReactPointerEvent) => {
    let curX = targetX;
    let curY = targetY;
    beginValueDrag(e, (dx, dy) => {
      curX += dx;
      curY += dy;
      const dist = Math.hypot(curX - x, curY - y);
      const rad = Math.atan2(curX - x, -(curY - y));
      const inCone = dist <= r && dist >= 8 && Math.abs(rad) <= angle;
      onChange({ x: curX, y: curY, detected: inCone });
    });
  };

  return (
    <g>
      {/* Detection field cone */}
      <path
        d={`M${x},${y} L${x + x1},${y + y1} A${r},${r} 0 0,1 ${x + x2},${y + y2} Z`}
        fill={detected ? '#4CAF50' : '#81C784'}
        opacity={detected ? 0.28 : 0.15}
        stroke={detected ? '#2E7D32' : '#66BB6A'}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {/* Dashed line connecting sensor to target */}
      <line
        x1={x}
        y1={y}
        x2={targetX}
        y2={targetY}
        stroke={detected ? '#2E7D32' : '#78909C'}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      {/* Draggable target dot */}
      <circle
        cx={targetX}
        cy={targetY}
        r={7}
        fill={detected ? '#2E7D32' : '#00897B'}
        stroke="#FFFFFF"
        strokeWidth={1.5}
      />
      {/* Large transparent grab handle */}
      <circle
        cx={targetX}
        cy={targetY}
        r={20}
        fill="transparent"
        style={{ cursor: 'grab' }}
        onPointerDown={drag}
      />
    </g>
  );
}

// ── small glyphs used as slider end-caps ─────────────────────────────────────

export const SunIcon = (
  <g stroke="#8A9096" strokeWidth={1.3} fill="none">
    <circle cx={0} cy={0} r={3.4} fill="#E3B341" stroke="none" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <line
        key={a}
        x1={Math.cos((a * Math.PI) / 180) * 5}
        y1={Math.sin((a * Math.PI) / 180) * 5}
        x2={Math.cos((a * Math.PI) / 180) * 7.5}
        y2={Math.sin((a * Math.PI) / 180) * 7.5}
      />
    ))}
  </g>
);

export const MoonIcon = (
  <path d="M2,-6 A6,6 0 1,0 2,6 A7.5,7.5 0 0,1 2,-6 Z" fill="#5A6068" />
);

export const HotIcon = (
  <g>
    <rect x={-1.6} y={-7} width={3.2} height={9} rx={1.6} fill="#C11F1F" />
    <circle cx={0} cy={4} r={3.6} fill="#C11F1F" />
  </g>
);

export const ColdIcon = (
  <g stroke="#2E63B8" strokeWidth={1.4} strokeLinecap="round">
    <line x1={0} y1={-6} x2={0} y2={6} />
    <line x1={-5} y1={-3} x2={5} y2={3} />
    <line x1={-5} y1={3} x2={5} y2={-3} />
  </g>
);

/**
 * A rotary knob, as a bench instrument carries. Dragging left/right turns it
 * through 270 degrees of travel, which is what a real single-turn pot does.
 */
export function PartKnob({
  x,
  y,
  r = 16,
  value,
  min,
  max,
  label,
  onChange,
}: {
  x: number;
  y: number;
  r?: number;
  value: number;
  min: number;
  max: number;
  label?: string;
  onChange: (value: number) => void;
}) {
  const f = clamp01((value - min) / (max - min || 1));
  const angle = -135 + f * 270;

  const drag = (e: ReactPointerEvent) => {
    let current = f;
    beginValueDrag(e, (dx, dy) => {
      // Horizontal turns it up, vertical down — the way a mouse expects.
      current = clamp01(current + (dx - dy) / 200);
      onChange(min + current * (max - min));
    });
  };

  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#8E949A" stroke="#6E7479" strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r - 5} fill="#B9BEC4" />
      <g transform={`rotate(${angle} ${x} ${y})`}>
        <rect x={x - 1.6} y={y - r + 2} width={3.2} height={r * 0.55} rx={1.6} fill="#3A3D41" />
      </g>
      {label && (
        <text
          x={x}
          y={y + r + 8}
          fontSize={6.5}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={600}
          fill="#5A6068"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}
      <circle
        cx={x}
        cy={y}
        r={r + 3}
        fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={drag}
      />
    </g>
  );
}
