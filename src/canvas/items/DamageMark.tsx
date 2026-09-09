'use client';

import type { DamageState } from '@/sim/devices/types';

/**
 * The mark drawn over a part that is being over-stressed or has been destroyed.
 *
 * Drawn generically from the part's declared bounds rather than by each part's
 * own art, so a model only has to publish `damage` for the whole catalogue to
 * show it consistently.
 *
 * The reference product draws a red starburst and nothing else, which reads as
 * an explosion but says nothing at a glance about *what* happened. Two states
 * are distinguished here instead: an amber badge for a part still working
 * outside its rating, and a scorch plus a red badge for one that has gone. The
 * badge counter-rotates so it stays upright whichever way the part is turned.
 */
export function DamageMark({
  damage,
  width,
  height,
  originX,
  originY,
  rotation,
  mirrored,
}: {
  damage: DamageState;
  width: number;
  height: number;
  originX: number;
  originY: number;
  rotation: number;
  mirrored: boolean;
}) {
  if (damage === 'ok') return null;
  const broken = damage === 'broken';

  // Top-right of the part's bounding box, nudged inside it.
  const bx = -originX + width - 8;
  const by = -originY + 8;

  return (
    <g pointerEvents="none">
      {broken && (
        <rect
          x={-originX}
          y={-originY}
          width={width}
          height={height}
          rx={3}
          fill="#1A1210"
          opacity={0.42}
        />
      )}
      <g transform={`translate(${bx} ${by}) scale(${mirrored ? -1 : 1},1) rotate(${-rotation})`}>
        <circle
          r={9}
          fill={broken ? '#D93025' : '#F5A623'}
          stroke="#FFFFFF"
          strokeWidth={1.8}
        />
        {broken ? (
          // A break, not an exclamation: this part is not coming back.
          <path
            d="M-3.2,-4.6 L0.6,-1 L-1.4,0.6 L3.2,4.6"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <rect x={-1} y={-5} width={2} height={6.4} rx={1} fill="#FFFFFF" />
            <circle cy={3.6} r={1.3} fill="#FFFFFF" />
          </>
        )}
      </g>
    </g>
  );
}
