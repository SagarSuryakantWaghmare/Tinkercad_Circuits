'use client';

import { memo, useMemo } from 'react';
import { getPartDef } from '@/parts/registry';
import { terminalsOf, type PropValue } from '@/parts/types';
import { BlockSymbol, SCHEMATIC_SYMBOLS } from '@/parts/schematic';
import type { PartInstance } from '@/state/design';
import type { ComponentView } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { C } from '@/lib/tokens';

interface Props {
  inst: PartInstance;
  selected: boolean;
  hovered: boolean;
  simulating: boolean;
  view: ComponentView;
  onPointerDown: (e: React.PointerEvent, partId: string) => void;
  onPointerEnter: (partId: string) => void;
  onPointerLeave: () => void;
  onInteract: (partId: string, event: string, value?: number | boolean | Record<string, unknown>) => void;
  onSetProp: (partId: string, key: string, value: PropValue) => void;
}

function PlacedPartInner({
  inst,
  selected,
  hovered,
  simulating,
  view,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onInteract,
  onSetProp,
}: Props) {
  const def = getPartDef(inst.type);
  // Subscribe narrowly: only this instance's slice of the sim snapshot.
  const state = useSimStore((s) =>
    simulating ? s.snapshot.parts[inst.id] ?? null : null,
  );

  // Hooks must run before the early return, so resolve the symbol first.
  const schematic = useMemo(() => {
    if (view !== 'schematic' || !def) return null;
    const known = SCHEMATIC_SYMBOLS[def.id];
    if (known) return { Symbol: known, pins: null };
    // No conventional symbol for this part: fall back to a labelled block
    // derived from its pin layout.
    const pins = terminalsOf(def, inst.props as never)
      .filter((t) => !t.quiet)
      .slice(0, 24);
    return { Symbol: null, pins };
  }, [view, def, inst.props]);

  if (!def) return null;

  const { size, origin } = def;
  const Art = schematic?.Symbol ?? def.Art;
  const transform = `translate(${inst.x},${inst.y}) rotate(${inst.rotation}) scale(${
    inst.mirrored ? -1 : 1
  },1)`;

  return (
    <g
      data-part={inst.id}
      transform={transform}
      onPointerDown={(e) => onPointerDown(e, inst.id)}
      onPointerEnter={() => onPointerEnter(inst.id)}
      onPointerLeave={onPointerLeave}
      style={{ cursor: inst.locked ? 'default' : 'move' }}
    >
      {/*
        Transparent hit area sized to the declared bbox. Matches the product's
        `hitarea` element and keeps pointer cost off the art geometry.
      */}
      <rect
        className="hitarea"
        x={-origin.x}
        y={-origin.y}
        width={size.w}
        height={size.h}
        fill="transparent"
      />
      {hovered && !selected && (
        <rect
          x={-origin.x - 2}
          y={-origin.y - 2}
          width={size.w + 4}
          height={size.h + 4}
          rx={2}
          fill="none"
          stroke={C.hover}
          strokeWidth={1.5}
          opacity={0.55}
          pointerEvents="none"
        />
      )}
      {/*
        Wires view fades the component art so the routing reads clearly; the
        parts stay in place so nothing shifts when the view changes.
      */}
      <g opacity={view === 'wires' ? 0.24 : 1}>
        {schematic?.pins ? (
          <BlockSymbol name={def.name} terminals={schematic.pins} />
        ) : (
          <Art
            props={inst.props as never}
            state={state}
            selected={selected}
            simulating={simulating}
            interact={(event, value) => onInteract(inst.id, event, value)}
            setProp={(key, value) => onSetProp(inst.id, key, value)}
          />
        )}
      </g>

      {/*
        A renamed component says so on the canvas. The label counter-rotates so
        it stays upright however the part is turned — a sideways caption is
        worse than none.
      */}
      {inst.name && (
        <g transform={`scale(${inst.mirrored ? -1 : 1},1) rotate(${-inst.rotation})`}>
          <text
            x={0}
            y={origin.y + 12}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={selected ? C.select : '#6B7378'}
            pointerEvents="none"
            style={{ paintOrder: 'stroke', stroke: C.canvasBg, strokeWidth: 3 }}
          >
            {inst.name}
          </text>
        </g>
      )}
    </g>
  );
}

export const PlacedPart = memo(PlacedPartInner);
