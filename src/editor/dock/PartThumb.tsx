'use client';

import { memo } from 'react';
import type { PartDef } from '@/parts/types';

/**
 * Panel thumbnail. Renders the part's real art inside a fitted viewBox so the
 * card and the canvas always agree — no separate icon set to keep in sync.
 */
function PartThumbInner({ def, box = 62 }: { def: PartDef<never>; box?: number }) {
  if (def.Thumb) {
    const T = def.Thumb;
    return <T />;
  }
  const { size, origin } = def;
  const pad = 6;
  const vb = `${-origin.x - pad} ${-origin.y - pad} ${size.w + pad * 2} ${size.h + pad * 2}`;
  const Art = def.Art;
  return (
    <svg width={box} height={box} viewBox={vb} preserveAspectRatio="xMidYMid meet">
      <Art
        props={def.defaults as never}
        state={null}
        selected={false}
        simulating={false}
      />
    </svg>
  );
}

export const PartThumb = memo(PartThumbInner);
