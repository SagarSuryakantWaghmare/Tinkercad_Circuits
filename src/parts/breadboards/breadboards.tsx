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

      {/*
        Row letters down both edges, as they are printed on a real board, so
        a hole can be read off from whichever side is nearer.
      */}
      <g>
        {[-w / 2 + 6, w / 2 - 6].map((lx) => (
          <g key={lx}>
            {UPPER.map((r, i) => (
              <Silk key={r} x={lx} y={ROW_Y_UPPER[i]} size={6} fill={C.bbLabel} weight={500}>
                {r}
              </Silk>
            ))}
            {LOWER.map((r, i) => (
              <Silk key={r} x={lx} y={ROW_Y_LOWER[i]} size={6} fill={C.bbLabel} weight={500}>
                {r}
              </Silk>
            ))}
          </g>
        ))}
        {/*
          Column numbers sit in the centre channel. Printed either side of it
          they cleared the row e/f holes by 0.15 units — close enough to read
          as though the digits were touching the holes at any useful zoom —
          and the channel is empty anyway, so one centred run is both legible
          and half the clutter.
        */}
        {Array.from({ length: cols }, (_, i) => i + 1)
          .filter((c) => c === 1 || c % 5 === 0)
          .map((c) => (
            <Silk key={`n${c}`} x={colX(cols, c)} y={0} size={5.5} fill={C.bbLabel} weight={500}>
              {c}
            </Silk>
          ))}
      </g>
    </g>
  );
}

function makeBreadboard(
  id: string,
  name: string,
  cols: number,
  rails: boolean,
  basic = false,
): PartDef<Record<string, never>> {
  const w = (cols - 1) * 10 + 40;
  const h = rails ? 210 : 130;
  return definePart({
    id,
    name,
    category: 'breadboards',
    keywords: ['breadboard', 'protoboard', 'solderless', String(cols)],
    basic,
    size: { w, h },
    origin: { x: w / 2, y: h / 2 },
    terminals: buildTerminals(cols, rails),
    props: [],
    defaults: {},
    substrate: true,
    rotationStep: 90,
    Art: () => <BreadboardArt cols={cols} rails={rails} />,
  });
}

export const BreadboardMini = makeBreadboard('breadboard-mini', 'Breadboard Mini', 17, false);
export const BreadboardSmall = makeBreadboard(
  'breadboard-small',
  'Breadboard Small',
  30,
  true,
  true,
);
export const BreadboardFull = makeBreadboard('breadboard', 'Breadboard', 63, true);

export const BREADBOARDS = [BreadboardMini, BreadboardSmall, BreadboardFull];
