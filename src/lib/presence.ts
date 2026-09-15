'use client';

import { useEffect, useState } from 'react';

/**
 * Best-effort "who is here right now" indicator.
 *
 * There is no server in this build, so a real cross-machine active-user
 * count is not on the table. What we can do is show every open tab of
 * CircuitLab on this machine: each tab writes a heartbeat to localStorage
 * under a unique key, cleans it up on unload, and expires stale keys.
 *
 * A BroadcastChannel wakes every listener as soon as a peer heartbeats,
 * so the number goes up the instant another tab opens without waiting
 * for the next poll.
 */

const STORAGE_PREFIX = 'circuitlab:presence:';
const HEARTBEAT_MS = 4000;
const TIMEOUT_MS = 12_000;

function selfKey(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

function countLiveTabs(): number {
  if (typeof window === 'undefined') return 1;
  const now = Date.now();
  let live = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(STORAGE_PREFIX)) continue;
    const raw = localStorage.getItem(k);
    const ts = raw ? Number(raw) : 0;
    if (ts && now - ts < TIMEOUT_MS) live++;
    else localStorage.removeItem(k);
  }
  return Math.max(1, live);
}

export function useActiveUsers(): number {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const key = selfKey(id);
    localStorage.setItem(key, String(Date.now()));

    const bc =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('circuitlab-presence')
        : null;

    const refresh = () => setCount(countLiveTabs());

    const beat = () => {
      localStorage.setItem(key, String(Date.now()));
      bc?.postMessage('beat');
      refresh();
    };

    const timer = window.setInterval(beat, HEARTBEAT_MS);
    const storage = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_PREFIX)) refresh();
    };
    window.addEventListener('storage', storage);
    const message = () => refresh();
    bc?.addEventListener('message', message);

    const bye = () => {
      localStorage.removeItem(key);
      bc?.postMessage('bye');
    };
    window.addEventListener('pagehide', bye);
    window.addEventListener('beforeunload', bye);

    beat();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', bye);
      window.removeEventListener('beforeunload', bye);
      bc?.removeEventListener('message', message);
      bc?.close();
      bye();
    };
  }, []);

  return count;
}
