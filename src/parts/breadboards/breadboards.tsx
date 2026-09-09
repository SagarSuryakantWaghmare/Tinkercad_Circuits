import { definePart } from '../registry';
import type { PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { Hole, BoardShadow, Silk } from '../primitives';

/**
 * Breadboard geometry.
 *
 * Terminal groups follow the naming observed in the live product: the five
 * holes of a lower column form group `ae<n>`, the upper five form `fj<n>`, and
 * the four distribution strips are `w`, `x`, `y`, `z` — every hole in a strip
 * belongs to one net.
 */

const ROW_Y_LOWER = [55, 45, 35, 25, 15]; // a b c d e  (a is the outer edge)
const ROW_Y_UPPER = [-15, -25, -35, -45, -55]; // f g h i j
const LOWER = ['a', 'b', 'c', 'd', 'e'] as const;
const UPPER = ['f', 'g', 'h', 'i', 'j'] as const;

const RAIL_Y = { topOuter: -85, topInner: -75, botInner: 75, botOuter: 85 };

const colX = (cols: number, c: number) => -((cols - 1) * 10) / 2 + (c - 1) * 10;

/**
 * Rail holes run in fives with a gap after each group, so a 30-column board
 * gives 25 holes per strip (4 strips → the 100 that make a 400-point board up
 * to its rated count alongside the 300 terminal-strip holes).
 */
function railColumns(cols: number): number[] {
  const out: number[] = [];
  for (let c = 1; c <= cols; c++) {
    if ((c - 1) % 6 === 5) continue; // the gap between runs
    out.push(c);
  }
  return out.slice(0, Math.floor(out.length / 5) * 5);
}

function buildTerminals(cols: number, rails: boolean): TerminalDef[] {
  const t: TerminalDef[] = [];

  for (let c = 1; c <= cols; c++) {
    const x = colX(cols, c);
    ROW_Y_UPPER.forEach((y, i) => {
      t.push({
        name: `${UPPER[i]}${c}`,
        type: 'breadboard_female',
        x,
        y,
        dir: [0, 0],
        group: `fj${c}`,
        quiet: true,
      });
    });
    ROW_Y_LOWER.forEach((y, i) => {
      t.push({
        name: `${LOWER[i]}${c}`,
        type: 'breadboard_female',
        x,
        y,
        dir: [0, 0],
        group: `ae${c}`,
        quiet: true,
      });
    });
  }

  if (rails) {
    const rc = railColumns(cols);
    const strips: { g: string; y: number; dir: [number, number]; role: 'power' | 'gnd' }[] = [
      { g: 'w', y: RAIL_Y.topOuter, dir: [0, 0], role: 'power' },
      { g: 'x', y: RAIL_Y.topInner, dir: [0, 0], role: 'gnd' },
      { g: 'y', y: RAIL_Y.botInner, dir: [0, 0], role: 'gnd' },
      { g: 'z', y: RAIL_Y.botOuter, dir: [0, 0], role: 'power' },
    ];
    for (const s of strips) {
      rc.forEach((c, i) => {
        t.push({
          name: `${s.g}${i + 1}`,
          type: 'breadboard_female',
          x: colX(cols, c),
          y: s.y,
          dir: s.dir,
          group: s.g,
          role: s.role,
          quiet: true,
        });
      });
    }
  }

  return t;
}

function BreadboardArt({ cols, rails }: { cols: number; rails: boolean }) {
  const w = (cols - 1) * 10 + 40;
  const h = rails ? 210 : 130;
  const rc = rails ? railColumns(cols) : [];

  return (
    <g>
      <BoardShadow w={w} h={h} rx={3} />
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={3}
        fill={C.bbBody}
        stroke={C.bbBodyEdge}
        strokeWidth={1}
      />

      {/* centre gutter */}
      <rect x={-w / 2 + 4} y={-5} width={w - 8} height={10} rx={1.5} fill="#DADADA" />
      <line
        x1={-w / 2 + 4}
        y1={-5}
        x2={w / 2 - 4}
        y2={-5}
        stroke="#C9C9C9"
        strokeWidth={0.8}
      />
      <line
        x1={-w / 2 + 4}
        y1={5}
        x2={w / 2 - 4}
        y2={5}
        stroke="#C9C9C9"
        strokeWidth={0.8}
      />

      {/* rail guide lines */}
      {rails && (
        <g strokeWidth={1.2}>
          <line x1={-w / 2 + 8} y1={-92} x2={w / 2 - 8} y2={-92} stroke={C.bbRailRed} />
          <line x1={-w / 2 + 8} y1={-68} x2={w / 2 - 8} y2={-68} stroke={C.bbRailBlue} />
          <line x1={-w / 2 + 8} y1={68} x2={w / 2 - 8} y2={68} stroke={C.bbRailBlue} />
          <line x1={-w / 2 + 8} y1={92} x2={w / 2 - 8} y2={92} stroke={C.bbRailRed} />
          {[-w / 2 + 5, w / 2 - 5].map((x) => (
            <g key={x}>
              <Silk x={x} y={-85} size={8} fill={C.bbRailRed}>
                +
              </Silk>
              <Silk x={x} y={-75} size={9} fill={C.bbRailBlue}>
                −
              </Silk>
              <Silk x={x} y={75} size={9} fill={C.bbRailBlue}>
                −
              </Silk>
              <Silk x={x} y={85} size={8} fill={C.bbRailRed}>
                +
              </Silk>
            </g>
          ))}
        </g>
      )}

      {/* terminal-strip holes */}
      {Array.from({ length: cols }, (_, i) => {
        const c = i + 1;
        const x = colX(cols, c);
        return (
          <g key={c}>
            {ROW_Y_UPPER.map((y) => (
              <Hole key={`u${y}`} x={x} y={y} />
            ))}
            {ROW_Y_LOWER.map((y) => (
              <Hole key={`l${y}`} x={x} y={y} />
            ))}
          </g>
        );
      })}

      {/* rail holes */}
      {rc.map((c) => {
        const x = colX(cols, c);
        return (
          <g key={`r${c}`}>
            <Hole x={x} y={RAIL_Y.topOuter} />
            <Hole x={x} y={RAIL_Y.topInner} />
            <Hole x={x} y={RAIL_Y.botInner} />
            <Hole x={x} y={RAIL_Y.botOuter} />
          </g>
        );
      })}

      {/* row letters + column numbers */}
      <g>
        {UPPER.map((r, i) => (
          <Silk key={r} x={-w / 2 + 6} y={ROW_Y_UPPER[i]} size={6} fill={C.bbLabel} weight={500}>
            {r}
          </Silk>
        ))}
        {LOWER.map((r, i) => (
          <Silk key={r} x={-w / 2 + 6} y={ROW_Y_LOWER[i]} size={6} fill={C.bbLabel} weight={500}>
            {r}
          </Silk>
        ))}
        {Array.from({ length: cols }, (_, i) => i + 1)
          .filter((c) => c === 1 || c % 5 === 0)
          .map((c) => (
            <g key={`n${c}`}>
              <Silk x={colX(cols, c)} y={-8.5} size={5.5} fill={C.bbLabel} weight={500}>
                {c}
              </Silk>
              <Silk x={colX(cols, c)} y={8.5} size={5.5} fill={C.bbLabel} weight={500}>
                {c}
              </Silk>
            </g>
          ))}
      </g>
    </g>
  );
}

/**
 * One breadboard, resizable in place.
 *
 * The reference product ships three separate components and puts only the
 * half-size one in its Basic palette, which leaves people believing that is
 * the only board on offer — a conclusion reached first-hand while testing
 * this build. A size property is both fewer entries to hunt through and one
 * fewer reason to delete a board and re-wire everything just to get a bigger
 * one.
 */
export const BREADBOARD_SIZES = {
  mini: { cols: 17, rails: false, label: 'Mini — 17 columns, no power rails' },
  small: { cols: 30, rails: true, label: 'Small — 30 columns, two rail pairs' },
  full: { cols: 63, rails: true, label: 'Full — 63 columns, two rail pairs' },
} as const;

export type BreadboardSize = keyof typeof BREADBOARD_SIZES;

interface BoardProps extends Record<string, string | number> {
  size: BreadboardSize;
}

const specOf = (props: BoardProps) =>
  BREADBOARD_SIZES[props.size as BreadboardSize] ?? BREADBOARD_SIZES.small;

const boxOf = (props: BoardProps) => {
  const { cols, rails } = specOf(props);
  return { w: (cols - 1) * 10 + 40, h: rails ? 210 : 130 };
};

export const Breadboard = definePart<BoardProps>({
  id: 'breadboard',
  name: 'Breadboard',
  category: 'breadboards',
  keywords: ['breadboard', 'protoboard', 'solderless', 'mini', 'small', 'full', 'half'],
  size: boxOf,
  origin: (props) => {
    const { w, h } = boxOf(props);
    return { x: w / 2, y: h / 2 };
  },
  terminals: (props) => {
    const { cols, rails } = specOf(props);
    return buildTerminals(cols, rails);
  },
  props: [
    {
      key: 'size',
      label: 'Size',
      kind: 'select',
      options: (Object.keys(BREADBOARD_SIZES) as BreadboardSize[]).map((k) => ({
        value: k,
        label: BREADBOARD_SIZES[k].label,
      })),
      help: 'Changing size keeps the board in place; anything plugged past the new end comes loose.',
    },
  ],
  defaults: { size: 'small' },
  substrate: true,
  rotationStep: 90,
  Art: ({ props }) => {
    const { cols, rails } = specOf(props);
    return <BreadboardArt cols={cols} rails={rails} />;
  },
});

export const BREADBOARDS = [Breadboard] as unknown as PartDef<never>[];
