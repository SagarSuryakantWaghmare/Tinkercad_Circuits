'use client';

import { useEffect, useState } from 'react';

import { useDesignStore } from '@/state/designStore';
import { IconUsers } from '../icons';

/**
 * Session and autosave status pill. There is no real multi-user backend, so
 * "active users" means the current student's session — an honest signal that
 * the editor is live and their work is being written back to storage.
 */
export function SessionStatus() {
  const updatedAt = useDesignStore((s) => s.design.updatedAt);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const age = Math.max(0, Math.round((now - updatedAt) / 1000));
  const label = mounted ? ageLabel(age) : 'just now';

  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11.5px] text-neutral-600 md:flex"
      title={`You are signed in as a local session. Work autosaves to this browser.\nLast saved ${label}.`}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <IconUsers width={12} height={12} />
        <span className="absolute -right-0.5 -top-0.5 block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
      </span>
      <span className="font-medium text-neutral-700">You</span>
      <span className="mx-0.5 h-3 w-px bg-neutral-300" />
      <span className="text-neutral-500">Saved {label}</span>
    </div>
  );
}

function ageLabel(seconds: number) {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
