'use client';

import Link from 'next/link';

import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { SendToMenu } from './SendToMenu';
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
        className="w-56 rounded border border-transparent px-2 py-1 text-[14px] font-medium text-neutral-900 outline-none hover:border-neutral-200 focus:border-sky-500 focus:bg-white"
      />

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('circuitlab:toggle-sim'))}
          className={`flex h-8 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition ${
            running
              ? 'bg-neutral-800 text-white hover:bg-neutral-900'
              : 'bg-sky-600 text-white hover:bg-sky-700'
          }`}
        >
          {running ? <IconStop width={13} height={13} /> : <IconPlay width={13} height={13} />}
          {running ? 'Stop Simulation' : 'Start Simulation'}
        </button>

        <SendToMenu />

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
      </div>
    </header>
  );
}

function Logo() {
  const cells = ['#E23B3B', '#E3A93B', '#3FBF4F', '#2E8BD6', '#7B3FB5', '#E3C93B'];
  return (
    <Link href="/" className="flex items-center gap-2" title="All designs">
      <svg width="26" height="26" viewBox="0 0 30 30" className="shrink-0">
        <rect width="30" height="30" rx="5" fill="#1F2937" />
        {cells.map((c, i) => (
          <rect
            key={i}
            x={5 + (i % 3) * 7}
            y={6 + Math.floor(i / 3) * 9}
            width="6"
            height="7.5"
            rx="1.2"
            fill={c}
          />
        ))}
      </svg>
      <span className="text-[14px] font-bold tracking-tight text-neutral-900">CircuitLab</span>
    </Link>
  );
}
