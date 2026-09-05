'use client';

import { memo, useState } from 'react';
import type { Note } from '@/state/design';
import { C } from '@/lib/tokens';

/**
 * Canvas annotation. Notes are foreignObject-hosted so the text wraps and can
 * be edited in place, and they tether to a leader line pointing at whatever
 * they describe — which is what keeps them useful once a design gets busy.
 */
function NoteItemInner({
  note,
  selected,
  onChange,
  onPointerDown,
  onDelete,
}: {
  note: Note;
  selected: boolean;
  onChange: (text: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(!note.text);

  const W = 180;
  const H = 92;

  return (
    <g transform={`translate(${note.x},${note.y})`} data-note={note.id}>
      <path
        d={`M0,0 L${-18},${-14}`}
        stroke={C.warn}
        strokeWidth={1.6}
        strokeDasharray="4 3"
        fill="none"
      />
      <circle cx={0} cy={0} r={3.5} fill={C.warn} />
      <g transform={`translate(${-W - 18},${-14 - H})`}>
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          rx={5}
          fill="#FFF8E1"
          stroke={selected ? C.select : '#E8D9A8'}
          strokeWidth={selected ? 2 : 1.2}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => onPointerDown(e, note.id)}
        />
        <foreignObject x={8} y={7} width={W - 16} height={H - 14}>
          {editing ? (
            <textarea
              autoFocus
              defaultValue={note.text}
              onBlur={(e) => {
                onChange(e.target.value);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                e.stopPropagation();
              }}
              className="h-full w-full resize-none border-0 bg-transparent p-0 text-[11px] leading-snug text-neutral-800 outline-none"
              placeholder="Write a note…"
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              className="h-full w-full overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-snug text-neutral-800"
              style={{ cursor: 'text' }}
            >
              {note.text || 'Double-click to edit'}
            </div>
          )}
        </foreignObject>
        {selected && (
          <g
            transform={`translate(${W - 16},8)`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
          >
            <circle cx={0} cy={0} r={7} fill="#F1E3B8" />
            <path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="#8A6B1F" strokeWidth={1.6} />
          </g>
        )}
      </g>
    </g>
  );
}

export const NoteItem = memo(NoteItemInner);
