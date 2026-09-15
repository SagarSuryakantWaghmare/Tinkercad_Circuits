'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import type { CodeLanguage, CodeMode } from '@/state/design';
import { TextEditor } from './TextEditor';
import { SerialMonitor, SerialPlotter } from './SerialMonitor';
import { LibraryManager } from './LibraryManager';
import dynamic from 'next/dynamic';

/**
 * Blockly reaches for a DOM at module scope (and drags jsdom in when it cannot
 * find one), so it must never be evaluated during the static prerender.
 */
const BlocklyHost = dynamic(
  () => import('@/code/blockly/BlocklyHost').then((m) => m.BlocklyHost),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-neutral-50 text-[12px] text-neutral-400">
        Loading blocks…
      </div>
    ),
  },
);
import {
  IconChevronDown,
  IconMaximise,
  IconMinimise,
  IconPlay,
  IconStepOver,
  IconTerminalWindow,
  IconWarning,
} from '../icons';

type Tab = 'serial' | 'plotter' | 'errors' | 'vars';

export function CodePanel({
  onSendSerial,
  onSetBreakpoints,
  onResume,
  onStepOver,
}: {
  onSendSerial: (text: string) => void;
  onSetBreakpoints: (lines: number[]) => void;
  onResume: () => void;
  onStepOver: () => void;
}) {
  const open = useEditorStore((s) => s.codeOpen);
  const setOpen = useEditorStore((s) => s.setCodeOpen);
  const code = useDesignStore((s) => s.design.code);
  const transact = useDesignStore((s) => s.transact);
  const errors = useSimStore((s) => s.errors);
  const snapshot = useSimStore((s) => s.snapshot);
  const running = useSimStore((s) => s.runState === 'running');

  // Which languages the design can be programmed in, from the boards present.
  const parts = useDesignStore((s) => s.design.parts);
  const boards = useMemo(() => {
    const found = new Set<CodeLanguage>();
    for (const id in parts) {
      const t = parts[id].type;
      if (t === 'microbit') found.add('micropython');
      if (t === 'uno-r3' || t === 'nano' || t === 'attiny85') found.add('arduino');
    }
    return [...found];
  }, [parts]);

  // Follow the board on the canvas, but never fight a deliberate choice when
  // both kinds are present.
  useEffect(() => {
    if (boards.length !== 1) return;
    if (code.language === boards[0]) return;
    transact('Code language', (d) => void (d.code.language = boards[0]));
  }, [boards, code.language, transact]);

  const language = code.language;
  const isPython = language === 'micropython';

  const [tab, setTab] = useState<Tab>('serial');
  const [drawer, setDrawer] = useState(true);
  const [libsOpen, setLibsOpen] = useState(false);
  const [height, setHeight] = useState(340);
  const [maximised, setMaximised] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const setMode = (mode: CodeMode) => {
    if (mode === 'text' && code.mode !== 'text' && !code.blocksAbandoned) {
      const ok = window.confirm(
        `Switching to a text-only view converts your blocks to ${
          isPython ? 'Python' : 'C++'
        }.\n\n` +
          'This cannot be undone — going back to Blocks will discard the code you write. ' +
          'Duplicate the design first if you want to keep the blocks.',
      );
      if (!ok) return;
      transact('Convert to text', (d) => {
        d.code.mode = 'text';
        d.code.blocksAbandoned = true;
      });
      return;
    }
    transact('Code view', (d) => void (d.code.mode = mode));
  };

  const mcuPaused = Object.values(snapshot.parts).find((p) => p.paused);
  const pausedLine = mcuPaused ? Number(mcuPaused.line) : null;
  // Each entry arrives as "name\0value" so a value containing an equals sign
  // or a comma still splits cleanly.
  const scopeRows = ((mcuPaused?.pausedScope as string[] | undefined) ?? []).map((row) => {
    const i = row.indexOf('\u0000');
    return { name: row.slice(0, i), value: row.slice(i + 1) };
  });
  const source = isPython ? code.python : code.text;
  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be refused; the download button still works.
    }
  };

  return (
    <section
      className="relative flex shrink-0 flex-col border-t border-neutral-200 bg-white"
      style={maximised ? { flex: '1 1 auto', height: 'auto' } : { height }}
    >
      {/* drag handle — inert while maximised, where there is nothing to drag */}
      <div
        className={`absolute -top-1 left-0 right-0 z-10 h-2 ${
          maximised ? 'pointer-events-none' : 'cursor-ns-resize'
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = height;
          const move = (ev: PointerEvent) =>
            setHeight(Math.max(160, Math.min(720, startH + (startY - ev.clientY))));
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      />

      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-200 px-2">
        <div className="relative">
          <select
            value={code.mode}
            onChange={(e) => setMode(e.target.value as CodeMode)}
            className="appearance-none rounded-md border border-neutral-300 bg-white py-1 pl-2.5 pr-7 text-[12px] font-medium text-neutral-700 outline-none hover:border-neutral-400"
          >
            <option value="blocks">Blocks</option>
            <option value="blocks+text">Blocks + Text</option>
            <option value="text">Text</option>
          </select>
          <IconChevronDown
            width={13}
            height={13}
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500"
          />
        </div>

        {boards.length > 1 && (
          <select
            value={language}
            onChange={(e) =>
              transact('Code language', (d) => {
                d.code.language = e.target.value as CodeLanguage;
              })
            }
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] font-medium text-neutral-700 outline-none hover:border-neutral-400"
            title="This design has more than one programmable board"
          >
            <option value="arduino">Uno &middot; C++</option>
            <option value="micropython">micro:bit &middot; Python</option>
          </select>
        )}

        {!isPython && (
          <button
            onClick={() => setLibsOpen(true)}
            title="Libraries"
            className="rounded border border-neutral-300 px-2 py-1 text-[11.5px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Libraries
          </button>
        )}

        {pausedLine !== null && (
          <div className="flex items-center gap-1">
            <button
              onClick={onResume}
              title="Run on until the next breakpoint"
              className="flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-amber-600"
            >
              <IconPlay width={11} height={11} />
              Continue
            </button>
            <button
              onClick={onStepOver}
              title="Run the next statement, then stop again"
              className="flex items-center gap-1 rounded border border-amber-500 px-2 py-1 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-50"
            >
              <IconStepOver width={12} height={12} />
              Step
            </button>
            <span className="text-[11.5px] font-medium text-amber-700">line {pausedLine}</span>
          </div>
        )}

        {code.breakpoints.length > 0 && (
          <button
            onClick={() => {
              transact('Clear breakpoints', (d) => void (d.code.breakpoints = []));
              onSetBreakpoints([]);
            }}
            title="Remove every breakpoint"
            className="rounded border border-neutral-300 px-2 py-1 text-[11.5px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Clear {code.breakpoints.length} breakpoint{code.breakpoints.length === 1 ? '' : 's'}
          </button>
        )}

        {errors.length > 0 && (
          <button
            onClick={() => {
              setTab('errors');
              setDrawer(true);
            }}
            className="flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-[11.5px] font-medium text-red-700 hover:bg-red-100"
          >
            <IconWarning width={13} height={13} />
            {errors.length} problem{errors.length === 1 ? '' : 's'}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={copySource}
            title="Copy the generated code to the clipboard"
            className="rounded border border-neutral-300 px-2 py-1 text-[11.5px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button
            onClick={() =>
              isPython
                ? downloadCode(code.python, 'main.py')
                : downloadCode(code.text, 'sketch.ino')
            }
            className="rounded border border-neutral-300 px-2 py-1 text-[11.5px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {isPython ? 'Download .py' : 'Download .ino'}
          </button>
          <button
            onClick={() => setDrawer(!drawer)}
            title={drawer ? 'Hide serial' : 'Show serial'}
            className={`rounded p-1.5 transition ${
              drawer ? 'bg-sky-50 text-sky-700' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <IconTerminalWindow width={15} height={15} />
          </button>
          <button
            onClick={() => setMaximised(!maximised)}
            title={maximised ? 'Restore panel height' : 'Fill the window'}
            className={`rounded p-1.5 transition ${
              maximised ? 'bg-sky-50 text-sky-700' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            {maximised ? (
              <IconMinimise width={15} height={15} />
            ) : (
              <IconMaximise width={15} height={15} />
            )}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 border-r border-neutral-200">
          {code.mode === 'blocks' ? (
            <Blocks language={language} />
          ) : code.mode === 'blocks+text' ? (
            <div className="flex h-full">
              <div className="min-w-0 flex-1 border-r border-neutral-200">
                <Blocks language={language} />
              </div>
              <div className="min-w-0 flex-1">
                <TextEditor
                  value={isPython ? code.python : code.text}
                  language={language}
                  onChange={() => {}}
                  readOnly
                />
              </div>
            </div>
          ) : (
            <TextEditor
              value={isPython ? code.python : code.text}
              language={language}
              onChange={(v) =>
                transact('Edit code', (d) => {
                  if (isPython) d.code.python = v;
                  else d.code.text = v;
                })
              }
              onBreakpointsChange={(lines) => {
                transact('Breakpoints', (d) => void (d.code.breakpoints = lines));
                onSetBreakpoints(lines);
              }}
              pausedLine={pausedLine}
            />
          )}
        </div>

        {drawer && (
          <div className="flex w-[46%] min-w-[280px] flex-col">
            <nav className="flex shrink-0 border-b border-neutral-200">
              {(['serial', 'plotter', 'vars', 'errors'] as Tab[]).map((tk) => (
                <button
                  key={tk}
                  onClick={() => setTab(tk)}
                  className={`px-3 py-1.5 text-[11.5px] font-medium capitalize transition ${
                    tab === tk
                      ? 'border-b-2 border-sky-600 text-sky-700'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {tk === 'serial'
                    ? 'Serial Monitor'
                    : tk === 'plotter'
                      ? 'Plotter'
                      : tk === 'vars'
                        ? 'Variables'
                        : 'Problems'}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1">
              {tab === 'serial' && <SerialMonitor onSend={onSendSerial} />}
              {tab === 'plotter' && <SerialPlotter />}
              {tab === 'vars' && <VariableInspector rows={scopeRows} paused={pausedLine !== null} />}
              {tab === 'errors' && <ErrorConsole />}
            </div>
          </div>
        )}
      </div>

      {libsOpen && <LibraryManager onClose={() => setLibsOpen(false)} />}
      {running && code.mode !== 'text' && (
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-neutral-400">
          {isPython ? 'micro:bit · MicroPython' : 'Uno · Arduino C++'} — edits apply
          immediately.
        </p>
      )}
    </section>
  );
}

/**
 * Variable inspector.
 *
 * Stopping on a breakpoint is only half a debugger; the point of stopping is to
 * see what the sketch believes. The interpreter snapshots the whole scope chain
 * at the pause, innermost binding winning, and this lists it.
 */
function VariableInspector({
  rows,
  paused,
}: {
  rows: { name: string; value: string }[];
  paused: boolean;
}) {
  if (!paused) {
    return (
      <div className="h-full overflow-auto bg-white px-3 py-2">
        <p className="text-[12px] text-neutral-400">
          Click a line number in the code to set a breakpoint. Variables appear here when the
          sketch stops on one.
        </p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="h-full overflow-auto bg-white px-3 py-2">
        <p className="text-[12px] text-neutral-400">Nothing in scope at this line.</p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto bg-white">
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-neutral-100 last:border-0">
              <td className="w-2/5 truncate px-3 py-1 font-mono text-neutral-600">{r.name}</td>
              <td className="px-3 py-1 font-mono text-neutral-900">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorConsole() {
  const errors = useSimStore((s) => s.errors);
  return (
    <div className="h-full overflow-auto bg-white px-3 py-2">
      {errors.length === 0 ? (
        <p className="text-[12px] text-neutral-400">No problems. Your sketch compiles.</p>
      ) : (
        <ul className="space-y-1.5">
          {errors.map((e, i) => (
            <li key={i} className="flex gap-2 text-[12px]">
              <IconWarning width={14} height={14} className="mt-0.5 shrink-0 text-red-500" />
              <span>
                {e.line !== undefined && (
                  <span className="mr-1.5 font-mono text-neutral-500">line {e.line}</span>
                )}
                <span className="text-neutral-800">{e.message}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Blocks view. Every structural edit regenerates the sketch, so the text view
 * and the running simulation always reflect the blocks without an explicit
 * compile step — which is what makes Blocks + Text useful for learning.
 */
function Blocks({ language }: { language: CodeLanguage }) {
  const arduinoXml = useDesignStore((s) => s.design.code.blocksXml);
  const microbitXml = useDesignStore((s) => s.design.code.microbitBlocksXml);
  const transact = useDesignStore((s) => s.transact);
  const micro = language === 'micropython';
  return (
    <BlocklyHost
      key={language}
      language={language}
      xml={micro ? microbitXml : arduinoXml}
      onChange={({ xml, code }) =>
        transact('Edit blocks', (d) => {
          if (micro) {
            d.code.microbitBlocksXml = xml;
            d.code.python = code;
          } else {
            d.code.blocksXml = xml;
            d.code.text = code;
          }
        })
      }
    />
  );
}

function downloadCode(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
