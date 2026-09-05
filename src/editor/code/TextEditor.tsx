'use client';

import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  gutter,
  GutterMarker,
  Decoration,
  type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags as t } from '@lezer/highlight';
import { ARDUINO_COMPLETIONS, MICROPYTHON_COMPLETIONS } from './completions';

/** Light syntax theme matched to the editor chrome. */
const highlight = HighlightStyle.define([
  { tag: t.keyword, color: '#0f766e', fontWeight: '600' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#1f2937' },
  { tag: [t.function(t.variableName), t.labelName], color: '#1d4ed8' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#9333ea' },
  { tag: [t.definition(t.name), t.separator], color: '#1f2937' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#b45309' },
  { tag: [t.operator, t.operatorKeyword], color: '#6b7280' },
  { tag: [t.string, t.processingInstruction, t.inserted, t.special(t.string)], color: '#b91c1c' },
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.invalid, color: '#dc2626' },
]);

const theme = EditorView.theme({
  '&': { fontSize: '12.5px', height: '100%', backgroundColor: '#ffffff' },
  '.cm-scroller': {
    fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: '1.65',
  },
  '.cm-content': { padding: '8px 0' },
  '.cm-gutters': { backgroundColor: '#fafafa', borderRight: '1px solid #eceef1', color: '#a3a9b3' },
  '.cm-activeLine': { backgroundColor: '#f5f8fb' },
  '.cm-activeLineGutter': { backgroundColor: '#f0f4f8' },
  '.cm-breakpoint-gutter': { width: '14px', cursor: 'pointer' },
  '&.cm-focused': { outline: 'none' },
});

// ── breakpoint gutter ────────────────────────────────────────────────────────

const toggleBreakpoint = StateEffect.define<number>();
const setBreakpoints = StateEffect.define<number[]>();

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.style.cssText =
      'display:inline-block;width:9px;height:9px;border-radius:50%;background:#dc2626;margin-left:2px';
    return el;
  }
}
const breakpointMarker = new BreakpointMarker();

/** Highlight for the line the sketch is paused on. */
const setPausedLine = StateEffect.define<number | null>();
const pausedLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (!e.is(setPausedLine)) continue;
      if (e.value === null) return Decoration.none;
      const line = tr.state.doc.line(Math.min(Math.max(1, e.value), tr.state.doc.lines));
      return Decoration.set([
        Decoration.line({ attributes: { style: 'background:#fef3c7' } }).range(line.from),
      ]);
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function breakpointExtension(onChange: (lines: number[]) => void): Extension {
  const field = StateField.define<Set<number>>({
    create: () => new Set(),
    update(set, tr) {
      let next = set;
      for (const e of tr.effects) {
        if (e.is(toggleBreakpoint)) {
          next = new Set(next);
          if (next.has(e.value)) next.delete(e.value);
          else next.add(e.value);
        }
        if (e.is(setBreakpoints)) next = new Set(e.value);
      }
      return next;
    },
  });

  return [
    field,
    gutter({
      class: 'cm-breakpoint-gutter',
      lineMarker: (view, line) => {
        const ln = view.state.doc.lineAt(line.from).number;
        return view.state.field(field).has(ln) ? breakpointMarker : null;
      },
      initialSpacer: () => breakpointMarker,
      domEventHandlers: {
        mousedown(view, line) {
          const ln = view.state.doc.lineAt(line.from).number;
          view.dispatch({ effects: toggleBreakpoint.of(ln) });
          onChange([...view.state.field(field)].sort((a, b) => a - b));
          return true;
        },
      },
    }),
  ];
}

export interface TextEditorProps {
  value: string;
  onChange: (v: string) => void;
  onBreakpointsChange?: (lines: number[]) => void;
  pausedLine?: number | null;
  readOnly?: boolean;
  /** Chooses the grammar, the completions and the indent unit. */
  language?: 'arduino' | 'micropython';
}

export function TextEditor({
  value,
  onChange,
  onBreakpointsChange,
  pausedLine = null,
  readOnly = false,
  language = 'arduino',
}: TextEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  // Keep the latest callback reachable from the long-lived editor instance
  // without tearing it down on every render.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        autocompletion({
          override: [language === 'micropython' ? MICROPYTHON_COMPLETIONS : ARDUINO_COMPLETIONS],
        }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        language === 'micropython' ? python() : cpp(),
        syntaxHighlighting(highlight),
        theme,
        pausedLineField,
        breakpointExtension((lines) => onBreakpointsChange?.(lines)),
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: host.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor owns its document after mount; `value` is only the seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, language]);

  // Accept external document replacement (loading a design, generated code).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setPausedLine.of(pausedLine) });
  }, [pausedLine]);

  return <div ref={host} className="h-full w-full overflow-hidden" />;
}
