'use client';

import Link from 'next/link';

import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { SendToMenu } from './SendToMenu';
import { SessionStatus } from './SessionStatus';
import { IconCode, IconPlay, IconStop } from '../icons';

export function TopBar() {
  const name = useDesignStore((s) => s.design.name);
  const rename = useDesignStore((s) => s.rename);
  const codeOpen = useEditorStore((s) => s.codeOpen);
  const setCodeOpen = useEditorStore((s) => s.setCodeOpen);
  const runState = useSimStore((s) => s.runState);
  const running = runState === 'running' || runState === 'paused';

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-3">
      <Logo />

      <input
        value={name}
        onChange={(e) => rename(e.target.value)}
        aria-label="Design name"
        placeholder="Untitled Design"
        className="w-56 rounded border border-transparent px-2 py-1 text-[14px] font-medium text-neutral-900 outline-none hover:border-neutral-200 focus:border-sky-500 focus:bg-white"
      />

      <div className="ml-auto flex items-center gap-2">
        <SessionStatus />

        <button
          onClick={() => setCodeOpen(!codeOpen)}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition ${
            codeOpen
              ? 'border-sky-500 bg-sky-50 text-sky-700'
              : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <IconCode width={15} height={15} />
          Code
        </button>

        <SendToMenu />

        {/* Simulation button: green Start / red Stop matches the reference
            product and the universal "green = go" convention. */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('circuitlab:toggle-sim'))}
          aria-label={running ? 'Stop simulation' : 'Start simulation'}
          className={`flex h-8 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white shadow-sm transition ${
            running
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {running ? <IconStop width={13} height={13} /> : <IconPlay width={13} height={13} />}
          {running ? 'Stop Simulation' : 'Start Simulation'}
        </button>
      </div>
    </header>
  );
}

function Logo() {
  // A Tinkercad-family mark: a bold rounded square in the reference product's
  // orange, with a simple resistor glyph so the tool it opens is unambiguous.
  return (
    <Link
      href="/"
      className="flex items-center gap-2"
      aria-label="Back to designs"
      title="All designs"
    >
      <svg width="28" height="28" viewBox="0 0 30 30" className="shrink-0">
        <rect width="30" height="30" rx="7" fill="#F04E23" />
        <path
          d="M4.5 15 h4.5 l1.5 -5 l3 10 l3 -10 l3 10 l1.5 -5 h4.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[14px] font-bold tracking-tight text-neutral-900">CircuitLab</span>
    </Link>
  );
}
