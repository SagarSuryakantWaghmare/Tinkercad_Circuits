import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { C } from '@/lib/tokens';
import { Leg, Silk } from '../primitives';

/** Concentric arcs that pulse while the part is sounding. */
function SoundWaves({ level, x, y }: { level: number; x: number; y: number }) {
  if (level < 0.02) return null;
  return (
    <g>
      {[16, 24, 32].map((r, i) => (
        <path
          key={r}
          d={`M${x + r * 0.7},${y - r * 0.7} A${r},${r} 0 0,1 ${x + r * 0.7},${y + r * 0.7}`}
          fill="none"
          stroke={C.select}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={Math.max(0, level - i * 0.22)}
        />
      ))}
    </g>
  );
}

// ─── Piezo buzzer ────────────────────────────────────────────────────────────

export const Piezo = definePart({
  id: 'piezo',
  name: 'Piezo',
  category: 'output',
  keywords: ['buzzer', 'piezo', 'speaker', 'sound', 'tone', 'beep'],
  basic: true,
  size: { w: 72, h: 84 },
  origin: { x: 36, y: 34 },
  socketable: true,
  model: 'piezo',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 40, dir: [0, 1] },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 40, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const level = Number(state?.level ?? 0);
    const freq = Number(state?.frequency ?? 0);
    return (
      <g>
        <Leg x1={-10} y1={22} x2={-10} y2={40} />
        <Leg x1={10} y1={22} x2={10} y2={40} />
        <circle cx={0} cy={0} r={28} fill="#1F2123" stroke="#0E0F10" />
        <circle cx={0} cy={0} r={24} fill="#2A2D30" />
        <circle cx={0} cy={0} r={5} fill="#0C0D0E" />
        <circle cx={0} cy={0} r={2.2} fill="#4A4E52" />
        <Silk x={0} y={15} size={5.5} fill="#8A9096" weight={600}>
          PIEZO
        </Silk>
        <SoundWaves level={level} x={24} y={0} />
        {level > 0.02 && freq > 0 && (
          <Silk x={0} y={-40} size={8} fill="#4A4F55" weight={600}>
            {`${Math.round(freq)} Hz`}
          </Silk>
        )}
      </g>
    );
  },
});

// ─── Speaker ─────────────────────────────────────────────────────────────────

export const Speaker = definePart({
  id: 'speaker',
  name: 'Speaker',
  category: 'output',
  keywords: ['speaker', 'audio', 'sound', 'loudspeaker', '8 ohm'],
  size: { w: 110, h: 118 },
  origin: { x: 55, y: 52 },
  model: 'speaker',
  terminals: [
    { name: 'terminal1', type: 'wire', x: -14, y: 58, dir: [0, 1] },
    { name: 'terminal2', type: 'wire', x: 14, y: 58, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const level = Number(state?.level ?? 0);
    const cone = 1 + level * 0.05;
    return (
      <g>
        <circle cx={0} cy={0} r={48} fill="#3A3D41" stroke="#232629" />
        <circle cx={0} cy={0} r={42} fill="#2B2E31" />
        <g transform={`scale(${cone})`}>
          <circle cx={0} cy={0} r={34} fill="#43474B" />
          <circle cx={0} cy={0} r={26} fill="#4E5257" />
          <circle cx={0} cy={0} r={13} fill="#5A5F64" />
          <circle cx={0} cy={0} r={13} fill="none" stroke="#3A3D41" strokeWidth={1} />
        </g>
        {[0, 90, 180, 270].map((a) => (
          <circle
            key={a}
            cx={Math.cos((a * Math.PI) / 180) * 44}
            cy={Math.sin((a * Math.PI) / 180) * 44}
            r={3}
            fill="#1E2124"
          />
        ))}
        <Leg x1={-14} y1={44} x2={-14} y2={58} w={3} color="#C11F1F" />
        <Leg x1={14} y1={44} x2={14} y2={58} w={3} color="#171919" />
        <SoundWaves level={level} x={44} y={0} />
      </g>
    );
  },
});

export const SOUND: PartDef<never>[] = [Piezo, Speaker] as unknown as PartDef<never>[];
