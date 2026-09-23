'use client';

import { memo, useEffect, useRef, useState } from 'react';
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
  onResize,
  onDelete,
}: {
  note: Note;
  selected: boolean;
  onChange: (text: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResize?: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(note.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEditing = () => {
    setDraftText(note.text);
    setEditing(true);
  };

  // Focus and drop the caret at the end when the editor opens. Doing this via
  // useEffect (rather than an inline ref callback) means the selection is not
  // rewritten on every keystroke while the user is editing.
  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const onBodyPointerDown = (e: React.PointerEvent<Element>) => {
    if (e.detail === 2) {
      // The second click of a double-click; enter edit mode before the drag
      // handler on the outer rect takes over.
      e.stopPropagation();
      startEditing();
      return;
    }
    onPointerDown(e, note.id);
  };

  const W = note.width ?? 180;
  const H = note.height ?? 92;

  return (
    <g transform={`translate(${note.x},${note.y})`} data-note={note.id}>
      <path
        d={`M0,0 L${-18},${-14}`}
        stroke={C.warn}
        strokeWidth={1.6}
        strokeDasharray="4 3"
        fill="none"
      />
      <circle
        cx={0}
        cy={0}
        r={3.5}
        fill={C.warn}
        style={{ cursor: 'pointer' }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
      />
      <g
        transform={`translate(${-W - 18},${-14 - H})`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
      >
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
          onPointerDown={onBodyPointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
        />
        <foreignObject x={8} y={7} width={Math.max(20, W - 16)} height={Math.max(20, H - 14)}>
          {editing ? (
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={() => {
                onChange(draftText);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setDraftText(note.text);
                  setEditing(false);
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.stopPropagation();
                  onChange(draftText);
                  setEditing(false);
                }
                e.stopPropagation();
              }}
              className="h-full w-full resize-none border-0 bg-transparent p-0 text-[11px] leading-snug text-neutral-800 outline-none"
              placeholder="Write a note…"
            />
          ) : (
            <div
              onPointerDown={onBodyPointerDown}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
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
        {selected && onResize && (
          <g
            transform={`translate(${W - 10},${H - 10})`}
            style={{ cursor: 'nwse-resize' }}
            onPointerDown={(e) => onResize(e, note.id)}
          >
            <rect x={-4} y={-4} width={14} height={14} fill="transparent" />
            <path
              d="M8,0 L0,8 M8,4 L4,8 M8,8 L8,8"
              stroke="#B3A270"
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </g>
        )}
      </g>
    </g>
  );
}

export const NoteItem = memo(NoteItemInner);
